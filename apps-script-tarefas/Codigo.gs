/**
 * Tarefas: a planilha que junta as minhas tarefas e o App da Web que a página do celular e o PC chamam.
 *
 * Quem chama e pra quê (sempre POST com {acao, token, ...} em text/plain, pra o navegador não pedir "preflight"):
 * - o PC, a cada 10 min (local/tarefas/sincronizar.cjs):
 *     "pendentes" → as marcações do celular que ainda não chegaram nos arquivos;
 *     "enviar"    → as tarefas abertas da lista mestra e das tabelas dos projetos, e quais marcações entraram;
 * - a aba Tarefas da página do celular:
 *     "listar" → as tarefas da planilha + o Google Tasks e a Agenda ao vivo + as marcações dos últimos dias;
 *     "marcar" → marquei ou desmarquei. Do Google Tasks, conclui lá na hora. Da lista e das tabelas, fica registrada
 *                aqui até o PC escrever no arquivo (a lista manda). Da Agenda, fica só aqui: evento não tem "feito".
 *
 * A chave (TOKEN) vem do Segredo.gs, que só existe no PC e aqui (gerado pelo sincronizar.cjs --configurar).
 * O endereço é aberto (o celular chama sem login do Google), então sem a chave nada é lido nem escrito; o doGet
 * só diz se está no ar.
 *
 * Abas da planilha (criadas por autorizar() ou na primeira chamada):
 * - Tarefas: a foto mais nova do PC, uma linha por tarefa aberta. É reescrita a cada envio;
 * - Marcações: o que eu marquei no celular, com quando e o que aconteceu com a marcação;
 * - Agendas: as agendas da conta, com a caixa "Mostrar" e o "Tipo" (tarefa, rotina, aviso ou lembrança);
 * - Listas: as listas do Google Tasks, com o "Tipo" (tarefa ou compra);
 * - Envios: quando o PC mandou e quantas tarefas (as últimas 500 voltas).
 *
 * O Tipo arruma a aba do site: "aviso" (calendário da faculdade, feriado, corrida) fica fechado num canto, "rotina"
 * vai pro bloco da agenda do dia, "compra" vai pro grupo 🛒 Compras e "lembrança" (uma data que eu guardo, como as
 * da agenda 💘) aparece no topo do dia sem caixa de marcar: não é tarefa. Na primeira vez o tipo é chutado pelo nome
 * (ver tipoDaAgenda e tipoDaLista); trocar na planilha vale na próxima vez que a página buscar.
 */

const COLUNAS = ['id', 'origem', 'projeto', 'emoji', 'grupo', 'quem', 'situacao', 'texto', 'falta', 'proximo', 'comecou', 'prazo', 'minutos'];
const CAB_MARCACOES = ['Quando', 'Marca', 'Id', 'Origem', 'Feita', 'Tarefa', 'O que aconteceu'];
const CAB_AGENDAS = ['Agenda', 'Mostrar', 'Id', 'Tipo'];
const CAB_LISTAS = ['Lista', 'Tipo', 'Id'];
const TIPOS_AGENDA = ['tarefa', 'rotina', 'aviso', 'lembrança'];
const TIPOS_LISTA = ['tarefa', 'compra'];
const CAB_ENVIOS = ['Quando', 'Tarefas abertas', 'Marcações que entraram', 'Que não acharam a linha'];
const DIAS_DE_AGENDA = 8;     // hoje + 7
const DIAS_DE_MARCACOES = 3;  // o que o site mostra como "marquei" além do que já saiu da lista
const DIAS_DE_MARCACOES_AGENDA = 60; // evento marcado continua marcado enquanto aparece (viagem de vários dias)
const MAX_EVENTOS = 500;

/* ---------- entrada ---------- */

function doGet() {
  return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Tarefas: o App da Web está no ar.</p>');
}

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (_) { return resposta({ erro: 'pedido inválido' }); }
  if (!p || typeof TOKEN === 'undefined' || p.token !== TOKEN) return resposta({ erro: 'chave errada' });
  try {
    if (p.acao === 'listar') return resposta(listar());
    // o que escreve na planilha passa um de cada vez (o PC e o celular podem chamar juntos)
    const trava = LockService.getScriptLock();
    if (!trava.tryLock(20000)) return resposta({ erro: 'a planilha está ocupada, tente de novo' });
    try {
      if (p.acao === 'marcar') return resposta(marcar(p));
      if (p.acao === 'pendentes') return resposta(pendentes());
      if (p.acao === 'enviar') return resposta(enviar(p));
    } finally {
      trava.releaseLock();
    }
    return resposta({ erro: 'ação desconhecida' });
  } catch (err) {
    return resposta({ erro: String((err && err.message) || err) });
  }
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Rode esta uma vez no editor: pede as permissões (planilha, Agenda, Tasks) e monta as abas. */
function autorizar() {
  aba('Tarefas', COLUNAS);
  aba('Marcações', CAB_MARCACOES);
  aba('Envios', CAB_ENVIOS);
  const novas = atualizarAgendas(true);
  const listas = (Tasks.Tasklists.list({ maxResults: 100 }).items || []).length;
  Logger.log(`Tudo certo: ${novas} agenda(s) na aba Agendas e ${listas} lista(s) no Google Tasks.`);
}

