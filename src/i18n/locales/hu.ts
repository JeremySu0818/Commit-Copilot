import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const huLocale: LocaleTextBundle = {
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
    'rewrite.commitHashRequired': () => 'Commit hash megadása szükséges.',
    'rewrite.commitNotFound': (args) =>
      'A(z) "{commitHash}" commit nem található.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'A(z) "{commitHash}" commit merge commit, és ez a folyamat nem tudja átírni.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Detached HEAD állapotban nem lehet commitokat átírni.',
    'rewrite.commitNotReachable': (args) =>
      'A(z) "{commitHash}" commit nem a HEAD őse.'.replace(
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
        `${String(count)} adattár található, de az aktív nem határozható meg.`,
      noRepoInApi: 'Nincsenek adattárak az API-ban.',
      usingProvider: (providerName) => `Használt szolgáltató: ${providerName}`,
      usingGenerateMode: (mode) => `Generálási mód: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Commit kimeneti opciók: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Figyelmeztetés: Nem található API kulcs ehhez: ${provider}.`,
      cancelRequestedFromProgress: 'Megszakítás kérve a folyamatjelző UI-ról.',
      rewriteStart: (timestamp) =>
        `[${timestamp}] Commit-copilot átírási generálás indítása...`,
      rewriteCancelRequestedFromProgress:
        'Megszakítás kérve a folyamatjelző felületről.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit átírva: ${originalHash} -> ${replacementHash}`,
      rewriteReplacementCommitFallback: 'updated',
      callingGenerateCommitMessage: 'generateCommitMessage hívása...',
      repositoryPath: (path) => `Adattár elérési útja: ${path}`,
      usingModel: (model) => `Használt modell: ${model}`,
      generatedMessage: (message) => `Generált üzenet: ${message}`,
      generationError: (errorCode, message) =>
        `Hiba: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Váratlan hiba: ${message}`,
      openingLanguageSettings:
        'Nyelvi beállítások megnyitása a tevékenység nézetben...',
      rewriteLeaseProtectionBlocked:
        'A push-t a lease védelem blokkolta (a távoli ág megváltozott).',
      rewriteSuggestedRecoverySteps: 'Javasolt helyreállítási lépések:',
      rewriteAutoSyncBeforeRetryFailed: (message) =>
        `Az automatikus szinkronizálás az újrapróbálás előtt sikertelen: ${message}`,
      rewriteResolveConflictsContinueRebase:
        'Ha rebase ütközések vannak, előbb oldd fel őket, majd folytasd a rebase-t.',
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
      rewriteCanceled: 'Commit üzenet újraírása megszakítva.',
      failedPrefix: 'Commit-Copilot hiba',
      rewriteNoNonMergeCommits:
        'Nem található nem merge commit az aktuális ág előzményeiben.',
      rewriteCommitNoSubject: '(nincs tárgy)',
      rewriteCommitRootDescription: 'gyökér commit',
      rewriteCommitMergeDescription: 'merge commit',
      rewriteCommitParentDescription: (parentHash) => `szülő ${parentHash}`,
      rewriteCommitSelectTitle: 'Válassza ki az átírandó commitot',
      rewriteCommitSelectPlaceholder:
        'Válasszon commitot az aktuális ág előzményeiből',
      rewriteWorkspaceDirtyBoth:
        'A commit előzmények nem írhatók át, amíg staged (nem commitolt) és modified (unstaged) módosítások is jelen vannak. Előbb commitolja vagy stash-elje őket.',
      rewriteWorkspaceDirtyStaged:
        'A commit előzmények nem írhatók át, amíg staged (nem commitolt) módosítások vannak jelen. Előbb commitolja vagy stash-elje őket.',
      rewriteWorkspaceDirtyUnstaged:
        'A commit előzmények nem írhatók át, amíg modified (unstaged) módosítások vannak jelen. Előbb commitolja vagy stash-elje őket.',
      rewriteProgressTitle: (providerName) => `Átírás (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) => `Commit elemzése: ${shortHash}...`,
      commitMessageCannotBeEmpty: 'A commit üzenet nem lehet üres.',
      rewriteApplyingTitle: (shortHash) => `${shortHash} átírása`,
      rewriteApplyingProgress: 'Commit előzmények átírása...',
      rewriteFailedHistory: 'A commit előzmények átírása sikertelen.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `A(z) ${shortHash} commit üzenete átírva.`,
      rewriteDetachedHeadPushUnavailable:
        'A commit előzmények át lettek írva, de detached HEAD állapotban a force push with lease nem érhető el.',
      rewriteForcePushPrompt: (target) =>
        `Az előzmények átírva. Force push with lease ide: ${target}?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease befejezve: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease sikertelen: ${message}`,
      pushingWithLease: 'Push with lease folyamatban',
      rewriteAutoSyncRetryAction: 'Automatikus szinkron és kényszer push',
      rewriteAutoSyncRetryTitle: 'Automatikus szinkronizálás az upstreammel',
      rewriteAutoSyncPromptWithUpstream: (upstreamRef) =>
        `A távoli ${upstreamRef} megváltozott. Futtassuk az automatikus szinkront (fetch + rebase ${upstreamRef}) és kényszerítsük a push-t lease-szel? Az előnézet a kimeneti panelre kerül.`,
      rewriteAutoSyncFailed: (message) =>
        `Az automatikus szinkronizálás sikertelen: ${message}. Oldd fel az esetleges konfliktusokat, fejezd be a rebase-t, majd próbáld újra a push-t.`,
    },
  },
  mainViewText: {
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
      rewriteEditor: 'Átírás',
      advancedFeatures: 'Speciális funkciók',
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
      commitMessage: 'Commit üzenet',
      selectedCommitMessage: 'Kiválasztott commit üzenet',
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
      openAdvancedFeatures: 'Speciális funkciók megnyitása',
      rewriteCommitMessage: 'Commit üzenet átírása',
      confirmRewrite: 'Átírás megerősítése',
      cancel: 'Mégse',
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
      commitMessageCannotBeEmpty: 'A commit üzenet nem lehet üres.',
      pushingWithLease: 'Push with lease folyamatban...',
      forcePushWithLeaseCompleted: 'Force push with lease befejezve.',
      forcePushWithLeaseFailed: 'Force push with lease sikertelen.',
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
      advancedFeaturesDescription:
        'Speciális eszközök és munkafolyamatok megnyitása.',
      rewriteWorkflowDescription:
        'Egy nem merge commit kiválasztása után a rendszer az aktív módban (Agentic / Direct Diff) újragenerálja az üzenetet a jelenlegi szolgáltató, modell és kimeneti formátumbeállítások (scope/body/footer) alapján, majd szerkeszthető megerősítő felületet nyit; elküldés után a történet rebase-szel íródik át, opcionális force push with lease lehetőséggel.',
      rewriteEditorDescription:
        'Tekintse át és erősítse meg az új commit üzenetet.',
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
      `Átmeneti API hiba. Újrapróbálkozás (${String(attempt)}/${String(maxAttempts)}) ${String(seconds)} mp múlva...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `${model} letöltése: ${status} (${String(percent)}%)`
        : `${model} letöltése: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[${String(step)}. lépés] Diff elemzése: ${path}`,
    stepReadingFile: (step, path) =>
      `[${String(step)}. lépés] Fájl olvasása: ${path}`,
    stepGettingOutline: (step, path) =>
      `[${String(step)}. lépés] Vázlat lekérése: ${path}`,
    stepFindingReferences: (step, target) =>
      `[${String(step)}. lépés] Hivatkozások keresése: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[${String(step)}. lépés] Legutóbbi commitok lekérése: ${String(count)} bejegyzés`
        : `[${String(step)}. lépés] Legutóbbi commitok lekérése...`,
    stepSearchingProject: (step, keyword) =>
      `[${String(step)}. lépés] Keresés a projektben: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[${String(step)}. lépés] ${toolName} hívása...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[${String(step)}. lépés] Diffek elemzése: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[${String(step)}. lépés] Diffek elemzése ${String(count)} fájlhoz...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[${String(step)}. lépés] Fájlok olvasása: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[${String(step)}. lépés] ${String(count)} fájl olvasása...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[${String(step)}. lépés] Vázlatok lekérése: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[${String(step)}. lépés] Vázlatok lekérése ${String(count)} fájlhoz...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[${String(step)}. lépés] Hivatkozások keresése: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[${String(step)}. lépés] Hivatkozások keresése ${String(count)} szimbólumhoz...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[${String(step)}. lépés] Keresés a projektben: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[${String(step)}. lépés] Keresés a projektben ${String(count)} kulcsszóra...`,
    stepExecutingMultipleTools: (step, count) =>
      `[${String(step)}. lépés] ${String(count)} vizsgáló eszköz futtatása...`,
  },
};
