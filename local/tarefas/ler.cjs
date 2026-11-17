'use strict';
/**
 * Leitura das tarefas que estão em arquivo no PC, no formato único que vai pra planilha e pro site.
 *
 * Duas fontes de texto:
 * - a lista mestra (Markdown com "## projeto" e linhas "- [ ] ..."), lida por lerLista;
 * - a tabela com código de um projeto ("| DIN-1 | O quê | Quem | Situação | Próximo passo |", na seção
 *   "## Tudo o que está aberto" do TAREFAS.md dele), lida por lerTabela.
 *
 * Cada tarefa sai com um id estável, porque é por ele que uma marcação feita no celular volta pra linha certa:
 * - na tabela, o próprio código ("fin-DIN-1"), que não muda quando o texto muda;
 * - na lista, que não tem código, um resumo do nome do projeto + o começo do texto. As marcas que mudam com o tempo
 *   (⏱️, ▶️, ✅, o "Falta:") ficam de fora, então a tarefa mantém o id enquanto anda. Se o começo do texto for
 *   reescrito, o id muda e a marcação que estava a caminho é avisada como "não achei" (nada é marcado no chute).
 *
 * As datas da lista vêm sem ano ("▶️ 07/11"): vale o ano de hoje, ou o anterior se a data cairia mais de 60 dias
 * no futuro (em janeiro, "▶️ 20/12" é dezembro passado).
 *
 * Nível de prioridade (desde 12/11): "🎯1" a "🎯5" em qualquer lugar da linha (na lista, logo depois de quem faz; na
 * tabela, na coluna Situação) põe a tarefa naquele nível. Ele sai do texto antes do id, então trocar o nível não muda
 * o id. Os nomes dos níveis vêm da seção "## 🎯 Prioridades" da lista mestra (lerNiveis); a aba Tarefas mostra tudo na
 * visão Níveis. Tarefa sem 🎯 fica fora dela.
 *
 * Área (desde 16/11): a linha "Começou: ... · Status: ... · Área: 💼 Carreira, 💰 Dinheiro" logo abaixo do título do
 * projeto. Toda tarefa do projeto leva a área no campo "area" (o texto inteiro, com as duas quando tem duas); a primeira
 * é a principal, a coluna onde o projeto fica no Quadro da aba Tarefas. Projeto sem a linha (as Rápidas) sai sem área.
 * A tabela de um projeto pega a área da seção que ela substitui na lista (lerAreas).
 */
const crypto = require('node:crypto');

const DIA = 864e5;

/** O dia de trabalho: vai até as 5h (à 1h de 13/10 ainda é 12/10). */
function diaDeTrabalho(agora = new Date()) {
  const d = new Date(agora.getTime() - 5 * 3600e3);
  d.setHours(0, 0, 0, 0);
  return d;
}

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ddmm = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** dd/mm sem ano → 'aaaa-mm-dd', pela regra dos 60 dias. */
function dataSemAno(dia, mes, hoje) {
  let d = new Date(hoje.getFullYear(), mes - 1, dia);
  if (d - hoje > 60 * DIA) d = new Date(hoje.getFullYear() - 1, mes - 1, dia);
  return iso(d);
}

// "Começou: 11/10/2026 · Status: andando · Área: 🗂️ Organização" → '🗂️ Organização'
const RE_AREA = /^Começou:.*·\s*Área:\s*(.+?)\s*$/u;

/** Tira o emoji e o número do título da seção: "💼 4. GitHub e LinkedIn" → { emoji: '💼', nome: 'GitHub e LinkedIn' }. */
function tituloDaSecao(titulo) {
  const i = titulo.indexOf(' ');
  const emoji = i > 0 ? titulo.slice(0, i) : '';
  let nome = (i > 0 ? titulo.slice(i + 1) : titulo).replace(/^\d+\.\s*/, '').trim();
  if (nome.startsWith('Rápidas')) nome = 'Rápidas';
  return { emoji, nome };
}