/* ---------- planilha ---------- */

function aba(nome, cabecalho) {
  const pl = SpreadsheetApp.getActiveSpreadsheet();
  const fuso = Session.getScriptTimeZone();
  if (pl.getSpreadsheetTimeZone() !== fuso) pl.setSpreadsheetTimeZone(fuso);
  let a = pl.getSheetByName(nome);
  if (!a) {
    a = pl.insertSheet(nome);
    a.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    a.setFrozenRows(1);
  } else if (a.getLastColumn() < cabecalho.length) {
    // aba de uma versão anterior: ganha as colunas novas no fim
    a.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
  }
  return a;
}

/** O tipo chutado pelo nome da agenda, na primeira vez que ela aparece. */
function tipoDaAgenda(nome) {
  if (/💘|❤|♥|lembran|namoro/i.test(nome)) return 'lembrança';
  if (/rotina/i.test(nome)) return 'rotina';
  if (/pucpr|ufpr|faculdade|feriado|holiday|anivers|birthday|formula|f1|semana|calend/i.test(nome)) return 'aviso';
  return 'tarefa';
}

function tipoDaLista(nome) {
  return /compra|mercado|shopee/i.test(nome) ? 'compra' : 'tarefa';
}

function listaSuspensa(a, coluna, opcoes) {
  if (a.getLastRow() < 2) return;
  a.getRange(2, coluna, a.getLastRow() - 1, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(opcoes, true).build());
}

