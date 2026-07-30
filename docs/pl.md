# Informacje o aktualizacji Commit Copilot

## Nowości w wersji 1.18.0

- Dodano obsługę pobierania diffów wielu plików w jednym wywołaniu narzędzia wraz ze zwracaniem pełnego, dokładnego diffu każdego żądanego pliku.
- Wprowadzono wymóg pełnego pokrycia diff, aby upewnić się, że wszystkie zmodyfikowane pliki zostały sprawdzone przed wygenerowaniem wiadomości commitu.
- Naprawiono anulowanie żądań, aby natychmiast przerywać aktywne połączenia HTTP z dostawcami LLM po anulowaniu generowania.
