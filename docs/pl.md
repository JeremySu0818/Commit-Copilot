# Informacje o aktualizacji Commit Copilot

## Nowości w wersji 1.14.0

- Obsługa trybu proxy Ollama: Wprowadzono protokoły narzędzi agenta tekstowego w celu usunięcia wymuszonego mechanizmu awaryjnego Direct Diff oraz dodano obsługę przerywania pobierania (Pull) modelu Ollama podczas anulowania generowania.
- Obsługa niestandardowych dostawców Anthropic: Umożliwiono konfigurowanie niestandardowych punktów końcowych w formacie API Anthropic, ustawianie maksymalnej liczby tokenów wyjściowych, zoptymalizowano kolejność wprowadzania nowych pól oraz automatycznie zmigrowano starsze ustawienia.
- Modularyzacja architektury rdzenia: Podzielono kluczowe komponenty, takie jak orkiestracja generowania, operacje Git, zarządzanie modelami i protokoły webview, na niezależne moduły oraz zmodularyzowano prompty językowe w celu poprawy wydajności ładowania.
- Uproszczenie wyświetlanych nazw dostawców: Poprawiono etykiety wbudowanych dostawców na czytelniejsze nazwy.
- Poprawki etykiet językowych interfejsu: Zmieniono etykietę akcji selektora modeli z „Dodaj model” na „Zarządzaj modelami...”, aby lepiej pasowała do ekranu funkcji.
- Aktualizacja i optymalizacja dokumentacji README.md oraz przykładowych konfiguracji.
