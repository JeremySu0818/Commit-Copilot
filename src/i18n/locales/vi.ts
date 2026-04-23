import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const viLocale: LocaleTextBundle = {
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
    'rewrite.commitHashRequired': () => 'Cần có hash của commit.',
    'rewrite.commitNotFound': (args) =>
      'Không tìm thấy commit "{commitHash}".'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'Commit "{commitHash}" là merge commit và workflow này không thể viết lại.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Không thể viết lại commit khi đang ở detached HEAD.',
    'rewrite.commitNotReachable': (args) =>
      'Commit "{commitHash}" không phải ancestor của HEAD.'.replace(
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
      title: 'Không phải là kho lưu trữ Git',
      action: 'Vui lòng mở một thư mục có chứa kho lưu trữ Git.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Không thể stage các thay đổi',
      action: 'Kiểm tra xem Git đã được cấu hình đúng chưa.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Không có thay đổi nào để commit',
      action: 'Vui lòng thực hiện một số thay đổi trong tệp của bạn trước.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Không phát hiện thấy thay đổi nào đã được stage',
      action:
        'Tìm thấy các tệp chưa được theo dõi (untracked). Vui lòng stage chúng để tạo thông báo commit.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Chỉ tìm thấy các tệp chưa được theo dõi',
      action:
        'Bạn có các tệp mới tạo nhưng không có sửa đổi nào được theo dõi. Vui lòng stage chúng để tạo commit.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Đã hủy tạo',
      action: 'Quá trình tạo đã bị hủy bởi người dùng.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Phát hiện các thay đổi hỗn hợp',
      action:
        'Bạn có cả những thay đổi đã stage và chưa stage. Vui lòng chọn cách tiếp tục.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'Chưa cấu hình API Key',
      action:
        'Vui lòng thiết lập API Key của bạn trong bảng điều khiển Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'API Key không hợp lệ',
      action:
        'API Key của bạn không hợp lệ hoặc đã bị thu hồi. Vui lòng kiểm tra và cập nhật nó.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'Vượt quá hạn ngạch API',
      action:
        'Bạn đã vượt quá hạn ngạch API của mình. Vui lòng kiểm tra tài khoản nhà cung cấp của bạn.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'Yêu cầu API thất bại',
      action: 'Đã xảy ra lỗi khi giao tiếp với API. Vui lòng thử lại.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Không thể commit các thay đổi',
      action: 'Kiểm tra xem có bất kỳ xung đột hoặc vấn đề Git nào không.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Đã xảy ra lỗi không xác định',
      action: 'Kiểm tra đầu ra "Commit-Copilot Debug" để biết thêm chi tiết.',
    },
  },
  extensionText: {
    output: {
      generationIgnored: 'Đã bỏ qua yêu cầu tạo: quá trình tạo đang diễn ra.',
      generationStart: (timestamp) =>
        `[${timestamp}] Bắt đầu tạo bằng commit-copilot...`,
      gitExtensionMissing: 'Lỗi: Không tìm thấy tiện ích mở rộng Git.',
      selectedRepoFromScm: (path) =>
        `Đã chọn kho lưu trữ từ ngữ cảnh SCM: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Đã chọn kho lưu trữ từ trình chỉnh sửa đang hoạt động: ${path}`,
      noRepoMatchedActiveEditor:
        'Không có kho lưu trữ nào khớp với trình chỉnh sửa đang hoạt động.',
      noActiveEditorForRepoSelection:
        'Không tìm thấy trình chỉnh sửa đang hoạt động để chọn kho lưu trữ.',
      selectedOnlyRepo: (path) => `Đã chọn kho lưu trữ duy nhất: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Tìm thấy ${String(count)} kho lưu trữ nhưng không thể xác định kho lưu trữ đang hoạt động.`,
      noRepoInApi: 'Không tìm thấy kho lưu trữ nào trong API.',
      usingProvider: (providerName) => `Sử dụng nhà cung cấp: ${providerName}`,
      usingGenerateMode: (mode) => `Chế độ tạo: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Tùy chọn đầu ra commit: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Cảnh báo: Không tìm thấy API Key cho ${provider}.`,
      cancelRequestedFromProgress: 'Đã yêu cầu hủy từ giao diện tiến trình.',
      rewriteStart: (timestamp) =>
        `[${timestamp}] Bắt đầu tạo rewrite commit-copilot...`,
      rewriteCancelRequestedFromProgress:
        'Đã yêu cầu hủy từ giao diện tiến trình.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit đã được viết lại: ${originalHash} -> ${replacementHash}`,
      rewriteReplacementCommitFallback: 'updated',
      callingGenerateCommitMessage: 'Đang gọi generateCommitMessage...',
      repositoryPath: (path) => `Đường dẫn kho lưu trữ: ${path}`,
      usingModel: (model) => `Sử dụng mô hình: ${model}`,
      generatedMessage: (message) => `Thông báo đã tạo: ${message}`,
      generationError: (errorCode, message) => `Lỗi: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Lỗi không mong muốn: ${message}`,
      openingLanguageSettings:
        'Mở cài đặt ngôn ngữ trong chế độ xem hoạt động...',
      rewriteLeaseProtectionBlocked:
        'Push bị chặn bởi cơ chế lease (remote đã thay đổi).',
      rewriteSuggestedRecoverySteps: 'Các bước khôi phục được đề xuất:',
      rewriteAutoSyncBeforeRetryFailed: (message) =>
        `Tự động đồng bộ trước khi thử lại đã thất bại: ${message}`,
      rewriteResolveConflictsContinueRebase:
        'Nếu có xung đột khi rebase, hãy xử lý trước rồi tiếp tục rebase.',
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
        'Không tìm thấy tiện ích mở rộng Git. Vui lòng đảm bảo Git đã được cài đặt và tiện ích mở rộng Git được bật.',
      multiRepoWarning:
        'Tìm thấy nhiều kho lưu trữ Git. Vui lòng tập trung vào một tệp trong kho lưu trữ mục tiêu hoặc chạy từ chế độ xem SCM.',
      repoNotFound:
        'Không tìm thấy kho lưu trữ Git. Vui lòng mở một thư mục có chứa kho lưu trữ Git.',
      apiKeyMissing: (providerName) =>
        `Chưa cấu hình API Key của ${providerName}. Vui lòng thiết lập API Key của bạn trong bảng điều khiển Commit-Copilot trước.`,
      configureApiKeyAction: 'Cấu hình API Key',
      mixedChangesQuestion:
        'Bạn có cả những thay đổi đã stage và chưa stage. Bạn muốn tiếp tục như thế nào?',
      stageAllAndGenerate: 'Stage tất cả & Tạo',
      proceedStagedOnly: 'Chỉ tiếp tục với tệp đã Stage',
      cancel: 'Hủy',
      noStagedButUntrackedQuestion:
        'Không có thay đổi đã stage. Tìm thấy các tệp chưa được theo dõi. Bạn có muốn stage tất cả các tệp (bao gồm cả tệp chưa theo dõi) hay chỉ tạo cho các tệp đã sửa đổi được theo dõi?',
      stageAndGenerateAll: 'Stage & Tạo tất cả',
      generateTrackedOnly: 'Chỉ tạo cho tệp được theo dõi',
      onlyUntrackedQuestion:
        'Chỉ có các tệp chưa được theo dõi mà không có sửa đổi được theo dõi nào. Bạn có muốn stage và theo dõi các tệp mới này để tạo commit không?',
      stageAndTrack: 'Stage & Theo dõi',
      commitGenerated: 'Đã tạo thông báo commit!',
      viewProviderConsoleAction: 'Xem Bảng điều khiển Nhà cung cấp',
      noChanges:
        'Không có thay đổi nào để commit. Hãy thực hiện một số thay đổi trước!',
      generationCanceled: 'Đã hủy tạo thông báo commit.',
      rewriteCanceled: 'Đã hủy viết lại thông báo commit.',
      failedPrefix: 'Commit-Copilot thất bại',
      rewriteNoNonMergeCommits:
        'Không tìm thấy commit không phải merge trong lịch sử nhánh hiện tại.',
      rewriteCommitNoSubject: '(không có chủ đề)',
      rewriteCommitRootDescription: 'commit gốc',
      rewriteCommitMergeDescription: 'commit merge',
      rewriteCommitParentDescription: (parentHash) => `parent ${parentHash}`,
      rewriteCommitSelectTitle: 'Chọn commit để viết lại',
      rewriteCommitSelectPlaceholder:
        'Chọn một commit từ lịch sử nhánh hiện tại',
      rewriteWorkspaceDirtyBoth:
        'Không thể viết lại lịch sử commit khi đang có thay đổi staged (chưa commit) và modified (unstaged). Vui lòng commit hoặc stash trước.',
      rewriteWorkspaceDirtyStaged:
        'Không thể viết lại lịch sử commit khi đang có thay đổi staged (chưa commit). Vui lòng commit hoặc stash trước.',
      rewriteWorkspaceDirtyUnstaged:
        'Không thể viết lại lịch sử commit khi đang có thay đổi modified (unstaged). Vui lòng commit hoặc stash trước.',
      rewriteProgressTitle: (providerName) => `Rewrite (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `Đang phân tích commit ${shortHash}...`,
      commitMessageCannotBeEmpty: 'Thông báo commit không được để trống.',
      rewriteApplyingTitle: (shortHash) => `Đang viết lại ${shortHash}`,
      rewriteApplyingProgress: 'Đang viết lại lịch sử commit...',
      rewriteFailedHistory: 'Không thể viết lại lịch sử commit.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Thông báo commit ${shortHash} đã được viết lại.`,
      rewriteDetachedHeadPushUnavailable:
        'Lịch sử commit đã được viết lại, nhưng force push with lease không khả dụng trong trạng thái detached HEAD.',
      rewriteForcePushPrompt: (target) =>
        `Lịch sử đã được viết lại. Force push with lease tới ${target}?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease hoàn tất: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease thất bại: ${message}`,
      pushingWithLease: 'Đang push with lease',
      rewriteAutoSyncRetryAction: 'Tự động đồng bộ và push bắt buộc',
      rewriteAutoSyncRetryTitle: 'Đang tự động đồng bộ với upstream',
      rewriteAutoSyncPromptWithUpstream: (upstreamRef) =>
        `Remote ${upstreamRef} đã thay đổi. Chạy tự động đồng bộ (fetch + rebase ${upstreamRef}) và push bắt buộc với lease? Bản xem trước sẽ được ghi vào bảng đầu ra.`,
      rewriteAutoSyncFailed: (message) =>
        `Tự động đồng bộ thất bại: ${message}. Hãy xử lý xung đột (nếu có), hoàn tất rebase rồi thử push lại.`,
    },
  },
  mainViewText: {
    invalidApiKeyPrefix: 'API Key không hợp lệ',
    quotaExceededPrefix: 'Vượt quá hạn ngạch API',
    apiRequestFailedPrefix: 'Yêu cầu API thất bại',
    connectionErrorPrefix: 'Lỗi kết nối',
    unknownProvider: 'Nhà cung cấp không xác định',
    cannotConnectOllamaAt: (host) => `Không thể kết nối với Ollama tại ${host}`,
    cannotConnectOllama: (message) =>
      `Không thể kết nối với Ollama: ${message}. Đảm bảo rằng Ollama đang chạy.`,
    apiKeyCannotBeEmpty: 'API Key không được để trống',
    validationFailedPrefix: 'Xác thực thất bại',
    unableToConnectFallback: 'Không thể kết nối',
    saveConfigSuccess: (providerName) =>
      `Đã lưu cấu hình ${providerName} thành công!`,
    saveConfigFailed: 'Không thể lưu cấu hình',
    languageSaved: (label) => `Đã cập nhật ngôn ngữ: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'Nhà cung cấp API',
      configuration: 'Cấu hình API',
      ollamaConfiguration: 'Cấu hình Ollama',
      model: 'Mô hình',
      generateConfiguration: 'Cấu hình Tạo',
      settings: 'Cài đặt',
      addProvider: 'Thêm nhà cung cấp tùy chỉnh',
      editProvider: 'Chỉnh sửa nhà cung cấp tùy chỉnh',
      rewriteEditor: 'Viết lại',
      advancedFeatures: 'Tính năng nâng cao',
    },
    labels: {
      provider: 'Nhà cung cấp',
      apiKey: 'API Key',
      ollamaHostUrl: 'Ollama Host URL',
      model: 'Mô hình',
      mode: 'Chế độ',
      conventionalCommitSections: 'Các phần Conventional Commit',
      includeScope: 'Bao gồm Phạm vi (Scope)',
      includeBody: 'Bao gồm Nội dung (Body)',
      includeFooter: 'Bao gồm Chân trang (Footer)',
      language: 'Ngôn ngữ Tiện ích',
      maxAgentSteps: 'Số bước Agent tối đa',
      providerName: 'Tên Nhà cung cấp',
      apiBaseUrl: 'API Base URL',
      commitMessage: 'Thông báo commit',
      selectedCommitMessage: 'Thông báo commit đã chọn',
    },
    placeholders: {
      selectProvider: 'Chọn một nhà cung cấp...',
      selectModel: 'Chọn một mô hình...',
      selectGenerateMode: 'Chọn chế độ tạo...',
      enterApiKey: 'Nhập API Key của bạn',
      enterGeminiApiKey: 'Nhập Gemini API Key của bạn',
      enterOpenAIApiKey: 'Nhập OpenAI API Key của bạn',
      enterAnthropicApiKey: 'Nhập Anthropic API Key của bạn',
      enterCustomApiKey: 'Nhập API Key của bạn',
    },
    buttons: {
      save: 'Lưu',
      validating: 'Đang xác thực...',
      generateCommitMessage: 'Tạo thông báo Commit',
      cancelGenerating: 'Hủy Tạo',
      back: 'Quay lại',
      editProvider: 'Chỉnh sửa Nhà cung cấp',
      addProvider: '+ Thêm Nhà cung cấp...',
      deleteProvider: 'Xóa Nhà cung cấp',
      openAdvancedFeatures: 'Mở tính năng nâng cao',
      rewriteCommitMessage: 'Viết lại thông báo commit',
      confirmRewrite: 'Xác nhận viết lại',
      cancel: 'Hủy',
    },
    statuses: {
      checkingStatus: 'Đang kiểm tra trạng thái...',
      configured: 'Đã cấu hình',
      notConfigured: 'Chưa cấu hình',
      validating: 'Đang xác thực...',
      loadingConfiguration: 'Đang tải cấu hình...',
      noChangesDetected: 'Không phát hiện thay đổi nào',
      cancelCurrentGeneration: 'Hủy quá trình tạo hiện tại',
      languageSaved: 'Ngôn ngữ đã cập nhật.',
      providerNameConflict: 'Đã có nhà cung cấp nào có tên này.',
      providerNameRequired: 'Tên nhà cung cấp là bắt buộc.',
      baseUrlRequired: 'API Base URL là bắt buộc.',
      apiKeyRequired: 'API Key là bắt buộc.',
      providerSaved: 'Đã lưu nhà cung cấp tùy chỉnh!',
      providerDeleted: 'Đã xóa nhà cung cấp tùy chỉnh.',
      modelNameRequired: 'Vui lòng nhập tên mô hình trước khi tạo.',
      commitMessageCannotBeEmpty: 'Thông báo commit không được để trống.',
      pushingWithLease: 'Đang push with lease...',
      forcePushWithLeaseCompleted: 'Force push with lease hoàn tất.',
      forcePushWithLeaseFailed: 'Force push with lease thất bại.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama được cố định ở chế độ Direct Diff',
      agenticModeDescription:
        'Chế độ Agentic sử dụng các công cụ kho lưu trữ để phân tích sâu hơn',
      directDiffDescription: 'Direct Diff gửi raw diff trực tiếp đến mô hình',
      ollamaInfo:
        '<strong>Ollama</strong> chạy cục bộ trên máy của bạn.<br>Máy chủ mặc định: <code>{host}</code><br>Đảm bảo Ollama đang chạy trước khi tạo.',
      googleInfo:
        'Lấy API key của bạn từ <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Lấy API key của bạn từ <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Lấy API key của bạn từ <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Giới hạn số lần gọi công cụ agent trong mỗi lần tạo. Nhập 0 hoặc để trống để không giới hạn.',
      customProviderInfo:
        'Các nhà cung cấp tùy chỉnh phải <strong>tương thích với OpenAI</strong>.<br>API Base URL phải trỏ đến một dịch vụ có triển khai OpenAI Chat Completions API.',
      advancedFeaturesDescription: 'Mở các công cụ và quy trình nâng cao.',
      rewriteWorkflowDescription:
        'Sau khi chọn một commit không phải merge, hệ thống sẽ tạo lại thông điệp theo chế độ đang dùng (Agentic / Direct Diff), sử dụng Provider, Model và định dạng đầu ra hiện tại (scope/body/footer), rồi mở giao diện xác nhận có thể chỉnh sửa; sau khi gửi, lịch sử sẽ được viết lại bằng rebase, kèm tùy chọn force push with lease.',
      rewriteEditorDescription: 'Xem lại và xác nhận thông báo commit mới.',
    },
    options: {
      agentic: 'Tạo Agentic',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'Agent đang phân tích các thay đổi...',
    generatingMessage: 'Đang tạo thông báo commit...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Lỗi API tạm thời. Thử lại lần (${String(attempt)}/${String(maxAttempts)}) sau ${String(seconds)}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Đang kéo ${model}: ${status} (${String(percent)}%)`
        : `Đang kéo ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Bước ${String(step)}] Phân tích diff: ${path}`,
    stepReadingFile: (step, path) => `[Bước ${String(step)}] Đọc tệp: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Bước ${String(step)}] Lấy phác thảo: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Bước ${String(step)}] Tìm tham chiếu: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Bước ${String(step)}] Đang lấy các commit gần đây: ${String(count)} mục`
        : `[Bước ${String(step)}] Đang lấy các commit gần đây...`,
    stepSearchingProject: (step, keyword) =>
      `[Bước ${String(step)}] Đang tìm kiếm dự án cho: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Bước ${String(step)}] Đang gọi ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Bước ${String(step)}] Phân tích diffs: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Bước ${String(step)}] Phân tích diffs cho ${String(count)} tệp...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Bước ${String(step)}] Đọc tệp: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Bước ${String(step)}] Đọc ${String(count)} tệp...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Bước ${String(step)}] Lấy phác thảo: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Bước ${String(step)}] Lấy phác thảo cho ${String(count)} tệp...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Bước ${String(step)}] Tìm tham chiếu: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Bước ${String(step)}] Tìm tham chiếu cho ${String(count)} biểu tượng...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Bước ${String(step)}] Đang tìm kiếm dự án cho: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Bước ${String(step)}] Đang tìm kiếm dự án cho ${String(count)} từ khóa...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Bước ${String(step)}] Đang thực thi ${String(count)} công cụ điều tra...`,
  },
};
