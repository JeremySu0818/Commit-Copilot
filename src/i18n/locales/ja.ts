import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const jaLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Git リポジトリではありません',
      action: 'Git リポジトリが含まれるフォルダを開いてください。',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: '変更のステージングに失敗しました',
      action: 'Git が正しく設定されているか確認してください。',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'コミットする変更がありません',
      action: 'まずはファイルに変更を加えてください。',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'ステージされた変更がありません',
      action:
        '追跡されていないファイルが見つかりました。コミットメッセージを生成する前にステージしてください。',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: '追跡されていないファイルのみが見つかりました',
      action:
        '新規作成されたファイルはありますが、追跡されている変更はありません。コミットを生成するにはステージしてください。',
    },
    [EXIT_CODES.CANCELLED]: {
      title: '生成がキャンセルされました',
      action: '生成はユーザーによりキャンセルされました。',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: '混在した変更が見つかりました',
      action:
        'ステージされた変更とされていない変更の両方があります。続行方法を選択してください。',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API キーが設定されていません',
      action: 'Commit-Copilot パネルから API キーを設定してください。',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: '無効な API キー',
      action:
        'API キーが無効または取り消されています。確認して更新してください。',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'API クォータを超過しました',
      action:
        'API の利用枠を超えました。プロバイダのアカウントを確認してください。',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'API リクエストに失敗しました',
      action: 'API との通信中にエラーが発生しました。もう一度お試しください。',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: '変更のコミットに失敗しました',
      action: 'Git の競合や問題がないか確認してください。',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: '予期せぬエラーが発生しました',
      action: '詳細は "Commit-Copilot Debug" の出力を確認してください。',
    },
  },
  extensionText: {
    output: {
      generationIgnored: '生成リクエストを無視しました：既に生成が進行中です。',
      generationStart: (timestamp) =>
        `[${timestamp}] Commit-Copilot の生成を開始します...`,
      gitExtensionMissing: 'エラー: Git 拡張機能が見つかりません。',
      selectedRepoFromScm: (path) =>
        `SCM コンテキストからリポジトリを選択しました: ${path}`,
      selectedRepoFromEditor: (path) =>
        `アクティブなエディターからリポジトリを選択しました: ${path}`,
      noRepoMatchedActiveEditor:
        'アクティブなエディターに一致するリポジトリがありません。',
      noActiveEditorForRepoSelection:
        'リポジトリ選択用のアクティブエディタが見つかりません。',
      selectedOnlyRepo: (path) => `唯一のリポジトリを選択しました: ${path}`,
      multiRepoNotDetermined: (count) =>
        `${String(count)} 個のリポジトリが見つかりましたが、アクティブなものを決定できませんでした。`,
      noRepoInApi: 'API にリポジトリが見つかりません。',
      usingProvider: (providerName) => `使用するプロバイダー: ${providerName}`,
      usingGenerateMode: (mode) => `生成モード: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `コミット出力オプション: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `警告: ${provider} の API キーが見つかりません。`,
      cancelRequestedFromProgress: '進行状況UIからキャンセルが要求されました。',
      rewriteStart: (timestamp) =>
        `[${timestamp}] commit-copilot の rewrite 生成を開始しています...`,
      rewriteCancelRequestedFromProgress:
        '進行状況 UI からキャンセルが要求されました。',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `コミットを書き換えました: ${originalHash} -> ${replacementHash}`,
      callingGenerateCommitMessage:
        'generateCommitMessage を呼び出しています...',
      repositoryPath: (path) => `リポジトリパス: ${path}`,
      usingModel: (model) => `使用するモデル: ${model}`,
      generatedMessage: (message) => `生成されたメッセージ: ${message}`,
      generationError: (errorCode, message) =>
        `エラー: ${errorCode} - ${message}`,
      unexpectedError: (message) => `予期せぬエラー: ${message}`,
      openingLanguageSettings:
        'アクティビティビューで言語設定を開いています...',
    },
    notification: {
      gitExtensionMissing:
        'Git 拡張機能が見つかりません。Git がインストールされており、Git 拡張機能が有効になっていることを確認してください。',
      multiRepoWarning:
        '複数の Git リポジトリが見つかりました。対象リポジトリのファイルにフォーカスするか、SCM ビューから実行してください。',
      repoNotFound:
        'Git リポジトリが見つかりません。Git リポジトリが含まれるフォルダを開いてください。',
      apiKeyMissing: (providerName) =>
        `${providerName} API キーが設定されていません。まず Commit-Copilot パネルから API キーを設定してください。`,
      configureApiKeyAction: 'API キーを設定',
      mixedChangesQuestion:
        'ステージされた変更とされていない変更の両方があります。どのように処理しますか？',
      stageAllAndGenerate: 'すべてステージして生成',
      proceedStagedOnly: 'ステージされたもののみで続行',
      cancel: 'キャンセル',
      noStagedButUntrackedQuestion:
        'ステージされた変更がありません。追跡されていないファイルが見つかりました。すべてのファイル (未追跡を含む) をステージしますか、それとも追跡されている変更済みファイルのみで生成しますか？',
      stageAndGenerateAll: 'すべてステージして生成',
      generateTrackedOnly: '追跡済みのみ生成',
      onlyUntrackedQuestion:
        '追跡されていないファイルのみが存在し、追跡されている変更はありません。これらの新規ファイルをステージして追跡し、コミットを生成しますか？',
      stageAndTrack: 'ステージ＆追跡',
      commitGenerated: 'コミットメッセージを生成しました！',
      viewProviderConsoleAction: 'プロバイダコンソールを表示',
      noChanges: 'コミットする変更がありません。まずは変更を加えてください！',
      generationCanceled: 'コミットメッセージの生成がキャンセルされました。',
      failedPrefix: 'Commit-Copilot 失敗',
      rewriteNoNonMergeCommits:
        '現在のブランチ履歴に非マージコミットが見つかりません。',
      rewriteCommitNoSubject: '(件名なし)',
      rewriteCommitRootDescription: 'ルートコミット',
      rewriteCommitMergeDescription: 'マージコミット',
      rewriteCommitParentDescription: (parentHash) => `親 ${parentHash}`,
      rewriteCommitSelectTitle: '書き換えるコミットを選択',
      rewriteCommitSelectPlaceholder: '現在のブランチ履歴からコミットを選択',
      rewriteWorkspaceDirtyBoth:
        'staged (未コミット) と modified (unstaged) の変更があるため、コミット履歴を書き換えられません。先に commit または stash してください。',
      rewriteWorkspaceDirtyStaged:
        'staged (未コミット) の変更があるため、コミット履歴を書き換えられません。先に commit または stash してください。',
      rewriteWorkspaceDirtyUnstaged:
        'modified (unstaged) の変更があるため、コミット履歴を書き換えられません。先に commit または stash してください。',
      rewriteProgressTitle: (providerName) => `Rewrite (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `コミット ${shortHash} を分析しています...`,
      commitMessageCannotBeEmpty: 'コミットメッセージは空にできません。',
      rewriteApplyingTitle: (shortHash) => `${shortHash} を書き換え中`,
      rewriteApplyingProgress: 'コミット履歴を書き換えています...',
      rewriteFailedHistory: 'コミット履歴の書き換えに失敗しました。',
      rewriteCommitMessageRewritten: (shortHash) =>
        `コミット ${shortHash} のメッセージを書き換えました。`,
      rewriteDetachedHeadPushUnavailable:
        'コミット履歴は書き換えられましたが、detached HEAD 状態では force push with lease を使用できません。',
      rewriteForcePushPrompt: (target) =>
        `履歴を書き換えました。${target} に force push with lease しますか?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease が完了しました: ${target}。`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease に失敗しました: ${message}`,
      pushingWithLease: 'Lease 付きで push 中',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: '無効な API キー',
    quotaExceededPrefix: 'API クォータ超過',
    apiRequestFailedPrefix: 'API リクエスト失敗',
    connectionErrorPrefix: '接続エラー',
    unknownProvider: '不明なプロバイダー',
    cannotConnectOllamaAt: (host) => `Ollama に接続できません (${host})`,
    cannotConnectOllama: (message) =>
      `Ollama に接続できません: ${message}。Ollama が実行中か確認してください。`,
    apiKeyCannotBeEmpty: 'API キーは空にできません',
    validationFailedPrefix: '検証に失敗しました',
    unableToConnectFallback: '接続できません',
    saveConfigSuccess: (providerName) =>
      `${providerName} 構成が正常に保存されました！`,
    saveConfigFailed: '設定の保存に失敗しました',
    languageSaved: (label) => `言語を更新しました: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API プロバイダー',
      configuration: 'API 構成',
      ollamaConfiguration: 'Ollama 構成',
      model: 'モデル',
      generateConfiguration: '生成構成',
      settings: '設定',
      addProvider: 'カスタムプロバイダーを追加',
      editProvider: 'カスタムプロバイダーを編集',
      rewriteEditor: '書き換え',
    },
    labels: {
      provider: 'プロバイダー',
      apiKey: 'API キー',
      ollamaHostUrl: 'Ollama ホスト URL',
      model: 'モデル',
      mode: 'モード',
      conventionalCommitSections: 'Conventional Commit セクション',
      includeScope: 'スコープを含める',
      includeBody: '本文を含める',
      includeFooter: 'フッターを含める',
      language: '拡張機能の言語',
      maxAgentSteps: '最大エージェントステップ数',
      providerName: 'プロバイダー名',
      apiBaseUrl: 'API ベース URL',
      commitMessage: 'コミットメッセージ',
      selectedCommitMessage: '選択したコミットメッセージ',
    },
    placeholders: {
      selectProvider: 'プロバイダーを選択...',
      selectModel: 'モデルを選択...',
      selectGenerateMode: '生成モードを選択...',
      enterApiKey: 'API キーを入力',
      enterGeminiApiKey: 'Gemini API キーを入力',
      enterOpenAIApiKey: 'OpenAI API キーを入力',
      enterAnthropicApiKey: 'Anthropic API キーを入力',
      enterCustomApiKey: 'API キーを入力',
    },
    buttons: {
      save: '保存',
      validating: '検証中...',
      generateCommitMessage: 'コミットメッセージを生成',
      cancelGenerating: '生成をキャンセル',
      back: '戻る',
      editProvider: 'プロバイダーを編集',
      addProvider: '+ プロバイダーを追加...',
      deleteProvider: 'プロバイダーを削除',
      rewriteCommitMessage: 'コミットメッセージを書き換え',
      confirmRewrite: '書き換えを確定',
      cancel: 'キャンセル',
    },
    statuses: {
      checkingStatus: '状態を確認中...',
      configured: '設定完了',
      notConfigured: '未設定',
      validating: '検証中...',
      loadingConfiguration: '設定を読み込み中...',
      noChangesDetected: '変更が検出されませんでした',
      cancelCurrentGeneration: '現在の生成をキャンセル',
      languageSaved: '言語を更新しました。',
      providerNameConflict: 'この名前のプロバイダーは既に存在します。',
      providerNameRequired: 'プロバイダー名が必要です。',
      baseUrlRequired: 'API ベース URL が必要です。',
      apiKeyRequired: 'API キーが必要です。',
      providerSaved: 'カスタムプロバイダーを保存しました！',
      providerDeleted: 'カスタムプロバイダーを削除しました。',
      modelNameRequired: '生成する前にモデル名を入力してください。',
      commitMessageCannotBeEmpty: 'コミットメッセージは空にできません。',
      pushingWithLease: 'Lease 付きで push 中...',
      forcePushWithLeaseCompleted: 'Force push with lease が完了しました。',
      forcePushWithLeaseFailed: 'Force push with lease に失敗しました。',
    },
    descriptions: {
      ollamaFixedToDirectDiff:
        'Ollamaは「Direct Diff」モードに固定されています',
      agenticModeDescription:
        'Agentic モードでは、リポジトリツールを使用して詳細な分析を行います',
      directDiffDescription: 'Direct Diff は差分を直接モデルに送信します',
      ollamaInfo:
        '<strong>Ollama</strong> はローカルマシンで動作します。<br>デフォルトホスト: <code>{host}</code><br>生成前に Ollama が起動していることを確認してください。',
      googleInfo:
        '<strong>Google AI Studio</strong> から API キーを取得してください:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        '<strong>OpenAI Platform</strong> から API キーを取得してください:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        '<strong>Anthropic Console</strong> から API キーを取得してください:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        '各生成のエージェントツール呼び出し回数を制限します。無制限にするには0を入力するか空白にしてください。',
      customProviderInfo:
        'カスタムプロバイダーは <strong>OpenAI 互換</strong> である必要があります。<br>API ベース URL は OpenAI Chat Completions API に準拠したサービスを指す必要があります。',
      rewriteEditorDescription:
        '新しいコミットメッセージを確認して確定します。',
    },
    options: {
      agentic: 'Agentic 生成',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'エージェントが変更を分析中...',
    generatingMessage: 'コミットメッセージを生成中...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `一時的な API エラー。再試行中 (${String(attempt)}/${String(maxAttempts)}) ${String(seconds)}秒後...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `${model} を取得中：${status} (${String(percent)}%)`
        : `${model} を取得中：${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[ステップ ${String(step)}] 差分を分析中：${path}`,
    stepReadingFile: (step, path) =>
      `[ステップ ${String(step)}] ファイルを読み込み中：${path}`,
    stepGettingOutline: (step, path) =>
      `[ステップ ${String(step)}] アウトラインを取得中：${path}`,
    stepFindingReferences: (step, target) =>
      `[ステップ ${String(step)}] 参照を検索中：${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[ステップ ${String(step)}] 最近のコミットを取得中：${String(count)} 件`
        : `[ステップ ${String(step)}] 最近のコミットを取得中...`,
    stepSearchingProject: (step, keyword) =>
      `[ステップ ${String(step)}] プロジェクトを検索中：${keyword}`,
    stepCalling: (step, toolName) =>
      `[ステップ ${String(step)}] ${toolName} を呼び出し中...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[ステップ ${String(step)}] 差分を分析中：${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[ステップ ${String(step)}] ${String(count)} ファイルの差分を分析中...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[ステップ ${String(step)}] ファイルを読み込み中：${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[ステップ ${String(step)}] ${String(count)} ファイルを読み込み中...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[ステップ ${String(step)}] アウトラインを取得中：${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[ステップ ${String(step)}] ${String(count)} ファイルのアウトラインを取得中...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[ステップ ${String(step)}] 参照を検索中：${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[ステップ ${String(step)}] ${String(count)} 個のシンボルの参照を検索中...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[ステップ ${String(step)}] プロジェクトを検索中：${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[ステップ ${String(step)}] ${String(count)} 個のキーワードでプロジェクトを検索中...`,
    stepExecutingMultipleTools: (step, count) =>
      `[ステップ ${String(step)}] ${String(count)} 個の調査ツールを実行中...`,
  },
};
