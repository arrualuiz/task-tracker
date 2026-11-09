#!/usr/bin/env node
'use strict';
/**
 * Sincroniza as tarefas do PC com a planilha Tarefas (App da Web do Apps Script).
 *
 *   node local/tarefas/sincronizar.cjs               # a volta completa (é o que o timer roda a cada 10 min)
 *   node local/tarefas/sincronizar.cjs --ver         # só lê os arquivos e mostra o resumo, sem internet
 *   node local/tarefas/sincronizar.cjs --configurar  # cria a chave e o Segredo.gs do Apps Script (uma vez)
 *   node local/tarefas/sincronizar.cjs --url <endereço /exec>   # guarda o endereço do App da Web
 *
 * A volta completa:
 * 1. pega na planilha as marcações do celular que ainda não chegaram nos arquivos (acao "pendentes");
 * 2. escreve cada uma na lista ou na tabela do projeto (aplicar.cjs). A lista manda: a planilha é o caminho;
 * 3. lê de novo os arquivos e manda as tarefas abertas (acao "enviar"), junto com quais marcações entraram e quais
 *    não acharam a linha;
 * 4. grava a foto (~/.config/task-tracker/foto.json), que a página do celular leva junto pra abrir mesmo sem internet.
 *
 * O Google Tasks e a Agenda não passam por aqui: o Apps Script lê os dois ao vivo quando a página abre.
 *
 * A chave e o endereço ficam em ~/.config/task-tracker/tarefas.json (fora do repositório, só o meu usuário lê).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { lerLista, lerTabela, publico } = require('./ler.cjs');
const { aplicar } = require('./aplicar.cjs');

const PASTA = path.join(os.homedir(), '.config', 'task-tracker');
const CONFIG = path.join(PASTA, 'tarefas.json');
const FOTO = path.join(PASTA, 'foto.json');
const SEGREDO = path.join(__dirname, '..', '..', 'apps-script-tarefas', 'Segredo.gs');

// De onde vêm as tarefas, se o tarefas.json não disser outra coisa.
const FONTES_PADRAO = {
  lista: '~/dev/projetos/rascunhos-e-anotacoes/TAREFAS-PENDENTES.md',
  tabelas: [
    // naLista: a seção da lista mestra que a tabela substitui (ela já junta as abertas de lá)
    { arquivo: '~/dev/projetos/financeiro/TAREFAS.md', nome: 'Financeiro', emoji: '💰', prefixo: 'fin', naLista: 'Projeto financeiro' },
  ],
};

const casa = p => p.replace(/^~(?=$|\/)/, os.homedir());

function lerConfig() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { /* ainda não configurado */ }
  return { ...FONTES_PADRAO, ...cfg };
}

function gravarConfig(cfg) {
  fs.mkdirSync(PASTA, { recursive: true, mode: 0o700 });
  const { lista, tabelas, ...resto } = cfg; // as fontes padrão não precisam ficar no arquivo
  const salvar = { ...resto };
  if (lista !== FONTES_PADRAO.lista) salvar.lista = lista;
  if (JSON.stringify(tabelas) !== JSON.stringify(FONTES_PADRAO.tabelas)) salvar.tabelas = tabelas;
  fs.writeFileSync(CONFIG, JSON.stringify(salvar, null, 2) + '\n', { mode: 0o600 });
}

/** Grava sem deixar o arquivo pela metade: escreve ao lado e troca (o temporário não sobra). */
function gravarArquivo(arquivo, texto) {
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, texto);
  fs.renameSync(tmp, arquivo);
}

/** Todas as tarefas dos arquivos (feitas também). */
function lerTudo(cfg) {
  const pular = [];
  const tarefas = [];
  for (const tb of cfg.tabelas) {
    const arq = casa(tb.arquivo);
    if (!fs.existsSync(arq)) continue;
    const lidas = lerTabela(fs.readFileSync(arq, 'utf8'), tb);
    if (lidas.length && tb.naLista) pular.push(tb.naLista);
    tarefas.push(...lidas);
  }
  const lista = casa(cfg.lista);
  const daLista = fs.existsSync(lista) ? lerLista(fs.readFileSync(lista, 'utf8'), { pular }) : [];
  return { tarefas: [...daLista, ...tarefas], pular };
}

async function chamar(cfg, acao, dados = {}) {
  if (!cfg.url || !cfg.token) throw new Error('falta configurar: rode com --configurar e depois --url <endereço>');
  // text/plain: o Apps Script não responde ao "preflight" do CORS, então o pedido tem de ser simples
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao, token: cfg.token, ...dados }),
    redirect: 'follow',
  });
  const corpo = await r.text();
  let json;
  try { json = JSON.parse(corpo); } catch {
    throw new Error(/autoriza|authoriz/i.test(corpo)
      ? 'o App da Web ainda não foi autorizado: abra o editor do script e rode a função autorizar'
      : `o App da Web não respondeu JSON (HTTP ${r.status})`);
  }
  if (json.erro) throw new Error(`o App da Web disse: ${json.erro}`);
  return json;
}

