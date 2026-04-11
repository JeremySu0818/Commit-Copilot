import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const huLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Nem Git adattár',
      action: 'Kérjük, nyisson meg egy Git adattárat tartalmazó mappát.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Változtatások előkészítése sikertelen',
      action: 'Ellenőrizze, hogy a Git megfelelően van-e konfigurálva.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Nincsenek változtatások',
      action: 'Kérjük, először módosítson fájlokat.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Nincsenek előkészített változtatások',
      action:
        'Nem követett fájlok találhatók. Kérjük, készítse elő őket commit üzenet generálásához.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Csak nem követett fájlok találhatók',
      action:
        'Új fájlokat hozott létre, de nincsenek követett módosítások. Kérjük, készítse elő őket commit létrehozásához.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Generálás megszakítva',
      action: 'A generálást a felhasználó megszakította.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Vegyes változtatások észlelve',
      action:
        'Előkészített és nem előkészített változtatásai is vannak. Kérjük, válassza ki a folytatás módját.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API kulcs nincs beállítva',
      action: 'Kérjük, állítsa be az API kulcsot a Commit-Copilot panelen.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Érvénytelen API kulcs',
      action:
        'Az API kulcsa érvénytelen vagy vissza lett vonva. Kérjük, ellenőrizze és frissítse.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'API kvóta túllépve',
      action:
        'Túllépte az API kvótáját. Kérjük, ellenőrizze a szolgáltatói fiókját.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'API kérés sikertelen',
      action:
        'Hiba történt az API-val való kommunikáció során. Kérjük, próbálja újra.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Változtatások commitolása sikertelen',
      action: 'Ellenőrizze, hogy nincsenek-e Git ütközések vagy hibák.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Váratlan hiba történt',
      action:
        'További részletekért ellenőrizze a "Commit-Copilot Debug" kimenetet.',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Generálási kérés figyelmen kívül hagyva: a generálás már folyamatban van.',
      generationStart: (timestamp) =>
        `[${timestamp}] Commit-copilot generálás indítása...`,
      gitExtensionMissing: 'Hiba: Git kiterjesztés nem található.',
      selectedRepoFromScm: (path) =>
        `Kiválasztott adattár az SCM kontextusból: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Kiválasztott adattár az aktív szerkesztőből: ${path}`,
      noRepoMatchedActiveEditor:
        'Nincs az aktív szerkesztőhöz illeszkedő adattár.',
      noActiveEditorForRepoSelection:
        'Nincs aktív szerkesztő az adattár kiválasztásához.',
      selectedOnlyRepo: (path) => `Az egyetlen kiválasztott adattár: ${path}`,
      multiRepoNotDetermined: (count) =>
        `${count} adattár található, de az aktív nem határozható meg.`,
      noRepoInApi: 'Nincsenek adattárak az API-ban.',
      usingProvider: (providerName) => `Használt szolgáltató: ${providerName}`,
      usingGenerateMode: (mode) => `Generálási mód: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Commit kimeneti opciók: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Figyelmeztetés: Nem található API kulcs ehhez: ${provider}.`,
      cancelRequestedFromProgress: 'Megszakítás kérve a folyamatjelző UI-ról.',
      callingGenerateCommitMessage: 'generateCommitMessage hívása...',
      repositoryPath: (path) => `Adattár elérési útja: ${path}`,
      usingModel: (model) => `Használt modell: ${model}`,
      generatedMessage: (message) => `Generált üzenet: ${message}`,
      generationError: (errorCode, message) =>
        `Hiba: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Váratlan hiba: ${message}`,
      openingLanguageSettings:
        'Nyelvi beállítások megnyitása a tevékenység nézetben...',
    },
    notification: {
      gitExtensionMissing:
        'Git kiterjesztés nem található. Kérjük, győződjön meg arról, hogy a Git telepítve van, és a Git kiterjesztés engedélyezve van.',
      multiRepoWarning:
        'Több Git adattár található. Kérjük, fókuszáljon egy fájlra a cél adattárban, vagy futtassa az SCM nézetből.',
      repoNotFound:
        'Git adattár nem található. Kérjük, nyisson meg egy Git adattárat tartalmazó mappát.',
      apiKeyMissing: (providerName) =>
        `${providerName} API kulcs nincs beállítva. Kérjük, először állítsa be az API kulcsot a Commit-Copilot panelen.`,
      configureApiKeyAction: 'API kulcs beállítása',
      mixedChangesQuestion:
        'Előkészített és nem előkészített változtatásai is vannak. Hogyan szeretné folytatni?',
      stageAllAndGenerate: 'Összes előkészítése és generálás',
      proceedStagedOnly: 'Folytatás csak az előkészítettekkel',
      cancel: 'Mégse',
      noStagedButUntrackedQuestion:
        'Nincsenek előkészített változtatások. Nem követett fájlok találhatók. Szeretné az összes fájlt előkészíteni (beleértve a nem követetteket is), vagy csak a követett módosított fájlokra generálni?',
      stageAndGenerateAll: 'Összes előkészítése és generálás',
      generateTrackedOnly: 'Csak követettek generálása',
      onlyUntrackedQuestion:
        'Csak nem követett fájlok vannak jelen, követett módosítások nélkül. Szeretné előkészíteni és követni ezeket az új fájlokat a commit generálásához?',
      stageAndTrack: 'Előkészítés és követés',
      commitGenerated: 'Commit üzenet generálva!',
      viewProviderConsoleAction: 'Szolgáltatói konzol megtekintése',
      noChanges:
        'Nincsenek változtatások. Kérjük, először módosítson fájlokat!',
      generationCanceled: 'Commit üzenet generálása megszakítva.',
      failedPrefix: 'Commit-Copilot hiba',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'Érvénytelen API kulcs',
    quotaExceededPrefix: 'API kvóta túllépve',
    apiRequestFailedPrefix: 'API kérés sikertelen',
    connectionErrorPrefix: 'Kapcsolati hiba',
    unknownProvider: 'Ismeretlen szolgáltató',
    cannotConnectOllamaAt: (host) =>
      `Nem lehet csatlakozni az Ollamahoz itt: ${host}`,
    cannotConnectOllama: (message) =>
      `Nem lehet csatlakozni az Ollamahoz: ${message}. Győződjön meg arról, hogy az Ollama fut.`,
    apiKeyCannotBeEmpty: 'Az API kulcs nem lehet üres',
    validationFailedPrefix: 'Sikertelen érvényesítés',
    unableToConnectFallback: 'Sikertelen csatlakozás',
    saveConfigSuccess: (providerName) =>
      `${providerName} konfiguráció sikeresen mentve!`,
    saveConfigFailed: 'A konfiguráció mentése sikertelen',
    languageSaved: (label) => `Nyelv frissítve: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API Szolgáltató',
      configuration: 'API Konfiguráció',
      ollamaConfiguration: 'Ollama Konfiguráció',
      model: 'Modell',
      generateConfiguration: 'Generálás Konfigurációja',
      settings: 'Beállítások',
      addProvider: 'Egyéni szolgáltató hozzáadása',
      editProvider: 'Egyéni szolgáltató szerkesztése',
    },
    labels: {
      provider: 'Szolgáltató',
      apiKey: 'API Kulcs',
      ollamaHostUrl: 'Ollama Host URL',
      model: 'Modell',
      mode: 'Mód',
      conventionalCommitSections: 'Hagyományos Commit Szakaszok',
      includeScope: 'Hatáskör (Scope) belefoglalása',
      includeBody: 'Törzs (Body) belefoglalása',
      includeFooter: 'Lábjegyzet (Footer) belefoglalása',
      language: 'Kiterjesztés Nyelve',
      maxAgentSteps: 'Max ügynök lépés',
      providerName: 'Szolgáltató neve',
      apiBaseUrl: 'API Base URL',
    },
    placeholders: {
      selectProvider: 'Válasszon szolgáltatót...',
      selectModel: 'Válasszon modellt...',
      selectGenerateMode: 'Válasszon generálási módot...',
      enterApiKey: 'Adja meg az API kulcsot',
      enterGeminiApiKey: 'Adja meg a Gemini API kulcsot',
      enterOpenAIApiKey: 'Adja meg az OpenAI API kulcsot',
      enterAnthropicApiKey: 'Adja meg az Anthropic API kulcsot',
      enterCustomApiKey: 'Adja meg az API kulcsot',
    },
    buttons: {
      save: 'Mentés',
      validating: 'Érvényesítés...',
      generateCommitMessage: 'Commit Üzenet Generálása',
      cancelGenerating: 'Generálás Megszakítása',
      back: 'Vissza',
      editProvider: 'Szolgáltató szerkesztése',
      addProvider: '+ Szolgáltató hozzáadása...',
      deleteProvider: 'Szolgáltató törlése',
    },
    statuses: {
      checkingStatus: 'Állapot ellenőrzése...',
      configured: 'Konfigurálva',
      notConfigured: 'Nincs konfigurálva',
      validating: 'Érvényesítés...',
      loadingConfiguration: 'Konfiguráció betöltése...',
      noChangesDetected: 'Nem található változtatás',
      cancelCurrentGeneration: 'Jelenlegi generálás megszakítása',
      languageSaved: 'Nyelv frissítve.',
      providerNameConflict: 'Ilyen nevű szolgáltató már létezik.',
      providerNameRequired: 'A szolgáltató neve kötelező.',
      baseUrlRequired: 'Az API Base URL kötelező.',
      apiKeyRequired: 'Az API kulcs kötelező.',
      providerSaved: 'Egyéni szolgáltató mentve!',
      providerDeleted: 'Egyéni szolgáltató törölve.',
      modelNameRequired: 'Kérjük, adjon meg egy modellnevet a generálás előtt.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Az Ollama rögzítve van a Direct Diff módhoz',
      agenticModeDescription:
        'Az ügynöki (Agentic) mód adattár eszközöket használ a mélyebb elemzéshez',
      directDiffDescription:
        'A Direct Diff közvetlenül a nyers fájl módosítást (diff) küldi el a modellnek',
      ollamaInfo:
        'A <strong>Ollama</strong> helyileg fut a gépén.<br>Alapértelmezett host: <code>{host}</code><br>Győződjön meg arról, hogy az Ollama fut a generálás előtt.',
      googleInfo:
        'Szerezze be az API kulcsot a <strong>Google AI Studio</strong>-ból:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Szerezze be az API kulcsot az <strong>OpenAI Platform</strong>-ról:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Szerezze be az API kulcsot az <strong>Anthropic Console</strong>-ból:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Az ügynöki (Agentic) eszköz meghívásainak korlátozása generálásonként. Írjon be 0-t, vagy hagyja üresen a korlátlanhoz.',
      customProviderInfo:
        'Az egyéni szolgáltatóknak <strong>OpenAI-kompatibilisnek</strong> kell lenniük.<br>Az API Base URL-nek olyan szolgáltatásra kell mutatnia, amely megvalósítja az OpenAI Chat Completions API-t.',
    },
    options: {
      agentic: 'Ügynöki (Agentic) Generálás',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'Ügynök elemzi a változtatásokat...',
    generatingMessage: 'Commit üzenet generálása...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Átmeneti API hiba. Újrapróbálkozás (${attempt}/${maxAttempts}) ${seconds} mp múlva...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `${model} letöltése: ${status} (${percent}%)`
        : `${model} letöltése: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[${step}. lépés] Diff elemzése: ${path}`,
    stepReadingFile: (step, path) => `[${step}. lépés] Fájl olvasása: ${path}`,
    stepGettingOutline: (step, path) =>
      `[${step}. lépés] Vázlat lekérése: ${path}`,
    stepFindingReferences: (step, target) =>
      `[${step}. lépés] Hivatkozások keresése: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[${step}. lépés] Legutóbbi commitok lekérése: ${count} bejegyzés`
        : `[${step}. lépés] Legutóbbi commitok lekérése...`,
    stepSearchingProject: (step, keyword) =>
      `[${step}. lépés] Keresés a projektben: ${keyword}`,
    stepCalling: (step, toolName) => `[${step}. lépés] ${toolName} hívása...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[${step}. lépés] Diffek elemzése: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[${step}. lépés] Diffek elemzése ${count} fájlhoz...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[${step}. lépés] Fájlok olvasása: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[${step}. lépés] ${count} fájl olvasása...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[${step}. lépés] Vázlatok lekérése: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[${step}. lépés] Vázlatok lekérése ${count} fájlhoz...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[${step}. lépés] Hivatkozások keresése: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[${step}. lépés] Hivatkozások keresése ${count} szimbólumhoz...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[${step}. lépés] Keresés a projektben: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[${step}. lépés] Keresés a projektben ${count} kulcsszóra...`,
    stepExecutingMultipleTools: (step, count) =>
      `[${step}. lépés] ${count} vizsgáló eszköz futtatása...`,
  },
};
