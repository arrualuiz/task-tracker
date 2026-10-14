# Task Tracker — Google Tasks/Calendar + Apps Script + Sheets + Site

## Continuidade do projeto

**Google Tasks:** a aba http://localhost:3210/tarefas consulta tarefas por conta e lista, com busca e filtros de situação. Ative a Google Tasks API no mesmo projeto e clique em **Autorizar Google Tasks**; o JSON já configurado é reaproveitado. Calendários agora aceita até 200 agendas por consulta.

**Calendários Google:** a aba http://localhost:3210/calendarios tem configuração guiada do projeto OAuth, conexão por conta e consulta dos eventos. Veja o [guia de integração](docs/INTEGRACAO-GOOGLE-CALENDAR.md). A conexão real requer que você configure o cliente Google e autorize cada conta; os acessos desta conversa e do site são independentes.

**Planejamento do dia:** execute `npm start` com Node.js 24+ e abra http://localhost:3210. Escolha sugestões, adicione tarefas, organize por blocos e reserve horários. Clique em **Salvar meu dia** para persistir. A revisão das rotinas continua em http://localhost:3210/revisao. Ambos usam o SQLite local. Veja [execução, fonte de verdade e backups](docs/REVISAO-LOCAL.md) e o [histórico de entregas](CHANGELOG.md). A integração Apps Script descrita abaixo é o quadro anterior e não é necessária para o planejador local.

Veja o [mapa do projeto e plano de evolução](docs/MAPA-DO-PROJETO.md) para o estado real das funcionalidades, limites encontrados e primeira etapa para computador e Chrome no iPhone 11. O app Android em Kotlin fica para a segunda etapa. As orientações de comentários e manutenção estão em [docs/ORIENTACOES.md](docs/ORIENTACOES.md).

Site próprio (Netlify/Vercel) que conclui tasks do Google Tasks, registra o
que foi/não foi feito numa planilha do Google Sheets, e mostra um dashboard
de cumprimento — tudo sem custo.

```
[Site (Netlify/Vercel)] --fetch--> [Apps Script Web App] --> Tasks API
                                                          --> Calendar API
                                                          --> Google Sheets
```

## 1. Crie a planilha

1. Crie uma planilha nova no Google Sheets (nome livre).
2. Copie o **ID da planilha** — é a parte da URL entre `/d/` e `/edit`:
   `https://docs.google.com/spreadsheets/d/ESTE_É_O_ID/edit`
3. Não precisa criar abas nem cabeçalhos: o script cria a aba `Log`
   automaticamente na primeira execução.

## 2. Crie o projeto Apps Script

1. Acesse [script.google.com](https://script.google.com) → **Novo projeto**.
2. Apague o conteúdo padrão de `Code.gs` e cole o conteúdo de
   [`apps-script/Code.gs`](apps-script/Code.gs).
3. No menu **Editor de manifesto do app** (ou nas Configurações do projeto,
   ative "Mostrar arquivo de manifesto appsscript.json"), substitua o
   conteúdo pelo de [`apps-script/appsscript.json`](apps-script/appsscript.json).
4. Ative o serviço avançado **Tasks API**:
   - Menu lateral → **Serviços** → `+` → escolha "Tasks API" → Adicionar.
   (Isso já está declarado no manifesto, mas confirme que aparece na lista.)
5. Em `Code.gs`, preencha as constantes no topo:
   ```js
   const SPREADSHEET_ID = 'cole o ID da planilha aqui';
   const SECRET_TOKEN = 'invente uma string aleatória longa';
   ```
   Dica para gerar um token: qualquer gerador de UUID online, ou rode
   `openssl rand -hex 16` no terminal.

## 3. Publique como Web App

1. No editor, clique em **Implantar → Nova implantação**.
2. Tipo: **App da Web**.
3. "Executar como": **Eu (seu e-mail)**.
4. "Quem pode acessar": **Qualquer pessoa**.
5. Implantar. Na primeira vez, o Google vai pedir para autorizar os escopos
   (Tasks, Calendar, Sheets) — autorize com sua conta.
6. Copie a **URL do app da web** gerada (termina em `/exec`).

> Sempre que editar o código, use **Gerenciar implantações → Editar → Nova
> versão** para que a URL publicada reflita as mudanças.

## 4. Crie o gatilho diário (opcional, mas recomendado)

Isso registra automaticamente como "não feito" tudo que ficou pendente no
fim do dia.

1. No editor do Apps Script, selecione a função `criarTriggerDiario` no
   seletor de funções (topo).
2. Clique em **Executar** uma única vez.
3. Confirme em **Gatilhos** (ícone de relógio na lateral) que o trigger
   `snapshotDiario` foi criado para rodar todo dia às 23h.

## 5. Configure o site

1. Dentro de `site/`, copie `config.example.js` para `config.js`:
   ```bash
   cp site/config.example.js site/config.js
   ```
2. Edite `site/config.js` com a URL do passo 3 e o token do passo 2:
   ```js
   const CONFIG = {
     APPS_SCRIPT_URL: 'https://script.google.com/macros/s/SEU_ID/exec',
     TOKEN: 'o mesmo token que você colocou no Code.gs'
   };
   ```
3. Teste local: abra `site/index.html` direto no navegador (ou rode um
   servidor estático simples, tipo `npx serve site`).

⚠️ **Sobre o token**: como é um site estático, o token fica visível no
JS do navegador (F12 → Sources). Para uso pessoal isso é aceitável — ele só
impede acesso casual/automatizado de terceiros, não é uma segurança forte.
Se quiser mais proteção depois, dá pra colocar uma função serverless na
Vercel/Netlify na frente, que guarda o token como variável de ambiente e
repassa a chamada para o Apps Script.

## 6. Deploy no Netlify ou Vercel

Como é HTML/CSS/JS puro, não tem build step.

**Netlify:**
```bash
npx netlify-cli deploy --dir=site --prod
```
ou simplesmente conecte o repositório Git e configure:
- Base directory: `site`
- Build command: (vazio)
- Publish directory: `site`

**Vercel:**
```bash
npx vercel --cwd site --prod
```
ou conecte o repo e configure "Root Directory" = `site`.

## 7. Git

```bash
cd task-tracker
git init
git add .
git commit -m "Setup inicial: task tracker com Apps Script + site"
git branch -M main
git remote add origin <URL_DO_SEU_REPO>
git push -u origin main
```

O `.gitignore` já exclui `site/config.js` (onde fica seu token real) —
quem clonar o repo usa `config.example.js` como referência.

## Estrutura de dados na planilha (aba `Log`)

| data       | hora     | item              | categoria | status     | origem  |
|------------|----------|-------------------|-----------|------------|---------|
| 2026-09-03 | 14:32:01 | Enviar relatório  | task      | feito      | task    |
| 2026-09-03 | 23:00:00 | Reunião com time  | evento    | não feito  | evento  |

## Próximos passos possíveis

- Adicionar categorias customizadas (ex: saúde, trabalho, estudo) passando
  `categoria` na hora de concluir, ao invés de usar só a origem.
- Streak de dias consecutivos cumprindo 100% das tarefas.
- Notificação (e-mail via `MailApp`) se a taxa de cumprimento cair muito.
- PWA no site pra virar "appzinho" instalável no celular.