/** A parte do texto que identifica a tarefa: sem quem faz, sem marcas, sem negrito, sem acento, até 60 letras. */
function chave(texto) {
  return norm(texto)
    .replace(/[*`~_]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .slice(0, 60);
}

function idDaLista(projeto, texto) {
  return 'l-' + crypto.createHash('sha1').update(`${norm(projeto)}|${chave(texto)}`).digest('hex').slice(0, 10);
}

// entre crases ("`🎯1`", quando o texto explica a marca) não conta
const RE_NIVEL = /\s*(?<!`)🎯\s*([1-9])(?![\d`])/u;

/** Tira o "🎯N" do texto: { nivel: 'N' ou '', resto: texto sem a marca }. */
function tirarNivel(s) {
  const m = s.match(RE_NIVEL);
  return m ? { nivel: m[1], resto: (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim() } : { nivel: '', resto: s };
}

/**
 * Os níveis da seção "## 🎯 Prioridades ..." da lista mestra. Cada nível é uma linha em negrito:
 *   **🔴 1. Prazo nesta semana (perco bolsa, dinheiro ou nota)**
 * → { n: '1', emoji: '🔴', titulo: 'Prazo nesta semana', sub: 'perco bolsa, dinheiro ou nota' }.
 */
function lerNiveis(texto) {
  const niveis = [];
  let dentro = false;
  for (const linha of texto.split(/\r?\n/)) {
    if (/^## /.test(linha)) { dentro = /^## 🎯/u.test(linha); continue; }
    if (!dentro) continue;
    const m = linha.match(/^\*\*(\S+)\s+([1-9])\.\s*(.+?)\*\*\s*$/u);
    if (!m) continue;
    const p = m[3].match(/^(.*?)\s*\((.+)\)\s*$/);
    niveis.push({ n: m[2], emoji: m[1], titulo: p ? p[1] : m[3], sub: p ? p[2] : '' });
  }
  return niveis;
}

/**
 * Separa as partes de uma linha "- [ ] 🙋 texto. Falta: ... ⏱️ 4min [..] ▶️ 07/11".
 * Devolve o texto limpo (ainda em Markdown leve), o "Falta", quem faz, as datas e os minutos do ⏱️.
 */
function partesDaLinha(bruto, hoje) {
  const { nivel, resto } = tirarNivel(bruto);
  let t = resto;
  let quem = '';
  const qm = t.match(/^((?:🙋|🤖|💍)+)\s*/u);
  if (qm) { quem = qm[1]; t = t.slice(qm[0].length); }

  const ultimo = re => { const todos = [...t.matchAll(re)]; return todos.length ? todos[todos.length - 1] : null; };
  const fm = ultimo(/✅\s*(\d{1,2})\/(\d{1,2})/gu);
  const im = ultimo(/▶️?\s*(\d{1,2})\/(\d{1,2})/gu);

  let minutos = 0;
  const tm = t.match(/⏱️?\s*(?:(\d+)h(\d{1,2})|(\d+)\s*min)?\s*\[[^\]]*\]/u);
  if (tm) minutos = tm[1] ? +tm[1] * 60 + +tm[2] : (tm[3] ? +tm[3] : 0);

  let texto = t
    .replace(/\s*⏱️?\s*(?:\d+h\d{1,2}|\d+\s*min)?\s*\[[^\]]*\]/gu, '')
    .replace(/\s*▶️?\s*\d{1,2}\/\d{1,2}/gu, '')
    .replace(/\s*✅\s*\d{1,2}\/\d{1,2}/gu, '')
    .trim();

  let falta = '';
  const fa = texto.match(/(?:^|\s)Falta:\s*/);
  if (fa) { falta = texto.slice(fa.index + fa[0].length).trim(); texto = texto.slice(0, fa.index).trim(); }

  // "**Até 09/11, PUCPR.**" no começo é o prazo (o jeito das Rápidas); o dia da semana antes da data também vale
  // ("**Até seg 16/11 23h59, ...**", o jeito das tarefas da faculdade)
  let prazo = '';
  const pz = texto.match(/^\*\*Até (?:(?:seg|ter|qua|qui|sex|s[áa]b|dom)\S*\s+)?(\d{1,2})\/(\d{1,2})/i);
  if (pz) prazo = dataSemAno(+pz[1], +pz[2], hoje);

  return {
    quem, texto, falta, prazo, minutos, nivel,
    comecou: im ? dataSemAno(+im[1], +im[2], hoje) : '',
    terminou: fm ? dataSemAno(+fm[1], +fm[2], hoje) : '',
    desistiu: texto.startsWith('~~'),
  };
}

/**
 * Lê a lista mestra. pular: nomes de projeto cuja seção fica de fora (o projeto que tem tabela própria é lido de lá).
 * Devolve todas as tarefas, feitas também (a marcação "desfazer" precisa achar a linha [x]).
 */
function lerLista(texto, { hoje = diaDeTrabalho(), pular = [] } = {}) {
  const tarefas = [];
  let secao = null, etapa = '';
  const linhas = texto.split(/\r?\n/);
  linhas.forEach((linha, n) => {
    let m;
    if ((m = linha.match(/^## (.+)/))) {
      const titulo = m[1].trim();
      // o placar no topo não é projeto
      secao = titulo.startsWith('📊') ? null : { ...tituloDaSecao(titulo), area: '' };
      if (secao && pular.some(p => norm(secao.nome).includes(norm(p)))) secao = null;
      etapa = '';
      return;
    }
    if (!secao) return;
    if ((m = linha.match(RE_AREA))) { secao.area = m[1]; return; }
    if ((m = linha.match(/^\*\*([^*]+?):?\*\*:?\s*$/))) { etapa = m[1]; return; }
    if ((m = linha.match(/^\s*- \[([ xX])\]\s*(.*)$/))) {
      const p = partesDaLinha(m[2], hoje);
      tarefas.push({
        id: idDaLista(secao.nome, p.texto),
        origem: 'lista',
        projeto: secao.nome,
        emoji: secao.emoji,
        grupo: etapa,
        quem: p.quem,
        situacao: m[1] !== ' ' ? 'feita' : (p.comecou ? 'comecada' : 'sem'),
        texto: p.texto,
        falta: p.falta,
        proximo: '',
        comecou: p.comecou,
        prazo: p.prazo,
        minutos: p.minutos,
        nivel: p.nivel,
        area: secao.area,
        _linha: n,
      });
    }
  });
  return tarefas;
}

/** A área de cada projeto da lista mestra, pelo nome: { 'Projeto financeiro': '💰 Dinheiro', ... }. */
function lerAreas(texto) {
  const areas = {};
  let nome = null;
  for (const linha of texto.split(/\r?\n/)) {
    let m;
    if ((m = linha.match(/^## (.+)/))) { nome = tituloDaSecao(m[1].trim()).nome; continue; }
    if (nome && (m = linha.match(RE_AREA))) { areas[nome] = m[1]; nome = null; }
  }
  return areas;
}

/**
 * Lê a tabela "Tudo o que está aberto" do TAREFAS.md de um projeto.
 * projeto: { nome, emoji, prefixo, area } (o prefixo vai na frente do código no id: "fin" + "DIN-1"; a área vai em
 * todas as tarefas da tabela).
 * A coluna Situação usa: ✅ feita · 🔴 tem prazo · ▶️ dd/mm começou · 💤 nunca comecei · ❓ decidir · 💡 ideia.
 */
function lerTabela(texto, projeto, { hoje = diaDeTrabalho() } = {}) {
  const tarefas = [];
  let dentro = false, grupo = '';
  texto.split(/\r?\n/).forEach((linha, n) => {
    if (/^## /.test(linha)) { dentro = /^## Tudo o que está aberto/.test(linha); return; }
    if (!dentro) return;
    let m;
    if ((m = linha.match(/^### (.+)/))) { grupo = m[1].replace(/^\d+\.\s*/, '').trim(); return; }
    m = linha.match(/^\|\s*([A-Z]{2,4}-\d+)\s*\|(.*)\|\s*$/);
    if (!m) return;
    const celulas = m[2].split('|').map(s => s.trim());
    if (celulas.length < 4) return;
    // se o texto tiver uma barra, as colunas de mais vão pro "O quê"
    const [oque0, quem, sit0, prox] = celulas.length === 4 ? celulas
      : [celulas.slice(0, celulas.length - 3).join(' | '), ...celulas.slice(-3)];
    // o "🎯N" pode estar na Situação ou no O quê; sai do texto dos dois
    const nOque = tirarNivel(oque0), nSit = tirarNivel(sit0);
    const oque = nOque.resto, sit = nSit.resto, nivel = nSit.nivel || nOque.nivel;

    const iniciou = sit.match(/▶️?\s*(\d{1,2})\/(\d{1,2})/u);
    // prazo é a data logo depois do 🔴 ("🔴 até 10/11", "🔴 09 e 10/11") ou a que abre a célula ("23 a 25/11");
    // vale o primeiro dia. Data no meio de um comentário ("(o workflow desde 20/10)") não é prazo.
    const pz = sit.match(/🔴\s*(?:até\s*)?(\d{1,2})(?:\s*(?:e|a)\s*\d{1,2})?\/(\d{1,2})/u)
      || sit.match(/^(\d{1,2})(?:\s*(?:e|a)\s*\d{1,2})?\/(\d{1,2})/);
    let situacao = 'sem';
    if (sit.includes('✅')) situacao = 'feita';
    else if (iniciou) situacao = 'comecada';
    else if (sit.includes('❓')) situacao = 'decidir';
    else if (sit.includes('💡')) situacao = 'ideia';

    tarefas.push({
      id: `${projeto.prefixo}-${m[1]}`,
      origem: 'projeto',
      projeto: projeto.nome,
      emoji: projeto.emoji || '',
      grupo,
      quem: (quem.match(/(?:🙋|🤖|💍)+/u) || [''])[0],
      situacao,
      texto: `**${m[1]}** ${oque}`,
      falta: '',
      proximo: prox === '—' ? '' : prox,
      comecou: iniciou ? dataSemAno(+iniciou[1], +iniciou[2], hoje) : '',
      prazo: pz && !sit.includes('✅') ? dataSemAno(+pz[1], +pz[2], hoje) : '',
      minutos: 0,
      nivel,
      area: projeto.area || '',
      _linha: n,
      _codigo: m[1],
    });
  });
  return tarefas;
}

/** Só o que vai pra fora: tira os campos internos (os que começam com "_"). */
function publico(t) {
  return Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith('_')));
}

module.exports = { lerLista, lerTabela, lerNiveis, lerAreas, publico, diaDeTrabalho, idDaLista, chave, iso, ddmm, dataSemAno };
