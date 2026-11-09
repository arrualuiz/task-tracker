'use strict';
/**
 * Passa pra lista (e pra tabela do projeto) o que eu marquei no celular.
 *
 * A lista manda: o celular só registra a marcação na planilha, e é o PC que escreve no arquivo, do jeito que a lista
 * já usa à mão:
 * - lista, feita: "- [ ]" vira "- [x]" e o último "▶️ dd/mm" vira "✅ dd/mm" (sem ▶️, o "✅ dd/mm" vai no fim);
 * - lista, desfeita: "- [x]" volta pra "- [ ]" e o último "✅ dd/mm" vira "▶️ dd/mm" (estava andando);
 * - tabela, feita: a coluna Situação vira "✅ dd/mm"; desfeita: "▶️ dd/mm".
 * dd/mm é o dia de trabalho da marcação (até as 5h vale o dia anterior).
 *
 * A linha é achada pelo id (ver ler.cjs). Sem a linha, a marcação volta como "não achei" e nada é mudado.
 */
const { lerLista, lerTabela, diaDeTrabalho, ddmm } = require('./ler.cjs');

/** Troca a última ocorrência de re em s pelo que fn devolver. */
function trocarUltima(s, re, novo) {
  const todos = [...s.matchAll(re)];
  if (!todos.length) return null;
  const m = todos[todos.length - 1];
  return s.slice(0, m.index) + novo + s.slice(m.index + m[0].length);
}

function marcarLinhaDaLista(linha, feita, dia) {
  if (feita) {
    if (/^\s*- \[[xX]\]/.test(linha)) return linha; // já estava
    let nova = linha.replace(/^(\s*)- \[ \]/, '$1- [x]');
    nova = trocarUltima(nova, /▶️?\s*\d{1,2}\/\d{1,2}/gu, `✅ ${dia}`) ?? `${nova.trimEnd()} ✅ ${dia}`;
    return nova;
  }
  if (/^\s*- \[ \]/.test(linha)) return linha;
  let nova = linha.replace(/^(\s*)- \[[xX]\]/, '$1- [ ]');
  nova = trocarUltima(nova, /✅\s*\d{1,2}\/\d{1,2}/gu, `▶️ ${dia}`) ?? nova;
  return nova;
}

function marcarLinhaDaTabela(linha, feita, dia) {
  const celulas = linha.split('|');
  // | código | o quê | quem | situação | próximo |  → a situação é a antepenúltima parte do split
  const i = celulas.length - 3;
  if (i < 2) return null;
  celulas[i] = ` ${feita ? '✅' : '▶️'} ${dia} `;
  return celulas.join('|');
}

/**
 * Aplica as marcações num arquivo. tipo: 'lista' ou 'tabela'.
 * marcas: [{ marca, id, feita, quando }] (quando em ISO). Só as marcações deste arquivo devem vir.
 * Devolve { texto, aplicadas: [marca], perdidas: [{ marca, motivo }] }.
 */
function aplicar(texto, marcas, { tipo, projeto, pular = [] }) {
  const linhas = texto.split('\n');
  const aplicadas = [], perdidas = [];
  for (const mc of marcas) {
    const hoje = diaDeTrabalho(new Date(mc.quando));
    const tarefas = tipo === 'lista'
      ? lerLista(linhas.join('\n'), { hoje, pular })
      : lerTabela(linhas.join('\n'), projeto, { hoje });
    const achadas = tarefas.filter(t => t.id === mc.id);
    if (achadas.length !== 1) {
      perdidas.push({ marca: mc.marca, motivo: achadas.length ? 'mais de uma linha com esse id' : 'não achei a tarefa' });
      continue;
    }
    const n = achadas[0]._linha;
    const dia = ddmm(hoje);
    const nova = tipo === 'lista' ? marcarLinhaDaLista(linhas[n], mc.feita, dia) : marcarLinhaDaTabela(linhas[n], mc.feita, dia);
    if (nova == null) { perdidas.push({ marca: mc.marca, motivo: 'linha da tabela fora do formato' }); continue; }
    linhas[n] = nova;
    aplicadas.push(mc.marca);
  }
  return { texto: linhas.join('\n'), aplicadas, perdidas };
}

module.exports = { aplicar, marcarLinhaDaLista, marcarLinhaDaTabela };
