# Informacje o aktualizacji Commit Copilot

## Nowości w wersji 1.20.0

- Naprawiono błąd powodujący niepowodzenie wywołań narzędzi punktu końcowego OpenAI z powodu nieobsługiwanych słów kluczowych schematu, prawidłowo filtrując schematy parametrów dla wywołań funkcji i Responses API.
- Wyłączono tryb thinking w Ollama dla zapytań w trybie Agent i Direct Diff, aby zapewnić zwracanie wiadomości commitów oraz wywołań narzędzi.
- Naprawiono błąd powodujący niepowodzenie wywołań narzędzi w Google Gemini, przekazując poprawnie parametry deklaracji funkcji w natywnym polu JSON Schema.
- Dodano obsługę Gemini 3.8 Flash dla dostawcy Google Gemini oraz zaktualizowano domyślny model Google do Gemini 3.8 Flash.
- Dodano obsługę GPT-6 Astra dla dostawcy OpenAI.
- Dodano obsługę Claude Fable 5.1 dla dostawcy Anthropic Claude.
- Zaktualizowano katalog modeli DeepSeek o DeepSeek V4.1 Flash oraz usunięto przestarzałe modele.
- Dodano obsługę GPT-6 Luna, GPT-6 Sol oraz GPT-6.1 Sol dla dostawcy OpenAI oraz zaktualizowano domyślny model OpenAI do GPT-6.1 Sol.
- Dodano obsługę Claude Opus 5.5 dla dostawcy Anthropic Claude.
- Dodano obsługę Grok 4.7 dla dostawcy xAI Grok.
- Zaktualizowano katalog modeli Groq o Qwen 3.8 27b oraz usunięto przestarzałe modele.
