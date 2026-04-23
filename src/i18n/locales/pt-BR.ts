import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const ptBRLocale: LocaleTextBundle = {
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
    'rewrite.commitHashRequired': () => 'Um hash de commit é obrigatório.',
    'rewrite.commitNotFound': (args) =>
      'O commit "{commitHash}" não foi encontrado.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'O commit "{commitHash}" é um merge commit e não pode ser reescrito por este fluxo.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Não é possível reescrever commits em detached HEAD.',
    'rewrite.commitNotReachable': (args) =>
      'O commit "{commitHash}" não é ancestral de HEAD.'.replace(
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
      title: 'Não é um repositório Git',
      action: 'Por favor, abra uma pasta que contenha um repositório Git.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Falha ao adicionar alterações ao stage',
      action: 'Verifique se o Git está configurado corretamente.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Nenhuma alteração para o commit',
      action: 'Faça algumas alterações nos seus arquivos primeiro.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Nenhuma alteração no stage detectada',
      action:
        'Arquivos não rastreados (untracked) encontrados. Por favor, adicione-os ao stage para gerar uma mensagem de commit.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Apenas arquivos não rastreados encontrados',
      action:
        'Você tem arquivos recém-criados mas não tem modificações em arquivos rastreados. Por favor, adicione-os ao stage para gerar o commit.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Geração cancelada',
      action: 'A geração foi cancelada pelo usuário.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Alterações mistas detectadas',
      action:
        'Você tem alterações com stage e sem stage. Por favor, escolha como prosseguir.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'Chave da API não configurada',
      action: 'Por favor, defina sua Chave da API no painel do Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Chave da API inválida',
      action:
        'Sua Chave da API é inválida ou foi revogada. Por favor, verifique e atualize-a.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'Cota da API excedida',
      action:
        'Você excedeu sua cota da API. Por favor, verifique a conta do seu provedor.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'Falha na requisição da API',
      action:
        'Ocorreu um erro de comunicação com a API. Por favor, tente novamente.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Falha ao fazer o commit das alterações',
      action: 'Verifique se há algum conflito ou problema no Git.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Ocorreu um erro inesperado',
      action:
        'Verifique a aba "Output" do "Commit-Copilot Debug" para mais detalhes.',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Requisição de geração ignorada: a geração já está em andamento.',
      generationStart: (timestamp) =>
        `[${timestamp}] Iniciando geração do commit-copilot...`,
      gitExtensionMissing: 'Erro: extensão do Git não encontrada.',
      selectedRepoFromScm: (path) =>
        `Repositório selecionado pelo contexto do SCM: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Repositório selecionado pelo editor ativo: ${path}`,
      noRepoMatchedActiveEditor:
        'Nenhum repositório correspondeu ao editor ativo.',
      noActiveEditorForRepoSelection:
        'Nenhum editor ativo encontrado para a seleção de repositório.',
      selectedOnlyRepo: (path) => `Selecionado o único repositório: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Foram encontrados ${String(count)} repositórios mas não foi possível determinar o ativo.`,
      noRepoInApi: 'Nenhum repositório encontrado na API.',
      usingProvider: (providerName) => `Usando provedor: ${providerName}`,
      usingGenerateMode: (mode) => `Modo de geração: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Opções de saída do commit: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Aviso: Nenhuma Chave da API encontrada para ${provider}.`,
      cancelRequestedFromProgress:
        'Cancelamento solicitado pela interface de progresso.',
      rewriteStart: (timestamp) =>
        `[${timestamp}] Iniciando geração de reescrita do commit-copilot...`,
      rewriteCancelRequestedFromProgress:
        'Cancelamento solicitado pela interface de progresso.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit reescrito: ${originalHash} -> ${replacementHash}`,
      rewriteReplacementCommitFallback: 'updated',
      callingGenerateCommitMessage: 'Chamando generateCommitMessage...',
      repositoryPath: (path) => `Caminho do repositório: ${path}`,
      usingModel: (model) => `Usando modelo: ${model}`,
      generatedMessage: (message) => `Mensagem gerada: ${message}`,
      generationError: (errorCode, message) =>
        `Erro: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Erro inesperado: ${message}`,
      openingLanguageSettings:
        'Abrindo configurações de idioma na Activity View...',
      rewriteLeaseProtectionBlocked:
        'Push bloqueado pela proteção de lease (o remoto mudou).',
      rewriteSuggestedRecoverySteps: 'Etapas de recuperação sugeridas:',
      rewriteAutoSyncBeforeRetryFailed: (message) =>
        `Falha na sincronização automática antes da nova tentativa: ${message}`,
      rewriteResolveConflictsContinueRebase:
        'Se houver conflitos no rebase, resolva-os primeiro e depois continue o rebase.',
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
        'Extensão do Git não encontrada. Por favor, certifique-se de que o Git está instalado e a extensão do Git está habilitada.',
      multiRepoWarning:
        'Múltiplos repositórios Git encontrados. Por favor, foque em um arquivo no repositório de destino ou execute a partir da visão de Source Control.',
      repoNotFound:
        'Nenhum repositório Git encontrado. Por favor, abra uma pasta que contenha um repositório Git.',
      apiKeyMissing: (providerName) =>
        `A Chave da API para o provedor ${providerName} não está configurada. Por favor, defina a Chave da API no painel do Commit-Copilot primeiro.`,
      configureApiKeyAction: 'Configurar a Chave da API',
      mixedChangesQuestion:
        'Você possui alterações com stage e sem stage. Como deseja proceder?',
      stageAllAndGenerate: 'Fazer Stage em Tudo e Gerar',
      proceedStagedOnly: 'Prosseguir Somente com o Stage',
      cancel: 'Cancelar',
      noStagedButUntrackedQuestion:
        'Nenhuma alteração com stage detectada. Arquivos não rastreados (untracked) foram encontrados. Deseja adicionar tudo ao stage (incluindo untracked) e gerar, ou gerar apenas para os arquivos modificados rastreados?',
      stageAndGenerateAll: 'Fazer Stage e Gerar em Tudo',
      generateTrackedOnly: 'Gerar Somente para Rastreados',
      onlyUntrackedQuestion:
        'Apenas arquivos não rastreados estão presentes e sem arquivos rastreados modificados. Deseja adicionar ao stage e rastrear os novos arquivos para gerar um commit?',
      stageAndTrack: 'Fazer Stage e Rastrear',
      commitGenerated: 'Mensagem de commit gerada!',
      viewProviderConsoleAction: 'Ver Console do Provedor',
      noChanges:
        'Nenhuma alteração para commitar. Faça algumas alterações primeiro!',
      generationCanceled: 'A geração de mensagem de commit foi cancelada.',
      rewriteCanceled: 'A reescrita da mensagem de commit foi cancelada.',
      failedPrefix: 'Commit-Copilot falhou',
      rewriteNoNonMergeCommits:
        'Nenhum commit que não seja merge foi encontrado no histórico do branch atual.',
      rewriteCommitNoSubject: '(sem assunto)',
      rewriteCommitRootDescription: 'commit raiz',
      rewriteCommitMergeDescription: 'commit de merge',
      rewriteCommitParentDescription: (parentHash) => `pai ${parentHash}`,
      rewriteCommitSelectTitle: 'Selecionar commit para reescrever',
      rewriteCommitSelectPlaceholder:
        'Escolha um commit do histórico do branch atual',
      rewriteWorkspaceDirtyBoth:
        'Não é possível reescrever o histórico de commits enquanto houver alterações staged (não commitadas) e modified (unstaged). Faça commit ou stash primeiro.',
      rewriteWorkspaceDirtyStaged:
        'Não é possível reescrever o histórico de commits enquanto houver alterações staged (não commitadas). Faça commit ou stash primeiro.',
      rewriteWorkspaceDirtyUnstaged:
        'Não é possível reescrever o histórico de commits enquanto houver alterações modified (unstaged). Faça commit ou stash primeiro.',
      rewriteProgressTitle: (providerName) => `Reescrita (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `Analisando commit ${shortHash}...`,
      commitMessageCannotBeEmpty: 'A mensagem de commit não pode ficar vazia.',
      rewriteApplyingTitle: (shortHash) => `Reescrevendo ${shortHash}`,
      rewriteApplyingProgress: 'Reescrevendo histórico de commits...',
      rewriteFailedHistory: 'Falha ao reescrever o histórico de commits.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Mensagem do commit ${shortHash} reescrita.`,
      rewriteDetachedHeadPushUnavailable:
        'O histórico de commits foi reescrito, mas force push with lease não está disponível em estado detached HEAD.',
      rewriteForcePushPrompt: (target) =>
        `Histórico reescrito. Fazer force push with lease para ${target}?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease concluído: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease falhou: ${message}`,
      pushingWithLease: 'Fazendo push with lease',
      rewriteAutoSyncRetryAction: 'Sincronizar e forçar push',
      rewriteAutoSyncRetryTitle: 'Sincronizando automaticamente com upstream',
      rewriteAutoSyncPromptWithUpstream: (upstreamRef) =>
        `O remoto ${upstreamRef} mudou. Executar sincronização automática (fetch + rebase ${upstreamRef}) e forçar push com lease? A prévia será gravada no painel de saída.`,
      rewriteAutoSyncFailed: (message) =>
        `Falha na sincronização automática: ${message}. Resolva conflitos (se houver), finalize o rebase e depois tente o push novamente.`,
    },
  },
  mainViewText: {
    invalidApiKeyPrefix: 'Chave da API Inválida',
    quotaExceededPrefix: 'Cota da API excedida',
    apiRequestFailedPrefix: 'Falha na requisição da API',
    connectionErrorPrefix: 'Erro de conexão',
    unknownProvider: 'Provedor desconhecido',
    cannotConnectOllamaAt: (host) =>
      `Não é possível conectar ao Ollama em ${host}`,
    cannotConnectOllama: (message) =>
      `Não é possível conectar ao Ollama: ${message}. Verifique se o Ollama está rodando.`,
    apiKeyCannotBeEmpty: 'A Chave da API não pode estar vazia',
    validationFailedPrefix: 'Falha na validação',
    unableToConnectFallback: 'Não foi possível conectar',
    saveConfigSuccess: (providerName) =>
      `Configuração salva com êxito em ${providerName}!`,
    saveConfigFailed: 'Falha ao tentar salvar as configurações',
    languageSaved: (label) => `Idioma atualizado: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'Provedor da API',
      configuration: 'Configuração da API',
      ollamaConfiguration: 'Configuração do Ollama',
      model: 'Modelo',
      generateConfiguration: 'Configuração de Geração',
      settings: 'Configurações',
      addProvider: 'Adicionar Provedor Personalizado',
      editProvider: 'Editar Provedor Personalizado',
      rewriteEditor: 'Reescrever',
      advancedFeatures: 'Recursos avançados',
    },
    labels: {
      provider: 'Provedor',
      apiKey: 'Chave da API',
      ollamaHostUrl: 'URL Host do Ollama',
      model: 'Modelo',
      mode: 'Modo',
      conventionalCommitSections: 'Sessões de Conventional Commit',
      includeScope: 'Incluir Escopo',
      includeBody: 'Incluir Corpo',
      includeFooter: 'Incluir Rodapé',
      language: 'Idioma da Extensão',
      maxAgentSteps: 'Número Máximo de Passos do Agente',
      providerName: 'Nome do Provedor',
      apiBaseUrl: 'URL Base da API',
      commitMessage: 'Mensagem de commit',
      selectedCommitMessage: 'Mensagem de commit selecionada',
    },
    placeholders: {
      selectProvider: 'Selecione um provedor...',
      selectModel: 'Selecione o modelo...',
      selectGenerateMode: 'Selecione o modo de geração...',
      enterApiKey: 'Insira sua Chave da API',
      enterGeminiApiKey: 'Insira sua Chave da API do Gemini',
      enterOpenAIApiKey: 'Insira sua Chave da API da OpenAI',
      enterAnthropicApiKey: 'Insira sua Chave da API da Anthropic',
      enterCustomApiKey: 'Insira sua Chave da API',
    },
    buttons: {
      save: 'Salvar',
      validating: 'Validando...',
      generateCommitMessage: 'Gerar Mensagem de Commit',
      cancelGenerating: 'Cancelar Geração',
      back: 'Voltar',
      editProvider: 'Editar Provedor',
      addProvider: '+ Adicionar Provedor...',
      deleteProvider: 'Excluir Provedor',
      openAdvancedFeatures: 'Abrir recursos avançados',
      rewriteCommitMessage: 'Reescrever mensagem de commit',
      confirmRewrite: 'Confirmar reescrita',
      cancel: 'Cancelar',
    },
    statuses: {
      checkingStatus: 'Verificando o status...',
      configured: 'Configurado',
      notConfigured: 'Não configurado',
      validating: 'Validando...',
      loadingConfiguration: 'Carregando a configuração...',
      noChangesDetected: 'Nenhuma alteração detectada',
      cancelCurrentGeneration: 'Cancelar a geração atual',
      languageSaved: 'Idioma atualizado.',
      providerNameConflict: 'Um provedor com esse nome já existe.',
      providerNameRequired: 'O nome do provedor é obrigatório.',
      baseUrlRequired: 'A URL Base da API é obrigatória.',
      apiKeyRequired: 'Sua chave de API é requerida.',
      providerSaved: 'Provedor customizado salvo!',
      providerDeleted: 'Provedor customizado removido.',
      modelNameRequired:
        'Por favor, insira o nome de um modelo antes da geração.',
      commitMessageCannotBeEmpty: 'A mensagem de commit não pode ficar vazia.',
      pushingWithLease: 'Fazendo push with lease...',
      forcePushWithLeaseCompleted: 'Force push with lease concluído.',
      forcePushWithLeaseFailed: 'Force push with lease falhou.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'O Ollama está fixado no modo de Diff Direto',
      agenticModeDescription:
        'Modo Agêntico usa ferramentas de repositório para uma análise mais profunda',
      directDiffDescription:
        'O Diff Direto envia o diff bruto diretamente ao modelo',
      ollamaInfo:
        'O <strong>Ollama</strong> roda localmente em sua máquina.<br>Host padrão: <code>{host}</code><br>Certifique-se de que o Ollama está rodando antes de gerar.',
      googleInfo:
        'Obtenha sua Chave da API a partir do <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Obtenha sua Chave da API a partir da <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Obtenha sua Chave da API a partir do <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Limita os passos do agente nas ferramentas. Insira 0 ou deixe em branco caso queira uso ilimitado.',
      customProviderInfo:
        'Os provedores personalizados precisam ser <strong>compatíveis com a OpenAI</strong>.<br>A URL Base da API deve apontar a um local com completude para Chat.',
      advancedFeaturesDescription:
        'Abra ferramentas e fluxos de trabalho avançados.',
      rewriteWorkflowDescription:
        'Após selecionar um commit que não seja de merge, o sistema regenera a mensagem usando o provedor, modelo e formato de saída atuais (scope/body/footer) no modo ativo (Agentic / Direct Diff), depois abre uma interface de confirmação editável; após enviar, o histórico é reescrito via rebase, com opção de force push with lease.',
      rewriteEditorDescription: 'Revise e confirme a nova mensagem de commit.',
    },
    options: {
      agentic: 'Geração Agêntica',
      directDiff: 'Diff Direto',
    },
  },
  progressMessages: {
    analyzingChanges: 'Agente analisando mudanças...',
    generatingMessage: 'Gerando mensagem de commit...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Erro transitório na API. Tentando novamente (${String(attempt)}/${String(maxAttempts)}) em ${String(seconds)}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Puxando ${model}: ${status} (${String(percent)}%)`
        : `Puxando ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Passo ${String(step)}] Analisando diff: ${path}`,
    stepReadingFile: (step, path) =>
      `[Passo ${String(step)}] Lendo arquivo: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Passo ${String(step)}] Obtendo outline: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Passo ${String(step)}] Encontrando referências: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Passo ${String(step)}] Buscando ${String(count)} commits mais recentes`
        : `[Passo ${String(step)}] Buscando commits mais recentes...`,
    stepSearchingProject: (step, keyword) =>
      `[Passo ${String(step)}] Pesquisando o projeto por: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Passo ${String(step)}] Chamando ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Passo ${String(step)}] Analisando diffs: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Passo ${String(step)}] Analisando os diffs em ${String(count)} arquivos...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Passo ${String(step)}] Lendo arquivos: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Passo ${String(step)}] Lendo ${String(count)} arquivos...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Passo ${String(step)}] Obtendo outlines: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Passo ${String(step)}] Obtendo os outlines em ${String(count)} arquivos...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Passo ${String(step)}] Encontrando referências: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Passo ${String(step)}] Encontrando referências para ${String(count)} símbolos...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Passo ${String(step)}] Pesquisando o projeto por: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Passo ${String(step)}] Pesquisando o projeto com ${String(count)} palavras-chave...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Passo ${String(step)}] Executando ${String(count)} ferramentas de investigação...`,
  },
};
