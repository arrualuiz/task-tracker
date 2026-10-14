# Orientações do projeto

- Este é o projeto ativo. A primeira etapa é o site acessível no computador e no Chrome do iPhone 11, sem instalar aplicativos. Android nativo em Kotlin fica para a segunda etapa.
- Escrever comentários em português ao criar ou alterar código: explicar a responsabilidade das funções, regras de negócio, entradas/saídas relevantes e efeitos nas integrações. Documentar também limites, decisões e motivos que não sejam óbvios pelo código.
- Manter comentários existentes corretos; evitar comentários que apenas repitam cada linha. HTML e CSS devem identificar blocos e explicar decisões de interação e responsividade.
- Atualizar o [MAPA-DO-PROJETO.md](MAPA-DO-PROJETO.md) quando o comportamento ou o estágio das integrações mudar. Distinguir o que está implementado do que está planejado.
- Separar seleção/aprovação para fazer de conclusão. Uma tarefa não selecionada não deve automaticamente contar como falha.
- Nas integrações futuras, usar IDs estáveis para relacionar planilha, Google Tasks e Calendar; não usar o título como identidade. Prever repetição de chamadas sem duplicar tarefas ou registros.
- Não gravar tokens reais em código, documentação ou commits. As credenciais existentes precisam ser migradas antes da publicação da próxima versão.
- Validar mudanças locais sem criar, concluir ou excluir tarefas reais como teste automático.
- Primeira etapa com várias contas do mesmo usuário: visão conjunta e filtros por conta, mantendo identidade e autorização separadas. Alexa fica com uma conta a definir e integração ainda a investigar.
- O calendário ICS recebido é a base inicial de rotinas. Preservar regras e exceções e manter inventários pessoais em dados-locais/, fora do Git e da pasta pública site/.
- Fazer commits por entrega funcional e registrar as alterações em CHANGELOG.md.
- A fonte de verdade das revisões é dados-locais/task-tracker.sqlite. Usar a API local para editar; não sobrescrever o banco com o inventário antigo. Histórico e edição devem ser gravados atomicamente.
