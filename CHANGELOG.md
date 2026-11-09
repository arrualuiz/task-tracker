# Histórico do projeto

## 2026-11-08 — Tarefas num lugar só: aba no site do celular, planilha e App da Web

- `local/tarefas/`: leitura da lista mestra e da tabela de códigos dos projetos num formato único, com id estável (o código, ou projeto + começo do texto na lista); volta das marcações do celular pros arquivos (`[x]`, `✅ dd/mm`); `npm run tarefas` e `npm run tarefas:ver`.
- `apps-script-tarefas/`: planilha Tarefas com App da Web protegido por chave (abas Tarefas, Marcações, Agendas e Envios); Google Tasks e Agenda lidos ao vivo; marcar uma tarefa do Google Tasks conclui lá.
- `site/aba-tarefas.html`: aba Tarefas (Hoje, Semana, Tudo; filtros de quem faz e busca) que entra na página trancada do financeiro.
- `scripts/instalar-timer-tarefas.sh`: timer de 10 min pro PC sincronizar.
- Oito testes novos em `local/tarefas/tarefas.test.cjs`, com lista e tabela inventadas.
- Arrumação da aba no mesmo dia (a primeira versão misturava tudo): Hoje com Pra fazer (até amanhã), Agenda e rotina numa linha por evento e Comecei e parei com as 5 mais antigas; avisos, compras e feitas fechados; Semana só com prazos e compromissos; Tudo por projeto, fechado. Tipo de cada agenda e lista na planilha (abas Agendas e Listas), a planilha no fuso de São Paulo e o id do evento pelo começo de verdade (viagem de vários dias marcada uma vez fica marcada).
- Tipo "lembrança" pras agendas de datas que eu guardo (a 💘): aparece no topo do dia e na semana, sem caixa e sem contar como tarefa.

## 2026-09-14 — Limpeza de credenciais e meta descriptions

- Credenciais reais (SPREADSHEET_ID e SECRET_TOKEN) removidas do `apps-script/Code.gs`, substituídas por placeholders com instruções de preenchimento. O histórico do Git ainda contém os valores anteriores.
- Meta descriptions adicionadas em todas as páginas HTML servidas pelo Node (dia, mês, revisão, calendários, tarefas), melhorando SEO e acessibilidade.
- MAPA-DO-PROJETO atualizado para 14/09/2026 com nota sobre a limpeza realizada.
- Quinze testes aprovados; verificação de sintaxe de todos os módulos com sucesso; sem push.

## 2026-09-12 — Visão integrada de Mês Completo, Mês Reduzido (Mini-mês) e Semana Certinha com rotinas diárias

- Alternador de visões na aba Mês & Semana (`/mes`): Mês Completo, Semana Certinha e Mês Reduzido (Mini-calendário lateral).
- Visão de Mês Completo com rotinas diárias listadas diretamente em cada célula de dia, com horários, chips coloridos por propósito e botão expansível "+ Mais N" para inspeção completa.
- Visão de Semana ("semana certinha") com colunas detalhadas por dia, faixas de horários e blocos cronológicos de rotinas (estilo visual da grade semanal do Google Calendar).
- Mini-mês compacto na barra lateral com navegação ágil de meses e seleção imediata da semana ativa e dias.
- Projeção automática de rotinas recorrentes ativas para todos os dias do período, mantendo a regra de que rotinas projetadas não contam como concluídas até serem salvas ou planejadas.
- Novo endpoint `GET /api/overview/week?date=YYYY-MM-DD&start=MO` retornando a semana com suas rotinas diárias e estatísticas.
- Filtros rápidos de rotina por conta e propósito na barra lateral.
- Testes automatizados cobrindo o novo endpoint semanal e integridade dos dados; sem push.

## 2026-09-12 — Visão mensal com marcos periódicos, avanço e separação de melhorias vs dívidas morais

