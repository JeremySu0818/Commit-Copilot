# Informações de Atualização do Commit Copilot

## Novidades na Versão 1.20.0

- Corrigido um problema em que as chamadas de ferramentas no endpoint da OpenAI falhavam devido a palavras-chave de esquema não suportadas, sanitizando corretamente os esquemas de parâmetros para chamadas de função e a API Responses.
- Desativado o modo thinking do Ollama em requisições de Agent e Direct Diff para garantir o retorno das mensagens de commit e das chamadas de ferramentas.
- Corrigido um problema em que as chamadas de ferramentas do Google Gemini falhavam, passando corretamente os parâmetros de declaração de funções através do campo JSON Schema nativo.
- Adicionado suporte para Gemini 3.8 Flash no provedor Google Gemini e atualizado o modelo padrão do Google para Gemini 3.8 Flash.
- Adicionado suporte para GPT-6 Astra no provedor OpenAI.
- Adicionado suporte para Claude Fable 5.1 no provedor Anthropic Claude.
- Atualizado o catálogo de modelos DeepSeek com DeepSeek V4.1 Flash, e removidos os modelos descontinuados.
- Adicionado suporte para GPT-6 Luna, GPT-6 Sol e GPT-6.1 Sol no provedor OpenAI, e atualizado o modelo padrão da OpenAI para GPT-6.1 Sol.
- Adicionado suporte para Claude Opus 5.5 no provedor Anthropic Claude.
- Adicionado suporte para Grok 4.7 no provedor xAI Grok.
- Atualizado o catálogo de modelos Groq com Qwen 3.8 27b, e removidos os modelos descontinuados.
