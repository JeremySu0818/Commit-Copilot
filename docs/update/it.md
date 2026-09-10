# Informazioni sull'aggiornamento di Commit Copilot

## Novità della versione 1.20.0

- Disattivata la modalità thinking di Ollama nelle richieste Agent e Direct Diff per garantire la corretta restituzione dei messaggi di commit e delle chiamate agli strumenti.
- Risolto un problema per cui le chiamate agli strumenti di Google Gemini fallivano, passando correttamente i parametri di dichiarazione delle funzioni tramite il campo JSON Schema nativo.
- Aggiunto il supporto per Gemini 3.8 Flash nel provider Google Gemini e aggiornato il modello predefinito di Google a Gemini 3.8 Flash.
- Aggiunto il supporto per GPT-6 Astra nel provider OpenAI.
- Aggiunto il supporto per Claude Fable 5.1 nel provider Anthropic Claude.
- Aggiornato il catalogo dei modelli DeepSeek con DeepSeek V4.1 Flash, e rimossi i modelli deprecati.
