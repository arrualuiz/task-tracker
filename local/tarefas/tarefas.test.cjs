'use strict';
// Testes da leitura e da volta das marcações, com uma lista e uma tabela inventadas (nada real é lido ou mudado).
const test = require('node:test');
const assert = require('node:assert/strict');
const { lerLista, lerTabela, lerNiveis, lerAreas, idDaLista } = require('./ler.cjs');
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

test('nível de prioridade: o 🎯N da linha e da tabela, sem mudar o id, e os nomes da seção 🎯', () => {
  const lista = `## 🎯 Prioridades por nível (12/11/2026)

Texto qualquer.

**🔴 1. Prazo nesta semana (perco bolsa, dinheiro ou nota)**
**⚪ 5. Gaveta**
- isto é explicação, não é tarefa

## ⚡ Rápidas

- [ ] 🙋 🎯1 **Até 18/11, ProUni.** Falta: clicar no aceite ⏱️ 8min [abcd1234@08/11] ▶️ 08/11
- [ ] 🙋 **Até 18/11, ProUni.** Falta: clicar no aceite ⏱️ 8min [abcd1234@08/11] ▶️ 08/11
`;
  const [com, sem] = lerLista(lista, { hoje: HOJE });
  assert.equal(com.nivel, '1');
  assert.equal(sem.nivel, '');
  assert.equal(com.id, sem.id); // pôr ou trocar o nível não muda o id
  assert.equal(com.texto, '**Até 18/11, ProUni.**');
  assert.equal(com.prazo, '2026-11-18');
  assert.equal(com.quem, '🙋');
  // a marca citada entre crases é texto, não nível
  const [citada] = lerLista('## ⚡ Rápidas\n- [ ] 🤖 A visão com o `🎯1` a `🎯5` de cada linha ▶️ 12/11\n', { hoje: HOJE });
  assert.equal(citada.nivel, '');
  assert.equal(citada.texto, 'A visão com o `🎯1` a `🎯5` de cada linha');

  assert.deepEqual(lerNiveis(lista), [
    { n: '1', emoji: '🔴', titulo: 'Prazo nesta semana', sub: 'perco bolsa, dinheiro ou nota' },
    { n: '5', emoji: '⚪', titulo: 'Gaveta', sub: '' },
  ]);
  assert.deepEqual(lerNiveis('## ⚡ Rápidas\n**🔴 1. Fora da seção**\n'), []);

  const tabela = `## Tudo o que está aberto

| Código | O quê | Quem | Situação | Próximo passo |
|---|---|---|---|---|
| DIN-4 | Pagar a água | 🙋 | 23 a 25/11 🎯2 | — |
| DIN-5 | 🎯3 Ver o 13º | 🙋 | ❓ | — |
`;
  const [agua, decimo] = lerTabela(tabela, FIN, { hoje: HOJE });
  assert.equal(agua.nivel, '2');
  assert.equal(agua.prazo, '2026-11-23');
  assert.equal(decimo.nivel, '3');
  assert.equal(decimo.texto, '**DIN-5** Ver o 13º');
  assert.equal(decimo.situacao, 'decidir');
});

test('área: a linha "Área:" do projeto vai em todas as tarefas dele, e a tabela usa a que receber', () => {
  const lista = `## ⚡ Rápidas

- [ ] 🙋 Sem área nenhuma

## 🐧 8. Linux e faculdade

Começou: 03/10/2026 · Status: andando · Área: 🖥️ PC e casa, 🎓 Estudos

- [ ] 🤖 Arrumar o boot
- [x] 🤖 Já feita ✅ 05/11

## 💰 12. Projeto financeiro

Começou: 13/10/2026 · Status: andando · Área: 💰 Dinheiro

- [ ] 🙋 Esta fica de fora quando a tabela existe
`;
  const t = lerLista(lista, { hoje: HOJE });
  assert.deepEqual(t.map(x => x.area), ['', '🖥️ PC e casa, 🎓 Estudos', '🖥️ PC e casa, 🎓 Estudos', '💰 Dinheiro']);
  // a linha "Começou:" não vira tarefa nem muda o id
  assert.equal(t[1].id, idDaLista('Linux e faculdade', 'Arrumar o boot'));
  assert.deepEqual(lerAreas(lista), { 'Linux e faculdade': '🖥️ PC e casa, 🎓 Estudos', 'Projeto financeiro': '💰 Dinheiro' });
  const [din] = lerTabela(TABELA, { ...FIN, area: '💰 Dinheiro' }, { hoje: HOJE });
  assert.equal(din.area, '💰 Dinheiro');
  assert.equal(lerTabela(TABELA, FIN, { hoje: HOJE })[0].area, '');
});

test('prazo com o dia da semana antes da data: "**Até seg 16/11 23h59, ...**"', () => {
  const [com, sem] = lerLista('## 🐧 8. Linux e faculdade\n- [ ] 🙋🤖 🎯1 **Até seg 16/11 23h59, Segurança da TI: AS1** (questionário)\n- [ ] 🙋 **Até qua. 18/11, ProUni.**\n', { hoje: HOJE });
  assert.equal(com.prazo, '2026-11-16');
  assert.equal(sem.prazo, '2026-11-18');
});
