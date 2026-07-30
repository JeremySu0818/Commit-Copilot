# Informações de Atualização do Commit Copilot

## Novidades na Versão 1.18.0

- Adicionado suporte para consultar os diffs de vários arquivos em uma única solicitação de ferramenta, retornando o diff exato completo de cada arquivo solicitado.
- Adicionada uma configuração opcional de cobertura completa de diffs, desativada por padrão, que quando ativada exige a inspeção de todos os arquivos alterados antes de finalizar a mensagem de commit.
- Corrigido o cancelamento de requisições para abortar imediatamente conexões HTTP ativas com provedores LLM quando a geração é cancelada.