/** Texto que vem de fora nunca vira fórmula na planilha. */
function seguro(s) {
  s = String(s == null ? '' : s);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function linhas(a) {
  const n = a.getLastRow() - 1;
  return n > 0 ? a.getRange(2, 1, n, a.getLastColumn()).getValues() : [];
}

/* ---------- listar (a página do celular) ---------- */

function listar() {
  const avisos = [];
  const tarefas = linhas(aba('Tarefas', COLUNAS)).map(l => {
    const t = {};
    COLUNAS.forEach((c, i) => { t[c] = c === 'minutos' ? Number(l[i]) || 0 : String(l[i]); });
    return t;
  }).filter(t => t.id);

  let google = [];
  try { google = lerGoogleTasks(); } catch (err) { avisos.push('Google Tasks: ' + err.message); }
  let agenda = [];
  try { agenda = lerAgenda(); } catch (err) { avisos.push('Agenda: ' + err.message); }

  return {
    tarefas, google, agenda,
    marcas: marcasRecentes(),
    enviadoEm: PropertiesService.getScriptProperties().getProperty('ultimoEnvio') || '',
    agora: new Date().toISOString(),
    avisos,
  };
}

/** As tarefas abertas de todas as listas do Google Tasks da conta. */
function lerGoogleTasks() {
  const saida = [];
  const a = aba('Listas', CAB_LISTAS);
  const tipos = {};
  linhas(a).forEach(l => { tipos[String(l[2])] = String(l[1]) || 'tarefa'; });
  const novas = [];
  let pagina;
  do {
    const r = Tasks.Tasklists.list({ maxResults: 100, pageToken: pagina });
    for (const lista of r.items || []) {
      if (!(lista.id in tipos)) {
        tipos[lista.id] = tipoDaLista(lista.title);
        novas.push([seguro(lista.title), tipos[lista.id], lista.id]);
      }
      let pt;
      do {
        const rt = Tasks.Tasks.list(lista.id, { showCompleted: false, showHidden: false, maxResults: 100, pageToken: pt });
        for (const t of rt.items || []) {
          if (!t.title || !t.title.trim()) continue;
          saida.push({
            id: 'g-' + t.id, origem: 'google', projeto: lista.title, emoji: '📝', grupo: '', quem: '🙋',
            situacao: 'sem', texto: t.title.trim(), falta: (t.notes || '').trim(), proximo: '',
            comecou: '', prazo: t.due ? t.due.slice(0, 10) : '', minutos: 0,
            lista: lista.id, tarefa: t.id, tipo: tipos[lista.id],
          });
        }
        pt = rt.nextPageToken;
      } while (pt);
    }
    pagina = r.nextPageToken;
  } while (pagina);
  if (novas.length) {
    a.getRange(a.getLastRow() + 1, 1, novas.length, 3).setValues(novas);
    listaSuspensa(a, 2, TIPOS_LISTA);
  }
  return saida;
}

/** O dia de trabalho começa às 5h: à 1h de 09/11 ainda é 08/11. */
function inicioDoDia() {
  const d = new Date(Date.now() - 5 * 3600e3);
  const tz = Session.getScriptTimeZone();
  return new Date(Utilities.formatDate(d, tz, "yyyy-MM-dd'T'00:00:00XXX"));
}

/** Os eventos de hoje até daqui a 7 dias, das agendas marcadas em "Mostrar". */
function lerAgenda() {
  atualizarAgendas(false);
  migrarLembrancas();
  const tz = Session.getScriptTimeZone();
  const ini = inicioDoDia();
  const fim = new Date(ini.getTime() + DIAS_DE_AGENDA * 864e5);
  const saida = [];
  for (const l of linhas(aba('Agendas', CAB_AGENDAS))) {
    if (l[1] !== true || !l[2]) continue;
    // sem tipo na planilha (ou um que não existe), vale o chute pelo nome
    const tipo = TIPOS_AGENDA.indexOf(String(l[3])) >= 0 ? String(l[3]) : tipoDaAgenda(String(l[0]));
    const cal = CalendarApp.getCalendarById(String(l[2]));
    if (!cal) continue;
    for (const ev of cal.getEvents(ini, fim)) {
      if (saida.length >= MAX_EVENTOS) break;
      const inicio = ev.getStartTime() < ini ? ini : ev.getStartTime(); // evento de vários dias que começou antes
      const data = Utilities.formatDate(inicio, tz, 'yyyy-MM-dd');
      const diaTodo = ev.isAllDayEvent();
      saida.push({
        // o id do evento repete em todas as vezes de um evento que se repete: o começo de cada vez entra junto
        // (o começo de verdade, não o dia de hoje: uma viagem de 4 dias marcada uma vez fica marcada nos 4)
        id: 'a-' + resumoCurto(ev.getId() + '|' + ev.getStartTime().getTime()), origem: 'agenda', projeto: cal.getName(), emoji: '📅', tipo,
        grupo: '', quem: '', situacao: 'sem', texto: ev.getTitle() || '(sem título)', falta: '', proximo: '',
        comecou: '', prazo: data, minutos: 0,
        hora: diaTodo ? '' : Utilities.formatDate(ev.getStartTime(), tz, 'HH:mm'),
        ate: diaTodo ? '' : Utilities.formatDate(ev.getEndTime(), tz, 'HH:mm'),
      });
    }
  }
  return saida;
}

function resumoCurto(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
    .slice(0, 6).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

/**
 * Põe na aba Agendas as agendas da conta que ainda não estão lá. Começam marcadas as que são minhas e estão
 * visíveis; feriados, aniversários e as assinadas começam desmarcadas. Fora do autorizar(), olha no máximo uma vez
 * por hora (a lista de agendas quase não muda e a chamada é lenta).
 */
function atualizarAgendas(sempre) {
  const cache = CacheService.getScriptCache();
  if (!sempre && cache.get('agendasVistas')) return 0;
  const a = aba('Agendas', CAB_AGENDAS);
  const existentes = linhas(a);
  // agendas da versão anterior, sem tipo: ganham o chute pelo nome
  existentes.forEach((l, i) => { if (!l[3]) a.getRange(i + 2, 4).setValue(tipoDaAgenda(String(l[0]))); });
  if (existentes.length && !existentes.every(l => l[3])) listaSuspensa(a, 4, TIPOS_AGENDA);
  const ja = new Set(existentes.map(l => String(l[2])));
  const novas = CalendarApp.getAllCalendars()
    .filter(c => !ja.has(c.getId()))
    .map(c => [seguro(c.getName()), c.isOwnedByMe() && !c.isHidden(), c.getId(), tipoDaAgenda(c.getName())]);
  if (novas.length) a.getRange(a.getLastRow() + 1, 1, novas.length, 4).setValues(novas);
  if (a.getLastRow() > 1) {
    a.getRange(2, 2, a.getLastRow() - 1, 1).insertCheckboxes();
    listaSuspensa(a, 4, TIPOS_AGENDA);
  }
  cache.put('agendasVistas', '1', 3600);
  return novas.length;
}

/**
 * Uma vez só: o chute de antes de 08/11 não conhecia "lembrança" e gravou "tarefa" nas agendas com 💘. Elas passam
 * pra lembrança; depois disso, o que estiver escrito na planilha manda.
 */
function migrarLembrancas() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('lembrancaMigrada')) return;
  const a = aba('Agendas', CAB_AGENDAS);
  linhas(a).forEach((l, i) => {
    if (String(l[3]) === 'tarefa' && tipoDaAgenda(String(l[0])) === 'lembrança') a.getRange(i + 2, 4).setValue('lembrança');
  });
  listaSuspensa(a, 4, TIPOS_AGENDA);
  props.setProperty('lembrancaMigrada', '1');
}

