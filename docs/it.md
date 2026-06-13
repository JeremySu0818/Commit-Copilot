# Informazioni sull'aggiornamento di Commit Copilot

## Novità della versione 1.14.0

- Supporto per la modalità proxy di Ollama: Introdotti protocolli di strumenti per agenti di testo per rimuovere il meccanismo di fallback Direct Diff forzato, e supportata l'interruzione del download (Pull) del modello Ollama in caso di annullamento della generazione.
- Supporto per provider Anthropic personalizzati: Consente di impostare endpoint personalizzati in formato API Anthropic e configurare i token di output massimi, ottimizzando l'ordine di inserimento dei nuovi campi e migrando automaticamente le vecchie impostazioni.
- Modularizzazione dell'architettura centrale: Divisione dei componenti principali come l'orchestrazione della generazione, le operazioni Git, la gestione dei modelli e i protocolli webview in moduli indipendenti, e modularizzazione dei prompt di lingua per migliorare le prestazioni di caricamento.
- Semplificazione dei nomi visualizzati dei provider: Corrette le etichette dei provider integrati con nomi più puliti.
- Correzione delle etichette della lingua dell'interfaccia: Modificata l'etichetta dell'azione del selettore di modelli da "Aggiungi modello" a "Gestisci modelli..." per renderla più coerente con la schermata delle funzioni.
- Aggiornamento e ottimizzazione della documentazione README.md e degli esempi di configurazione.