- Nova aba Mês & Avanço (`/mes`) com grade mensal de 30/31 dias, visualização panorâmica e atalho direto para planejamento diário.
- Destaque específico para os marcos periódicos de dias 05, 10, 15, 20, 25 e 30 com etiqueta de revisão e estilo diferenciado.
- Classificação de propósito pessoal para tarefas e rotinas: Melhorias (evolução, hábitos, saúde), Dívidas Morais (pendências atrasadas) e Rotina/Manutenção.
- Painel de avanço recente com taxa de realização, saldo de dívidas morais quitadas de pendentes, melhorias conquistadas e consistência diária nos últimos 7, 14 ou 30 dias.
- Divisão contextual de rotinas por dia de semana (Seg a Sex), final de semana (Sáb e Dom) e rotinas especiais de quarta-feira (sem aula / volta direto).
- Suporte a abertura do planejamento por parâmetro de data na URL (`/?date=YYYY-MM-DD`).
- Quinze testes automatizados aprovados; verificação de sintaxe de todos os módulos com sucesso; sem push.

## 2026-09-11 — Mais calendários e consulta Google Tasks

- Limite ampliado de 20 para 200 calendários, seleção em lote e até cinco fontes simultâneas por consulta.
- Nova aba Google Tasks com listas por conta, filtros de situação, busca, notas, datas e subtarefas.
- Autorização adicional de leitura Tasks por conta, reaproveitando o JSON e preservando as conexões existentes.
- Paginação, deduplicação por IDs e avisos de falhas parciais.
- Quatorze testes simulados aprovados; nenhuma tarefa real criada, concluída ou excluída.
- Uso real de Tasks depende da ativação da API e consentimento do usuário. Sem push.

## 2026-09-11 — Calendários e autorização Google por conta

- Navegação entre Meu dia, Calendários e Revisão de rotinas.
- Página de consulta de eventos por período, calendário e conta, com busca e identificação da origem.
- Configuração guiada do cliente OAuth e autorização de leitura separada para cada conta Google.
- Credenciais privadas fora do Git, pasta pública e backups; estado/cookie OAuth de uso único e renovação no servidor.
- Paginação, recorrências expandidas pelo Google, eventos de dia inteiro, exceções e avisos de falha parcial.
- Desconexão local sem excluir eventos; planejamento diário e revisões preservados.
- Onze testes isolados aprovados. Conexão real pendente de configuração e consentimento do usuário; sem publicação ou push.

## 2026-09-10 — Meu dia: planejamento por blocos

- Nova tela principal com data, sugestões filtráveis por conta e busca, priorizando rotinas aprovadas.
- Tarefas livres, comentários, horário opcional, duração e reservas de tempo com aviso de sobreposição.
- Organização por manhã, tarde, noite ou sem bloco; movimentação por arraste, setas e seletor acessível ao toque.
- Remoção do planejamento e conclusão/reabertura independentes da aprovação da rotina.
- Persistência diária no SQLite, histórico atômico, proteção contra conflito, salvamento idempotente e backup completo versão 2.
- Revisão original mantida em `/revisao`; dados pessoais preservados, sem sincronização Google ou push.
- Sintaxe validada e seis testes isolados aprovados. Sugestões são indicativas: expansão integral das exceções e regras ICS continua planejada.

## 2026-09-08 — Revisão local com persistência

- Página de revisão com dados reais do calendário, busca e filtros por categoria, situação e conta de destino.
- Edição de título, tipo, repetição, data, horário, duração, aprovação e observações.
- SQLite como fonte de verdade, importação inicial única e histórico transacional antes/depois.
- Proteção contra conflito entre abas e exportação de backup JSON.
- Servidor restrito a localhost, sem operações Google.
- Testes isolados de persistência, reinício, exceções, validação e API.

## 2026-09-08 — Mapeamento inicial

- Mapa da arquitetura existente e requisitos de várias contas, iPhone web e Android futuro.
- Inventário das rotinas do ICS preservando recorrências e exceções.
- Orientações para comentários em português e manutenção do projeto.
