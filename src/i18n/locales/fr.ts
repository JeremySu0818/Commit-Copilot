import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const frLocale: LocaleTextBundle = {
  commitCopilotErrorMessages: {
    'rewrite.commitHashRequired': () => 'Un hash de commit est requis.',
    'rewrite.commitNotFound': (args) =>
      'Le commit "{commitHash}" est introuvable.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'Le commit "{commitHash}" est un merge commit et ne peut pas être réécrit par ce flux.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Impossible de réécrire des commits en état detached HEAD.',
    'rewrite.commitNotReachable': (args) =>
      'Le commit "{commitHash}" n\'est pas un ancêtre de HEAD.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
  },
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Pas un dépôt Git',
      action: 'Veuillez ouvrir un dossier contenant un dépôt Git.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: "Échec de la mise en zone d'attente (stage) des modifications",
      action: 'Vérifiez si Git est correctement configuré.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Aucune modification à commiter',
      action: "Modifiez d'abord quelques fichiers.",
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Aucune modification indexée détectée',
      action:
        'Fichiers non suivis trouvés. Veuillez les indexer (stage) pour générer un message de commit.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Seuls des fichiers non suivis ont été trouvés',
      action:
        'Vous avez créé de nouveaux fichiers mais aucune modification suivie. Veuillez les indexer pour générer un commit.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Génération annulée',
      action: "La génération a été annulée par l'utilisateur.",
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Modifications mixtes détectées',
      action:
        'Vous avez des modifications indexées et non indexées. Veuillez choisir comment procéder.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'Clé API non configurée',
      action: 'Veuillez définir votre clé API dans le panneau Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Clé API invalide',
      action:
        'Votre clé API est invalide ou a été révoquée. Veuillez vérifier et mettre à jour.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'Quota API dépassé',
      action:
        'Vous avez dépassé votre quota API. Veuillez vérifier votre compte fournisseur.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'Échec de la requête API',
      action:
        "Une erreur s'est produite lors de la communication avec l'API. Veuillez réessayer.",
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Échec du commit des modifications',
      action: "Vérifiez s'il y a des conflits ou problèmes Git.",
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: "Une erreur inattendue s'est produite",
      action: 'Vérifiez la sortie "Commit-Copilot Debug" pour plus de détails.',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Requête de génération ignorée : génération déjà en cours.',
      generationStart: (timestamp) =>
        `[${timestamp}] Démarrage de la génération commit-copilot...`,
      gitExtensionMissing: 'Erreur : Extension Git introuvable.',
      selectedRepoFromScm: (path) =>
        `Dépôt sélectionné depuis le contexte SCM : ${path}`,
      selectedRepoFromEditor: (path) =>
        `Dépôt sélectionné depuis l'éditeur actif : ${path}`,
      noRepoMatchedActiveEditor: "Aucun dépôt ne correspond à l'éditeur actif.",
      noActiveEditorForRepoSelection:
        'Aucun éditeur actif trouvé pour la sélection du dépôt.',
      selectedOnlyRepo: (path) => `Dépôt unique sélectionné : ${path}`,
      multiRepoNotDetermined: (count) =>
        `Trouvé ${String(count)} dépôts mais impossible de déterminer l'actif.`,
      noRepoInApi: "Aucun dépôt trouvé dans l'API.",
      usingProvider: (providerName) =>
        `Utilisation du fournisseur : ${providerName}`,
      usingGenerateMode: (mode) => `Mode de génération : ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Options de sortie du commit : ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Avertissement : Aucune clé API trouvée pour ${provider}.`,
      cancelRequestedFromProgress:
        "Annulation demandée depuis l'interface de progression.",
      rewriteStart: (timestamp) =>
        `[${timestamp}] Démarrage de la génération de réécriture commit-copilot...`,
      rewriteCancelRequestedFromProgress:
        'Annulation demandée depuis l’interface de progression.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit réécrit : ${originalHash} -> ${replacementHash}`,
      callingGenerateCommitMessage: 'Appel de generateCommitMessage...',
      repositoryPath: (path) => `Chemin du dépôt : ${path}`,
      usingModel: (model) => `Utilisation du modèle : ${model}`,
      generatedMessage: (message) => `Message généré : ${message}`,
      generationError: (errorCode, message) =>
        `Erreur : ${errorCode} - ${message}`,
      unexpectedError: (message) => `Erreur inattendue : ${message}`,
      openingLanguageSettings:
        "Ouverture des paramètres de langue dans la vue d'activité...",
    },
    notification: {
      gitExtensionMissing:
        "Extension Git introuvable. Veuillez vous assurer que Git est installé et que l'extension Git est activée.",
      multiRepoWarning:
        'Plusieurs dépôts Git trouvés. Veuillez vous concentrer sur un fichier du dépôt cible ou lancer depuis la vue SCM.',
      repoNotFound:
        'Aucun dépôt Git trouvé. Veuillez ouvrir un dossier contenant un dépôt Git.',
      apiKeyMissing: (providerName) =>
        `La clé API ${providerName} n'est pas configurée. Veuillez d'abord définir votre clé API dans le panneau Commit-Copilot.`,
      configureApiKeyAction: 'Configurer la clé API',
      mixedChangesQuestion:
        'Vous avez des modifications indexées et non indexées. Comment souhaitez-vous procéder ?',
      stageAllAndGenerate: 'Tout indexer et générer',
      proceedStagedOnly: 'Procéder uniquement avec les fichiers indexés',
      cancel: 'Annuler',
      noStagedButUntrackedQuestion:
        'Aucune modification indexée détectée. Fichiers non suivis trouvés. Souhaitez-vous indexer tous les fichiers (y compris non suivis) ou générer uniquement pour les fichiers modifiés suivis ?',
      stageAndGenerateAll: 'Tout indexer et générer',
      generateTrackedOnly: 'Générer pour les suivis uniquement',
      onlyUntrackedQuestion:
        'Seuls des fichiers non suivis sont présents sans aucune modification suivie. Voulez-vous indexer et suivre ces nouveaux fichiers pour générer un commit ?',
      stageAndTrack: 'Indexer et suivre',
      commitGenerated: 'Message de commit généré !',
      viewProviderConsoleAction: 'Voir la console du fournisseur',
      noChanges:
        "Aucune modification à commiter. Modifiez d'abord quelques fichiers !",
      generationCanceled: 'Génération du message de commit annulée.',
      rewriteCanceled: 'Réécriture du message de commit annulée.',
      failedPrefix: 'Échec de Commit-Copilot',
      rewriteNoNonMergeCommits:
        'Aucun commit hors merge trouvé dans l’historique de la branche actuelle.',
      rewriteCommitNoSubject: '(aucun sujet)',
      rewriteCommitRootDescription: 'commit racine',
      rewriteCommitMergeDescription: 'commit de merge',
      rewriteCommitParentDescription: (parentHash) => `parent ${parentHash}`,
      rewriteCommitSelectTitle: 'Sélectionner le commit à réécrire',
      rewriteCommitSelectPlaceholder:
        'Choisissez un commit dans l’historique de la branche actuelle',
      rewriteWorkspaceDirtyBoth:
        'Impossible de réécrire l’historique des commits tant que des changements staged (non commités) et modified (unstaged) sont présents. Commitez-les ou mettez-les de côté avec stash d’abord.',
      rewriteWorkspaceDirtyStaged:
        'Impossible de réécrire l’historique des commits tant que des changements staged (non commités) sont présents. Commitez-les ou mettez-les de côté avec stash d’abord.',
      rewriteWorkspaceDirtyUnstaged:
        'Impossible de réécrire l’historique des commits tant que des changements modified (unstaged) sont présents. Commitez-les ou mettez-les de côté avec stash d’abord.',
      rewriteProgressTitle: (providerName) => `Réécriture (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `Analyse du commit ${shortHash}...`,
      commitMessageCannotBeEmpty: 'Le message de commit ne peut pas être vide.',
      rewriteApplyingTitle: (shortHash) => `Réécriture de ${shortHash}`,
      rewriteApplyingProgress: 'Réécriture de l’historique des commits...',
      rewriteFailedHistory:
        'Échec de la réécriture de l’historique des commits.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Message du commit ${shortHash} réécrit.`,
      rewriteDetachedHeadPushUnavailable:
        'L’historique des commits a été réécrit, mais le force push with lease n’est pas disponible en état detached HEAD.',
      rewriteForcePushPrompt: (target) =>
        `Historique réécrit. Faire un force push with lease vers ${target} ?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease terminé : ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Échec du force push with lease : ${message}`,
      pushingWithLease: 'Push with lease en cours',
    },
  },
  mainViewText: {
    invalidApiKeyPrefix: 'Clé API invalide',
    quotaExceededPrefix: 'Quota API dépassé',
    apiRequestFailedPrefix: 'Échec de la requête API',
    connectionErrorPrefix: 'Erreur de connexion',
    unknownProvider: 'Fournisseur inconnu',
    cannotConnectOllamaAt: (host) =>
      `Impossible de se connecter à Ollama à ${host}`,
    cannotConnectOllama: (message) =>
      `Impossible de se connecter à Ollama : ${message}. Assurez-vous qu'Ollama est en cours d'exécution.`,
    apiKeyCannotBeEmpty: 'La clé API ne peut pas être vide',
    validationFailedPrefix: 'Échec de la validation',
    unableToConnectFallback: 'Impossible de se connecter',
    saveConfigSuccess: (providerName) =>
      `Configuration de ${providerName} enregistrée avec succès !`,
    saveConfigFailed: "Échec de l'enregistrement de la configuration",
    languageSaved: (label) => `Langue mise à jour : ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: "Fournisseur d'API",
      configuration: 'Configuration API',
      ollamaConfiguration: 'Configuration Ollama',
      model: 'Modèle',
      generateConfiguration: 'Configuration de génération',
      settings: 'Paramètres',
      addProvider: 'Ajouter un fournisseur personnalisé',
      editProvider: 'Modifier un fournisseur personnalisé',
      rewriteEditor: 'Réécrire',
      advancedFeatures: 'Fonctionnalités avancées',
    },
    labels: {
      provider: 'Fournisseur',
      apiKey: 'Clé API',
      ollamaHostUrl: "URL de l'hôte Ollama",
      model: 'Modèle',
      mode: 'Mode',
      conventionalCommitSections: 'Sections de commit conventionnel',
      includeScope: 'Inclure la portée (scope)',
      includeBody: 'Inclure le corps (body)',
      includeFooter: 'Inclure le pied de page (footer)',
      language: "Langue de l'extension",
      maxAgentSteps: "Nombre maximal d'étapes de l'agent",
      providerName: 'Nom du fournisseur',
      apiBaseUrl: "URL de base de l'API",
      commitMessage: 'Message de commit',
      selectedCommitMessage: 'Message de commit sélectionné',
    },
    placeholders: {
      selectProvider: 'Sélectionnez un fournisseur...',
      selectModel: 'Sélectionnez un modèle...',
      selectGenerateMode: 'Sélectionnez un mode de génération...',
      enterApiKey: 'Entrez votre clé API',
      enterGeminiApiKey: 'Entrez votre clé API Gemini',
      enterOpenAIApiKey: 'Entrez votre clé API OpenAI',
      enterAnthropicApiKey: 'Entrez votre clé API Anthropic',
      enterCustomApiKey: 'Entrez votre clé API',
    },
    buttons: {
      save: 'Enregistrer',
      validating: 'Validation en cours...',
      generateCommitMessage: 'Générer le message de commit',
      cancelGenerating: 'Annuler la génération',
      back: 'Retour',
      editProvider: 'Modifier le fournisseur',
      addProvider: '+ Ajouter un fournisseur...',
      deleteProvider: 'Supprimer le fournisseur',
      openAdvancedFeatures: 'Ouvrir les fonctionnalités avancées',
      rewriteCommitMessage: 'Réécrire le message de commit',
      confirmRewrite: 'Confirmer la réécriture',
      cancel: 'Annuler',
    },
    statuses: {
      checkingStatus: "Vérification de l'état...",
      configured: 'Configuré',
      notConfigured: 'Non configuré',
      validating: 'Validation en cours...',
      loadingConfiguration: 'Chargement de la configuration...',
      noChangesDetected: 'Aucune modification détectée',
      cancelCurrentGeneration: 'Annuler la génération actuelle',
      languageSaved: 'Langue mise à jour.',
      providerNameConflict: 'Un fournisseur avec ce nom existe déjà.',
      providerNameRequired: 'Le nom du fournisseur est requis.',
      baseUrlRequired: "L'URL de base de l'API est requise.",
      apiKeyRequired: 'La clé API est requise.',
      providerSaved: 'Fournisseur personnalisé enregistré !',
      providerDeleted: 'Fournisseur personnalisé supprimé.',
      modelNameRequired: 'Veuillez entrer un nom de modèle avant de générer.',
      commitMessageCannotBeEmpty: 'Le message de commit ne peut pas être vide.',
      pushingWithLease: 'Push with lease en cours...',
      forcePushWithLeaseCompleted: 'Force push with lease terminé.',
      forcePushWithLeaseFailed: 'Échec du force push with lease.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama est fixé en mode Direct Diff',
      agenticModeDescription:
        'Le mode Agentic utilise des outils de dépôt pour une analyse plus approfondie',
      directDiffDescription:
        'Direct Diff envoie directement la différence (diff) brute au modèle',
      ollamaInfo:
        "<strong>Ollama</strong> s'exécute localement sur votre machine.<br>Hôte par défaut : <code>{host}</code><br>Assurez-vous qu'Ollama est en cours d'exécution avant de générer.",
      googleInfo:
        'Obtenez votre clé API sur <strong>Google AI Studio</strong> :<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Obtenez votre clé API sur <strong>OpenAI Platform</strong> :<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Obtenez votre clé API sur la <strong>Console Anthropic</strong> :<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        "Limiter les appels de l'outil de l'agent par génération. Entrez 0 ou laissez vide pour illimité.",
      customProviderInfo:
        "Les fournisseurs personnalisés doivent être <strong>compatibles avec OpenAI</strong>.<br>L'URL de base de l'API doit pointer vers un service qui implémente l'API Chat Completions d'OpenAI.",
      advancedFeaturesDescription: 'Ouvrez les outils et workflows avancés.',
      rewriteWorkflowDescription:
        "Après avoir sélectionné un commit non-merge, le système régénère le message selon le fournisseur, le modèle et le format de sortie actuels (scope/body/footer) dans le mode actif (Agentic / Direct Diff), puis ouvre une interface de confirmation modifiable ; après validation, l'historique est réécrit via rebase, avec option de force push with lease.",
      rewriteEditorDescription:
        'Vérifiez et confirmez le nouveau message de commit.',
    },
    options: {
      agentic: 'Génération Agentic',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: "L'agent analyse les modifications...",
    generatingMessage: 'Génération du message de commit...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Erreur d'API transitoire. Nouvelle tentative (${String(attempt)}/${String(maxAttempts)}) dans ${String(seconds)}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Téléchargement de ${model} : ${status} (${String(percent)}%)`
        : `Téléchargement de ${model} : ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Étape ${String(step)}] Analyse de la différence : ${path}`,
    stepReadingFile: (step, path) =>
      `[Étape ${String(step)}] Lecture du fichier : ${path}`,
    stepGettingOutline: (step, path) =>
      `[Étape ${String(step)}] Obtention de l'aperçu : ${path}`,
    stepFindingReferences: (step, target) =>
      `[Étape ${String(step)}] Recherche de références : ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Étape ${String(step)}] Récupération des commits récents : ${String(count)} entrées`
        : `[Étape ${String(step)}] Récupération des commits récents...`,
    stepSearchingProject: (step, keyword) =>
      `[Étape ${String(step)}] Recherche dans le projet pour : ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Étape ${String(step)}] Appel de ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Étape ${String(step)}] Analyse des différences : ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Étape ${String(step)}] Analyse des différences pour ${String(count)} fichiers...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Étape ${String(step)}] Lecture des fichiers : ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Étape ${String(step)}] Lecture de ${String(count)} fichiers...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Étape ${String(step)}] Obtention des aperçus : ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Étape ${String(step)}] Obtention d'aperçus pour ${String(count)} fichiers...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Étape ${String(step)}] Recherche de références : ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Étape ${String(step)}] Recherche de références pour ${String(count)} symboles...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Étape ${String(step)}] Recherche dans le projet pour : ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Étape ${String(step)}] Recherche dans le projet pour ${String(count)} mots-clés...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Étape ${String(step)}] Exécution de ${String(count)} outils d'investigation...`,
  },
};
