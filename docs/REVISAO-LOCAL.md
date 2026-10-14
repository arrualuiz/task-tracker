# Revisão local — fonte de verdade

## Executar

Requer Node.js 24 ou superior. Na raiz do projeto:

```powershell
npm start
```

Abra http://localhost:3210. Não há dependências externas para instalar nem build do frontend. `npm run check` verifica a sintaxe e `npm test` verifica persistência, conflitos, importação e API com banco temporário.

A página inicial é o planejador **Meu dia**. Escolha a data, adicione itens ou sugestões e use **Salvar meu dia**. Setas/arraste alteram a ordem; o seletor muda o bloco do dia. Reservar horário cria um bloco local com início e duração. Comentários e conclusão pertencem ao item daquele dia. Remover não exclui a rotina original. A revisão descrita abaixo permanece em `/revisao`.

Os dias e seu histórico ficam no mesmo SQLite, em tabelas adicionais. O backup JSON versão 2 inclui o planejamento. A tela mantém rascunhos em memória até salvar; em conflito, baixe o rascunho antes de recarregar. O arquivo de rascunho serve para consulta/cópia manual, sem importador na interface. Não se trata de sincronização com Google e as sugestões ainda exigem conferência de regras e exceções do ICS.

Se o inventário não existir neste computador, gere-o primeiro:

```powershell
node scripts/mapear-calendario.cjs "CAMINHO-DO-CALENDARIO.ics" dados-locais/rotinas
```

## Onde os dados vivem

- **Fonte de verdade editável:** `dados-locais/task-tracker.sqlite`. O servidor grava a rotina e seu histórico na mesma transação.
- **Origem de importação:** `dados-locais/rotinas/inventario.json`, lido somente na primeira inicialização do banco. Alterar esse JSON ou reexecutar o mapeamento não sobrescreve o banco existente.
- **Relatório de importação:** `ROTINAS-IMPORTADAS.md` é uma fotografia da origem. Não representa as revisões posteriores. Consulte a página para o estado atual.
- **Cópia transportável:** botão Exportar backup, contendo dados revisados, origem integral e histórico em JSON. Restauração desse JSON pela interface ainda não implementada.

Mantenha cópia do banco para recuperação. Para copiar manualmente o SQLite, pare o servidor antes; não copie apenas o arquivo principal enquanto houver escritas, pois o SQLite pode usar arquivos auxiliares WAL. O backup JSON pode ser baixado com o servidor aberto.

## O que a página altera

Título, categoria, nome da conta de destino, tipo, situação de revisão, data inicial, horário opcional, duração, repetição semanal/mensal/diária e observações. Cada salvamento com mudanças cria uma versão e registra antes/depois, com data e hora. A mesma versão não pode ser sobrescrita por outra aba: em caso de conflito, o rascunho permanece e o usuário pode copiá-lo antes de recarregar.

O nome da conta é um agrupamento local, ainda não uma autorização Google. Aprovação é da rotina para o planejamento futuro, não conclusão diária. Os registros começam para revisão; nenhum evento remoto é modificado.

As 110 séries e o evento avulso formam 111 registros editáveis. A exceção é anexada à sua série e EXDATE permanece na origem. Alterar uma repetição não apaga o ICS original. A expansão em ocorrências, data final da série, exceções editáveis e sincronização Google ficam para próximas entregas.

## Versionamento e acompanhamento

- Fazer commits pequenos por entrega funcional, com validação e atualização do mapa/CHANGELOG.
- Dados pessoais ficam fora do Git, conforme as [orientações do projeto](ORIENTACOES.md). O histórico do SQLite registra cada mudança feita pela página; Git registra código e documentação.
- A interface informa salvamento, falha e conflito. Notificações externas e atualização automática entre abas ainda não estão implementadas.
- Não há push automático ao GitHub nesta entrega.

## Limite desta etapa

O servidor escuta somente `127.0.0.1`, verifica Host/Origin e serve uma lista fixa de arquivos. Não publica a pasta do projeto. No iPhone, localhost aponta para o próprio celular; o acesso pelo telefone exigirá outra etapa de disponibilização. O quadro antigo do Apps Script permanece em `site/index.html`, mas a rota local inicial agora é o planejador do dia.

A persistência usa o módulo nativo [node:sqlite](https://nodejs.org/api/sqlite.html); sua API ainda é experimental na linha Node 24 utilizada nesta entrega.
