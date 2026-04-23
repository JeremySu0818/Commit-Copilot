import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const plLocale: LocaleTextBundle = {
  commitCopilotErrorMessages: {
    'api.keyMissing': () =>
      'API Key is not configured. Please set your API Key in the Commit-Copilot panel.',
    'api.keyInvalid': (args) =>
      args.details?.trim()
        ? 'Invalid API Key: {details}'.replace('{details}', args.details ?? '')
        : 'Invalid API Key.',
    'api.quotaExceeded': (args) =>
      args.details?.trim()
        ? 'API quota exceeded: {details}'.replace(
            '{details}',
            args.details ?? '',
          )
        : 'API quota exceeded.',
    'api.requestFailed': (args) =>
      args.details?.trim()
        ? 'API request failed: {details}'.replace(
            '{details}',
            args.details ?? '',
          )
        : 'API request failed.',
    'api.ollamaConnectionFailed': (args) =>
      'Cannot connect to Ollama. Make sure Ollama is running at {host}.'.replace(
        '{host}',
        args.host ?? '',
      ),
    'api.ollamaModelNotFound': (args) =>
      'Model "{model}" was not found. Pull it first with: ollama pull {model}'.replace(
        /\{model\}/g,
        args.model ?? '',
      ),
    'api.unknownAnthropicModel': (args) =>
      'Unknown Anthropic model "{model}". Add it to ANTHROPIC_MODELS with max_tokens.'.replace(
        '{model}',
        args.model ?? '',
      ),
    'api.emptyResponse': (args) =>
      'Empty response from {provider}.'.replace(
        '{provider}',
        args.provider ?? '',
      ),
    'api.emptyTextResponse': (args) =>
      'Empty text response from {provider}.'.replace(
        '{provider}',
        args.provider ?? '',
      ),
    'api.emptyFinalResponse': (args) =>
      'Empty final response from {provider}.'.replace(
        '{provider}',
        args.provider ?? '',
      ),
    'api.responseTruncated': (args) =>
      'Response from {provider} was truncated ({stopReason}).'
        .replace('{provider}', args.provider ?? '')
        .replace('{stopReason}', args.stopReason ?? ''),
    'api.finalResponseTruncated': (args) =>
      'Final response from {provider} was truncated ({stopReason}).'
        .replace('{provider}', args.provider ?? '')
        .replace('{stopReason}', args.stopReason ?? ''),
    'git.stageFailed': (args) =>
      args.details?.trim()
        ? 'Failed to stage changes: {details}'.replace(
            '{details}',
            args.details ?? '',
          )
        : 'Failed to stage changes.',
    'generation.noChanges': () =>
      'No changes detected to generate a commit for.',
    'generation.noChangesButUntracked': () =>
      'No changes to commit, but untracked files were detected.',
    'generation.noTrackedChangesButUntracked': () =>
      'No tracked changes detected, only untracked files are present.',
    'generation.mixedChanges': () =>
      'Both staged and unstaged changes were detected.',
    'generation.cancelled': () => 'Generation canceled by user.',
    'rewrite.commitHashRequired': () => 'Wymagany jest hash commita.',
    'rewrite.commitNotFound': (args) =>
      'Nie znaleziono commita "{commitHash}".'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'Commit "{commitHash}" jest merge commitem i ten workflow nie może go przepisać.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Nie można przepisywać commitów w stanie detached HEAD.',
    'rewrite.commitNotReachable': (args) =>
      'Commit "{commitHash}" nie jest przodkiem HEAD.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.upstreamVerifyFailed': (args) =>
      'Cannot verify upstream "{upstreamRef}" after fetch.'.replace(
        '{upstreamRef}',
        args.upstreamRef ?? '',
      ),
    'rewrite.remoteNotIntegrated': (args) =>
      'Cannot rewrite safely because local HEAD does not include latest {upstreamRef} ({remoteHash}). Run git pull --rebase (or merge) first.'
        .replace('{upstreamRef}', args.upstreamRef ?? '')
        .replace('{remoteHash}', args.remoteHash ?? ''),
    'rewrite.autoSyncMissingUpstream': () =>
      'Cannot auto-sync without an upstream branch. Configure upstream first.',
    'rewrite.autoSyncUpstreamUnavailable': (args) =>
      'Cannot auto-sync because upstream "{upstreamRef}" is unavailable after fetch.'.replace(
        '{upstreamRef}',
        args.upstreamRef ?? '',
      ),
    'rewrite.autoSyncUnsafeRemoteRewrite': (args) =>
      'Cannot auto-sync safely because upstream "{upstreamRef}" no longer contains {previousHash}.'
        .replace('{upstreamRef}', args.upstreamRef ?? '')
        .replace('{previousHash}', args.previousHash ?? ''),
    'rewrite.forcePushStaleInfo': () =>
      'Force-with-lease stale info: remote tracking ref changed before VS Code fallback.',
  },
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
      rewriteStart: (timestamp) =>
        `[${timestamp}] Uruchamianie generowania przepisywania commit-copilot...`,
      rewriteCancelRequestedFromProgress:
        'Anulowanie zażądane z interfejsu postępu.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit przepisany: ${originalHash} -> ${replacementHash}`,
      rewriteReplacementCommitFallback: 'updated',
      callingGenerateCommitMessage: 'Wywoływanie generateCommitMessage...',
      repositoryPath: (path) => `Ścieżka repozytorium: ${path}`,
      usingModel: (model) => `Używanie modelu: ${model}`,
      generatedMessage: (message) => `Wygenerowany komunikat: ${message}`,
      generationError: (errorCode, message) =>
        `Błąd: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Nieoczekiwany błąd: ${message}`,
      openingLanguageSettings:
        'Otwieranie ustawień języka w widoku aktywności...',
      rewriteLeaseProtectionBlocked:
        'Wypychanie zablokowane przez ochronę lease (zdalne repozytorium się zmieniło).',
      rewriteSuggestedRecoverySteps: 'Sugerowane kroki naprawy:',
      rewriteAutoSyncBeforeRetryFailed: (message) =>
        `Automatyczna synchronizacja przed ponowną próbą nie powiodła się: ${message}`,
      rewriteResolveConflictsContinueRebase:
        'Jeśli podczas rebase wystąpią konflikty, najpierw je rozwiąż, a potem kontynuuj rebase.',
      rewriteRecoveryCommand: (command) => `• ${command}`,
      rewriteAutoSyncPreviewSummary: (upstreamRef) =>
        `Auto-sync preview for ${upstreamRef}:`,
      rewriteAutoSyncRemoteTracking: (beforeHash, afterHash) =>
        `Remote tracking: ${beforeHash} -> ${afterHash}`,
      rewriteAutoSyncLocalHead: (headHash) =>
        `Local rewritten HEAD: ${headHash}`,
      rewriteAutoSyncCommitsToPush: 'Commits that will be pushed:',
      rewriteAutoSyncNoCommitsToPush: '(none)',
      rewriteAutoSyncDiffStat: 'Diff that will be pushed:',
      rewriteAutoSyncNoDiffStat: '(no diff)',
      rewriteAutoSyncRetryUsesCurrentLease:
        'Retry push will use the refreshed upstream lease, not the pre-rewrite hash.',
      rewriteCliAuthFailedUsingVscodeFallback:
        'CLI push failed because Git needs credentials; retrying through VS Code Git.',
      rewriteVscodeFallbackSkippedLeaseChanged:
        'VS Code Git fallback skipped because the remote tracking ref changed.',
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
      rewriteCanceled: 'Przepisywanie komunikatu commita anulowane.',
      failedPrefix: 'Commit-Copilot napotkał błąd',
      rewriteNoNonMergeCommits:
        'Nie znaleziono commitów niebędących merge w historii bieżącej gałęzi.',
      rewriteCommitNoSubject: '(brak tematu)',
      rewriteCommitRootDescription: 'commit główny',
      rewriteCommitMergeDescription: 'commit merge',
      rewriteCommitParentDescription: (parentHash) => `rodzic ${parentHash}`,
      rewriteCommitSelectTitle: 'Wybierz commit do przepisania',
      rewriteCommitSelectPlaceholder:
        'Wybierz commit z historii bieżącej gałęzi',
      rewriteWorkspaceDirtyBoth:
        'Nie można przepisać historii commitów, gdy istnieją zmiany staged (niezacommitowane) i modified (unstaged). Najpierw je commitnij lub stashuj.',
      rewriteWorkspaceDirtyStaged:
        'Nie można przepisać historii commitów, gdy istnieją zmiany staged (niezacommitowane). Najpierw je commitnij lub stashuj.',
      rewriteWorkspaceDirtyUnstaged:
        'Nie można przepisać historii commitów, gdy istnieją zmiany modified (unstaged). Najpierw je commitnij lub stashuj.',
      rewriteProgressTitle: (providerName) => `Przepisywanie (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `Analizowanie commita ${shortHash}...`,
      commitMessageCannotBeEmpty: 'Wiadomość commita nie może być pusta.',
      rewriteApplyingTitle: (shortHash) => `Przepisywanie ${shortHash}`,
      rewriteApplyingProgress: 'Przepisywanie historii commitów...',
      rewriteFailedHistory: 'Nie udało się przepisać historii commitów.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Wiadomość commita ${shortHash} została przepisana.`,
      rewriteDetachedHeadPushUnavailable:
        'Historia commitów została przepisana, ale force push with lease jest niedostępny w stanie detached HEAD.',
      rewriteForcePushPrompt: (target) =>
        `Historia przepisana. Wykonać force push with lease do ${target}?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease zakończony: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease nie powiódł się: ${message}`,
      pushingWithLease: 'Push with lease w toku',
      rewriteAutoSyncRetryAction: 'Automatycznie zsynchronizuj i wymuś push',
      rewriteAutoSyncRetryTitle: 'Automatyczna synchronizacja z upstream',
      rewriteAutoSyncPromptWithUpstream: (upstreamRef) =>
        `Zdalne ${upstreamRef} zostało zmienione. Uruchomić automatyczną synchronizację (fetch + rebase ${upstreamRef}) i wymusić push z lease? Podgląd zostanie zapisany w panelu wyjścia.`,
      rewriteAutoSyncFailed: (message) =>
        `Automatyczna synchronizacja nie powiodła się: ${message}. Rozwiąż konflikty (jeśli są), zakończ rebase i ponów push.`,
    },
  },
  mainViewText: {
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
      rewriteEditor: 'Przepisz',
      advancedFeatures: 'Funkcje zaawansowane',
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
      commitMessage: 'Wiadomość commita',
      selectedCommitMessage: 'Wybrana wiadomość commita',
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
      openAdvancedFeatures: 'Otwórz funkcje zaawansowane',
      rewriteCommitMessage: 'Przepisz wiadomość commita',
      confirmRewrite: 'Potwierdź przepisanie',
      cancel: 'Anuluj',
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
      commitMessageCannotBeEmpty: 'Wiadomość commita nie może być pusta.',
      pushingWithLease: 'Push with lease w toku...',
      forcePushWithLeaseCompleted: 'Force push with lease zakończony.',
      forcePushWithLeaseFailed: 'Force push with lease nie powiódł się.',
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
      advancedFeaturesDescription:
        'Otwórz zaawansowane narzędzia i przepływy pracy.',
      rewriteWorkflowDescription:
        'Po wybraniu commitu innego niż merge system ponownie generuje wiadomość w aktywnym trybie (Agentic / Direct Diff), używając bieżącego providera, modelu i ustawień formatu wyjścia (scope/body/footer), a następnie otwiera edytowalny ekran potwierdzenia; po zatwierdzeniu historia jest przepisywana przez rebase, z opcjonalnym force push with lease.',
      rewriteEditorDescription: 'Przejrzyj i potwierdź nową wiadomość commita.',
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