/** id → a última marcação dos últimos dias: { feita, quando, estado }. */
function marcasRecentes() {
  const saida = {};
  for (const l of linhas(aba('Marcações', CAB_MARCACOES))) {
    const quando = l[0] instanceof Date ? l[0] : new Date(l[0]);
    const dias = l[3] === 'agenda' ? DIAS_DE_MARCACOES_AGENDA : DIAS_DE_MARCACOES;
    if (quando.getTime() < Date.now() - dias * 864e5) continue;
    saida[String(l[2])] = { feita: l[4] === true, quando: quando.toISOString(), estado: String(l[6]) };
  }
  return saida;
}

/* ---------- marcar (a página do celular) ---------- */

function marcar(p) {
  if (typeof p.id !== 'string' || !/^[\w-]{3,120}$/.test(p.id) || typeof p.feita !== 'boolean') {
    return { erro: 'marcação inválida' };
  }
  const origem = p.id.startsWith('g-') ? 'google' : p.id.startsWith('a-') ? 'agenda' : 'arquivo';
  let estado = '';
  if (origem === 'google') {
    if (!p.lista || !p.tarefa) return { erro: 'falta a lista da tarefa do Google Tasks' };
    Tasks.Tasks.patch(p.feita ? { status: 'completed' } : { status: 'needsAction', completed: null }, p.lista, p.tarefa);
    estado = p.feita ? 'concluída no Google Tasks' : 'reaberta no Google Tasks';
  } else if (origem === 'agenda') {
    estado = 'só aqui (evento da Agenda)';
  }
  const marca = Utilities.getUuid();
  const quando = new Date();
  aba('Marcações', CAB_MARCACOES).appendRow([quando, marca, p.id, origem, p.feita, seguro(String(p.texto || '').slice(0, 200)), estado]);
  return { ok: true, marca, estado, quando: quando.toISOString() };
}

/* ---------- o PC ---------- */

/**
 * As marcações de arquivo que ainda não entraram. Se a mesma tarefa foi marcada mais de uma vez (marquei e
 * desmarquei), só a última vale; as de antes ficam anotadas como trocadas.
 */
function pendentes() {
  const a = aba('Marcações', CAB_MARCACOES);
  const ls = linhas(a);
  const ultima = {};
  ls.forEach((l, i) => {
    if (l[3] === 'arquivo' && l[6] === '') {
      if (ultima[l[2]] !== undefined) a.getRange(ultima[l[2]] + 2, 7).setValue('trocada por uma mais nova');
      ultima[l[2]] = i;
    }
  });
  return {
    marcas: Object.keys(ultima).map(id => {
      const l = ls[ultima[id]];
      return { marca: String(l[1]), id: String(l[2]), feita: l[4] === true, quando: new Date(l[0]).toISOString() };
    }),
  };
}

function enviar(p) {
  if (!Array.isArray(p.tarefas) || p.tarefas.length > 3000) return { erro: 'lista de tarefas inválida' };
  const a = aba('Tarefas', COLUNAS);
  const tz = Session.getScriptTimeZone();
  const valores = p.tarefas.map(t => COLUNAS.map(c => c === 'minutos' ? Number(t[c]) || 0 : seguro(t[c])));
  if (a.getLastRow() > 1) a.getRange(2, 1, a.getLastRow() - 1, a.getMaxColumns()).clearContent();
  if (valores.length) {
    const r = a.getRange(2, 1, valores.length, COLUNAS.length);
    r.setNumberFormat('@'); // datas e códigos ficam como texto, do jeito que vieram
    r.setValues(valores);
  }

  // o que o PC fez com as marcações
  const feitoEm = 'no arquivo em ' + Utilities.formatDate(new Date(), tz, 'dd/MM HH:mm');
  const resultado = {};
  (p.aplicadas || []).forEach(m => { resultado[m] = feitoEm; });
  (p.perdidas || []).forEach(x => { resultado[x.marca] = 'não entrou: ' + x.motivo; });
  const m = aba('Marcações', CAB_MARCACOES);
  linhas(m).forEach((l, i) => {
    if (resultado[l[1]] !== undefined) m.getRange(i + 2, 7).setValue(resultado[l[1]]);
  });

  const e = aba('Envios', CAB_ENVIOS);
  e.appendRow([new Date(), valores.length, (p.aplicadas || []).length, (p.perdidas || []).length]);
  if (e.getLastRow() > 501) e.deleteRows(2, e.getLastRow() - 501);
  PropertiesService.getScriptProperties().setProperty('ultimoEnvio', String(p.geradoEm || new Date().toISOString()));
  return { ok: true, tarefas: valores.length };
}
