import { EXIT_CODES } from '../../shared/errors';
import type { LocaleTextBundle } from '../types';

export const viLocale: LocaleTextBundle = {
  commitCopilotErrorMessages: {
    'api.keyMissing': () =>
      'API Key chưa được cấu hình. Vui lòng thiết lập API Key của bạn trong bảng điều khiển Commit-Copilot.',
    'api.keyInvalid': (args) =>
      args.details?.trim()
        ? 'API Key không hợp lệ: {details}'.replace('{details}', args.details)
        : 'API Key không hợp lệ.',
    'api.quotaExceeded': (args) =>
      args.details?.trim()
        ? 'Hạn mức API đã vượt quá: {details}'.replace(
            '{details}',
            args.details,
          )
        : 'Hạn mức API đã vượt quá.',
    'api.requestFailed': (args) =>
      args.details?.trim()
        ? 'Yêu cầu API thất bại: {details}'.replace('{details}', args.details)
        : 'Yêu cầu API thất bại.',
    'api.ollamaConnectionFailed': (args) =>
      'Không thể kết nối đến Ollama. Hãy đảm bảo Ollama đang chạy tại {host}.'.replace(
        '{host}',
        args.host ?? '',
      ),
    'api.ollamaModelNotFound': (args) =>
      'Không tìm thấy mô hình "{model}". Vui lòng tải về trước bằng: ollama pull {model}'.replace(
        /\{model\}/g,
        args.model ?? '',
      ),
    'api.unknownAnthropicModel': (args) =>
      'Không xác định được mô hình Anthropic "{model}". Hãy thêm vào ANTHROPIC_MODELS kèm theo max_tokens.'.replace(
        '{model}',
        args.model ?? '',
      ),
    'api.emptyResponse': (args) =>
      'Phản hồi trống từ {provider}.'.replace(
        '{provider}',
        args.provider ?? '',
      ),
    'api.emptyTextResponse': (args) =>
      'Phản hồi văn bản trống từ {provider}.'.replace(
        '{provider}',
        args.provider ?? '',
      ),
    'api.emptyFinalResponse': (args) =>
      'Phản hồi cuối cùng trống từ {provider}.'.replace(
        '{provider}',
        args.provider ?? '',
      ),
    'api.responseTruncated': (args) =>
      'Phản hồi từ {provider} đã bị cắt bớt ({stopReason}).'
        .replace('{provider}', args.provider ?? '')
        .replace('{stopReason}', args.stopReason ?? ''),
    'api.finalResponseTruncated': (args) =>
      'Phản hồi cuối cùng từ {provider} đã bị cắt bớt ({stopReason}).'
        .replace('{provider}', args.provider ?? '')
        .replace('{stopReason}', args.stopReason ?? ''),
    'git.stageFailed': (args) =>
      args.details?.trim()
        ? 'Không thể chuẩn bị (stage) các thay đổi: {details}'.replace(
            '{details}',
            args.details,
          )
        : 'Không thể chuẩn bị (stage) các thay đổi.',
    'generation.noChanges': () =>
      'Không phát hiện thay đổi nào để tạo thông điệp commit.',
    'generation.noChangesButUntracked': () =>
      'Không có thay đổi nào để commit, nhưng phát hiện các tệp tin chưa được theo dõi.',
    'generation.noTrackedChangesButUntracked': () =>
      'Không phát hiện thay đổi nào được theo dõi, chỉ có các tệp tin chưa được theo dõi.',
    'generation.mixedChanges': () =>
      'Phát hiện cả thay đổi đã chuẩn bị (staged) và chưa chuẩn bị.',
    'generation.cancelled': () => 'Người dùng đã hủy quá trình tạo.',
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
      callingGenerateCommitMessage: 'Đang gọi generateCommitMessage...',
      repositoryPath: (path) => `Đường dẫn kho lưu trữ: ${path}`,
      usingModel: (model) => `Sử dụng mô hình: ${model}`,
      generatedMessage: (message) => `Thông báo đã tạo: ${message}`,
      generationError: (errorCode, message) => `Lỗi: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Lỗi không mong muốn: ${message}`,
      openingSettings: 'Đang mở cài đặt...',
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
      failedPrefix: 'Commit-Copilot thất bại',
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
      addModel: 'Thêm mô hình tùy chỉnh',
      about: 'Giới thiệu',
      updateInfo: 'Thông tin cập nhật',
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
      includeGitmoji: 'Bao gồm Gitmoji',
      language: 'Ngôn ngữ Tiện ích',
      commitMessageLanguage: 'Ngôn ngữ thông điệp commit',
      hybridGeneration: 'Tạo kết hợp',
      useScmInputAsDraft: 'Dùng nội dung SCM làm bản nháp',
      maxAgentSteps: 'Số bước Agent tối đa',
      providerName: 'Tên Nhà cung cấp',
      apiFormat: 'Định dạng API',
      apiBaseUrl: 'API Base URL',
      maxOutputTokens: 'Token đầu ra tối đa',
      commitMessage: 'Thông báo commit',
      modelName: 'Tên mô hình',
      version: 'Phiên bản',
      author: 'Tác giả',
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
      enterModelName: 'Nhập tên mô hình',
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
      addModel: 'Quản lý mô hình...',
      deleteModel: 'Xóa mô hình',
      cancel: 'Hủy',
      showUpdateNotes: 'Hiển thị nhật ký cập nhật',
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
      commitMessageLanguageSaved: 'Đã cập nhật ngôn ngữ thông điệp commit.',
      providerNameConflict: 'Đã có nhà cung cấp nào có tên này.',
      providerNameRequired: 'Tên nhà cung cấp là bắt buộc.',
      baseUrlRequired: 'API Base URL là bắt buộc.',
      apiKeyRequired: 'API Key là bắt buộc.',
      providerSaved: 'Đã lưu nhà cung cấp tùy chỉnh!',
      providerDeleted: 'Đã xóa nhà cung cấp tùy chỉnh.',
      modelNameRequired: 'Vui lòng nhập tên mô hình trước khi tạo.',
      modelAdded: 'Đã thêm mô hình tùy chỉnh.',
      modelDeleted: 'Đã xóa mô hình tùy chỉnh.',
      modelNameConflict: 'Mô hình này đã tồn tại trong danh sách.',
      fetchingModels: 'Đang tải các mô hình từ điểm cuối...',
      fetchModelsFailed:
        'Không thể tải các mô hình từ điểm cuối. Bạn có thể thêm mô hình thủ công.',
    },
    descriptions: {
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
      hybridGenerationDescription:
        'Khi bật, nội dung hiện có trong ô SCM chỉ được dùng làm bản nháp tham khảo; các chỉ dẫn bên trong sẽ không được làm theo.',
      customProviderInfo:
        'Nhà cung cấp tùy chỉnh hỗ trợ định dạng API tương thích với <strong>OpenAI</strong> và <strong>Anthropic</strong>.<br>Chọn định dạng được triển khai bởi URL Cơ sở API.',
      maxOutputTokensDescription:
        'Giá trị max_tokens được gửi với mỗi yêu cầu Anthropic. Sử dụng giới hạn được hỗ trợ bởi nhà cung cấp và mô hình. Thông thường đây là bắt buộc; việc bỏ qua nó có thể gây ra lỗi API.',
    },
    options: {
      agentic: 'Tạo Agentic',
      directDiff: 'Direct Diff',
      openaiCompatible: 'OpenAI-compatible',
      anthropicCompatible: 'Anthropic-compatible',
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
    stepWritingCommitMessage: (step) =>
      `[Bước ${String(step)}] Đang viết tin nhắn commit...`,

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
