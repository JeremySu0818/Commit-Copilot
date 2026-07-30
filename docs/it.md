# Informazioni sull'aggiornamento di Commit Copilot

## Novità della versione 1.18.0

- Aggiunto il supporto per la richiesta dei diff di più file in un'unica chiamata di strumento, restituendo il diff esatto completo di ogni file richiesto.
- Introdotta la verifica obbligatoria della copertura dei diff per garantire l'ispezione di tutti i file modificati prima di completare il messaggio di commit.
- Risolto l'annullamento delle richieste per interrompere immediatamente le connessioni HTTP attive ai provider LLM quando la generazione viene annullata.
