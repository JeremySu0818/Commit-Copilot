import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const nlLocale: LocaleTextBundle = {
  commitCopilotErrorMessages: {
    'api.keyMissing': () =>
      'API Key is not configured. Please set your API Key in the Commit-Copilot panel.',
    'api.keyInvalid': (args) =>
      args.details?.trim()
        ? 'Invalid API Key: {details}'.replace('{details}', args.details)
        : 'Invalid API Key.',
    'api.quotaExceeded': (args) =>
      args.details?.trim()
        ? 'API quota exceeded: {details}'.replace(
            '{details}',
            args.details,
          )
        : 'API quota exceeded.',
    'api.requestFailed': (args) =>
      args.details?.trim()
        ? 'API request failed: {details}'.replace(
            '{details}',
            args.details,
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
            args.details,
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
    'rewrite.commitHashRequired': () => 'Een commit-hash is vereist.',
    'rewrite.commitNotFound': (args) =>
      'Commit "{commitHash}" is niet gevonden.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'Commit "{commitHash}" is een merge-commit en kan niet door deze workflow worden herschreven.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Commits kunnen niet worden herschreven vanuit detached HEAD.',
    'rewrite.commitNotReachable': (args) =>
      'Commit "{commitHash}" is geen ancestor van HEAD.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.upstreamVerifyFailed': (args) =>
      'Kan upstream "{upstreamRef}" niet verifiëren na fetch.'.replace(
        '{upstreamRef}',
        args.upstreamRef ?? '',
      ),
    'rewrite.remoteNotIntegrated': (args) =>
      'Kan niet veilig herschrijven omdat de lokale HEAD de nieuwste {upstreamRef} ({remoteHash}) niet bevat. Voer eerst git pull --rebase (of merge) uit.'
        .replace('{upstreamRef}', args.upstreamRef ?? '')
        .replace('{remoteHash}', args.remoteHash ?? ''),
    'rewrite.autoSyncMissingUpstream': () =>
      'Kan niet automatisch synchroniseren zonder een upstream-branch. Configureer eerst upstream.',
    'rewrite.autoSyncUpstreamUnavailable': (args) =>
      'Kan niet automatisch synchroniseren omdat upstream "{upstreamRef}" niet beschikbaar is na fetch.'.replace(
        '{upstreamRef}',
        args.upstreamRef ?? '',
      ),
    'rewrite.autoSyncUnsafeRemoteRewrite': (args) =>
      'Kan niet veilig automatisch synchroniseren omdat upstream "{upstreamRef}" {previousHash} niet meer bevat.'
        .replace('{upstreamRef}', args.upstreamRef ?? '')
        .replace('{previousHash}', args.previousHash ?? ''),
    'rewrite.forcePushStaleInfo': () =>
      'Verouderde info force-with-lease: de remote tracking referentie is gewijzigd vóór VS Code fallback.',
  },
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Geen Git repository',
      action: 'Open een map die een Git repository bevat.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Kan wijzigingen niet stagen',
      action: 'Controleer of Git correct is geconfigureerd.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Geen wijzigingen om te committen',
      action: 'Breng eerst wijzigingen aan in uw bestanden.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Geen gestagede wijzigingen gedetecteerd',
      action:
        'Niet-getraceerde bestanden gevonden. Stage deze a.u.b. om een commitbericht te genereren.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Alleen niet-getraceerde bestanden gevonden',
      action:
        'U heeft nieuw aangemaakte bestanden maar geen getraceerde wijzigingen. Stage deze a.u.b. om een commitbericht te genereren.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Generatie geannuleerd',
      action: 'Generatie werd geannuleerd door gebruiker.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Gemengde wijzigingen gedetecteerd',
      action:
        'U heeft zowel gestagede als niet-gestagede wijzigingen. Kies a.u.b. hoe u verder wilt gaan.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API sleutel niet geconfigureerd',
      action: 'Stel uw API sleutel in in het Commit-Copilot paneel.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Ongeldige API sleutel',
      action:
        'Uw API sleutel is ongeldig of is ingetrokken. Controleer en update deze a.u.b.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'API quota overschreden',
      action:
        'U heeft uw API quota overschreden. Controleer a.u.b. uw provider account.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'API verzoek mislukt',
      action:
        'Er is een fout opgetreden bij de communicatie met de API. Probeer het opnieuw.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Kan wijzigingen niet committen',
      action: 'Controleer of er Git conflicten of problemen zijn.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Er is een onverwachte fout opgetreden',
      action: 'Controleer de "Commit-Copilot Debug" output voor details.',
    },
  },
  extensionText: {
    output: {
      generationIgnored: 'Generatie verzoek genegeerd: generatie is al bezig.',
      generationStart: (timestamp) =>
        `[${timestamp}] Starten met commit-copilot generatie...`,
      gitExtensionMissing: 'Fout: Git extensie niet gevonden.',
      selectedRepoFromScm: (path) =>
        `Geselecteerde repository via SCM context: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Geselecteerde repository via actieve editor: ${path}`,
      noRepoMatchedActiveEditor:
        'Geen repository komt overeen met de actieve editor.',
      noActiveEditorForRepoSelection:
        'Geen actieve editor gevonden voor repository selectie.',
      selectedOnlyRepo: (path) => `Enige repository geselecteerd: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Vond ${String(count)} repositories maar kon de actieve niet bepalen.`,
      noRepoInApi: 'Geen repositories gevonden in API.',
      usingProvider: (providerName) => `Gebruikt provider: ${providerName}`,
      usingGenerateMode: (mode) => `Generatie modus: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Commit output opties: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Waarschuwing: Geen API sleutel gevonden voor ${provider}.`,
      cancelRequestedFromProgress: 'Annulering aangevraagd via voortgangs UI.',
      rewriteStart: (timestamp) =>
        `[${timestamp}] Commit-copilot rewrite-generatie gestart...`,
      rewriteCancelRequestedFromProgress:
        'Annulering aangevraagd vanuit de voortgangsinterface.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit herschreven: ${originalHash} -> ${replacementHash}`,
      rewriteReplacementCommitFallback: 'bijgewerkt',
      callingGenerateCommitMessage: 'Aanroepen van generateCommitMessage...',
      repositoryPath: (path) => `Repository pad: ${path}`,
      usingModel: (model) => `Gebruikt model: ${model}`,
      generatedMessage: (message) => `Gegenereerd bericht: ${message}`,
      generationError: (errorCode, message) =>
        `Fout: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Onverwachte fout: ${message}`,
      openingLanguageSettings:
        'Taalinstellingen openen in activiteitsweergave...',
      rewriteLeaseProtectionBlocked:
        'Push geblokkeerd door lease-beveiliging (remote is gewijzigd).',
      rewriteSuggestedRecoverySteps: 'Voorgestelde herstelstappen:',
      rewriteAutoSyncBeforeRetryFailed: (message) =>
        `Automatisch synchroniseren vóór opnieuw proberen mislukt: ${message}`,
      rewriteResolveConflictsContinueRebase:
        'Als er rebase-conflicten optreden, los die eerst op en ga daarna verder met de rebase.',
      rewriteRecoveryCommand: (command) => `• ${command}`,
      rewriteAutoSyncPreviewSummary: (upstreamRef) =>
        `Voorbeeld van automatische synchronisatie voor ${upstreamRef}:`,
      rewriteAutoSyncRemoteTracking: (beforeHash, afterHash) =>
        `Remote tracking: ${beforeHash} -> ${afterHash}`,
      rewriteAutoSyncLocalHead: (headHash) =>
        `Lokaal herschreven HEAD: ${headHash}`,
      rewriteAutoSyncCommitsToPush: 'Commits die gepusht zullen worden:',
      rewriteAutoSyncNoCommitsToPush: '(geen)',
      rewriteAutoSyncDiffStat: 'Diff die gepusht zal worden:',
      rewriteAutoSyncNoDiffStat: '(geen diff)',
      rewriteAutoSyncRetryUsesCurrentLease:
        'Een nieuwe push poging zal de vernieuwde upstream lease gebruiken, niet de hash van vóór het herschrijven.',
      rewriteCliAuthFailedUsingVscodeFallback:
        'CLI push mislukt omdat Git inloggegevens nodig heeft; opnieuw proberen via VS Code Git.',
      rewriteVscodeFallbackSkippedLeaseChanged:
        'VS Code Git fallback overgeslagen omdat de remote tracking referentie is gewijzigd.',
    },
    notification: {
      gitExtensionMissing:
        'Git extensie niet gevonden. Controleer of Git is geïnstalleerd en de Git extensie is ingeschakeld.',
      multiRepoWarning:
        'Meerdere Git repositories gevonden. Focus a.u.b. op een bestand in de doelrepository of start via de SCM weergave.',
      repoNotFound:
        'Geen Git repository gevonden. Open een map die een Git repository bevat.',
      apiKeyMissing: (providerName) =>
        `${providerName} API sleutel is niet geconfigureerd. Stel uw API sleutel eerst in het Commit-Copilot paneel in.`,
      configureApiKeyAction: 'Configureer API sleutel',
      mixedChangesQuestion:
        'U heeft zowel gestagede als niet-gestagede wijzigingen. Hoe wilt u verder gaan?',
      stageAllAndGenerate: 'Stage Alles & Genereer',
      proceedStagedOnly: 'Ga door met alleen Gestagede',
      cancel: 'Annuleer',
      noStagedButUntrackedQuestion:
        'Geen gestagede wijzigingen gedetecteerd. Niet-getraceerde bestanden gevonden. Wilt u alle bestanden (inclusief niet-getraceerde) stagen of alleen genereren voor getraceerde gewijzigde bestanden?',
      stageAndGenerateAll: 'Stage & Genereer Alles',
      generateTrackedOnly: 'Genereer Alleen Getraceerde',
      onlyUntrackedQuestion:
        'Er zijn alleen niet-getraceerde bestanden aanwezig zonder getraceerde wijzigingen. Wilt u deze nieuwe bestanden stagen en traceren om een commit te genereren?',
      stageAndTrack: 'Stage & Traceer',
      commitGenerated: 'Commitbericht gegenereerd!',
      viewProviderConsoleAction: 'Bekijk Provider Console',
      noChanges:
        'Geen wijzigingen om te committen. Breng eerst wijzigingen aan!',
      generationCanceled: 'Commitbericht generatie geannuleerd.',
      rewriteCanceled: 'Commitbericht herschrijven geannuleerd.',
      failedPrefix: 'Commit-Copilot mislukt',
      rewriteNoNonMergeCommits:
        'Geen niet-merge commits gevonden in de geschiedenis van de huidige branch.',
      rewriteCommitNoSubject: '(geen onderwerp)',
      rewriteCommitRootDescription: 'root commit',
      rewriteCommitMergeDescription: 'merge commit',
      rewriteCommitParentDescription: (parentHash) => `parent ${parentHash}`,
      rewriteCommitSelectTitle: 'Selecteer commit om te herschrijven',
      rewriteCommitSelectPlaceholder:
        'Kies een commit uit de geschiedenis van de huidige branch',
      rewriteWorkspaceDirtyBoth:
        'Kan de commitgeschiedenis niet herschrijven zolang er staged (niet-gecommitte) en modified (unstaged) wijzigingen aanwezig zijn. Commit of stash ze eerst.',
      rewriteWorkspaceDirtyStaged:
        'Kan de commitgeschiedenis niet herschrijven zolang er staged (niet-gecommitte) wijzigingen aanwezig zijn. Commit of stash ze eerst.',
      rewriteWorkspaceDirtyUnstaged:
        'Kan de commitgeschiedenis niet herschrijven zolang er modified (unstaged) wijzigingen aanwezig zijn. Commit of stash ze eerst.',
      rewriteProgressTitle: (providerName) => `Herschrijven (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `Commit ${shortHash} analyseren...`,
      commitMessageCannotBeEmpty: 'Commitbericht mag niet leeg zijn.',
      rewriteApplyingTitle: (shortHash) => `${shortHash} herschrijven`,
      rewriteApplyingProgress: 'Commitgeschiedenis herschrijven...',
      rewriteFailedHistory: 'Commitgeschiedenis herschrijven mislukt.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Commitbericht van ${shortHash} herschreven.`,
      rewriteDetachedHeadPushUnavailable:
        'Commitgeschiedenis is herschreven, maar force push with lease is niet beschikbaar in detached HEAD-status.',
      rewriteForcePushPrompt: (target) =>
        `Geschiedenis herschreven. Force push with lease naar ${target}?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease voltooid: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease mislukt: ${message}`,
      pushingWithLease: 'Push with lease wordt uitgevoerd',
      rewriteAutoSyncRetryAction:
        'Automatisch synchroniseren en geforceerd pushen',
      rewriteAutoSyncRetryTitle: 'Automatisch synchroniseren met upstream',
      rewriteAutoSyncPromptWithUpstream: (upstreamRef) =>
        `De remote ${upstreamRef} is gewijzigd. Automatisch synchroniseren uitvoeren (fetch + rebase ${upstreamRef}) en met lease geforceerd pushen? De voorvertoning wordt naar het uitvoerpaneel geschreven.`,
      rewriteAutoSyncFailed: (message) =>
        `Automatisch synchroniseren mislukt: ${message}. Los eventuele conflicten op, rond de rebase af en probeer daarna opnieuw te pushen.`,
    },
  },
  mainViewText: {
    invalidApiKeyPrefix: 'Ongeldige API sleutel',
    quotaExceededPrefix: 'API quota overschreden',
    apiRequestFailedPrefix: 'API verzoek mislukt',
    connectionErrorPrefix: 'Verbindingsfout',
    unknownProvider: 'Onbekende provider',
    cannotConnectOllamaAt: (host) =>
      `Kan geen verbinding maken met Ollama op ${host}`,
    cannotConnectOllama: (message) =>
      `Kan geen verbinding maken met Ollama: ${message}. Zorg ervoor dat Ollama draait.`,
    apiKeyCannotBeEmpty: 'API sleutel mag niet leeg zijn',
    validationFailedPrefix: 'Validatie mislukt',
    unableToConnectFallback: 'Kan geen verbinding maken',
    saveConfigSuccess: (providerName) =>
      `${providerName} configuratie succesvol opgeslagen!`,
    saveConfigFailed: 'Opslaan configuratie mislukt',
    languageSaved: (label) => `Taal bijgewerkt: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API Provider',
      configuration: 'API Configuratie',
      ollamaConfiguration: 'Ollama Configuratie',
      model: 'Model',
      generateConfiguration: 'Generatie Configuratie',
      settings: 'Instellingen',
      addProvider: 'Aangepaste Provider Toevoegen',
      editProvider: 'Aangepaste Provider Bewerken',
      rewriteEditor: 'Herschrijven',
      advancedFeatures: 'Geavanceerde functies',
    },
    labels: {
      provider: 'Provider',
      apiKey: 'API Sleutel',
      ollamaHostUrl: 'Ollama Host URL',
      model: 'Model',
      mode: 'Modus',
      conventionalCommitSections: 'Conventionele Commit Secties',
      includeScope: 'Inclusief Scope',
      includeBody: 'Inclusief Body',
      includeFooter: 'Inclusief Footer',
      language: 'Extensie Taal',
      maxAgentSteps: 'Max Agent Stappen',
      providerName: 'Naam van Provider',
      apiBaseUrl: 'API Basis URL',
      commitMessage: 'Commitbericht',
      selectedCommitMessage: 'Geselecteerd commitbericht',
    },
    placeholders: {
      selectProvider: 'Selecteer een provider...',
      selectModel: 'Selecteer een model...',
      selectGenerateMode: 'Selecteer generatie modus...',
      enterApiKey: 'Voer uw API sleutel in',
      enterGeminiApiKey: 'Voer uw Gemini API sleutel in',
      enterOpenAIApiKey: 'Voer uw OpenAI API sleutel in',
      enterAnthropicApiKey: 'Voer uw Anthropic API sleutel in',
      enterCustomApiKey: 'Voer uw API sleutel in',
    },
    buttons: {
      save: 'Opslaan',
      validating: 'Valideren...',
      generateCommitMessage: 'Genereer Commitbericht',
      cancelGenerating: 'Annuleer Generatie',
      back: 'Terug',
      editProvider: 'Bewerk Provider',
      addProvider: '+ Provider Toevoegen...',
      deleteProvider: 'Verwijder Provider',
      openAdvancedFeatures: 'Geavanceerde functies openen',
      rewriteCommitMessage: 'Commitbericht herschrijven',
      confirmRewrite: 'Herschrijven bevestigen',
      cancel: 'Annuleren',
    },
    statuses: {
      checkingStatus: 'Status controleren...',
      configured: 'Geconfigureerd',
      notConfigured: 'Niet geconfigureerd',
      validating: 'Valideren...',
      loadingConfiguration: 'Configuratie laden...',
      noChangesDetected: 'Geen wijzigingen gedetecteerd',
      cancelCurrentGeneration: 'Annuleer huidige generatie',
      languageSaved: 'Taal bijgewerkt.',
      providerNameConflict: 'Een provider met deze naam bestaat al.',
      providerNameRequired: 'Provider naam is vereist.',
      baseUrlRequired: 'API Basis URL is vereist.',
      apiKeyRequired: 'API sleutel is vereist.',
      providerSaved: 'Aangepaste provider opgeslagen!',
      providerDeleted: 'Aangepaste provider verwijderd.',
      modelNameRequired: 'Voer een modelnaam in voordat u genereert.',
      commitMessageCannotBeEmpty: 'Commitbericht mag niet leeg zijn.',
      pushingWithLease: 'Push with lease wordt uitgevoerd...',
      forcePushWithLeaseCompleted: 'Force push with lease voltooid.',
      forcePushWithLeaseFailed: 'Force push with lease mislukt.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama staat vast op Direct Diff modus',
      agenticModeDescription:
        'Agentic modus gebruikt repository tools voor diepere analyse',
      directDiffDescription:
        'Direct Diff stuurt de ruwe diff direct naar het model',
      ollamaInfo:
        '<strong>Ollama</strong> draait lokaal op uw machine.<br>Standaard host: <code>{host}</code><br>Zorg ervoor dat Ollama draait voordat u genereert.',
      googleInfo:
        'Haal uw API sleutel op van <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Haal uw API sleutel op van <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Haal uw API sleutel op van <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Beperk tool calls van de agentic mode per generatie. Voer 0 in of laat leeg voor onbeperkt.',
      customProviderInfo:
        'Aangepaste providers moeten <strong>OpenAI-compatibel</strong> zijn.<br>De API basis URL moet wijzen naar een service die de OpenAI Chat Completions API implementeert.',
      advancedFeaturesDescription: 'Open geavanceerde tools en workflows.',
      rewriteWorkflowDescription:
        'Na het selecteren van een niet-merge commit genereert het systeem het bericht opnieuw met de huidige provider-, model- en uitvoerformaatinstellingen (scope/body/footer) in de actieve modus (Agentic / Direct Diff), en opent vervolgens een bewerkbare bevestigingsinterface; na verzenden wordt de geschiedenis herschreven via rebase, met optionele force push with lease.',
      rewriteEditorDescription:
        'Controleer en bevestig het nieuwe commitbericht.',
    },
    options: {
      agentic: 'Agentic Genereren',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'Agent analyseert wijzigingen...',
    generatingMessage: 'Commitbericht genereren...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Tijdelijke API-fout. Opnieuw proberen (${String(attempt)}/${String(maxAttempts)}) in ${String(seconds)}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Pulling ${model}: ${status} (${String(percent)}%)`
        : `Pulling ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Stap ${String(step)}] Diff analyseren: ${path}`,
    stepReadingFile: (step, path) =>
      `[Stap ${String(step)}] Bestand lezen: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Stap ${String(step)}] Outline ophalen: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Stap ${String(step)}] Referenties zoeken: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Stap ${String(step)}] Recente commits ophalen: ${String(count)} vermeldingen`
        : `[Stap ${String(step)}] Recente commits ophalen...`,
    stepSearchingProject: (step, keyword) =>
      `[Stap ${String(step)}] Project doorzoeken op: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Stap ${String(step)}] Aanroepen ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Stap ${String(step)}] Diffs analyseren: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Stap ${String(step)}] Diffs analyseren voor ${String(count)} bestanden...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Stap ${String(step)}] Bestanden lezen: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Stap ${String(step)}] Lezen van ${String(count)} bestanden...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Stap ${String(step)}] Outlines ophalen: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Stap ${String(step)}] Outlines ophalen voor ${String(count)} bestanden...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Stap ${String(step)}] Referenties zoeken: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Stap ${String(step)}] Referenties zoeken voor ${String(count)} symbolen...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Stap ${String(step)}] Project doorzoeken op: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Stap ${String(step)}] Project doorzoeken op ${String(count)} trefwoorden...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Stap ${String(step)}] Uitvoeren van ${String(count)} onderzoekstools...`,
  },
};
