import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const ptBRLocale: LocaleTextBundle = {
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
        `Foram encontrados ${count} repositórios mas não foi possível determinar o ativo.`,
      noRepoInApi: 'Nenhum repositório encontrado na API.',
      usingProvider: (providerName) => `Usando provedor: ${providerName}`,
      usingGenerateMode: (mode) => `Modo de geração: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Opções de saída do commit: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Aviso: Nenhuma Chave da API encontrada para ${provider}.`,
      cancelRequestedFromProgress:
        'Cancelamento solicitado pela interface de progresso.',
      callingGenerateCommitMessage: 'Chamando generateCommitMessage...',
      repositoryPath: (path) => `Caminho do repositório: ${path}`,
      usingModel: (model) => `Usando modelo: ${model}`,
      generatedMessage: (message) => `Mensagem gerada: ${message}`,
      generationError: (errorCode, message) =>
        `Erro: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Erro inesperado: ${message}`,
      openingLanguageSettings:
        'Abrindo configurações de idioma na Activity View...',
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
      failedPrefix: 'Commit-Copilot falhou',
    },
  },
  sidePanelText: {
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
      `Erro transitório na API. Tentando novamente (${attempt}/${maxAttempts}) em ${seconds}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Puxando ${model}: ${status} (${percent}%)`
        : `Puxando ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Passo ${step}] Analisando diff: ${path}`,
    stepReadingFile: (step, path) => `[Passo ${step}] Lendo arquivo: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Passo ${step}] Obtendo outline: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Passo ${step}] Encontrando referências: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Passo ${step}] Buscando ${count} commits mais recentes`
        : `[Passo ${step}] Buscando commits mais recentes...`,
    stepSearchingProject: (step, keyword) =>
      `[Passo ${step}] Pesquisando o projeto por: ${keyword}`,
    stepCalling: (step, toolName) => `[Passo ${step}] Chamando ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Passo ${step}] Analisando diffs: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Passo ${step}] Analisando os diffs em ${count} arquivos...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Passo ${step}] Lendo arquivos: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Passo ${step}] Lendo ${count} arquivos...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Passo ${step}] Obtendo outlines: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Passo ${step}] Obtendo os outlines em ${count} arquivos...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Passo ${step}] Encontrando referências: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Passo ${step}] Encontrando referências para ${count} símbolos...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Passo ${step}] Pesquisando o projeto por: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Passo ${step}] Pesquisando o projeto com ${count} palavras-chave...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Passo ${step}] Executando ${count} ferramentas de investigação...`,
  },
};
