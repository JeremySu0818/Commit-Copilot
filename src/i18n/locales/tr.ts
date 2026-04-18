import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const trLocale: LocaleTextBundle = {
  commitCopilotErrorMessages: {
    'rewrite.commitHashRequired': () => 'Commit hash gerekiyor.',
    'rewrite.commitNotFound': (args) =>
      'Commit "{commitHash}" bulunamadı.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'Commit "{commitHash}" bir merge commit ve bu workflow tarafından yeniden yazılamaz.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Detached HEAD durumunda commitler yeniden yazılamaz.',
    'rewrite.commitNotReachable': (args) =>
      'Commit "{commitHash}" HEAD\'in ancestor\'ı değil.'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
  },
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Git deposu değil',
      action: 'Lütfen bir Git deposu içeren bir klasör açın.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Değişiklikler hazırlanamadı (stage failed)',
      action: "Git'in doğru yapılandırılıp yapılandırılmadığını kontrol edin.",
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Taahhüt edilecek değişiklik yok',
      action: 'Önce dosyalarınızda bazı değişiklikler yapın.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Hazırlanan değişiklik bulunamadı',
      action:
        'İzlenmeyen (untracked) dosyalar bulundu. Commit mesajı oluşturmak için lütfen bunları hazırlayın (stage).',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Sadece izlenmeyen dosyalar bulundu',
      action:
        'Yeni oluşturulan dosyalarınız var ancak izlenen bir değişiklik yok. Commit oluşturmak için lütfen bunları hazırlayın.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Oluşturma iptal edildi',
      action: 'Oluşturma işlemi kullanıcı tarafından iptal edildi.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Karışık değişiklikler algılandı',
      action:
        'Hem hazırlanan (staged) hem de hazırlanmayan değişiklikleriniz var. Lütfen nasıl devam edeceğinizi seçin.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API Anahtarı yapılandırılmadı',
      action: 'Lütfen Commit-Copilot panelinde API Anahtarınızı ayarlayın.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Geçersiz API Anahtarı',
      action:
        'API Anahtarınız geçersiz veya iptal edilmiş. Lütfen kontrol edip güncelleyin.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'API kotası aşıldı',
      action: 'API kotanızı aştınız. Lütfen sağlayıcı hesabınızı kontrol edin.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'API isteği başarısız',
      action:
        'API ile iletişim kurulurken bir hata oluştu. Lütfen tekrar deneyin.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Değişiklikler taahhüt edilemedi',
      action:
        'Herhangi bir Git çakışması veya sorunu olup olmadığını kontrol edin.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Beklenmeyen bir hata oluştu',
      action: 'Detaylar için "Commit-Copilot Debug" çıktısını kontrol edin.',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Oluşturma isteği yok sayıldı: oluşturma işlemi halihazırda devam ediyor.',
      generationStart: (timestamp) =>
        `[${timestamp}] Commit-Copilot oluşturması başlatılıyor...`,
      gitExtensionMissing: 'Hata: Git eklentisi bulunamadı.',
      selectedRepoFromScm: (path) => `SCM bağlamından seçilen depo: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Etkin düzenleyiciden seçilen depo: ${path}`,
      noRepoMatchedActiveEditor:
        'Etkin düzenleyiciyle eşleşen depo bulunamadı.',
      noActiveEditorForRepoSelection:
        'Depo seçimi için etkin düzenleyici bulunamadı.',
      selectedOnlyRepo: (path) => `Sadece depo seçildi: ${path}`,
      multiRepoNotDetermined: (count) =>
        `${String(count)} depo bulundu ancak etkin olan belirlenemedi.`,
      noRepoInApi: "API'de depo bulunamadı.",
      usingProvider: (providerName) =>
        `Sağlayıcı kullanılıyor: ${providerName}`,
      usingGenerateMode: (mode) => `Oluşturma modu: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Commit çıktı seçenekleri: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Uyarı: ${provider} için API Anahtarı bulunamadı.`,
      cancelRequestedFromProgress:
        'İlerleme (progress) arayüzünden iptal istendi.',
      rewriteStart: (timestamp) =>
        `[${timestamp}] commit-copilot rewrite üretimi başlatılıyor...`,
      rewriteCancelRequestedFromProgress: 'İlerleme arayüzünden iptal istendi.',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit yeniden yazıldı: ${originalHash} -> ${replacementHash}`,
      callingGenerateCommitMessage: 'generateCommitMessage çağrılıyor...',
      repositoryPath: (path) => `Depo yolu: ${path}`,
      usingModel: (model) => `Kullanılan model: ${model}`,
      generatedMessage: (message) => `Oluşturulan mesaj: ${message}`,
      generationError: (errorCode, message) =>
        `Hata: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Beklenmeyen hata: ${message}`,
      openingLanguageSettings:
        'Dil ayarları activity view üzerinde açılıyor...',
    },
    notification: {
      gitExtensionMissing:
        "Git eklentisi bulunamadı. Lütfen Git'in kurulu olduğundan ve Git eklentisinin etkinleştirildiğinden emin olun.",
      multiRepoWarning:
        'Birden fazla Git deposu bulundu. Lütfen hedef depoda bir odaklanın veya SCM görünümünden çalıştırın.',
      repoNotFound:
        'Git deposu bulunamadı. Lütfen bir Git deposu içeren bir klasör açın.',
      apiKeyMissing: (providerName) =>
        `${providerName} API Anahtarı yapılandırılmamış. Lütfen önce Commit-Copilot panelinde API Anahtarınızı ayarlayın.`,
      configureApiKeyAction: 'API Anahtarını Yapılandır',
      mixedChangesQuestion:
        'Hem hazırlanan (staged) hem de hazırlanmayan değişiklikleriniz var. Nasıl devam etmek istersiniz?',
      stageAllAndGenerate: 'Tümünü Hazırla ve Oluştur',
      proceedStagedOnly: 'Sadece Hazırlananlarla Devam Et',
      cancel: 'İptal',
      noStagedButUntrackedQuestion:
        'Hazırlanan değişiklik algılanmadı. İzlenmeyen (untracked) dosyalar bulundu. İzlenmeyenler dahil tüm dosyaları hazırlamak mı yoksa sadece izlenen ve değiştirilen dosyalar için mi oluşturmak istersiniz?',
      stageAndGenerateAll: 'Tümünü Hazırla ve Oluştur',
      generateTrackedOnly: 'Sadece İzlenenleri Oluştur',
      onlyUntrackedQuestion:
        'İzlenen hiçbir değişiklik yok ancak izlenmeyen dosyalar var. Commit oluşturmak için bu yeni dosyaları hazırlayıp (stage) izlemek ister misiniz?',
      stageAndTrack: 'Hazırla ve İzle',
      commitGenerated: 'Commit mesajı oluşturuldu!',
      viewProviderConsoleAction: 'Sağlayıcı Konsolunu Görüntüle',
      noChanges:
        'Taahhüt edilecek değişiklik yok. Önce bazı değişiklikler yapın!',
      generationCanceled: 'Commit mesajı oluşturma iptal edildi.',
      failedPrefix: 'Commit-Copilot başarısız oldu',
      rewriteNoNonMergeCommits:
        'Geçerli branch geçmişinde merge olmayan commit bulunamadı.',
      rewriteCommitNoSubject: '(konu yok)',
      rewriteCommitRootDescription: 'root commit',
      rewriteCommitMergeDescription: 'merge commit',
      rewriteCommitParentDescription: (parentHash) => `parent ${parentHash}`,
      rewriteCommitSelectTitle: 'Yeniden Yazılacak Commiti Seç',
      rewriteCommitSelectPlaceholder:
        'Geçerli branch geçmişinden bir commit seçin',
      rewriteWorkspaceDirtyBoth:
        'Staged (commitlenmemiş) ve modified (unstaged) değişiklikler varken commit geçmişi yeniden yazılamaz. Lütfen önce commit veya stash yapın.',
      rewriteWorkspaceDirtyStaged:
        'Staged (commitlenmemiş) değişiklikler varken commit geçmişi yeniden yazılamaz. Lütfen önce commit veya stash yapın.',
      rewriteWorkspaceDirtyUnstaged:
        'Modified (unstaged) değişiklikler varken commit geçmişi yeniden yazılamaz. Lütfen önce commit veya stash yapın.',
      rewriteProgressTitle: (providerName) => `Rewrite (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `Commit ${shortHash} analiz ediliyor...`,
      commitMessageCannotBeEmpty: 'Commit mesajı boş olamaz.',
      rewriteApplyingTitle: (shortHash) => `${shortHash} yeniden yazılıyor`,
      rewriteApplyingProgress: 'Commit geçmişi yeniden yazılıyor...',
      rewriteFailedHistory: 'Commit geçmişi yeniden yazılamadı.',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Commit ${shortHash} mesajı yeniden yazıldı.`,
      rewriteDetachedHeadPushUnavailable:
        'Commit geçmişi yeniden yazıldı, ancak detached HEAD durumunda force push with lease kullanılamaz.',
      rewriteForcePushPrompt: (target) =>
        `Geçmiş yeniden yazıldı. ${target} hedefine force push with lease yapılsın mı?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease tamamlandı: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease başarısız: ${message}`,
      pushingWithLease: 'Lease ile push yapılıyor',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'Geçersiz API Anahtarı',
    quotaExceededPrefix: 'API kotası aşıldı',
    apiRequestFailedPrefix: 'API isteği başarısız oldu',
    connectionErrorPrefix: 'Bağlantı hatası',
    unknownProvider: 'Bilinmeyen sağlayıcı',
    cannotConnectOllamaAt: (host) =>
      `${host} adresindeki Ollama'ya bağlanılamıyor`,
    cannotConnectOllama: (message) =>
      `Ollama'ya bağlanılamıyor: ${message}. Ollama'nın çalıştığından emin olun.`,
    apiKeyCannotBeEmpty: 'API Anahtarı boş olamaz',
    validationFailedPrefix: 'Doğrulama başarısız',
    unableToConnectFallback: 'Bağlanılamıyor',
    saveConfigSuccess: (providerName) =>
      `${providerName} yapılandırması başarıyla kaydedildi!`,
    saveConfigFailed: 'Yapılandırma kaydedilemedi',
    languageSaved: (label) => `Dil güncellendi: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API Sağlayıcı',
      configuration: 'API Yapılandırması',
      ollamaConfiguration: 'Ollama Yapılandırması',
      model: 'Model',
      generateConfiguration: 'Oluşturma Yapılandırması',
      settings: 'Ayarlar',
      addProvider: 'Özel Sağlayıcı Ekle',
      editProvider: 'Özel Sağlayıcıyı Düzenle',
      rewriteEditor: 'Rewrite',
    },
    labels: {
      provider: 'Sağlayıcı',
      apiKey: 'API Anahtarı',
      ollamaHostUrl: 'Ollama Sunucu URL',
      model: 'Model',
      mode: 'Mod',
      conventionalCommitSections: 'Geleneksel Commit Bölümleri',
      includeScope: 'Kapsamı (Scope) Dahil Et',
      includeBody: 'Gövdeyi (Body) Dahil Et',
      includeFooter: 'Altbilgiyi (Footer) Dahil Et',
      language: 'Eklenti Dili',
      maxAgentSteps: 'Maksimum Ajan Adımı',
      providerName: 'Sağlayıcı Adı',
      apiBaseUrl: 'API Temel URL',
      commitMessage: 'Commit Mesajı',
      selectedCommitMessage: 'Seçilen Commit Mesajı',
    },
    placeholders: {
      selectProvider: 'Bir sağlayıcı seçin...',
      selectModel: 'Bir model seçin...',
      selectGenerateMode: 'Oluşturma modunu seçin...',
      enterApiKey: 'API Anahtarınızı girin',
      enterGeminiApiKey: 'Gemini API Anahtarınızı girin',
      enterOpenAIApiKey: 'OpenAI API Anahtarınızı girin',
      enterAnthropicApiKey: 'Anthropic API Anahtarınızı girin',
      enterCustomApiKey: 'API Anahtarınızı girin',
    },
    buttons: {
      save: 'Kaydet',
      validating: 'Doğrulanıyor...',
      generateCommitMessage: 'Commit Mesajı Oluştur',
      cancelGenerating: 'Oluşturmayı İptal Et',
      back: 'Geri',
      editProvider: 'Sağlayıcıyı Düzenle',
      addProvider: '+ Sağlayıcı Ekle...',
      deleteProvider: 'Sağlayıcıyı Sil',
      rewriteCommitMessage: 'Commit Mesajını Yeniden Yaz',
      confirmRewrite: 'Rewrite Onayla',
      cancel: 'İptal',
    },
    statuses: {
      checkingStatus: 'Durum kontrol ediliyor...',
      configured: 'Yapılandırıldı',
      notConfigured: 'Yapılandırılmadı',
      validating: 'Doğrulanıyor...',
      loadingConfiguration: 'Yapılandırma yükleniyor...',
      noChangesDetected: 'Değişiklik algılanmadı',
      cancelCurrentGeneration: 'Mevcut oluşturmayı iptal et',
      languageSaved: 'Dil güncellendi.',
      providerNameConflict: 'Bu ada sahip bir sağlayıcı zaten var.',
      providerNameRequired: 'Sağlayıcı adı gereklidir.',
      baseUrlRequired: 'API Temel URL gereklidir.',
      apiKeyRequired: 'API Anahtarı gereklidir.',
      providerSaved: 'Özel sağlayıcı kaydedildi!',
      providerDeleted: 'Özel sağlayıcı silindi.',
      modelNameRequired: 'Lütfen oluşturmadan önce bir model adı girin.',
      commitMessageCannotBeEmpty: 'Commit mesajı boş olamaz.',
      pushingWithLease: 'Lease ile push yapılıyor...',
      forcePushWithLeaseCompleted: 'Force push with lease tamamlandı.',
      forcePushWithLeaseFailed: 'Force push with lease başarısız.',
    },
    descriptions: {
      ollamaFixedToDirectDiff:
        'Ollama Doğrudan Diff (Direct Diff) moduna sabitlenmiştir',
      agenticModeDescription:
        'Ajan (Agentic) mod, derin analiz için depo araçlarını kullanır',
      directDiffDescription:
        'Doğrudan Diff (Direct Diff) raw diff datasını doğrudan modele gönderir',
      ollamaInfo:
        "<strong>Ollama</strong> makinenizde yerel olarak çalışır.<br>Varsayılan sunucu: <code>{host}</code><br>Oluşturmadan önce Ollama'nın çalıştığından emin olun.",
      googleInfo:
        'API anahtarınızı <strong>Google AI Studio</strong> üzerinden alın:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'API anahtarınızı <strong>OpenAI Platform</strong> üzerinden alın:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'API anahtarınızı <strong>Anthropic Console</strong> üzerinden alın:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Oluşturma başına ajan araç çağrılarını sınırlayın. Sınırsız için 0 girin veya boş bırakın.',
      customProviderInfo:
        "Özel sağlayıcılar <strong>OpenAI uyumlu</strong> olmalıdır.<br>API Temel URL'si, OpenAI Chat Completions API'sini uygulayan bir hizmeti işaret etmelidir.",
      rewriteEditorDescription:
        'Yeni commit mesajını gözden geçirin ve onaylayın.',
    },
    options: {
      agentic: 'Ajan (Agentic) Oluşturma',
      directDiff: 'Doğrudan Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'Ajan değişiklikleri analiz ediyor...',
    generatingMessage: 'Commit mesajı oluşturuluyor...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Geçici API hatası. Yeniden deneniyor (${String(attempt)}/${String(maxAttempts)}) ${String(seconds)}s içinde...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `${model} çekiliyor: ${status} (${String(percent)}%)`
        : `${model} çekiliyor: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Adım ${String(step)}] Diff analiz ediliyor: ${path}`,
    stepReadingFile: (step, path) =>
      `[Adım ${String(step)}] Dosya okunuyor: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Adım ${String(step)}] Anahat (outline) alınıyor: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Adım ${String(step)}] Referanslar bulunuyor: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Adım ${String(step)}] Son commit'ler getiriliyor: ${String(count)} kayıt`
        : `[Adım ${String(step)}] Son commit'ler getiriliyor...`,
    stepSearchingProject: (step, keyword) =>
      `[Adım ${String(step)}] Projede aranıyor: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Adım ${String(step)}] ${toolName} çağrılıyor...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Adım ${String(step)}] Diff'ler analiz ediliyor: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Adım ${String(step)}] ${String(count)} dosya için diff analiz ediliyor...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Adım ${String(step)}] Dosyalar okunuyor: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Adım ${String(step)}] ${String(count)} dosya okunuyor...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Adım ${String(step)}] Anahatlar (outlines) alınıyor: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Adım ${String(step)}] ${String(count)} dosya için anahat alınıyor...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Adım ${String(step)}] Referanslar bulunuyor: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Adım ${String(step)}] ${String(count)} sembol için referans bulunuyor...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Adım ${String(step)}] Projede aranıyor: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Adım ${String(step)}] ${String(count)} anahtar kelime için projede aranıyor...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Adım ${String(step)}] ${String(count)} inceleme aracı çalıştırılıyor...`,
  },
};
