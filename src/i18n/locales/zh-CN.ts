import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const zhCNLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: '不是 Git 仓库',
      action: '请打开包含 Git 仓库的文件夹。',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: '暂存更改失败',
      action: '请确认 Git 设置是否正确。',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: '没有可提交的更改',
      action: '请先修改文件。',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: '未检测到已暂存更改',
      action: '发现未追踪文件，请先暂存再生成 commit 信息。',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: '只有未追踪文件',
      action: '目前只有新文件，请先暂存后再生成 commit。',
    },
    [EXIT_CODES.CANCELLED]: {
      title: '已取消生成',
      action: '用户已取消生成流程。',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: '检测到混合更改',
      action: '同时存在 staged 与 unstaged 更改，请选择处理方式。',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: '未设置 API Key',
      action: '请先在 Commit-Copilot 面板设置 API Key。',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'API Key 无效',
      action: 'API Key 可能无效或已被撤销，请更新后再试。',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'API 配额已用尽',
      action: '请至提供商后台确认账户配额。',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'API 请求失败',
      action: '与 API 通信时发生错误，请稍后再试。',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: '提交更改失败',
      action: '请确认是否有 Git 冲突或其他问题。',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: '发生未预期错误',
      action: '请查看“Commit-Copilot Debug”输出以获取细节。',
    },
  },
  extensionText: {
    output: {
      generationIgnored: '忽略生成请求：目前已有生成流程进行中。',
      generationStart: (timestamp) =>
        `[${timestamp}] 开始执行 commit-copilot 生成流程...`,
      gitExtensionMissing: '错误：找不到 Git extension。',
      selectedRepoFromScm: (path) => `从 SCM 内容选择仓库：${path}`,
      selectedRepoFromEditor: (path) => `从当前编辑器选择仓库：${path}`,
      noRepoMatchedActiveEditor: '当前编辑器未对应到任何仓库。',
      noActiveEditorForRepoSelection: '找不到活动的编辑器，无法选择仓库。',
      selectedOnlyRepo: (path) => `已选择唯一仓库：${path}`,
      multiRepoNotDetermined: (count) =>
        `找到 ${String(count)} 个仓库，但无法判定活动目标。`,
      noRepoInApi: 'Git API 中没有可用仓库。',
      usingProvider: (providerName) => `使用提供商：${providerName}`,
      usingGenerateMode: (mode) => `生成模式：${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Commit 输出选项：${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `警告：${provider} 尚未设置 API Key。`,
      cancelRequestedFromProgress: '已从进度通知请求取消。',
      callingGenerateCommitMessage: '调用 generateCommitMessage...',
      repositoryPath: (path) => `仓库路径：${path}`,
      usingModel: (model) => `使用模型：${model}`,
      generatedMessage: (message) => `已生成信息：${message}`,
      generationError: (errorCode, message) =>
        `错误：${errorCode} - ${message}`,
      unexpectedError: (message) => `未预期错误：${message}`,
      openingLanguageSettings: '正在打开 Activity View 的语言设置...',
    },
    notification: {
      gitExtensionMissing:
        '找不到 Git extension。请确认已安装 Git 并启用 Git extension。',
      multiRepoWarning:
        '检测到多个 Git 仓库。请先聚焦目标仓库中的文件，或从 SCM 视图执行。',
      repoNotFound: '找不到 Git 仓库。请打开包含 Git 仓库的文件夹。',
      apiKeyMissing: (providerName) =>
        `${providerName} API Key 尚未设置。请先在 Commit-Copilot 面板设置 API Key。`,
      configureApiKeyAction: '设置 API Key',
      mixedChangesQuestion:
        '目前同时有 staged 与 unstaged 更改。请选择要如何处理：',
      stageAllAndGenerate: '全部暂存并生成',
      proceedStagedOnly: '仅使用已暂存内容',
      cancel: '取消',
      noStagedButUntrackedQuestion:
        '目前没有 staged 更改，但有未追踪文件。要先暂存全部文件（含未追踪）还是只针对已追踪修改生成？',
      stageAndGenerateAll: '暂存并生成全部',
      generateTrackedOnly: '只生成已追踪修改',
      onlyUntrackedQuestion:
        '目前只有未追踪文件，没有已追踪修改。要暂存并追踪这些新文件后生成 commit 吗？',
      stageAndTrack: '暂存并追踪',
      commitGenerated: '已生成 Commit Message！',
      viewProviderConsoleAction: '打开提供商后台',
      noChanges: '目前没有可提交的更改，请先修改文件！',
      generationCanceled: '已取消 commit message 生成。',
      failedPrefix: 'Commit-Copilot 执行失败',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'API Key 无效',
    quotaExceededPrefix: 'API 配额已用尽',
    apiRequestFailedPrefix: 'API 请求失败',
    connectionErrorPrefix: '连接错误',
    unknownProvider: '未知的提供商',
    cannotConnectOllamaAt: (host) => `无法连接到 ${host} 的 Ollama`,
    cannotConnectOllama: (message) =>
      `无法连接到 Ollama：${message}。请确认 Ollama 已启动。`,
    apiKeyCannotBeEmpty: 'API Key 不可为空',
    validationFailedPrefix: '验证失败',
    unableToConnectFallback: '无法连接',
    saveConfigSuccess: (providerName) => `已保存 ${providerName} 设置！`,
    saveConfigFailed: '保存设置失败',
    languageSaved: (label) => `语言已更新：${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API 提供商',
      configuration: 'API 设置',
      ollamaConfiguration: 'Ollama 设置',
      model: '模型',
      generateConfiguration: '生成设置',
      settings: '设置',
      addProvider: '添加自定义提供商',
      editProvider: '编辑自定义提供商',
    },
    labels: {
      provider: '提供商',
      apiKey: 'API Key',
      ollamaHostUrl: 'Ollama 主机 URL',
      model: '模型',
      mode: '模式',
      conventionalCommitSections: '约定式提交区块',
      includeScope: '包含 Scope',
      includeBody: '包含 Body',
      includeFooter: '包含 Footer',
      language: 'Extension 语言',
      maxAgentSteps: '最大 Agent 步数',
      providerName: '提供商名称',
      apiBaseUrl: 'API Base URL',
    },
    placeholders: {
      selectProvider: '请选择提供商...',
      selectModel: '请选择模型...',
      selectGenerateMode: '请选择生成模式...',
      enterApiKey: '请输入 API Key',
      enterGeminiApiKey: '请输入 Gemini API Key',
      enterOpenAIApiKey: '请输入 OpenAI API Key',
      enterAnthropicApiKey: '请输入 Anthropic API Key',
      enterCustomApiKey: '请输入 API Key',
    },
    buttons: {
      save: '保存',
      validating: '验证中...',
      generateCommitMessage: '生成 Commit Message',
      cancelGenerating: '取消生成',
      back: '返回',
      editProvider: '编辑 Provider',
      addProvider: '+ 添加 Provider...',
      deleteProvider: '删除 Provider',
    },
    statuses: {
      checkingStatus: '检查状态中...',
      configured: '已设置',
      notConfigured: '未设置',
      validating: '验证中...',
      loadingConfiguration: '加载设置中...',
      noChangesDetected: '未检测到更改',
      cancelCurrentGeneration: '取消目前生成流程',
      languageSaved: '语言已更新。',
      providerNameConflict: '已存在相同名称的提供商。',
      providerNameRequired: '请输入提供商名称。',
      baseUrlRequired: '请输入 API Base URL。',
      apiKeyRequired: '请输入 API Key。',
      providerSaved: '已保存自定义提供商！',
      providerDeleted: '已删除自定义提供商。',
      modelNameRequired: '请先输入模型名称再进行生成。',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama 固定使用 Direct Diff 模式',
      agenticModeDescription: 'Agentic 模式会使用仓库工具做更深入分析',
      directDiffDescription: 'Direct Diff 会将原始 diff 直接发给模型',
      ollamaInfo:
        '<strong>Ollama</strong> 在本地运行。<br>默认主机：<code>{host}</code><br>生成前请确认 Ollama 已启动。',
      googleInfo:
        '请到 <strong>Google AI Studio</strong> 获取 API Key：<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        '请到 <strong>OpenAI Platform</strong> 获取 API Key：<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        '请到 <strong>Anthropic Console</strong> 获取 API Key：<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        '限制每次生成的 Agent 工具调用次数。输入 0 或留空表示无限制。',
      customProviderInfo:
        '自定义提供商必须<strong>兼容 OpenAI</strong>。<br>API Base URL 需指向支持 OpenAI Chat Completions API 的服务。',
    },
    options: {
      agentic: 'Agentic 生成',
      directDiff: '直接 Diff 生成',
    },
  },
  progressMessages: {
    analyzingChanges: 'Agent 正在分析更改...',
    generatingMessage: '正在生成 commit message...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `发生暂时性 API 错误。将在 ${String(seconds)} 秒后重试 (${String(attempt)}/${String(maxAttempts)})...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `正在下载 ${model}：${status} (${String(percent)}%)`
        : `正在下载 ${model}：${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[步骤 ${String(step)}] 分析 diff：${path}`,
    stepReadingFile: (step, path) => `[步骤 ${String(step)}] 读取文件：${path}`,
    stepGettingOutline: (step, path) =>
      `[步骤 ${String(step)}] 获取结构：${path}`,
    stepFindingReferences: (step, target) =>
      `[步骤 ${String(step)}] 查找引用：${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[步骤 ${String(step)}] 获取近期 commits：${String(count)} 笔`
        : `[步骤 ${String(step)}] 获取近期 commits...`,
    stepSearchingProject: (step, keyword) =>
      `[步骤 ${String(step)}] 在项目中搜索：${keyword}`,
    stepCalling: (step, toolName) =>
      `[步骤 ${String(step)}] 调用 ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[步骤 ${String(step)}] 分析多个 diff：${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[步骤 ${String(step)}] 分析 ${String(count)} 个文件的 diff...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[步骤 ${String(step)}] 读取多个文件：${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[步骤 ${String(step)}] 读取 ${String(count)} 个文件...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[步骤 ${String(step)}] 获取多个文件结构：${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[步骤 ${String(step)}] 获取 ${String(count)} 个文件结构...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[步骤 ${String(step)}] 查找多个引用：${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[步骤 ${String(step)}] 查找 ${String(count)} 个符号的引用...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[步骤 ${String(step)}] 在项目中搜索：${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[步骤 ${String(step)}] 在项目中搜索 ${String(count)} 个关键字...`,
    stepExecutingMultipleTools: (step, count) =>
      `[步骤 ${String(step)}] 执行 ${String(count)} 个调查工具...`,
  },
};
