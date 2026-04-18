import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const ruLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Не Git-репозиторий',
      action: 'Пожалуйста, откройте папку, содержащую Git-репозиторий.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Не удалось проиндексировать изменения',
      action: 'Проверьте, правильно ли настроен Git.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Нет изменений для коммита',
      action: 'Сначала внесите изменения в ваши файлы.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Проиндексированные изменения не найдены',
      action:
        'Обнаружены неотслеживаемые файлы. Пожалуйста, проиндексируйте их для генерации сообщения коммита.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Найдены только неотслеживаемые файлы',
      action:
        'У вас есть недавно созданные файлы, но нет отслеживаемых изменений. Пожалуйста, проиндексируйте их для генерации коммита.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Генерация отменена',
      action: 'Генерация была отменена пользователем.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Обнаружены смешанные изменения',
      action:
        'У вас есть как проиндексированные, так и непроиндексированные изменения. Пожалуйста, выберите, как продолжить.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API-ключ не настроен',
      action: 'Пожалуйста, установите ваш API-ключ на панели Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Недействительный API-ключ',
      action:
        'Ваш API-ключ недействителен или был отозван. Пожалуйста, проверьте и обновите его.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'Превышена квота API',
      action:
        'Вы превысили вашу квоту API. Пожалуйста, проверьте ваш аккаунт провайдера.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'Ошибка запроса к API',
      action: 'Произошла ошибка при связи с API. Пожалуйста, попробуйте снова.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Не удалось зафиксировать изменения',
      action: 'Проверьте, есть ли конфликты или проблемы Git.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Произошла непредвиденная ошибка',
      action: 'Подробности см. в выводе "Commit-Copilot Debug".',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Запрос на генерацию проигнорирован: генерация уже выполняется.',
      generationStart: (timestamp) =>
        `[${timestamp}] Запуск генерации commit-copilot...`,
      gitExtensionMissing: 'Ошибка: Расширение Git не найдено.',
      selectedRepoFromScm: (path) =>
        `Выбран репозиторий из контекста SCM: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Выбран репозиторий из активного редактора: ${path}`,
      noRepoMatchedActiveEditor:
        'Нет репозитория, соответствующего активному редактору.',
      noActiveEditorForRepoSelection:
        'Не найден активный редактор для выбора репозитория.',
      selectedOnlyRepo: (path) => `Выбран единственный репозиторий: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Найдено ${String(count)} репозиториев, но не удалось определить активный.`,
      noRepoInApi: 'Репозитории в API не найдены.',
      usingProvider: (providerName) =>
        `Используется провайдер: ${providerName}`,
      usingGenerateMode: (mode) => `Режим генерации: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Параметры вывода коммита: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Предупреждение: Не найден API-ключ для ${provider}.`,
      cancelRequestedFromProgress: 'Отмена запрошена из интерфейса прогресса.',
      rewriteStart: (timestamp) =>
        `[${timestamp}] Запуск генерации переписывания commit-copilot...`,
      rewriteCancelRequestedFromProgress:
        'Отмена запрошена из интерфейса прогресса.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Коммит переписан: ${originalHash} -> ${replacementHash}`,
      callingGenerateCommitMessage: 'Вызов generateCommitMessage...',
      repositoryPath: (path) => `Путь к репозиторию: ${path}`,
      usingModel: (model) => `Используется модель: ${model}`,
      generatedMessage: (message) => `Сгенерированное сообщение: ${message}`,
      generationError: (errorCode, message) =>
        `Ошибка: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Непредвиденная ошибка: ${message}`,
      openingLanguageSettings:
        'Открытие языковых настроек на панели активности...',
    },
    notification: {
      gitExtensionMissing:
        'Расширение Git не найдено. Пожалуйста, убедитесь, что Git установлен, а расширение Git включено.',
      multiRepoWarning:
        'Найдено несколько репозиториев Git. Пожалуйста, выберите файл в целевом репозитории либо выполните запуск из представления SCM.',
      repoNotFound:
        'Репозиторий Git не найден. Пожалуйста, откройте папку, содержащую Git-репозиторий.',
      apiKeyMissing: (providerName) =>
        `API-ключ ${providerName} не настроен. Пожалуйста, сначала установите ваш API-ключ на панели Commit-Copilot.`,
      configureApiKeyAction: 'Настроить API-ключ',
      mixedChangesQuestion:
        'У вас есть как проиндексированные, так и непроиндексированные изменения. Как бы вы хотели продолжить?',
      stageAllAndGenerate: 'Проиндексировать всё и сгенерировать',
      proceedStagedOnly: 'Продолжить только с проиндексированными',
      cancel: 'Отмена',
      noStagedButUntrackedQuestion:
        'Проиндексированные изменения не обнаружены. Найдены неотслеживаемые файлы. Хотели бы вы проиндексировать все файлы (включая неотслеживаемые) или сгенерировать только для отслеживаемых измененных файлов?',
      stageAndGenerateAll: 'Проиндексировать и сгенерировать всё',
      generateTrackedOnly: 'Сгенерировать только отслеживаемые',
      onlyUntrackedQuestion:
        'Присутствуют только неотслеживаемые файлы без отслеживаемых изменений. Хотите ли вы проиндексировать и отслеживать эти новые файлы для генерации коммита?',
      stageAndTrack: 'Проиндексировать и отслеживать',
      commitGenerated: 'Сообщение коммита сгенерировано!',
      viewProviderConsoleAction: 'Открыть консоль провайдера',
      noChanges: 'Нет изменений для коммита. Сначала внесите изменения!',
      generationCanceled: 'Генерация сообщения коммита отменена.',
      failedPrefix: 'Ошибка Commit-Copilot',
      rewriteNoNonMergeCommits:
        'В истории текущей ветки не найдено коммитов, не являющихся merge.',
      rewriteCommitNoSubject: '(без темы)',
      rewriteCommitRootDescription: 'корневой коммит',
      rewriteCommitMergeDescription: 'merge-коммит',
      rewriteCommitParentDescription: (parentHash) => `родитель ${parentHash}`,
      rewriteCommitSelectTitle: 'Выберите коммит для переписывания',
      rewriteCommitSelectPlaceholder:
        'Выберите коммит из истории текущей ветки',
      rewriteWorkspaceDirtyBoth:
        'Нельзя переписать историю коммитов, пока есть staged (не закоммиченные) и modified (unstaged) изменения. Сначала закоммитьте их или сохраните в stash.',
      rewriteWorkspaceDirtyStaged:
        'Нельзя переписать историю коммитов, пока есть staged (не закоммиченные) изменения. Сначала закоммитьте их или сохраните в stash.',
      rewriteWorkspaceDirtyUnstaged:
        'Нельзя переписать историю коммитов, пока есть modified (unstaged) изменения. Сначала закоммитьте их или сохраните в stash.',
      rewriteProgressTitle: (providerName) => `Переписывание (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) => `Анализ коммита ${shortHash}...`,
      commitMessageCannotBeEmpty: 'Сообщение коммита не может быть пустым.',
      rewriteApplyingTitle: (shortHash) => `Переписывание ${shortHash}`,
      rewriteApplyingProgress: 'Переписывание истории коммитов...',
      rewriteFailedHistory: 'Не удалось переписать историю коммитов.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Сообщение коммита ${shortHash} переписано.`,
      rewriteDetachedHeadPushUnavailable:
        'История коммитов была переписана, но force push with lease недоступен в состоянии detached HEAD.',
      rewriteForcePushPrompt: (target) =>
        `История переписана. Выполнить force push with lease в ${target}?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease завершён: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease не удался: ${message}`,
      pushingWithLease: 'Push with lease выполняется',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'Недействительный API-ключ',
    quotaExceededPrefix: 'Квота API превышена',
    apiRequestFailedPrefix: 'Ошибка запроса к API',
    connectionErrorPrefix: 'Ошибка соединения',
    unknownProvider: 'Неизвестный провайдер',
    cannotConnectOllamaAt: (host) =>
      `Невозможно подключиться к Ollama по адресу ${host}`,
    cannotConnectOllama: (message) =>
      `Невозможно подключиться к Ollama: ${message}. Убедитесь, что Ollama запущена.`,
    apiKeyCannotBeEmpty: 'API-ключ не может быть пустым',
    validationFailedPrefix: 'Ошибка валидации',
    unableToConnectFallback: 'Невозможно подключиться',
    saveConfigSuccess: (providerName) =>
      `Конфигурация ${providerName} успешно сохранена!`,
    saveConfigFailed: 'Не удалось сохранить конфигурацию',
    languageSaved: (label) => `Язык обновлен: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API Провайдер',
      configuration: 'Конфигурация API',
      ollamaConfiguration: 'Конфигурация Ollama',
      model: 'Модель',
      generateConfiguration: 'Конфигурация генерации',
      settings: 'Настройки',
      addProvider: 'Добавить кастомного провайдера',
      editProvider: 'Редактировать кастомного провайдера',
      rewriteEditor: 'Переписать',
    },
    labels: {
      provider: 'Провайдер',
      apiKey: 'API-ключ',
      ollamaHostUrl: 'URL-адрес хоста Ollama',
      model: 'Модель',
      mode: 'Режим',
      conventionalCommitSections: 'Разделы общепринятого коммита',
      includeScope: 'Включить область (Scope)',
      includeBody: 'Включить тело (Body)',
      includeFooter: 'Включить подвал (Footer)',
      language: 'Язык расширения',
      maxAgentSteps: 'Макс. количество шагов агента',
      providerName: 'Имя провайдера',
      apiBaseUrl: 'Базовый URL-адрес API',
      commitMessage: 'Сообщение коммита',
      selectedCommitMessage: 'Выбранное сообщение коммита',
    },
    placeholders: {
      selectProvider: 'Выберите провайдера...',
      selectModel: 'Выберите модель...',
      selectGenerateMode: 'Выберите режим генерации...',
      enterApiKey: 'Введите ваш API-ключ',
      enterGeminiApiKey: 'Введите ваш API-ключ Gemini',
      enterOpenAIApiKey: 'Введите ваш API-ключ OpenAI',
      enterAnthropicApiKey: 'Введите ваш API-ключ Anthropic',
      enterCustomApiKey: 'Введите ваш API-ключ',
    },
    buttons: {
      save: 'Сохранить',
      validating: 'Проверка...',
      generateCommitMessage: 'Сгенерировать сообщение коммита',
      cancelGenerating: 'Отменить генерацию',
      back: 'Назад',
      editProvider: 'Изменить провайдера',
      addProvider: '+ Добавить провайдера...',
      deleteProvider: 'Удалить провайдера',
      rewriteCommitMessage: 'Переписать сообщение коммита',
      confirmRewrite: 'Подтвердить переписывание',
      cancel: 'Отмена',
    },
    statuses: {
      checkingStatus: 'Проверка статуса...',
      configured: 'Настроено',
      notConfigured: 'Не настроено',
      validating: 'Проверка...',
      loadingConfiguration: 'Загрузка конфигурации...',
      noChangesDetected: 'Изменения не обнаружены',
      cancelCurrentGeneration: 'Отменить текущую генерацию',
      languageSaved: 'Язык обновлен.',
      providerNameConflict: 'Провайдер с таким именем уже существует.',
      providerNameRequired: 'Требуется имя провайдера.',
      baseUrlRequired: 'Требуется базовый URL-адрес API.',
      apiKeyRequired: 'Требуется API-ключ.',
      providerSaved: 'Кастомный провайдер сохранен!',
      providerDeleted: 'Кастомный провайдер удален.',
      modelNameRequired: 'Пожалуйста, введите имя модели перед генерацией.',
      commitMessageCannotBeEmpty: 'Сообщение коммита не может быть пустым.',
      pushingWithLease: 'Push with lease выполняется...',
      forcePushWithLeaseCompleted: 'Force push with lease завершён.',
      forcePushWithLeaseFailed: 'Force push with lease не удался.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama зафиксирована в режиме Direct Diff',
      agenticModeDescription:
        'Агентный режим использует инструменты репозитория для более глубокого анализа',
      directDiffDescription:
        'Direct Diff отправляет чистый diff напрямую в модель',
      ollamaInfo:
        '<strong>Ollama</strong> работает локально на вашей машине.<br>Хост по умолчанию: <code>{host}</code><br>Убедитесь, что Ollama запущена перед генерацией.',
      googleInfo:
        'Получите ваш API-ключ в <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Получите ваш API-ключ на платформе <strong>OpenAI</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Получите ваш API-ключ в консоли <strong>Anthropic</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Ограничить количество вызовов инструментов агентом за сеанс. Введите 0 или оставьте пустым для снятия ограничения.',
      customProviderInfo:
        'Кастомные провайдеры должны быть совместимы с <strong>OpenAI</strong>.<br>Базовый URL-адрес API должен указывать на сервис, который реализует API Chat Completions от OpenAI.',
      rewriteEditorDescription:
        'Проверьте и подтвердите новое сообщение коммита.',
    },
    options: {
      agentic: 'Агентная генерация',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'Агент анализирует изменения...',
    generatingMessage: 'Генерация сообщения коммита...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Временная ошибка API. Повторная попытка (${String(attempt)}/${String(maxAttempts)}) через ${String(seconds)} сек...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Скачивание ${model}: ${status} (${String(percent)}%)`
        : `Скачивание ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Шаг ${String(step)}] Анализ diff: ${path}`,
    stepReadingFile: (step, path) =>
      `[Шаг ${String(step)}] Чтение файла: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Шаг ${String(step)}] Получение структуры: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Шаг ${String(step)}] Поиск ссылок: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Шаг ${String(step)}] Получение недавних коммитов: ${String(count)} записей`
        : `[Шаг ${String(step)}] Получение недавних коммитов...`,
    stepSearchingProject: (step, keyword) =>
      `[Шаг ${String(step)}] Поиск по проекту: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Шаг ${String(step)}] Вызов ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Шаг ${String(step)}] Анализ diff для: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Шаг ${String(step)}] Анализ diff для ${String(count)} файлов...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Шаг ${String(step)}] Чтение файлов: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Шаг ${String(step)}] Чтение ${String(count)} файлов...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Шаг ${String(step)}] Получение структур: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Шаг ${String(step)}] Получение структур для ${String(count)} файлов...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Шаг ${String(step)}] Поиск ссылок: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Шаг ${String(step)}] Поиск ссылок для ${String(count)} символов...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Шаг ${String(step)}] Поиск по проекту: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Шаг ${String(step)}] Поиск по проекту ${String(count)} ключевых слов...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Шаг ${String(step)}] Выполнение ${String(count)} исследовательских инструментов...`,
  },
};
