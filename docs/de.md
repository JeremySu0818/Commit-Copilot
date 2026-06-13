# Commit Copilot Update-Informationen

## Neue Funktionen in Version 1.14.0

- Unterstützung des Ollama-Proxy-Modus: Einführung von Text-Agent-Tool-Protokollen zur Entfernung des erzwungenen Direct-Diff-Fallback-Mechanismus sowie Unterstützung für den Abbruch des Ollama-Modelldownloads (Pull) beim Abbrechen der Generierung.
- Unterstützung für benutzerdefinierte Anthropic-Anbieter: Ermöglicht die Konfiguration benutzerdefinierter Endpunkte im Anthropic-API-Format und die Festlegung maximaler Ausgabe-Token. Zudem wurden die Eingabereihenfolge neuer Felder optimiert und alte Einstellungen automatisch migriert.
- Modularisierung der Kernarchitektur: Aufteilung der Kernkomponenten wie Generierungsorchestrierung, Git-Operationen, Modellverwaltung und Webview-Protokolle in eigenständige Module sowie Modularisierung von Sprach-Prompts zur Verbesserung der Ladeleistung.
- Vereinfachte Anzeigenamen der Anbieter: Die Bezeichnungen der integrierten Anbieter wurden auf sauberere Namen korrigiert.
- Korrektur der UI-Sprachbezeichnungen: Die Aktionsbezeichnung der Modellsteuerung wurde von „Modell hinzufügen“ in „Modelle verwalten...“ geändert, um besser zum Funktionsbildschirm zu passen.
- Aktualisierung und Optimierung der README.md-Dokumentation und der Konfigurationsbeispiele.
