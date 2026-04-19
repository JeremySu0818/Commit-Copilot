import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const itLocale: LocaleTextBundle = {
  commitCopilotErrorMessages: {
    'rewrite.commitHashRequired': () => 'È richiesto un hash del commit.',
    'rewrite.commitNotFound': (args) =>
      'Il commit "{commitHash}" non è stato trovato.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'Il commit "{commitHash}" è un merge commit e non può essere riscritto da questo workflow.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Non è possibile riscrivere commit da detached HEAD.',
    'rewrite.commitNotReachable': (args) =>
      'Il commit "{commitHash}" non è un antenato di HEAD.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
  },
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Non è un repository Git',
      action: 'Apri una cartella che contiene un repository Git.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Impossibile inviare le modifiche in stage',
      action: 'Controlla se Git è configurato correttamente.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Nessuna modifica da committare',
      action: 'Fai prima alcune modifiche ai tuoi file.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Nessuna modifica in stage rilevata',
      action:
        'Trovati file non tracciati. Mettili in stage per generare un messaggio di commit.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Trovati solo file non tracciati',
      action:
        'Hai file appena creati ma nessuna modifica tracciata. Mettili in stage per generare un commit.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Generazione annullata',
      action: "La generazione è stata annullata dall'utente.",
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Modifiche miste rilevate',
      action:
        'Hai modifiche sia in stage che non in stage. Scegli come procedere.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'Chiave API non configurata',
      action: 'Imposta la tua chiave API nel pannello di Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Chiave API non valida',
      action:
        'La tua chiave API non è valida o è stata revocata. Controlla e aggiornala.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'Quota API superata',
      action:
        "Hai superato la tua quota API. Controlla l'account del provider.",
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'Richiesta API non riuscita',
      action:
        "Si è verificato un errore durante la comunicazione con l'API. Riprova.",
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Commit delle modifiche non riuscito',
      action: 'Controlla se ci sono conflitti o problemi con Git.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Si è verificato un errore imprevisto',
      action: 'Controlla l\'output "Commit-Copilot Debug" per i dettagli.',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Richiesta di generazione ignorata: generazione già in corso.',
      generationStart: (timestamp) =>
        `[${timestamp}] Avvio generazione commit-copilot...`,
      gitExtensionMissing: 'Errore: estensione Git non trovata.',
      selectedRepoFromScm: (path) =>
        `Repository selezionato dal contesto SCM: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Repository selezionato dall'editor attivo: ${path}`,
      noRepoMatchedActiveEditor:
        "Nessun repository corrisponde all'editor attivo.",
      noActiveEditorForRepoSelection:
        'Nessun editor attivo trovato per la selezione del repository.',
      selectedOnlyRepo: (path) => `Selezionato l'unico repository: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Trovati ${String(count)} repository ma impossibile determinare quello attivo.`,
      noRepoInApi: "Nessun repository trovato nell'API.",
      usingProvider: (providerName) => `Utilizzo del provider: ${providerName}`,
      usingGenerateMode: (mode) => `Modalità di generazione: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Opzioni di output commit: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Avviso: nessuna chiave API trovata per ${provider}.`,
      cancelRequestedFromProgress:
        "Annullamento richiesto dall'interfaccia di avanzamento.",
      rewriteStart: (timestamp) =>
        `[${timestamp}] Avvio della generazione di riscrittura commit-copilot...`,
      rewriteCancelRequestedFromProgress:
        'Annullamento richiesto dall’interfaccia di avanzamento.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit riscritto: ${originalHash} -> ${replacementHash}`,
      callingGenerateCommitMessage: 'Chiamata a generateCommitMessage...',
      repositoryPath: (path) => `Percorso del repository: ${path}`,
      usingModel: (model) => `Utilizzo del modello: ${model}`,
      generatedMessage: (message) => `Messaggio generato: ${message}`,
      generationError: (errorCode, message) =>
        `Errore: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Errore imprevisto: ${message}`,
      openingLanguageSettings:
        'Apertura delle impostazioni della lingua nella vista attività...',
    },
    notification: {
      gitExtensionMissing:
        "Estensione Git non trovata. Assicurati che Git sia installato e l'estensione Git sia abilitata.",
      multiRepoWarning:
        'Trovati repository Git multipli. Concentrati su un file nel repository di destinazione o esegui dalla vista SCM.',
      repoNotFound:
        'Nessun repository Git trovato. Apri una cartella contenente un repository Git.',
      apiKeyMissing: (providerName) =>
        `${providerName}: chiave API non configurata. Imposta prima la chiave API nel pannello di Commit-Copilot.`,
      configureApiKeyAction: 'Configura chiave API',
      mixedChangesQuestion:
        'Hai modifiche sia in stage che non in stage. Come vorresti procedere?',
      stageAllAndGenerate: 'Stage tutto e genera',
      proceedStagedOnly: 'Procedi solo con i file in stage',
      cancel: 'Annulla',
      noStagedButUntrackedQuestion:
        'Nessuna modifica in stage rilevata. Trovati file non tracciati. Vuoi mettere in stage tutti i file (inclusi quelli non tracciati) o generare solo per i file modificati tracciati?',
      stageAndGenerateAll: 'Stage e genera tutto',
      generateTrackedOnly: 'Genera solo modifiche tracciate',
      onlyUntrackedQuestion:
        'Sono presenti solo file non tracciati senza modifiche ai file tracciati. Vuoi mettere in stage e tracciare questi nuovi file per generare un commit?',
      stageAndTrack: 'Stage e traccia',
      commitGenerated: 'Messaggio di commit generato!',
      viewProviderConsoleAction: 'Visualizza Console Provider',
      noChanges: 'Nessuna modifica da committare. Fai prima alcune modifiche!',
      generationCanceled: 'Generazione del messaggio di commit annullata.',
      rewriteCanceled: 'Riscrittura del messaggio di commit annullata.',
      failedPrefix: 'Commit-Copilot fallito',
      rewriteNoNonMergeCommits:
        'Nessun commit non-merge trovato nella cronologia del branch corrente.',
      rewriteCommitNoSubject: '(nessun oggetto)',
      rewriteCommitRootDescription: 'commit radice',
      rewriteCommitMergeDescription: 'commit di merge',
      rewriteCommitParentDescription: (parentHash) => `padre ${parentHash}`,
      rewriteCommitSelectTitle: 'Seleziona commit da riscrivere',
      rewriteCommitSelectPlaceholder:
        'Scegli un commit dalla cronologia del branch corrente',
      rewriteWorkspaceDirtyBoth:
        'Impossibile riscrivere la cronologia dei commit mentre sono presenti modifiche staged (non committate) e modified (unstaged). Esegui prima commit o stash.',
      rewriteWorkspaceDirtyStaged:
        'Impossibile riscrivere la cronologia dei commit mentre sono presenti modifiche staged (non committate). Esegui prima commit o stash.',
      rewriteWorkspaceDirtyUnstaged:
        'Impossibile riscrivere la cronologia dei commit mentre sono presenti modifiche modified (unstaged). Esegui prima commit o stash.',
      rewriteProgressTitle: (providerName) => `Riscrittura (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `Analisi del commit ${shortHash}...`,
      commitMessageCannotBeEmpty:
        'Il messaggio di commit non può essere vuoto.',
      rewriteApplyingTitle: (shortHash) => `Riscrittura di ${shortHash}`,
      rewriteApplyingProgress: 'Riscrittura della cronologia dei commit...',
      rewriteFailedHistory: 'Impossibile riscrivere la cronologia dei commit.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Messaggio del commit ${shortHash} riscritto.`,
      rewriteDetachedHeadPushUnavailable:
        'La cronologia dei commit è stata riscritta, ma force push with lease non è disponibile nello stato detached HEAD.',
      rewriteForcePushPrompt: (target) =>
        `Cronologia riscritta. Eseguire force push with lease verso ${target}?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease completato: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease non riuscito: ${message}`,
      pushingWithLease: 'Push with lease in corso',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'Chiave API non valida',
    quotaExceededPrefix: 'Quota API superata',
    apiRequestFailedPrefix: 'Richiesta API non riuscita',
    connectionErrorPrefix: 'Errore di connessione',
    unknownProvider: 'Provider sconosciuto',
    cannotConnectOllamaAt: (host) =>
      `Impossibile connettersi a Ollama su ${host}`,
    cannotConnectOllama: (message) =>
      `Impossibile connettersi a Ollama: ${message}. Assicurati che Ollama sia in esecuzione.`,
    apiKeyCannotBeEmpty: 'La chiave API non può essere vuota',
    validationFailedPrefix: 'Convalida non riuscita',
    unableToConnectFallback: 'Impossibile connettersi',
    saveConfigSuccess: (providerName) =>
      `Configurazione di ${providerName} salvata con successo!`,
    saveConfigFailed: 'Salvataggio configurazione non riuscito',
    languageSaved: (label) => `Lingua aggiornata: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'Provider API',
      configuration: 'Configurazione API',
      ollamaConfiguration: 'Configurazione Ollama',
      model: 'Modello',
      generateConfiguration: 'Configurazione Generazione',
      settings: 'Impostazioni',
      addProvider: 'Aggiungi Provider Personalizzato',
      editProvider: 'Modifica Provider Personalizzato',
      rewriteEditor: 'Riscrivi',
    },
    labels: {
      provider: 'Provider',
      apiKey: 'Chiave API',
      ollamaHostUrl: 'URL Host Ollama',
      model: 'Modello',
      mode: 'Modalità',
      conventionalCommitSections: 'Sezioni Conventional Commit',
      includeScope: 'Includi Scopo (Scope)',
      includeBody: 'Includi Corpo (Body)',
      includeFooter: 'Includi Piè di pagina (Footer)',
      language: 'Lingua Estensione',
      maxAgentSteps: 'Passi Massimi Agente',
      providerName: 'Nome Provider',
      apiBaseUrl: 'URL Base API',
      commitMessage: 'Messaggio di commit',
      selectedCommitMessage: 'Messaggio di commit selezionato',
    },
    placeholders: {
      selectProvider: 'Seleziona un provider...',
      selectModel: 'Seleziona un modello...',
      selectGenerateMode: 'Seleziona la modalità di generazione...',
      enterApiKey: 'Inserisci la tua chiave API',
      enterGeminiApiKey: "Inserisci l'API Key di Gemini",
      enterOpenAIApiKey: "Inserisci l'API Key di OpenAI",
      enterAnthropicApiKey: "Inserisci l'API Key di Anthropic",
      enterCustomApiKey: 'Inserisci la tua chiave API',
    },
    buttons: {
      save: 'Salva',
      validating: 'Convalida in corso...',
      generateCommitMessage: 'Genera Messaggio di Commit',
      cancelGenerating: 'Annulla Generazione',
      back: 'Indietro',
      editProvider: 'Modifica Provider',
      addProvider: '+ Aggiungi Provider...',
      deleteProvider: 'Elimina Provider',
      rewriteCommitMessage: 'Riscrivi messaggio di commit',
      confirmRewrite: 'Conferma riscrittura',
      cancel: 'Annulla',
    },
    statuses: {
      checkingStatus: 'Controllo dello stato...',
      configured: 'Configurato',
      notConfigured: 'Non configurato',
      validating: 'Convalida in corso...',
      loadingConfiguration: 'Caricamento configurazione...',
      noChangesDetected: 'Nessuna modifica rilevata',
      cancelCurrentGeneration: 'Annulla la generazione corrente',
      languageSaved: 'Lingua aggiornata.',
      providerNameConflict: 'Esiste già un provider con questo nome.',
      providerNameRequired: 'Il nome del provider è obbligatorio.',
      baseUrlRequired: "L'URL Base API è obbligatorio.",
      apiKeyRequired: 'La chiave API è obbligatoria.',
      providerSaved: 'Provider personalizzato salvato!',
      providerDeleted: 'Provider personalizzato eliminato.',
      modelNameRequired: 'Inserisci il nome del modello prima di generare.',
      commitMessageCannotBeEmpty:
        'Il messaggio di commit non può essere vuoto.',
      pushingWithLease: 'Push with lease in corso...',
      forcePushWithLeaseCompleted: 'Force push with lease completato.',
      forcePushWithLeaseFailed: 'Force push with lease non riuscito.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama è fissato sulla modalità Direct Diff',
      agenticModeDescription:
        "La modalità agentica utilizza gli strumenti del repository per un'analisi più approfondita",
      directDiffDescription:
        'Direct Diff invia il diff grezzo direttamente al modello',
      ollamaInfo:
        '<strong>Ollama</strong> viene eseguito localmente sulla tua macchina.<br>Host predefinito: <code>{host}</code><br>Assicurati che Ollama sia in esecuzione prima di generare.',
      googleInfo:
        'Ottieni la tua chiave API da <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Ottieni la tua chiave API da <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Ottieni la tua chiave API da <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        "Limita le chiamate agli strumenti dell'agente per generazione. Inserisci 0 o lascia vuoto per non avere limiti.",
      customProviderInfo:
        "I provider personalizzati devono essere <strong>compatibili con OpenAI</strong>.<br>L'URL base dell'API deve puntare a un servizio che implementi l'API Chat Completions di OpenAI.",
      rewriteEditorDescription:
        'Rivedi e conferma il nuovo messaggio di commit.',
    },
    options: {
      agentic: 'Generazione Agentica',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: "L'agente sta analizzando le modifiche...",
    generatingMessage: 'Generazione del messaggio di commit...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Errore transitorio API. Riprovo (${String(attempt)}/${String(maxAttempts)}) tra ${String(seconds)}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Pulling ${model}: ${status} (${String(percent)}%)`
        : `Pulling ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Passo ${String(step)}] Analisi delle differenze: ${path}`,
    stepReadingFile: (step, path) =>
      `[Passo ${String(step)}] Lettura del file: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Passo ${String(step)}] Lettura struttura: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Passo ${String(step)}] Ricerca riferimenti: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Passo ${String(step)}] Recupero commit recenti: ${String(count)} voci`
        : `[Passo ${String(step)}] Recupero commit recenti...`,
    stepSearchingProject: (step, keyword) =>
      `[Passo ${String(step)}] Ricerca nel progetto per: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Passo ${String(step)}] Chiamata a ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Passo ${String(step)}] Analisi differenze: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Passo ${String(step)}] Analisi differenze per ${String(count)} file...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Passo ${String(step)}] Lettura file: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Passo ${String(step)}] Lettura di ${String(count)} file...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Passo ${String(step)}] Lettura struttura: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Passo ${String(step)}] Lettura struttura per ${String(count)} file...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Passo ${String(step)}] Ricerca riferimenti: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Passo ${String(step)}] Ricerca riferimenti per ${String(count)} simboli...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Passo ${String(step)}] Ricerca nel progetto per: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Passo ${String(step)}] Ricerca nel progetto per ${String(count)} parole chiave...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Passo ${String(step)}] Esecuzione di ${String(count)} strumenti di investigazione...`,
  },
};
