# Informações de Atualização do Commit Copilot

## Novidades na Versão 1.14.0

- Suporte ao modo proxy do Ollama: Introdução de protocolos de ferramentas de agente de texto para remover o mecanismo de fallback obrigatório Direct Diff, e suporte para abortar o progresso do download (Pull) do modelo do Ollama ao cancelar a geração.
- Suporte a provedores personalizados da Anthropic: Permissão para configurar endpoints personalizados no formato da API da Anthropic, definição de limite máximo de tokens de saída, otimização da ordem de entrada dos novos campos e migração automática das configurações antigas.
- Modularização da arquitetura principal: Divisão dos componentes principais, como orquestração de geração, operações Git, gerenciamento de modelos e protocolos de webview, em módulos independentes, além da modularização dos prompts de idioma para melhorar o desempenho de carregamento.
- Simplificação dos nomes de exibição dos provedores: Correção dos rótulos dos provedores integrados para nomes mais limpos.
- Correção dos rótulos de idioma da interface: Alteração do rótulo de ação do seletor de modelos de "Adicionar Modelo" para "Gerenciar Modelos..." para melhor correspondência com a tela da funcionalidade.
- Atualização e otimização da documentação do README.md e dos exemplos de configuração.
