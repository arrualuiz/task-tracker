'use strict';
// Testes da leitura e da volta das marcações, com uma lista e uma tabela inventadas (nada real é lido ou mudado).
const test = require('node:test');
const assert = require('node:assert/strict');
const { lerLista, lerTabela, idDaLista } = require('./ler.cjs');
const { aplicar } = require('./aplicar.cjs');

const HOJE = new Date(2026, 10, 8); // 08/11/2026

const LISTA = `# Tarefas pendentes

## 📊 Placar (08/11/2026)
- [ ] isto é do placar e não conta

## ⚡ Rápidas (5 a 10 min cada)

- [ ] 🙋 **Até 09/11, faculdade.** Falta: agendar a prova ⏱️ 4min [abcd1234@07/11] ▶️ 07/11

## 🧪 1. Projeto de teste

Começou: 01/10/2026 · Status: andando · Área: 🗂️ Organização

**Parte 1:**
- [ ] 🤖 Escrever o leitor ▶️ 20/10
- [x] 🤖 Coisa feita ✅ 05/11
- [ ] 🙋🤖 Decidir o nome

## 💰 2. Projeto financeiro

- [ ] 🙋 Esta fica de fora quando a tabela existe
`;

const TABELA = `# Tarefas

## Tudo o que está aberto (consolidado)

### 1. Dinheiro de agora

| Código | O quê | Quem | Situação | Próximo passo |
|---|---|---|---|---|
| DIN-1 | Mandar a conta | 🙋 | 🔴 até 10/11 · ▶️ 05/11 | mandar |
| DIN-4 | Pagar a água | 🙋 | 23 a 25/11 | — |
| SIS-1 | Consertar o teste | 🙋🤖 | ▶️ 07/11 (quebrado desde 20/10) | — |
| SIS-2 | Já feito | 🤖 | ✅ 06/11 | — |

## Diário de 07/11

| DIN-9 | fora da seção, não conta | 🙋 | 💤 | — |
`;

const FIN = { nome: 'Financeiro', emoji: '💰', prefixo: 'fin' };

test('a lista: projetos, quem faz, situação, datas e o Falta', () => {
  const t = lerLista(LISTA, { hoje: HOJE });
  assert.equal(t.length, 5); // o placar não conta
  const [rap, leitor, feita, decidir] = t;
  assert.equal(rap.projeto, 'Rápidas');
  assert.equal(rap.prazo, '2026-11-09');
  assert.equal(rap.falta, 'agendar a prova');
  assert.equal(rap.minutos, 4);
  assert.equal(leitor.grupo, 'Parte 1');
  assert.equal(leitor.situacao, 'comecada');
  assert.equal(leitor.comecou, '2026-10-20');
  assert.equal(feita.situacao, 'feita');
  assert.equal(decidir.quem, '🙋🤖');
  assert.equal(decidir.situacao, 'sem');
});

test('em janeiro, "▶️ 20/12" é o dezembro passado', () => {
  const [t] = lerLista('## 🧪 1. P\n- [ ] 🤖 Coisa ▶️ 20/12', { hoje: new Date(2027, 0, 10) });
  assert.equal(t.comecou, '2026-12-20');
});

test('a seção do projeto que tem tabela fica de fora da lista', () => {
  const t = lerLista(LISTA, { hoje: HOJE, pular: ['Projeto financeiro'] });
  assert.equal(t.length, 4);
  assert.ok(!t.some(x => x.projeto === 'Projeto financeiro'));
});

test('o id da lista não muda quando a tarefa anda', () => {
  const antes = lerLista('## 🧪 1. P\n- [ ] 🤖 Escrever o leitor', { hoje: HOJE })[0].id;
  const depois = lerLista('## 🧪 3. P\n- [ ] 🤖 **Escrever** o leitor. Falta: testar ⏱️ 9min [x@08/11] ▶️ 08/11', { hoje: HOJE })[0].id;
  assert.equal(antes, depois);
  assert.equal(antes, idDaLista('P', 'Escrever o leitor'));
});

test('a tabela: código como id, prazo só depois do 🔴 ou no começo, feitas marcadas', () => {
  const t = lerTabela(TABELA, FIN, { hoje: HOJE });
  assert.deepEqual(t.map(x => x.id), ['fin-DIN-1', 'fin-DIN-4', 'fin-SIS-1', 'fin-SIS-2']);
  assert.equal(t[0].prazo, '2026-11-10');
  assert.equal(t[0].comecou, '2026-11-05');
  assert.equal(t[0].grupo, 'Dinheiro de agora');
  assert.equal(t[1].prazo, '2026-11-23');
  assert.equal(t[1].proximo, '');
  assert.equal(t[2].prazo, '', 'data no comentário não é prazo');
  assert.equal(t[3].situacao, 'feita');
});

test('marcar no celular: a linha da lista vira [x] com ✅ no lugar do ▶️', () => {
  const [, leitor, , decidir] = lerLista(LISTA, { hoje: HOJE });
  const quando = '2026-11-09T03:00:00.000Z'; // 00h de 09/11 em Curitiba: ainda é o dia 08/11
  const r = aplicar(LISTA, [
    { marca: 'm1', id: leitor.id, feita: true, quando },
    { marca: 'm2', id: decidir.id, feita: true, quando },
    { marca: 'm3', id: 'l-naoexiste', feita: true, quando },
  ], { tipo: 'lista' });
  assert.deepEqual(r.aplicadas, ['m1', 'm2']);
  assert.deepEqual(r.perdidas, [{ marca: 'm3', motivo: 'não achei a tarefa' }]);
  assert.match(r.texto, /- \[x\] 🤖 Escrever o leitor ✅ 08\/11\n/);
  assert.match(r.texto, /- \[x\] 🙋🤖 Decidir o nome ✅ 08\/11\n/);
  assert.equal(r.texto.split('\n').length, LISTA.split('\n').length, 'nenhuma linha some ou aparece');
});

test('desmarcar: a linha volta pra [ ] e o ✅ vira ▶️', () => {
  const feita = lerLista(LISTA, { hoje: HOJE })[2];
  const r = aplicar(LISTA, [{ marca: 'm', id: feita.id, feita: false, quando: '2026-11-08T15:00:00Z' }], { tipo: 'lista' });
  assert.match(r.texto, /- \[ \] 🤖 Coisa feita ▶️ 08\/11\n/);
});

test('marcar na tabela troca só a coluna Situação', () => {
  const r = aplicar(TABELA, [{ marca: 'm', id: 'fin-DIN-1', feita: true, quando: '2026-11-08T15:00:00Z' }], { tipo: 'tabela', projeto: FIN });
  assert.deepEqual(r.aplicadas, ['m']);
  assert.match(r.texto, /\| DIN-1 \| Mandar a conta \| 🙋 \| ✅ 08\/11 \| mandar \|/);
  assert.equal(lerTabela(r.texto, FIN, { hoje: HOJE })[0].situacao, 'feita');
});
