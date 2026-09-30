# Informace o aktualizaci Commit Copilot

## Novinky ve verzi 1.20.0

- Opraven problém, při kterém selhávalo volání nástrojů koncového bodu OpenAI kvůli nepodporovaným klíčovým slovům schématu, správným očištěním schémat parametrů pro volání funkcí a Responses API.
- Zakázán režim thinking u Ollama v požadavcích Agent a Direct Diff, aby bylo zajištěno správné vracení zpráv commitu a volání nástrojů.
- Opraven problém, při kterém selhávalo volání nástrojů Google Gemini, správným předáváním parametrů deklarace funkcí prostřednictvím pole JSON Schema.
- Přidána podpora pro Gemini 3.8 Flash u poskytovatele Google Gemini a výchozí model Google byl aktualizován na Gemini 3.8 Flash.
- Přidána podpora pro GPT-6 Astra u poskytovatele OpenAI.
- Přidána podpora pro Claude Fable 5.1 u poskytovatele Anthropic Claude.
- Aktualizován katalog modelů DeepSeek o DeepSeek V4.1 Flash a odstraněny zastaralé modely.
- Přidána podpora pro GPT-6 Luna, GPT-6 Sol a GPT-6.1 Sol u poskytovatele OpenAI a výchozí model OpenAI byl aktualizován na GPT-6.1 Sol.
- Přidána podpora pro Claude Opus 5.5 u poskytovatele Anthropic Claude.
- Přidána podpora pro Grok 4.7 u poskytovatele xAI Grok.
- Aktualizován katalog modelů Groq o Qwen 3.8 27b a odstraněny zastaralé modely.
