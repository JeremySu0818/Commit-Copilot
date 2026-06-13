# Informace o aktualizaci Commit Copilot

## Novinky ve verzi 1.14.0

- Podpora proxy režimu Ollama: Zavedeny protokoly textových agentů pro odstranění vynuceného záložního mechanismu Direct Diff a přidána podpora pro přerušení stahování (Pull) modelu Ollama při zrušení generování.
- Podpora pro vlastní poskytovatele Anthropic: Umožněno nastavení vlastních koncových bodů ve formátu Anthropic API, konfigurace maximálního počtu výstupních tokenů, optimalizováno pořadí zadávání nových polí a automaticky migrována starší nastavení.
- Modularizace jádra architektury: Rozdělení klíčových komponent, jako je orchestrace generování, operace Git, správa modelů a protokoly webview, do nezávislých modulů a modularizace jazykových promptů pro zvýšení výkonu načítání.
- Zjednodušení zobrazovaných názvů poskytovatelů: Opraveny štítky vestavěných poskytovatelů na čistší názvy.
- Oprava jazykových štítků uživatelského rozhraní: Opraven štítek akce v selektoru modelů z „Přidat model“ na „Spravovat modely...“, aby lépe odpovídal funkční obrazovce.
- Aktualizace a optimalizace dokumentace README.md a příkladů konfigurace.
