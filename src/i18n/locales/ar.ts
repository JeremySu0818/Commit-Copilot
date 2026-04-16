import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const arLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'ليس مستودع Git',
      action: 'الرجاء فتح مجلد يحتوي على مستودع Git.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'فشل في إدراج التغييرات',
      action: 'تحقق مما إذا كان Git مكوّناً بشكل صحيح.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'لا توجد تغييرات للالتزام بها',
      action: 'قم بإجراء بعض التغييرات على ملفاتك أولاً.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'لم يتم اكتشاف تغييرات مدرجة',
      action:
        'تم العثور على ملفات غير متتبعة. يرجى إدراجها لتوليد رسالة التزام.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'تم العثور على ملفات غير متتبعة فقط',
      action:
        'لديك ملفات منشأة حديثاً ولكن لا توجد تعديلات متتبعة. يرجى إدراجها لتوليد التزام.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'تم إلغاء التوليد',
      action: 'تم إلغاء التوليد من قبل المستخدم.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'تم اكتشاف تغييرات مختلطة',
      action: 'لديك تغييرات مدرجة وغير مدرجة. يرجى اختيار كيفية المتابعة.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'مفتاح API غير مكوّن',
      action: 'الرجاء تعيين مفتاح API الخاص بك في لوحة Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'مفتاح API غير صالح',
      action: 'مفتاح API الخاص بك غير صالح أو تم إبطاله. يرجى التحقق وتحديثه.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'تم تجاوز حصة API',
      action: 'لقد تجاوزت حصة API الخاصة بك. يرجى التحقق من حساب المزود.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'فشل طلب API',
      action:
        'حدث خطأ في الاتصال بواجهة برمجة التطبيقات. يرجى المحاولة مرة أخرى.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'فشل في الالتزام بالتغييرات',
      action: 'تحقق مما إذا كانت هناك أي تعارضات أو مشاكل في Git.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'حدث خطأ غير متوقع',
      action: 'تحقق من مخرجات "Commit-Copilot Debug" للحصول على التفاصيل.',
    },
  },
  extensionText: {
    output: {
      generationIgnored: 'تم تجاهل طلب التوليد: التوليد قيد التقدم بالفعل.',
      generationStart: (timestamp) =>
        `[${timestamp}] بدء توليد commit-copilot...`,
      gitExtensionMissing: 'خطأ: لم يتم العثور على إضافة Git.',
      selectedRepoFromScm: (path) => `تم تحديد المستودع من سياق SCM: ${path}`,
      selectedRepoFromEditor: (path) =>
        `تم تحديد المستودع من المحرر النشط: ${path}`,
      noRepoMatchedActiveEditor: 'لا يوجد مستودع يطابق المحرر النشط.',
      noActiveEditorForRepoSelection:
        'لم يتم العثور على محرر نشط لاختيار المستودع.',
      selectedOnlyRepo: (path) => `تم تحديد المستودع الوحيد: ${path}`,
      multiRepoNotDetermined: (count) =>
        `تم العثور على ${String(count)} مستودعات ولكن لم نتمكن من تحديد المستودع النشط.`,
      noRepoInApi: 'لم يتم العثور على أي مستودعات في واجهة برمجة التطبيقات.',
      usingProvider: (providerName) => `استخدام المزود: ${providerName}`,
      usingGenerateMode: (mode) => `وضع التوليد: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `خيارات إخراج الالتزام: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `تحذير: لم يتم العثور على مفتاح API لـ ${provider}.`,
      cancelRequestedFromProgress: 'تم طلب الإلغاء من واجهة مستخدم التقدم.',
      callingGenerateCommitMessage: 'جاري استدعاء generateCommitMessage...',
      repositoryPath: (path) => `مسار المستودع: ${path}`,
      usingModel: (model) => `استخدام النموذج: ${model}`,
      generatedMessage: (message) => `الرسالة المولدة: ${message}`,
      generationError: (errorCode, message) => `خطأ: ${errorCode} - ${message}`,
      unexpectedError: (message) => `خطأ غير متوقع: ${message}`,
      openingLanguageSettings: 'جاري فتح إعدادات اللغة في عرض النشاط...',
    },
    notification: {
      gitExtensionMissing:
        'لم يتم العثور على إضافة Git. يرجى التأكد من تثبيت Git وتمكين إضافة Git.',
      multiRepoWarning:
        'تم العثور على مستودعات Git متعددة. يرجى التركيز على ملف في المستودع المستهدف أو التشغيل من عرض SCM.',
      repoNotFound:
        'لم يتم العثور على مستودع Git. الرجاء فتح مجلد يحتوي على مستودع Git.',
      apiKeyMissing: (providerName) =>
        `لم يتم تكوين مفتاح API لـ ${providerName}. يرجى إعداد مفتاح API الخاص بك في لوحة Commit-Copilot أولاً.`,
      configureApiKeyAction: 'تكوين مفتاح API',
      mixedChangesQuestion: 'لديك تغييرات مدرجة وغير مدرجة. كيف تود المتابعة؟',
      stageAllAndGenerate: 'إدراج الكل والتوليد',
      proceedStagedOnly: 'المتابعة للمدرجة فقط',
      cancel: 'إلغاء',
      noStagedButUntrackedQuestion:
        'لم يتم اكتشاف تغييرات مدرجة. تم العثور على ملفات غير متتبعة. هل ترغب في إدراج جميع الملفات (بما في ذلك غير المتتبعة) أم التوليد للملفات المعدلة المتتبعة فقط؟',
      stageAndGenerateAll: 'إدراج وتوليد الكل',
      generateTrackedOnly: 'توليد المتتبعة فقط',
      onlyUntrackedQuestion:
        'توجد ملفات غير متتبعة فقط بدون تعديلات متتبعة. هل تريد إدراج وتتبع هذه الملفات الجديدة لتوليد التزام؟',
      stageAndTrack: 'إدراج وتتبع',
      commitGenerated: 'تم توليد رسالة الالتزام!',
      viewProviderConsoleAction: 'عرض وحدة تحكم المزود',
      noChanges: 'لا توجد تغييرات للالتزام بها. قم ببعض التغييرات أولاً!',
      generationCanceled: 'تم إلغاء توليد رسالة الالتزام.',
      failedPrefix: 'فشل Commit-Copilot',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'مفتاح API غير صالح',
    quotaExceededPrefix: 'تم تجاوز حصة API',
    apiRequestFailedPrefix: 'فشل طلب API',
    connectionErrorPrefix: 'خطأ في الاتصال',
    unknownProvider: 'مزود غير معروف',
    cannotConnectOllamaAt: (host) => `لا يمكن الاتصال بـ Ollama على ${host}`,
    cannotConnectOllama: (message) =>
      `لا يمكن الاتصال بـ Ollama: ${message}. تأكد من وضع Ollama قيد التشغيل.`,
    apiKeyCannotBeEmpty: 'لا يمكن أن يكون مفتاح API فارغاً',
    validationFailedPrefix: 'فشل التحقق',
    unableToConnectFallback: 'غير قادر على الاتصال',
    saveConfigSuccess: (providerName) => `تم حفظ تكوين ${providerName} بنجاح!`,
    saveConfigFailed: 'فشل حفظ التكوين',
    languageSaved: (label) => `تم تحديث اللغة: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'مزود API',
      configuration: 'تكوين API',
      ollamaConfiguration: 'تكوين Ollama',
      model: 'النموذج',
      generateConfiguration: 'تكوين التوليد',
      settings: 'الإعدادات',
      addProvider: 'إضافة مزود مخصص',
      editProvider: 'تعديل مزود مخصص',
    },
    labels: {
      provider: 'المزود',
      apiKey: 'مفتاح API',
      ollamaHostUrl: 'عنوان مضيف Ollama',
      model: 'النموذج',
      mode: 'الوضع',
      conventionalCommitSections: 'أقسام الالتزام التقليدي',
      includeScope: 'تضمين النطاق',
      includeBody: 'تضمين النص',
      includeFooter: 'تضمين التذييل',
      language: 'لغة الإضافة',
      maxAgentSteps: 'أقصى خطوات للوكيل',
      providerName: 'اسم المزود',
      apiBaseUrl: 'الرابط الأساسي لـ API',
    },
    placeholders: {
      selectProvider: 'حدد مزوداً...',
      selectModel: 'حدد نموذجاً...',
      selectGenerateMode: 'حدد وضع التوليد...',
      enterApiKey: 'أدخل مفتاح API الخاص بك',
      enterGeminiApiKey: 'أدخل مفتاح Gemini API الخاص بك',
      enterOpenAIApiKey: 'أدخل مفتاح OpenAI API الخاص بك',
      enterAnthropicApiKey: 'أدخل مفتاح Anthropic API الخاص بك',
      enterCustomApiKey: 'أدخل مفتاح API الخاص بك',
    },
    buttons: {
      save: 'حفظ',
      validating: 'جاري التحقق...',
      generateCommitMessage: 'توليد رسالة الالتزام',
      cancelGenerating: 'إلغاء التوليد',
      back: 'رجوع',
      editProvider: 'تعديل المزود',
      addProvider: '+ إضافة مزود...',
      deleteProvider: 'حذف المزود',
    },
    statuses: {
      checkingStatus: 'جاري التحقق من الحالة...',
      configured: 'تم التكوين',
      notConfigured: 'لم يتم التكوين',
      validating: 'جاري التحقق...',
      loadingConfiguration: 'جاري تحميل التكوين...',
      noChangesDetected: 'لم يتم اكتشاف أي تغييرات',
      cancelCurrentGeneration: 'إلغاء التوليد الحالي',
      languageSaved: 'تم تحديث اللغة.',
      providerNameConflict: 'يوجد بالفعل مزود بهذا الاسم.',
      providerNameRequired: 'مطلوب اسم المزود.',
      baseUrlRequired: 'مطلوب الرابط الأساسي لـ API.',
      apiKeyRequired: 'مطلوب مفتاح API.',
      providerSaved: 'تم حفظ المزود المخصص!',
      providerDeleted: 'تم حذف المزود المخصص.',
      modelNameRequired: 'يرجى إدخال اسم النموذج قبل التوليد.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama مثبت على وضع Direct Diff',
      agenticModeDescription: 'الوضع الوكيلي يستخدم أدوات المستودع لتحليل أعمق',
      directDiffDescription: 'Direct Diff يرسل الفرق الخام مباشرة إلى النموذج',
      ollamaInfo:
        '<strong>Ollama</strong> يعمل محلياً على جهازك.<br>المضيف الافتراضي: <code>{host}</code><br>تأكد من تشغيل Ollama قبل التوليد.',
      googleInfo:
        'احصل على مفتاح API من <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'احصل على مفتاح API من <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'احصل على مفتاح API من <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'حد استدعاءات أداة الوكيل لكل عملية توليد. أدخل 0 أو اتركه فارغاً للحصول على عدد غير محدود.',
      customProviderInfo:
        'المزودات المخصصة يجب أن تكون <strong>متوافقة مع OpenAI</strong>.<br>الرابط الأساسي لـ API يجب أن يشير إلى خدمة تنفذ API الخاص بـ OpenAI Chat Completions.',
    },
    options: {
      agentic: 'توليد وكيلي',
      directDiff: 'فرق مباشر',
    },
  },
  progressMessages: {
    analyzingChanges: 'يقوم الوكيل بتحليل التغييرات...',
    generatingMessage: 'جاري توليد رسالة الالتزام...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `خطأ عابر في API. إعادة المحاولة (${String(attempt)}/${String(maxAttempts)}) خلال ${String(seconds)} ثانية...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `جاري سحب ${model}: ${status} (${String(percent)}%)`
        : `جاري سحب ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) => `[الخطوة ${String(step)}] تحليل الفرق: ${path}`,
    stepReadingFile: (step, path) => `[الخطوة ${String(step)}] قراءة الملف: ${path}`,
    stepGettingOutline: (step, path) =>
      `[الخطوة ${String(step)}] الحصول على المخطط: ${path}`,
    stepFindingReferences: (step, target) =>
      `[الخطوة ${String(step)}] العثور على المراجع: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[الخطوة ${String(step)}] جلب الالتزامات الأخيرة: ${String(count)} إدخالات`
        : `[الخطوة ${String(step)}] جلب الالتزامات الأخيرة...`,
    stepSearchingProject: (step, keyword) =>
      `[الخطوة ${String(step)}] البحث في المشروع عن: ${keyword}`,
    stepCalling: (step, toolName) => `[الخطوة ${String(step)}] استدعاء ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[الخطوة ${String(step)}] تحليل الفروق: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[الخطوة ${String(step)}] تحليل الفروق لـ ${String(count)} ملفات...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[الخطوة ${String(step)}] قراءة الملفات: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[الخطوة ${String(step)}] قراءة ${String(count)} ملفات...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[الخطوة ${String(step)}] الحصول على المخططات: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[الخطوة ${String(step)}] الحصول على المخططات لـ ${String(count)} ملفات...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[الخطوة ${String(step)}] العثور على المراجع: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[الخطوة ${String(step)}] العثور على المراجع لـ ${String(count)} رموز...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[الخطوة ${String(step)}] البحث في المشروع عن: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[الخطوة ${String(step)}] البحث في المشروع عن ${String(count)} كلمات رئيسية...`,
    stepExecutingMultipleTools: (step, count) =>
      `[الخطوة ${String(step)}] تنفيذ ${String(count)} أدوات تحقيق...`,
  },
};
