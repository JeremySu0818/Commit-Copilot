import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const deLocale: LocaleTextBundle = {
  commitCopilotErrorMessages: {
    'rewrite.commitHashRequired': () => 'Ein Commit-Hash ist erforderlich.',
    'rewrite.commitNotFound': (args) =>
      'Commit "{commitHash}" wurde nicht gefunden.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'Commit "{commitHash}" ist ein Merge-Commit und kann mit diesem Ablauf nicht umgeschrieben werden.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Commits können im detached HEAD-Zustand nicht umgeschrieben werden.',
    'rewrite.commitNotReachable': (args) =>
      'Commit "{commitHash}" ist kein Vorfahr von HEAD.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
  },
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Kein Git-Repository',
      action: 'Bitte öffnen Sie einen Ordner, der ein Git-Repository enthält.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Staging der Änderungen fehlgeschlagen',
      action: 'Überprüfen Sie, ob Git richtig konfiguriert ist.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Keine Änderungen zum Committen',
      action: 'Bitte nehmen Sie zuerst einige Änderungen an Ihren Dateien vor.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Keine zum Commit vorgemerkten Änderungen erkannt',
      action:
        'Nicht nachverfolgte Dateien gefunden. Bitte vormerken, um eine Commit-Nachricht zu generieren.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Nur nicht nachverfolgte Dateien gefunden',
      action:
        'Sie haben neu erstellte Dateien, aber keine nachverfolgten Änderungen. Bitte vormerken, um einen Commit zu generieren.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Generierung abgebrochen',
      action: 'Die Generierung wurde vom Benutzer abgebrochen.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Gemischte Änderungen erkannt',
      action:
        'Sie haben sowohl vorgemerkte als auch nicht vorgemerkte Änderungen. Bitte wählen Sie, wie Sie fortfahren möchten.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API-Schlüssel nicht konfiguriert',
      action:
        'Bitte legen Sie Ihren API-Schlüssel im Commit-Copilot Panel fest.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Ungültiger API-Schlüssel',
      action:
        'Ihr API-Schlüssel ist ungültig oder wurde widerrufen. Bitte überprüfen und aktualisieren Sie ihn.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'API-Kontingent überschritten',
      action:
        'Sie haben Ihr API-Kontingent überschritten. Bitte überprüfen Sie Ihr Anbieterkonto.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'API-Anfrage fehlgeschlagen',
      action:
        'Es gab einen Fehler bei der Kommunikation mit der API. Bitte versuchen Sie es erneut.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Commit der Änderungen fehlgeschlagen',
      action: 'Überprüfen Sie, ob Git-Konflikte oder Probleme vorliegen.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Ein unerwarteter Fehler ist aufgetreten',
      action:
        'Zusätzliche Details finden Sie in der "Commit-Copilot Debug"-Ausgabe.',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Generierungsanforderung ignoriert: Generierung wird bereits ausgeführt.',
      generationStart: (timestamp) =>
        `[${timestamp}] Starte Commit-Copilot Generierung...`,
      gitExtensionMissing: 'Fehler: Git-Erweiterung nicht gefunden.',
      selectedRepoFromScm: (path) =>
        `Repository aus SCM-Kontext ausgewählt: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Repository aus aktivem Editor ausgewählt: ${path}`,
      noRepoMatchedActiveEditor: 'Kein Repository passte zum aktiven Editor.',
      noActiveEditorForRepoSelection:
        'Kein aktiver Editor für Repository-Auswahl gefunden.',
      selectedOnlyRepo: (path) => `Einziges Repository ausgewählt: ${path}`,
      multiRepoNotDetermined: (count) =>
        `${String(count)} Repositories gefunden, aber das aktive konnte nicht ermittelt werden.`,
      noRepoInApi: 'Keine Repositories in der API gefunden.',
      usingProvider: (providerName) => `Verwende Anbieter: ${providerName}`,
      usingGenerateMode: (mode) => `Generierungsmodus: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Commit-Ausgabeoptionen: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Warnung: Kein API-Schlüssel gefunden für ${provider}.`,
      cancelRequestedFromProgress:
        'Abbruch von der Benutzeroberfläche angefordert.',
      rewriteStart: (timestamp) =>
        `[${timestamp}] Starte Commit-Copilot Rewrite-Generierung...`,
      rewriteCancelRequestedFromProgress:
        'Abbruch von der Fortschrittsanzeige angefordert.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit umgeschrieben: ${originalHash} -> ${replacementHash}`,
      callingGenerateCommitMessage: 'Rufe generateCommitMessage auf...',
      repositoryPath: (path) => `Repository-Pfad: ${path}`,
      usingModel: (model) => `Verwende Modell: ${model}`,
      generatedMessage: (message) => `Generierte Nachricht: ${message}`,
      generationError: (errorCode, message) =>
        `Fehler: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Unerwarteter Fehler: ${message}`,
      openingLanguageSettings: 'Öffne Spracheinstellungen in Activity-View...',
    },
    notification: {
      gitExtensionMissing:
        'Git-Erweiterung nicht gefunden. Bitte stellen Sie sicher, dass Git installiert und die Git-Erweiterung aktiviert ist.',
      multiRepoWarning:
        'Mehrere Git-Repositories gefunden. Bitte fokussieren Sie eine Datei im Ziel-Repository oder führen Sie die Aktion in der SCM-Ansicht aus.',
      repoNotFound:
        'Kein Git-Repository gefunden. Bitte öffnen Sie einen Ordner, der ein Git-Repository enthält.',
      apiKeyMissing: (providerName) =>
        `${providerName} API-Schlüssel ist nicht konfiguriert. Bitte legen Sie Ihren API-Schlüssel zuerst im Commit-Copilot Panel fest.`,
      configureApiKeyAction: 'API-Schlüssel konfigurieren',
      mixedChangesQuestion:
        'Sie haben sowohl vorgemerkte als auch nicht vorgemerkte Änderungen. Wie möchten Sie fortfahren?',
      stageAllAndGenerate: 'Alle vormerken & Generieren',
      proceedStagedOnly: 'Nur mit Vorgemerkten fortfahren',
      cancel: 'Abbrechen',
      noStagedButUntrackedQuestion:
        'Keine vorgemerkten Änderungen erkannt. Nicht nachverfolgte Dateien gefunden. Möchten Sie alle Dateien (einschließlich nicht nachverfolgte) vormerken oder nur für nachverfolgte bearbeitete Dateien generieren?',
      stageAndGenerateAll: 'Alle vormerken & generieren',
      generateTrackedOnly: 'Nur für Nachverfolgte generieren',
      onlyUntrackedQuestion:
        'Nur nicht nachverfolgte Dateien vorhanden, ohne nachverfolgte Änderungen. Möchten Sie diese neuen Dateien vormerken und nachverfolgen, um einen Commit zu generieren?',
      stageAndTrack: 'Vormerken & nachverfolgen',
      commitGenerated: 'Commit-Nachricht generiert!',
      viewProviderConsoleAction: 'Anbieter-Konsole anzeigen',
      noChanges:
        'Keine Änderungen zum Committen. Nehmen Sie zuerst einige Änderungen vor!',
      generationCanceled: 'Erstellung der Commit-Nachricht abgebrochen.',
      rewriteCanceled: 'Umschreiben der Commit-Nachricht abgebrochen.',
      failedPrefix: 'Commit-Copilot fehlgeschlagen',
      rewriteNoNonMergeCommits:
        'Keine Nicht-Merge-Commits in der Historie des aktuellen Branches gefunden.',
      rewriteCommitNoSubject: '(kein Betreff)',
      rewriteCommitRootDescription: 'Root-Commit',
      rewriteCommitMergeDescription: 'Merge-Commit',
      rewriteCommitParentDescription: (parentHash) => `Parent ${parentHash}`,
      rewriteCommitSelectTitle: 'Commit zum Umschreiben auswählen',
      rewriteCommitSelectPlaceholder:
        'Wählen Sie einen Commit aus der Historie des aktuellen Branches',
      rewriteWorkspaceDirtyBoth:
        'Die Commit-Historie kann nicht umgeschrieben werden, solange sowohl vorgemerkte (nicht committete) als auch geänderte (nicht vorgemerkte) Änderungen vorhanden sind. Bitte zuerst committen oder stashen.',
      rewriteWorkspaceDirtyStaged:
        'Die Commit-Historie kann nicht umgeschrieben werden, solange vorgemerkte (nicht committete) Änderungen vorhanden sind. Bitte zuerst committen oder stashen.',
      rewriteWorkspaceDirtyUnstaged:
        'Die Commit-Historie kann nicht umgeschrieben werden, solange geänderte (nicht vorgemerkte) Änderungen vorhanden sind. Bitte zuerst committen oder stashen.',
      rewriteProgressTitle: (providerName) => `Umschreiben (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `Analysiere Commit ${shortHash}...`,
      commitMessageCannotBeEmpty: 'Commit-Nachricht darf nicht leer sein.',
      rewriteApplyingTitle: (shortHash) => `Schreibe ${shortHash} um`,
      rewriteApplyingProgress: 'Schreibe Commit-Historie um...',
      rewriteFailedHistory:
        'Commit-Historie konnte nicht umgeschrieben werden.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Commit-Nachricht von ${shortHash} wurde umgeschrieben.`,
      rewriteDetachedHeadPushUnavailable:
        'Die Commit-Historie wurde umgeschrieben, aber Force Push with Lease ist im detached HEAD-Zustand nicht verfügbar.',
      rewriteForcePushPrompt: (target) =>
        `Historie umgeschrieben. Force Push with Lease nach ${target} ausführen?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force Push with Lease abgeschlossen: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force Push with Lease fehlgeschlagen: ${message}`,
      pushingWithLease: 'Push with Lease läuft',
    },
  },
  mainViewText: {
    invalidApiKeyPrefix: 'Ungültiger API-Schlüssel',
    quotaExceededPrefix: 'API-Kontingent überschritten',
    apiRequestFailedPrefix: 'API-Anfrage fehlgeschlagen',
    connectionErrorPrefix: 'Verbindungsfehler',
    unknownProvider: 'Unbekannter Anbieter',
    cannotConnectOllamaAt: (host) =>
      `Kann keine Verbindung zu Ollama unter ${host} herstellen`,
    cannotConnectOllama: (message) =>
      `Kann keine Verbindung zu Ollama herstellen: ${message}. Stellen Sie sicher, dass Ollama läuft.`,
    apiKeyCannotBeEmpty: 'API-Schlüssel darf nicht leer sein',
    validationFailedPrefix: 'Validierung fehlgeschlagen',
    unableToConnectFallback: 'Verbindung kann nicht hergestellt werden',
    saveConfigSuccess: (providerName) =>
      `${providerName}-Konfiguration erfolgreich gespeichert!`,
    saveConfigFailed: 'Konfiguration konnte nicht gespeichert werden',
    languageSaved: (label) => `Sprache aktualisiert: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API-Anbieter',
      configuration: 'API-Konfiguration',
      ollamaConfiguration: 'Ollama-Konfiguration',
      model: 'Modell',
      generateConfiguration: 'Generierungskonfiguration',
      settings: 'Einstellungen',
      addProvider: 'Benutzerdefinierten Anbieter hinzufügen',
      editProvider: 'Benutzerdefinierten Anbieter bearbeiten',
      rewriteEditor: 'Umschreiben',
      advancedFeatures: 'Erweiterte Funktionen',
    },
    labels: {
      provider: 'Anbieter',
      apiKey: 'API-Schlüssel',
      ollamaHostUrl: 'Ollama-Host-URL',
      model: 'Modell',
      mode: 'Modus',
      conventionalCommitSections: 'Konventionelle Commit-Abschnitte',
      includeScope: 'Kontext (Scope) einschließen',
      includeBody: 'Nachrichtenkörper (Body) einschließen',
      includeFooter: 'Fußzeile (Footer) einschließen',
      language: 'Erweiterungssprache',
      maxAgentSteps: 'Max. Agentenschritte',
      providerName: 'Anbietername',
      apiBaseUrl: 'API Basis-URL',
      commitMessage: 'Commit-Nachricht',
      selectedCommitMessage: 'Ausgewählte Commit-Nachricht',
    },
    placeholders: {
      selectProvider: 'Einen Anbieter auswählen...',
      selectModel: 'Ein Modell auswählen...',
      selectGenerateMode: 'Generierungsmodus auswählen...',
      enterApiKey: 'Geben Sie Ihren API-Schlüssel ein',
      enterGeminiApiKey: 'Geben Sie Ihren Gemini API-Schlüssel ein',
      enterOpenAIApiKey: 'Geben Sie Ihren OpenAI API-Schlüssel ein',
      enterAnthropicApiKey: 'Geben Sie Ihren Anthropic API-Schlüssel ein',
      enterCustomApiKey: 'Geben Sie Ihren API-Schlüssel ein',
    },
    buttons: {
      save: 'Speichern',
      validating: 'Überprüfe...',
      generateCommitMessage: 'Commit-Nachricht generieren',
      cancelGenerating: 'Generierung abbrechen',
      back: 'Zurück',
      editProvider: 'Anbieter bearbeiten',
      addProvider: '+ Anbieter hinzufügen...',
      deleteProvider: 'Anbieter löschen',
      openAdvancedFeatures: 'Erweiterte Funktionen öffnen',
      rewriteCommitMessage: 'Commit-Nachricht umschreiben',
      confirmRewrite: 'Umschreiben bestätigen',
      cancel: 'Abbrechen',
    },
    statuses: {
      checkingStatus: 'Status wird überprüft...',
      configured: 'Konfiguriert',
      notConfigured: 'Nicht konfiguriert',
      validating: 'Wird überprüft...',
      loadingConfiguration: 'Lade Konfiguration...',
      noChangesDetected: 'Keine Änderungen erkannt',
      cancelCurrentGeneration: 'Aktuelle Generierung abbrechen',
      languageSaved: 'Sprache aktualisiert.',
      providerNameConflict: 'Ein Anbieter mit diesem Namen existiert bereits.',
      providerNameRequired: 'Anbietername ist erforderlich.',
      baseUrlRequired: 'API Basis-URL ist erforderlich.',
      apiKeyRequired: 'API-Schlüssel ist erforderlich.',
      providerSaved: 'Benutzerdefinierter Anbieter gespeichert!',
      providerDeleted: 'Benutzerdefinierter Anbieter gelöscht.',
      modelNameRequired:
        'Bitte geben Sie vor der Generierung einen Modellnamen ein.',
      commitMessageCannotBeEmpty: 'Commit-Nachricht darf nicht leer sein.',
      pushingWithLease: 'Push with Lease läuft...',
      forcePushWithLeaseCompleted: 'Force Push with Lease abgeschlossen.',
      forcePushWithLeaseFailed: 'Force Push with Lease fehlgeschlagen.',
    },
    descriptions: {
      ollamaFixedToDirectDiff:
        'Ollama ist auf den Modus Direct Diff festgelegt',
      agenticModeDescription:
        'Der Agentic-Modus verwendet Repository-Tools für eine tiefere Analyse',
      directDiffDescription:
        'Direct Diff sendet das rohe Diff direkt an das Modell',
      ollamaInfo:
        '<strong>Ollama</strong> wird lokal auf Ihrem Computer ausgeführt.<br>Standardhost: <code>{host}</code><br>Stellen Sie sicher, dass Ollama ausgeführt wird, bevor Sie generieren.',
      googleInfo:
        'Holen Sie sich Ihren API-Schlüssel von <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Holen Sie sich Ihren API-Schlüssel von <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Holen Sie sich Ihren API-Schlüssel von <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Begrenzen Sie absichtliche Tool-Aufrufe pro Erzeugung. Geben Sie 0 ein oder lassen Sie das Feld leer, um eine unbegrenzte Anzahl zuzulassen.',
      customProviderInfo:
        'Benutzerdefinierte Anbieter müssen <strong>OpenAI-kompatibel</strong> sein.<br>Die API-Base-URL sollte auf einen Dienst weisen, der die OpenAI Chat Completions-API implementiert.',
      advancedFeaturesDescription: 'Erweiterte Werkzeuge und Workflows öffnen.',
      rewriteWorkflowDescription:
        'Nach Auswahl eines Nicht-Merge-Commits generiert das System die Nachricht im aktiven Modus (Agentic / Direct Diff) mit dem aktuellen Provider, Modell und Ausgabeformat (Scope/Body/Footer) neu, öffnet anschließend eine bearbeitbare Bestätigungsansicht; nach dem Absenden wird die Historie per Rebase umgeschrieben, optional mit force push with lease.',
      rewriteEditorDescription:
        'Prüfen und bestätigen Sie die neue Commit-Nachricht.',
    },
    options: {
      agentic: 'Agentic Generierung',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'Agent analysiert Änderungen...',
    generatingMessage: 'Generiere Commit-Nachricht...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Vorübergehender API-Fehler. Erneuter Versuch (${String(attempt)}/${String(maxAttempts)}) in ${String(seconds)}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Ziehe ${model}: ${status} (${String(percent)}%)`
        : `Ziehe ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Schritt ${String(step)}] Analysiere Diff: ${path}`,
    stepReadingFile: (step, path) =>
      `[Schritt ${String(step)}] Lese Datei: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Schritt ${String(step)}] Hole Gliederung: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Schritt ${String(step)}] Finde Referenzen: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Schritt ${String(step)}] Hole letzte Commits: ${String(count)} Einträge`
        : `[Schritt ${String(step)}] Hole letzte Commits...`,
    stepSearchingProject: (step, keyword) =>
      `[Schritt ${String(step)}] Durchsuche Projekt nach: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Schritt ${String(step)}] Rufe ${toolName} auf...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Schritt ${String(step)}] Analysiere Diffs: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Schritt ${String(step)}] Analysiere Diffs für ${String(count)} Dateien...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Schritt ${String(step)}] Lese Dateien: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Schritt ${String(step)}] Lese ${String(count)} Dateien...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Schritt ${String(step)}] Hole Gliederungen: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Schritt ${String(step)}] Hole Gliederungen für ${String(count)} Dateien...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Schritt ${String(step)}] Finde Referenzen: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Schritt ${String(step)}] Finde Referenzen für ${String(count)} Symbole...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Schritt ${String(step)}] Durchsuche Projekt nach: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Schritt ${String(step)}] Durchsuche Projekt nach ${String(count)} Schlüsselwörtern...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Schritt ${String(step)}] Führe ${String(count)} Untersuchungstools aus...`,
  },
};