/** Passo 2: escreve as marcações nos arquivos. Devolve { aplicadas, perdidas, mudou: [arquivos] }. */
function aplicarMarcas(cfg, marcas, pular) {
  const aplicadas = [], perdidas = [], mudou = [];
  const porArquivo = new Map();
  for (const m of marcas) {
    const tb = m.id.startsWith('l-') ? null : cfg.tabelas.find(t => m.id.startsWith(`${t.prefixo}-`));
    if (!m.id.startsWith('l-') && !tb) { perdidas.push({ marca: m.marca, motivo: 'origem desconhecida' }); continue; }
    const chave = tb ? casa(tb.arquivo) : casa(cfg.lista);
    if (!porArquivo.has(chave)) porArquivo.set(chave, { tb, marcas: [] });
    porArquivo.get(chave).marcas.push(m);
  }
  for (const [arquivo, { tb, marcas: ms }] of porArquivo) {
    const antes = fs.readFileSync(arquivo, 'utf8');
    const r = aplicar(antes, ms, tb ? { tipo: 'tabela', projeto: tb } : { tipo: 'lista', pular });
    aplicadas.push(...r.aplicadas); perdidas.push(...r.perdidas);
    if (r.texto !== antes) {
      // se alguém salvou o arquivo enquanto isso, não atropela: a marcação fica pra próxima volta
      if (fs.readFileSync(arquivo, 'utf8') !== antes) {
        for (const m of r.aplicadas) aplicadas.splice(aplicadas.indexOf(m), 1);
        continue;
      }
      gravarArquivo(arquivo, r.texto);
      mudou.push(arquivo);
    }
  }
  return { aplicadas, perdidas, mudou };
}

function resumo(tarefas) {
  const abertas = tarefas.filter(t => t.situacao !== 'feita');
  const porProjeto = {};
  for (const t of abertas) porProjeto[t.projeto] = (porProjeto[t.projeto] || 0) + 1;
  return { abertas, porProjeto };
}

async function sincronizar() {
  const cfg = lerConfig();
  let r = { aplicadas: [], perdidas: [], mudou: [] };
  let falhou = null;
  try {
    const inicio = lerTudo(cfg);
    const { marcas } = await chamar(cfg, 'pendentes');
    r = aplicarMarcas(cfg, marcas || [], inicio.pular);
  } catch (e) {
    falhou = e;
  }

  // a foto sai mesmo sem o Google: a página do celular leva ela e abre com a lista mais nova que o PC tem
  const { tarefas } = lerTudo(cfg);
  const { abertas } = resumo(tarefas);
  const geradoEm = new Date().toISOString();
  fs.mkdirSync(PASTA, { recursive: true, mode: 0o700 });
  fs.writeFileSync(FOTO, JSON.stringify({ geradoEm, tarefas: abertas.map(publico) }) + '\n', { mode: 0o600 });
  if (falhou) throw falhou;

  await chamar(cfg, 'enviar', { tarefas: abertas.map(publico), geradoEm, aplicadas: r.aplicadas, perdidas: r.perdidas });

  console.log(`✔ ${abertas.length} tarefas abertas na planilha.`);
  if (r.aplicadas.length) console.log(`✔ ${r.aplicadas.length} marcação(ões) do celular passada(s) pra ${r.mudou.map(a => path.basename(path.dirname(a)) + '/' + path.basename(a)).join(', ')}.`);
  for (const p of r.perdidas) console.log(`⚠️ Uma marcação não entrou (${p.motivo}). Ela continua na aba Marcações da planilha.`);
}

function ver() {
  const cfg = lerConfig();
  const { tarefas, pular } = lerTudo(cfg);
  const { abertas, porProjeto } = resumo(tarefas);
  console.log(`${abertas.length} tarefas abertas (de ${tarefas.length} lidas).`);
  if (pular.length) console.log(`Da lista mestra ficou de fora a seção "${pular.join('", "')}" (vem da tabela do projeto).`);
  for (const [p, n] of Object.entries(porProjeto).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${p}`);
  const ids = new Map();
  for (const t of tarefas) ids.set(t.id, (ids.get(t.id) || 0) + 1);
  const repetidos = [...ids].filter(([, n]) => n > 1);
  if (repetidos.length) console.log(`⚠️ ${repetidos.length} id(s) repetido(s): duas linhas começam igual no mesmo projeto. Marcar uma delas no celular não vai entrar.`);
  console.log(cfg.url ? `App da Web: configurado.` : 'App da Web: ainda não configurado (--configurar e --url).');
}

function configurar(url) {
  const cfg = lerConfig();
  if (!cfg.token) cfg.token = crypto.randomBytes(24).toString('base64url');
  if (url) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error('o endereço tem de ser o /exec do App da Web');
    cfg.url = url;
  }
  gravarConfig(cfg);
  // O Apps Script lê a mesma chave de um arquivo que só existe no PC e no Google (está no .gitignore)
  fs.writeFileSync(SEGREDO, `// Gerado por local/tarefas/sincronizar.cjs --configurar. Não vai pro git.\nconst TOKEN = ${JSON.stringify(cfg.token)};\n`, { mode: 0o600 });
  console.log(`✔ Chave guardada em ${CONFIG} e em apps-script-tarefas/Segredo.gs.`);
  if (cfg.url) console.log('✔ Endereço do App da Web guardado.');
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--ver')) return ver();
    if (args.includes('--configurar')) return configurar();
    const iu = args.indexOf('--url');
    if (iu >= 0) return configurar(args[iu + 1]);
    await sincronizar();
  } catch (e) {
    console.error(`✘ ${e.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { lerTudo, aplicarMarcas, FONTES_PADRAO };
