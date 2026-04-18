import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const koLocale: LocaleTextBundle = {
  commitCopilotErrorMessages: {
    'rewrite.commitHashRequired': () => '커밋 해시가 필요합니다.',
    'rewrite.commitNotFound': (args) =>
      '커밋 "{commitHash}"을 찾을 수 없습니다.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      '커밋 "{commitHash}"은 병합 커밋이므로 이 워크플로에서 다시 작성할 수 없습니다.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'detached HEAD 상태에서는 커밋을 다시 작성할 수 없습니다.',
    'rewrite.commitNotReachable': (args) =>
      '커밋 "{commitHash}"은 HEAD의 조상이 아닙니다.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
  },
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Git 리포지토리가 아닙니다',
      action: 'Git 리포지토리가 포함된 폴더를 여세요.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: '변경 사항 스테이징 실패',
      action: 'Git이 올바르게 설정되어 있는지 확인하세요.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: '커밋할 변경 사항이 없습니다',
      action: '먼저 파일에 변경을 가하세요.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: '스테이징된 변경 사항이 없습니다',
      action:
        '추적되지 않는 파일이 발견되었습니다. 커밋 메시지를 생성하기 전에 스테이징하세요.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: '추적되지 않는 파일만 있습니다',
      action:
        '새 파일은 있지만 추적된 변경 사항이 없습니다. 커밋을 생성하려면 스테이징하세요.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: '생성 취소됨',
      action: '사용자에 의해 생성이 취소되었습니다.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: '혼합된 변경 사항 발견됨',
      action:
        '스테이징된 변경 사항과 스테이징되지 않은 변경 사항이 모두 있습니다. 진행 방법을 선택하세요.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API 키 누락',
      action: 'Commit-Copilot 패널에서 API 키를 구성하세요.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: '잘못된 API 키',
      action:
        'API 키가 유효하지 않거나 해지되었습니다. 확인하고 업데이트하세요.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'API 할당량 초과',
      action: 'API 할당량을 초과했습니다. 프로바이더 계정을 확인하세요.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'API 요청 실패',
      action: 'API 통신 중 오류가 발생했습니다. 다시 시도해 주세요.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: '변경 사항 커밋 실패',
      action: 'Git 충돌이나 문제를 확인하세요.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: '예기치 않은 오류가 발생했습니다',
      action: '자세한 내용은 "Commit-Copilot Debug" 출력을 확인하세요.',
    },
  },
  extensionText: {
    output: {
      generationIgnored: '생성 요청 무시됨: 다른 생성이 이미 진행 중입니다.',
      generationStart: (timestamp) =>
        `[${timestamp}] Commit-Copilot 생성 시작...`,
      gitExtensionMissing: '오류: Git 확장을 찾을 수 없습니다.',
      selectedRepoFromScm: (path) =>
        `SCM 컨텍스트에서 리포지토리 선택됨: ${path}`,
      selectedRepoFromEditor: (path) =>
        `활성 편집기에서 리포지토리 선택됨: ${path}`,
      noRepoMatchedActiveEditor:
        '활성 편집기와 일치하는 리포지토리가 없습니다.',
      noActiveEditorForRepoSelection:
        '리포지토리 선택을 위한 활성 편집기가 없습니다.',
      selectedOnlyRepo: (path) => `유일한 리포지토리 선택됨: ${path}`,
      multiRepoNotDetermined: (count) =>
        `${String(count)}개의 리포지토리가 발견되었지만 활성 리포지토리를 결정할 수 없습니다.`,
      noRepoInApi: 'API에서 리포지토리를 찾을 수 없습니다.',
      usingProvider: (providerName) => `사용 중인 프로바이더: ${providerName}`,
      usingGenerateMode: (mode) => `생성 모드 사용: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `커밋 출력 옵션 사용: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `경고: ${provider}의 API 키가 구성되지 않았습니다.`,
      cancelRequestedFromProgress: '진행 상황 UI에서 취소 요청됨.',
      rewriteStart: (timestamp) =>
        `[${timestamp}] commit-copilot rewrite 생성을 시작합니다...`,
      rewriteCancelRequestedFromProgress: '진행 UI에서 취소가 요청되었습니다.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `커밋이 다시 작성됨: ${originalHash} -> ${replacementHash}`,
      callingGenerateCommitMessage: 'generateCommitMessage 호출 중...',
      repositoryPath: (path) => `리포지토리 경로: ${path}`,
      usingModel: (model) => `사용 중인 모델: ${model}`,
      generatedMessage: (message) => `생성된 메시지: ${message}`,
      generationError: (errorCode, message) =>
        `오류: ${errorCode} - ${message}`,
      unexpectedError: (message) => `예기치 않은 오류: ${message}`,
      openingLanguageSettings: '활동 뷰에서 언어 설정 열기...',
    },
    notification: {
      gitExtensionMissing:
        'Git 확장을 찾을 수 없습니다. Git이 설치되어 있고 확장이 활성화되어 있는지 확인하세요.',
      multiRepoWarning:
        '여러 개의 Git 리포지토리가 발견되었습니다. 작업하려는 리포지토리의 파일에 포커스를 맞추거나 SCM 뷰에서 트리거하세요.',
      repoNotFound:
        'Git 리포지토리를 찾을 수 없습니다. Git 리포지토리가 포함된 폴더를 여세요.',
      apiKeyMissing: (providerName) =>
        `${providerName} API 키가 구성되지 않았습니다. 먼저 Commit-Copilot 측면 패널에서 추가하세요.`,
      configureApiKeyAction: 'API 키 구성',
      mixedChangesQuestion:
        '스테이징된 변경 사항과 스테이징되지 않은 변경 사항이 모두 있습니다. 어떻게 처리하시겠습니까?',
      stageAllAndGenerate: '모두 스테이징 후 생성',
      proceedStagedOnly: '스테이징된 항목만 진행',
      cancel: '취소',
      noStagedButUntrackedQuestion:
        '스테이징된 변경 사항이 없지만 추적되지 않는 파일이 발견되었습니다. 생성하기 전에 모든 파일(추적되지 않는 파일 포함)을 스테이징하거나 추적된 변경 파일에서만 생성하시겠습니까?',
      stageAndGenerateAll: '모두 스테이징 후 생성',
      generateTrackedOnly: '추적된 것만 생성',
      onlyUntrackedQuestion:
        '추적되지 않는 파일만 존재하며 추적된 변경 사항이 없습니다. 이 새 파일들을 스테이징하여 추적하고 커밋을 생성하시겠습니까?',
      stageAndTrack: '스테이징 및 추적',
      commitGenerated: '커밋 메시지가 성공적으로 생성되었습니다!',
      viewProviderConsoleAction: '프로바이더 콘솔 보기',
      noChanges: '커밋할 변경 사항이 없습니다. 먼저 수정해 주세요!',
      generationCanceled: '커밋 메시지 생성이 취소되었습니다.',
      failedPrefix: 'Commit-Copilot 실패',
      rewriteNoNonMergeCommits:
        '현재 브랜치 기록에서 merge가 아닌 커밋을 찾지 못했습니다.',
      rewriteCommitNoSubject: '(제목 없음)',
      rewriteCommitRootDescription: '루트 커밋',
      rewriteCommitMergeDescription: 'merge 커밋',
      rewriteCommitParentDescription: (parentHash) => `부모 ${parentHash}`,
      rewriteCommitSelectTitle: '다시 작성할 커밋 선택',
      rewriteCommitSelectPlaceholder: '현재 브랜치 기록에서 커밋 선택',
      rewriteWorkspaceDirtyBoth:
        'staged(커밋되지 않음) 변경과 modified(unstaged) 변경이 모두 있는 동안에는 커밋 기록을 다시 작성할 수 없습니다. 먼저 commit 또는 stash 하세요.',
      rewriteWorkspaceDirtyStaged:
        'staged(커밋되지 않음) 변경이 있는 동안에는 커밋 기록을 다시 작성할 수 없습니다. 먼저 commit 또는 stash 하세요.',
      rewriteWorkspaceDirtyUnstaged:
        'modified(unstaged) 변경이 있는 동안에는 커밋 기록을 다시 작성할 수 없습니다. 먼저 commit 또는 stash 하세요.',
      rewriteProgressTitle: (providerName) => `다시 작성 (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) => `커밋 ${shortHash} 분석 중...`,
      commitMessageCannotBeEmpty: '커밋 메시지는 비워 둘 수 없습니다.',
      rewriteApplyingTitle: (shortHash) => `${shortHash} 다시 작성 중`,
      rewriteApplyingProgress: '커밋 기록을 다시 작성하는 중...',
      rewriteFailedHistory: '커밋 기록 다시 작성에 실패했습니다.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `커밋 ${shortHash} 메시지가 다시 작성되었습니다.`,
      rewriteDetachedHeadPushUnavailable:
        '커밋 기록은 다시 작성되었지만 detached HEAD 상태에서는 force push with lease를 사용할 수 없습니다.',
      rewriteForcePushPrompt: (target) =>
        `기록이 다시 작성되었습니다. ${target}(으)로 force push with lease 하시겠습니까?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease 완료: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease 실패: ${message}`,
      pushingWithLease: 'Lease와 함께 push 중',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: '잘못된 API 키',
    quotaExceededPrefix: 'API 할당량 초과',
    apiRequestFailedPrefix: 'API 요청 실패',
    connectionErrorPrefix: '연결 오류',
    unknownProvider: '알 수 없는 프로바이더',
    cannotConnectOllamaAt: (host) =>
      `해당 주소의 Ollama에 연결할 수 없습니다 (${host})`,
    cannotConnectOllama: (message) =>
      `Ollama에 연결할 수 없습니다: ${message}. Ollama가 실행 중인지 확인하세요.`,
    apiKeyCannotBeEmpty: 'API 키는 비워둘 수 없습니다',
    validationFailedPrefix: '유효성 검사 실패',
    unableToConnectFallback: '연결할 수 없습니다',
    saveConfigSuccess: (providerName) =>
      `${providerName} 구성이 성공적으로 저장되었습니다!`,
    saveConfigFailed: '구성을 저장하지 못했습니다',
    languageSaved: (label) => `언어가 변경되었습니다: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API 프로바이더',
      configuration: 'API 구성',
      ollamaConfiguration: 'Ollama 구성',
      model: '모델',
      generateConfiguration: '생성 구성',
      settings: '설정',
      addProvider: '사용자 지정 프로바이더 추가',
      editProvider: '사용자 지정 프로바이더 편집',
      rewriteEditor: '다시 작성',
    },
    labels: {
      provider: '프로바이더',
      apiKey: 'API 키',
      ollamaHostUrl: 'Ollama 호스트 URL',
      model: '모델',
      mode: '모드',
      conventionalCommitSections: 'Conventional Commit 섹션',
      includeScope: '스코프 포함',
      includeBody: '본문 포함',
      includeFooter: '푸터 포함',
      language: '확장 언어',
      maxAgentSteps: '최대 에이전트 단계 수',
      providerName: '프로바이더 이름',
      apiBaseUrl: 'API 베이스 URL',
      commitMessage: '커밋 메시지',
      selectedCommitMessage: '선택한 커밋 메시지',
    },
    placeholders: {
      selectProvider: '프로바이더 선택...',
      selectModel: '모델 선택...',
      selectGenerateMode: '생성 모드 선택...',
      enterApiKey: 'API 키 입력',
      enterGeminiApiKey: 'Gemini API 키 입력',
      enterOpenAIApiKey: 'OpenAI API 키 입력',
      enterAnthropicApiKey: 'Anthropic API 키 입력',
      enterCustomApiKey: 'API 키 입력',
    },
    buttons: {
      save: '저장',
      validating: '유효성 검사 중...',
      generateCommitMessage: '커밋 메시지 생성',
      cancelGenerating: '생성 취소',
      back: '뒤로',
      editProvider: '프로바이더 편집',
      addProvider: '+ 프로바이더 추가...',
      deleteProvider: '프로바이더 삭제',
      rewriteCommitMessage: '커밋 메시지 다시 작성',
      confirmRewrite: '다시 작성 확인',
      cancel: '취소',
    },
    statuses: {
      checkingStatus: '상태 확인 중...',
      configured: '구성됨',
      notConfigured: '구성되지 않음',
      validating: '유효성 검사 중...',
      loadingConfiguration: '구성을 로드 중...',
      noChangesDetected: '변경 사항이 감지되지 않았습니다',
      cancelCurrentGeneration: '현재 생성 취소',
      languageSaved: '새 언어 선택이 적용되었습니다.',
      providerNameConflict: '이 이름을 가진 프로바이더가 이미 존재합니다.',
      providerNameRequired: '프로바이더 이름이 필요합니다.',
      baseUrlRequired: 'API 베이스 URL이 필요합니다.',
      apiKeyRequired: 'API 키가 필요합니다.',
      providerSaved: '사용자 지정 프로바이더가 저장되었습니다!',
      providerDeleted: '사용자 지정 프로바이더가 삭제되었습니다.',
      modelNameRequired: '생성하기 전에 모델 이름을 입력하십시오.',
      commitMessageCannotBeEmpty: '커밋 메시지는 비워 둘 수 없습니다.',
      pushingWithLease: 'Lease와 함께 push 중...',
      forcePushWithLeaseCompleted: 'Force push with lease 완료.',
      forcePushWithLeaseFailed: 'Force push with lease 실패.',
    },
    descriptions: {
      ollamaFixedToDirectDiff:
        'Ollama는 "Direct Diff" 모드로 고정되어 있습니다.',
      agenticModeDescription:
        'Agentic 모드는 리포지토리 도구를 사용하여 심층 분석을 수행합니다.',
      directDiffDescription:
        'Direct Diff 모드는 차이점(diff)을 모델에 직접 보냅니다.',
      ollamaInfo:
        '<strong>Ollama</strong> 서버가 로컬에서 실행 중이어야 합니다.<br>기본 호스트: <code>{host}</code><br>생성을 시도하기 전에 Ollama가 켜져 있는지 확인하세요.',
      googleInfo:
        '<strong>Google AI Studio</strong>에서 API 키 가져오기:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        '<strong>OpenAI Platform</strong>에서 API 키 가져오기:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        '<strong>Anthropic Console</strong>에서 API 키 가져오기:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        '각 생성이 허용되는 에이전트 도구 호출 횟수를 제한합니다. 제한 없음을 원하면 0 또는 공백을 입력하세요.',
      customProviderInfo:
        '사용자 지정 프로바이더는 <strong>OpenAI 호환</strong>이어야 합니다.<br>API 베이스 URL은 OpenAI Chat Completions API를 준수하는 서비스를 가리켜야 합니다.',
      rewriteEditorDescription: '새 커밋 메시지를 검토하고 확인합니다.',
    },
    options: {
      agentic: 'Agentic 생성',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: '에이전트 변경 사항 분석 중...',
    generatingMessage: '메시지 생성 중...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `일시적인 API 오류입니다. 재시도 중 (${String(attempt)}/${String(maxAttempts)}) ${String(seconds)}초 후...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `가져오는 중 ${model}: ${status} (${String(percent)}%)`
        : `가져오는 중 ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[단계 ${String(step)}] <code>${path}</code>에 대한 변경 사항 분석 중`,
    stepReadingFile: (step, path) =>
      `[단계 ${String(step)}] <code>${path}</code> 읽는 중`,
    stepGettingOutline: (step, path) =>
      `[단계 ${String(step)}] <code>${path}</code>에 대한 코드 구조 탐색 중`,
    stepFindingReferences: (step, target) =>
      `[단계 ${String(step)}] 코드베이스에서 <code>${target}</code> 검색 중`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[단계 ${String(step)}] 최근 ${String(count)}개의 커밋 내역 가져오는 중`
        : `[단계 ${String(step)}] 최근 커밋 내역 가져오는 중...`,
    stepSearchingProject: (step, keyword) =>
      `[단계 ${String(step)}] 프로젝트에서 <code>${keyword}</code> 검색 중`,
    stepCalling: (step, toolName) =>
      `[단계 ${String(step)}] <code>${toolName}</code> 도구 실행 중...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[단계 ${String(step)}] 여러 파일의 변경 사항 분석 중: <code>${paths}</code>`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[단계 ${String(step)}] ${String(count)}개 파일의 변경 사항 분석 중...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[단계 ${String(step)}] 여러 파일 읽는 중: <code>${paths}</code>`,
    stepReadingFilesForCount: (step, count) =>
      `[단계 ${String(step)}] ${String(count)}개의 파일 읽는 중...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[단계 ${String(step)}] 여러 파일의 코드 구조 탐색 중: <code>${paths}</code>`,
    stepGettingOutlinesForCount: (step, count) =>
      `[단계 ${String(step)}] ${String(count)}개 파일의 구조 정보 가져오는 중...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[단계 ${String(step)}] 여러 참조 검색 중: <code>${targets}</code>`,
    stepFindingReferencesForCount: (step, count) =>
      `[단계 ${String(step)}] ${String(count)}개의 심볼 참조 검색 중...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[단계 ${String(step)}] 프로젝트에서 여러 키워드 검색 중: <code>${keywords}</code>`,
    stepSearchingProjectForCount: (step, count) =>
      `[단계 ${String(step)}] ${String(count)}개의 프로젝트 키워드 검색 중...`,
    stepExecutingMultipleTools: (step, count) =>
      `[단계 ${String(step)}] ${String(count)}개의 탐색 도구 실행 중...`,
  },
};
