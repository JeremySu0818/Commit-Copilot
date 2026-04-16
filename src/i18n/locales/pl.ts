import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const plLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Brak repozytorium Git',
      action: 'Otwórz folder zawierający repozytorium Git.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Nie udało się dodać zmian do poczekalni (stage)',
      action: 'Sprawdź, czy Git jest poprawnie skonfigurowany.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Brak zmian do zatwierdzenia',
      action: 'Najpierw wprowadź jakieś zmiany w plikach.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Nie wykryto zmian w poczekalni',
      action:
        'Znaleziono nieśledzone pliki. Dodaj je do poczekalni, aby wygenerować komunikat commita.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Znaleziono tylko nieśledzone pliki',
      action:
        'Masz nowo utworzone pliki, ale brak śledzonych modyfikacji. Dodaj je do poczekalni, aby wygenerować commita.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Generowanie anulowane',
      action: 'Generowanie zostało anulowane przez użytkownika.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Wykryto mieszane zmiany',
      action:
        'Masz zarówno zmiany w poczekalni, jak i poza nią. Wybierz, jak chcesz kontynuować.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'Brak klucza API',
      action: 'Ustaw klucz API w panelu Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Nieprawidłowy klucz API',
      action:
        'Twój klucz API jest nieprawidłowy lub został unieważniony. Sprawdź go i zaktualizuj.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'Przekroczono limit API',
      action:
        'Przekroczyłeś swój limit wykorzystania API. Sprawdź swoje konto u dostawcy usług.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'Żądanie API nie powiodło się',
      action: 'Wystąpił błąd podczas komunikacji z API. Spróbuj ponownie.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Nie udało się zatwierdzić zmian',
      action: 'Sprawdź, czy nie ma konfliktów lub problemów z Git.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Wystąpił nieoczekiwany błąd',
      action: 'Sprawdź szczegóły w oknie wyjściowym "Commit-Copilot Debug".',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Żądanie wygenerowania zignorowane: generowanie jest już w toku.',
      generationStart: (timestamp) =>
        `[${timestamp}] Rozpoczynanie generowania przez commit-copilot...`,
      gitExtensionMissing: 'Błąd: Nie znaleziono rozszerzenia Git.',
      selectedRepoFromScm: (path) =>
        `Wybrano repozytorium z kontekstu SCM: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Wybrano repozytorium z aktywnego edytora: ${path}`,
      noRepoMatchedActiveEditor:
        'Żadne repozytorium nie pasuje do aktywnego edytora.',
      noActiveEditorForRepoSelection:
        'Nie znaleziono aktywnego edytora do wyboru repozytorium.',
      selectedOnlyRepo: (path) => `Wybrano jedyne repozytorium: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Znaleziono ${String(count)} repozytoria, ale nie można określić, które jest aktywne.`,
      noRepoInApi: 'Nie znaleziono repozytoriów w API.',
      usingProvider: (providerName) => `Używanie dostawcy: ${providerName}`,
      usingGenerateMode: (mode) => `Tryb generowania: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Opcje wyjścia commita: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Ostrzeżenie: Nie znaleziono klucza API dla ${provider}.`,
      cancelRequestedFromProgress: 'Zażądano anulowania z interfejsu postępu.',
      callingGenerateCommitMessage: 'Wywoływanie generateCommitMessage...',
      repositoryPath: (path) => `Ścieżka repozytorium: ${path}`,
      usingModel: (model) => `Używanie modelu: ${model}`,
      generatedMessage: (message) => `Wygenerowany komunikat: ${message}`,
      generationError: (errorCode, message) =>
        `Błąd: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Nieoczekiwany błąd: ${message}`,
      openingLanguageSettings:
        'Otwieranie ustawień języka w widoku aktywności...',
    },
    notification: {
      gitExtensionMissing:
        'Nie znaleziono rozszerzenia Git. Upewnij się, że Git jest zainstalowany, a rozszerzenie Git włączone.',
      multiRepoWarning:
        'Znaleziono kilka repozytoriów Git. Skup się na pliku w docelowym repozytorium lub uruchom z widoku SCM.',
      repoNotFound:
        'Nie znaleziono repozytorium Git. Otwórz folder zawierający repozytorium Git.',
      apiKeyMissing: (providerName) =>
        `Klucz API dla ${providerName} nie jest skonfigurowany. Najpierw ustaw klucz API w panelu Commit-Copilot.`,
      configureApiKeyAction: 'Skonfiguruj klucz API',
      mixedChangesQuestion:
        'Masz zmiany zarówno w poczekalni (staged), jak i poza nią. Jak chcesz kontynuować?',
      stageAllAndGenerate: 'Dodaj wszystko do poczekalni i generuj',
      proceedStagedOnly: 'Kontynuuj tylko z plikami w poczekalni',
      cancel: 'Anuluj',
      noStagedButUntrackedQuestion:
        'Nie wykryto zmian w poczekalni. Znaleziono nieśledzone pliki. Czy chcesz dodać wszystkie pliki do poczekalni (w tym nieśledzone), czy wygenerować tylko dla śledzonych zmodyfikowanych plików?',
      stageAndGenerateAll: 'Dodaj do poczekalni i generuj wszystkie',
      generateTrackedOnly: 'Generuj tylko dla śledzonych',
      onlyUntrackedQuestion:
        'Obecne są tylko nieśledzone pliki, bez śledzonych modyfikacji. Czy chcesz dodać te nowe pliki do poczekalni i śledzić je, aby wygenerować commita?',
      stageAndTrack: 'Dodaj do poczekalni i śledź',
      commitGenerated: 'Komunikat commita wygenerowany!',
      viewProviderConsoleAction: 'Wyświetl konsolę dostawcy',
      noChanges:
        'Brak zmian do zatwierdzenia. Najpierw wprowadź jakieś zmiany!',
      generationCanceled: 'Generowanie komunikatu commita anulowane.',
      failedPrefix: 'Commit-Copilot napotkał błąd',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'Nieprawidłowy klucz API',
    quotaExceededPrefix: 'Przekroczono limit API',
    apiRequestFailedPrefix: 'Żądanie API nie powiodło się',
    connectionErrorPrefix: 'Błąd połączenia',
    unknownProvider: 'Nieznany dostawca',
    cannotConnectOllamaAt: (host) =>
      `Nie można połączyć się z Ollama pod adresem ${host}`,
    cannotConnectOllama: (message) =>
      `Nie można połączyć się z Ollama: ${message}. Upewnij się, że Ollama jest uruchomiona.`,
    apiKeyCannotBeEmpty: 'Klucz API nie może być pusty',
    validationFailedPrefix: 'Weryfikacja nie powiodła się',
    unableToConnectFallback: 'Nie można nawiązać połączenia',
    saveConfigSuccess: (providerName) =>
      `Pomyślnie zapisano konfigurację dla ${providerName}!`,
    saveConfigFailed: 'Nie udało się zapisać konfiguracji',
    languageSaved: (label) => `Zaktualizowano język: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'Dostawca API',
      configuration: 'Konfiguracja API',
      ollamaConfiguration: 'Konfiguracja Ollama',
      model: 'Model',
      generateConfiguration: 'Konfiguracja generowania',
      settings: 'Ustawienia',
      addProvider: 'Dodaj niestandardowego dostawcę',
      editProvider: 'Edytuj niestandardowego dostawcę',
    },
    labels: {
      provider: 'Dostawca',
      apiKey: 'Klucz API',
      ollamaHostUrl: 'Adres hosta Ollama',
      model: 'Model',
      mode: 'Tryb',
      conventionalCommitSections: 'Sekcje konwencjonalnego commita',
      includeScope: 'Uwzględnij zakres (scope)',
      includeBody: 'Uwzględnij treść (body)',
      includeFooter: 'Uwzględnij stopkę (footer)',
      language: 'Język rozszerzenia',
      maxAgentSteps: 'Maks. kroków agenta',
      providerName: 'Nazwa dostawcy',
      apiBaseUrl: 'Podstawowy adres URL API',
    },
    placeholders: {
      selectProvider: 'Wybierz dostawcę...',
      selectModel: 'Wybierz model...',
      selectGenerateMode: 'Wybierz tryb generowania...',
      enterApiKey: 'Wprowadź swój klucz API',
      enterGeminiApiKey: 'Wprowadź swój klucz API Gemini',
      enterOpenAIApiKey: 'Wprowadź swój klucz API OpenAI',
      enterAnthropicApiKey: 'Wprowadź swój klucz API Anthropic',
      enterCustomApiKey: 'Wprowadź klucz API',
    },
    buttons: {
      save: 'Zapisz',
      validating: 'Weryfikowanie...',
      generateCommitMessage: 'Generuj komunikat commita',
      cancelGenerating: 'Anuluj generowanie',
      back: 'Wstecz',
      editProvider: 'Edytuj dostawcę',
      addProvider: '+ Dodaj dostawcę...',
      deleteProvider: 'Usuń dostawcę',
    },
    statuses: {
      checkingStatus: 'Sprawdzanie statusu...',
      configured: 'Skonfigurowano',
      notConfigured: 'Nie skonfigurowano',
      validating: 'Weryfikowanie...',
      loadingConfiguration: 'Ładowanie konfiguracji...',
      noChangesDetected: 'Nie wykryto zmian',
      cancelCurrentGeneration: 'Anuluj bieżące generowanie',
      languageSaved: 'Język zaktualizowany.',
      providerNameConflict: 'Dostawca o tej nazwie już istnieje.',
      providerNameRequired: 'Nazwa dostawcy jest wymagana.',
      baseUrlRequired: 'Podstawowy adres URL API jest wymagany.',
      apiKeyRequired: 'Klucz API jest wymagany.',
      providerSaved: 'Niestandardowy dostawca został zapisany!',
      providerDeleted: 'Niestandardowy dostawca został usunięty.',
      modelNameRequired: 'Wprowadź nazwę modelu przed wygenerowaniem.',
    },
    descriptions: {
      ollamaFixedToDirectDiff:
        'Ollama jest na sztywno przypisana do trybu Direct Diff',
      agenticModeDescription:
        'Tryb agenta używa narzędzi repozytorium do głębszej analizy',
      directDiffDescription:
        'Direct Diff wysyła surowe roznice bezpośrednio do modelu',
      ollamaInfo:
        '<strong>Ollama</strong> działa lokalnie na twojej maszynie.<br>Domyślny host: <code>{host}</code><br>Upewnij się, że Ollama jest uruchomiona przed generowaniem.',
      googleInfo:
        'Zdobądź klucz API w <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Zdobądź klucz API w <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Zdobądź klucz API w <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Ogranicz wywołania narzędzi agenta na generowanie. Wpisz 0 lub pozostaw puste, aby usunąć limit.',
      customProviderInfo:
        'Niestandardowi dostawcy muszą być <strong>zgodni z OpenAI</strong>.<br>Podstawowy adres URL API (API Base URL) powinien wskazywać na usługę implementującą funkcję OpenAI Chat Completions API.',
    },
    options: {
      agentic: 'Generowanie agentowe',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'Agent analizuje zmiany...',
    generatingMessage: 'Generowanie komunikatu commita...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Przejściowy błąd API. Ponowna próba (${String(attempt)}/${String(maxAttempts)}) za ${String(seconds)}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Pobieranie ${model}: ${status} (${String(percent)}%)`
        : `Pobieranie ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Krok ${String(step)}] Analizowanie różnic: ${path}`,
    stepReadingFile: (step, path) =>
      `[Krok ${String(step)}] Czytanie pliku: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Krok ${String(step)}] Pobieranie struktury: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Krok ${String(step)}] Szukanie referencji: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Krok ${String(step)}] Pobieranie ostatnich commitów: ${String(count)} wpisów`
        : `[Krok ${String(step)}] Pobieranie ostatnich commitów...`,
    stepSearchingProject: (step, keyword) =>
      `[Krok ${String(step)}] Przeszukiwanie projektu pod kątem: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Krok ${String(step)}] Wywoływanie ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Krok ${String(step)}] Analizowanie różnic: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Krok ${String(step)}] Analizowanie różnic dla ${String(count)} plików...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Krok ${String(step)}] Czytanie plików: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Krok ${String(step)}] Czytanie ${String(count)} plików...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Krok ${String(step)}] Pobieranie struktury: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Krok ${String(step)}] Pobieranie struktury dla ${String(count)} plików...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Krok ${String(step)}] Szukanie referencji: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Krok ${String(step)}] Szukanie referencji dla ${String(count)} symboli...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Krok ${String(step)}] Przeszukiwanie projektu pod kątem: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Krok ${String(step)}] Przeszukiwanie projektu pod kątem ${String(count)} słów kluczowych...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Krok ${String(step)}] Wykonywanie ${String(count)} narzędzi analitycznych...`,
  },
};
