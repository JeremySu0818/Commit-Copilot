# Commit Copilot Update-Informationen

## Neue Funktionen in Version 1.18.0

- Unterstützung für die Abfrage mehrerer Datei-Diffs in einer einzelnen Tool-Anforderung hinzugefügt, wobei der vollständige exakte Diff jeder angeforderten Datei zurückgegeben wird.
- Erzwingung vollständiger Diff-Abdeckung eingeführt, um sicherzustellen, dass alle geänderten Dateien vor der Commit-Nachrichtengenerierung überprüft werden.
- Behebung der Anfrageabbrechung, um aktive HTTP-Verbindungen zu LLM-Anbietern beim Abbrechen der Generierung sofort zu beenden.
