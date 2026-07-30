# Informações de Atualização do Commit Copilot

## Novidades na Versão 1.18.0

- Adicionado suporte para consultar os diffs de vários arquivos em uma única solicitação de ferramenta, retornando o diff exato completo de cada arquivo solicitado.
- Implementada a verificação obrigatória de cobertura de diffs para garantir que todos os arquivos alterados sejam inspecionados antes de finalizar a geração da mensagem de commit.
- Corrigido o cancelamento de requisições para abortar imediatamente conexões HTTP ativas com provedores LLM quando a geração é cancelada.
