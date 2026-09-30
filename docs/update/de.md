# Commit Copilot Update-Informationen

## Neue Funktionen in Version 1.20.0

- Ein Problem behoben, bei dem OpenAI-Endpunkt-Tool-Aufrufe aufgrund nicht unterstützter Schema-Schlüsselwörter fehlschlugen, indem Tool-Parameter-Schemas für Funktionsaufrufe und die Responses-API bereinigt werden.
- Den Ollama-Thinking-Modus bei Agent- und Direct-Diff-Anfragen deaktiviert, um sicherzustellen, dass Commit-Nachrichten und Tool-Aufrufe ordnungsgemäß zurückgegeben werden.
- Ein Problem behoben, bei dem Google Gemini-Tool-Aufrufe fehlschlugen, indem Funktionsdeklarations-Parameter nun korrekt über das native JSON-Schema-Feld übergeben werden.
- Unterstützung für Gemini 3.8 Flash im Google-Gemini-Anbieter hinzugefügt und das Standard-Google-Modell auf Gemini 3.8 Flash aktualisiert.
- Unterstützung für GPT-6 Astra im OpenAI-Anbieter hinzugefügt.
- Unterstützung für Claude Fable 5.1 im Anthropic-Claude-Anbieter hinzugefügt.
- Der DeepSeek-Modellkatalog wurde um DeepSeek V4.1 Flash erweitert und veraltete Modelle wurden entfernt.
- Unterstützung für GPT-6 Luna, GPT-6 Sol und GPT-6.1 Sol im OpenAI-Anbieter hinzugefügt und das Standard-OpenAI-Modell auf GPT-6.1 Sol aktualisiert.
- Unterstützung für Claude Opus 5.5 im Anthropic-Claude-Anbieter hinzugefügt.
- Unterstützung für Grok 4.7 im xAI-Grok-Anbieter hinzugefügt.
- Der Groq-Modellkatalog wurde um Qwen 3.8 27b aktualisiert und veraltete Modelle wurden entfernt.
