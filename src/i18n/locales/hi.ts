import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const hiLocale: LocaleTextBundle = {
  commitCopilotErrorMessages: {
    'rewrite.commitHashRequired': () => 'Commit hash आवश्यक है।',
    'rewrite.commitNotFound': (args) =>
      'Commit "{commitHash}" नहीं मिला।'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.mergeCommitUnsupported': (args) =>
      'Commit "{commitHash}" merge commit है और इस workflow से फिर से नहीं लिखा जा सकता।'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
    'rewrite.detachedHead': () =>
      'Detached HEAD में commits फिर से नहीं लिखे जा सकते।',
    'rewrite.commitNotReachable': (args) =>
      'Commit "{commitHash}" HEAD का ancestor नहीं है।'.replace(
        '{commitHash}',
        args.commitHash ?? '',
      ),
  },
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'गिट रिपॉजिटरी नहीं है',
      action: 'कृपया ऐसा फोल्डर खोलें जिसमें गिट रिपॉजिटरी हो।',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'परिवर्तनों को स्टेज करने में विफल',
      action: 'जांचें कि गिट ठीक से कॉन्फ़िगर किया गया है या नहीं।',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'कमिट करने के लिए कोई परिवर्तन नहीं',
      action: 'पहले अपनी फ़ाइलों में कुछ परिवर्तन करें।',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'कोई स्टेज किया गया परिवर्तन नहीं मिला',
      action:
        'अनट्रैक की गई फ़ाइलें मिलीं। कमिट संदेश उत्पन्न करने के लिए कृपया उन्हें स्टेज करें।',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'केवल अनट्रैक की गई फ़ाइलें मिलीं',
      action:
        'आपके पास नई बनाई गई फ़ाइलें हैं लेकिन कोई ट्रैक किया गया संशोधन नहीं है। कृपया कमिट उत्पन्न करने के लिए उन्हें स्टेज करें।',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'उत्पादन रद्द किया गया',
      action: 'उत्पादन उपयोगकर्ता द्वारा रद्द कर दिया गया था।',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'मिश्रित परिवर्तन मिले',
      action:
        'आपके पास स्टेज किए गए और अनस्टेज किए गए दोनों परिवर्तन हैं। कृपया चुनें कि आगे कैसे बढ़ना है।',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'एपीआई कुंजी कॉन्फ़िगर नहीं की गई है',
      action: 'कृपया कमिट-कोपायलट पैनल में अपनी एपीआई कुंजी सेट करें।',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'अमान्य एपीआई कुंजी',
      action:
        'आपकी एपीआई कुंजी अमान्य है या रद्द कर दी गई है। कृपया इसकी जांच करें और अपडेट करें।',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'एपीआई कोटा पार हो गया',
      action:
        'आपने अपना एपीआई कोटा पार कर लिया है। कृपया अपने प्रदाता खाते की जांच करें।',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'एपीआई अनुरोध विफल रहा',
      action: 'एपीआई के साथ संवाद करने में त्रुटि हुई। कृपया पुन: प्रयास करें।',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'परिवर्तनों को कमिट करने में विफल',
      action: 'जांचें कि क्या कोई गिट टकराव या समस्याएं हैं।',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'एक अप्रत्याशित त्रुटि हुई',
      action: 'विवरण के लिए "Commit-Copilot Debug" आउटपुट की जांच करें।',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'उत्पादन अनुरोध को अनदेखा किया गया: उत्पादन पहले से ही प्रगति पर है।',
      generationStart: (timestamp) =>
        `[${timestamp}] Commit-copilot उत्पादन शुरू हो रहा है...`,
      gitExtensionMissing: 'त्रुटि: गिट एक्सटेंशन नहीं मिला।',
      selectedRepoFromScm: (path) => `SCM संदर्भ से चयनित रिपॉजिटरी: ${path}`,
      selectedRepoFromEditor: (path) =>
        `सक्रिय संपादक से चयनित रिपॉजिटरी: ${path}`,
      noRepoMatchedActiveEditor:
        'सक्रिय संपादक से मेल खाने वाली कोई रिपॉजिटरी नहीं।',
      noActiveEditorForRepoSelection:
        'रिपॉजिटरी चयन के लिए कोई सक्रिय संपादक नहीं मिला।',
      selectedOnlyRepo: (path) => `चयनित केवल रिपॉजिटरी: ${path}`,
      multiRepoNotDetermined: (count) =>
        `${String(count)} रिपॉजिटरी मिलीं लेकिन सक्रिय रिपॉजिटरी का निर्धारण नहीं कर सका।`,
      noRepoInApi: 'एपीआई में कोई रिपॉजिटरी नहीं मिली।',
      usingProvider: (providerName) => `प्रदाता का उपयोग: ${providerName}`,
      usingGenerateMode: (mode) => `उत्पादन मोड: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `कमिट आउटपुट विकल्प: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `चेतावनी: ${provider} के लिए कोई एपीआई कुंजी नहीं मिली।`,
      cancelRequestedFromProgress:
        'प्रगति यूआई से रद्दीकरण का अनुरोध किया गया।',
      rewriteStart: (timestamp) =>
        `[${timestamp}] commit-copilot rewrite generation शुरू हो रहा है...`,
      rewriteCancelRequestedFromProgress:
        'Progress UI से रद्द करने का अनुरोध किया गया।',
      rewriteCommitRewritten: (originalHash, replacementHash) =>
        `Commit फिर से लिखा गया: ${originalHash} -> ${replacementHash}`,
      callingGenerateCommitMessage: 'generateCommitMessage को कॉल कर रहा है...',
      repositoryPath: (path) => `रिपॉजिटरी पथ: ${path}`,
      usingModel: (model) => `मॉडल का उपयोग: ${model}`,
      generatedMessage: (message) => `उत्पन्न संदेश: ${message}`,
      generationError: (errorCode, message) =>
        `त्रुटि: ${errorCode} - ${message}`,
      unexpectedError: (message) => `अप्रत्याशित त्रुटि: ${message}`,
      openingLanguageSettings: 'गतिविधि दृश्य में भाषा सेटिंग्स खोल रहा है...',
    },
    notification: {
      gitExtensionMissing:
        'गिट एक्सटेंशन नहीं मिला। कृपया सुनिश्चित करें कि गिट स्थापित है और गिट एक्सटेंशन सक्षम है।',
      multiRepoWarning:
        'एकाधिक गिट रिपॉजिटरी मिलीं। कृपया लक्ष्य रिपॉजिटरी में फ़ाइल पर ध्यान केंद्रित करें या SCM दृश्य से निष्पादित करें।',
      repoNotFound:
        'कोई गिट रिपॉजिटरी नहीं मिली। कृपया एक फ़ोल्डर खोलें जिसमें गिट रिपॉजिटरी हो।',
      apiKeyMissing: (providerName) =>
        `${providerName} एपीआई कुंजी कॉन्फ़िगर नहीं की गई है। कृपया पहले कमिट-कोपायलट पैनल में अपनी एपीआई कुंजी सेट करें।`,
      configureApiKeyAction: 'एपीआई कुंजी कॉन्फ़िगर करें',
      mixedChangesQuestion:
        'आपके पास स्टेज किए गए और अनस्टेज किए गए दोनों परिवर्तन हैं। आप आगे कैसे बढ़ना चाहेंगे?',
      stageAllAndGenerate: 'सभी स्टेज करें और उत्पन्न करें',
      proceedStagedOnly: 'केवल स्टेज के साथ आगे बढ़ें',
      cancel: 'रद्द करें',
      noStagedButUntrackedQuestion:
        'कोई स्टेज किया गया परिवर्तन नहीं मिला। अनट्रैक की गई फ़ाइलें मिलीं। क्या आप सभी फ़ाइलों (अनट्रैक सहित) को स्टेज करना चाहेंगे या केवल ट्रैक की गई संशोधित फ़ाइलों के लिए उत्पन्न करना चाहेंगे?',
      stageAndGenerateAll: 'सभी को स्टेज और उत्पन्न करें',
      generateTrackedOnly: 'केवल ट्रैक किए गए उत्पन्न करें',
      onlyUntrackedQuestion:
        'केवल अनट्रैक की गई फ़ाइलें मौजूद हैं जिनमें कोई ट्रैक किया गया संशोधन नहीं है। क्या आप कमिट उत्पन्न करने के लिए इन नई फ़ाइलों को स्टेज और ट्रैक करना चाहते हैं?',
      stageAndTrack: 'स्टेज और ट्रैक करें',
      commitGenerated: 'कमिट संदेश उत्पन्न किया गया!',
      viewProviderConsoleAction: 'प्रदाता कंसोल देखें',
      noChanges:
        'कमिट करने के लिए कोई परिवर्तन है नहीं। पहले कुछ परिवर्तन करें!',
      generationCanceled: 'कमिट संदेश उत्पादन रद्द कर दिया गया।',
      rewriteCanceled: 'कमिट संदेश पुनर्लेखन रद्द कर दिया गया।',
      failedPrefix: 'Commit-Copilot विफल रहा',
      rewriteNoNonMergeCommits:
        'वर्तमान branch history में कोई non-merge commit नहीं मिला।',
      rewriteCommitNoSubject: '(कोई subject नहीं)',
      rewriteCommitRootDescription: 'root commit',
      rewriteCommitMergeDescription: 'merge commit',
      rewriteCommitParentDescription: (parentHash) => `parent ${parentHash}`,
      rewriteCommitSelectTitle: 'फिर से लिखने के लिए commit चुनें',
      rewriteCommitSelectPlaceholder: 'वर्तमान branch history से commit चुनें',
      rewriteWorkspaceDirtyBoth:
        'staged (commit नहीं किए गए) और modified (unstaged) बदलाव मौजूद होने पर commit history फिर से नहीं लिखी जा सकती। कृपया पहले commit या stash करें।',
      rewriteWorkspaceDirtyStaged:
        'staged (commit नहीं किए गए) बदलाव मौजूद होने पर commit history फिर से नहीं लिखी जा सकती। कृपया पहले commit या stash करें।',
      rewriteWorkspaceDirtyUnstaged:
        'modified (unstaged) बदलाव मौजूद होने पर commit history फिर से नहीं लिखी जा सकती। कृपया पहले commit या stash करें।',
      rewriteProgressTitle: (providerName) => `Rewrite (${providerName})`,
      rewriteAnalyzingCommit: (shortHash) =>
        `Commit ${shortHash} का विश्लेषण हो रहा है...`,
      commitMessageCannotBeEmpty: 'Commit message खाली नहीं हो सकता।',
      rewriteApplyingTitle: (shortHash) => `${shortHash} फिर से लिखा जा रहा है`,
      rewriteApplyingProgress: 'Commit history फिर से लिखी जा रही है...',
      rewriteFailedHistory: 'Commit history फिर से लिखने में विफल।',
      rewriteCommitMessageRewritten: (shortHash) =>
        `Commit ${shortHash} message फिर से लिखा गया।`,
      rewriteDetachedHeadPushUnavailable:
        'Commit history फिर से लिखी गई, लेकिन detached HEAD state में force push with lease उपलब्ध नहीं है।',
      rewriteForcePushPrompt: (target) =>
        `History फिर से लिखी गई। क्या ${target} पर force push with lease करें?`,
      pushWithLeaseConfirmAction: 'Push with Lease',
      rewriteForcePushCompleted: (target) =>
        `Force push with lease पूरा हुआ: ${target}.`,
      rewriteForcePushFailed: (message) =>
        `Force push with lease विफल: ${message}`,
      pushingWithLease: 'Lease के साथ push हो रहा है',
    },
  },
  mainViewText: {
    invalidApiKeyPrefix: 'अमान्य एपीआई कुंजी',
    quotaExceededPrefix: 'एपीआई कोटा पार हो गया',
    apiRequestFailedPrefix: 'एपीआई अनुरोध विफल रहा',
    connectionErrorPrefix: 'कनेक्शन त्रुटि',
    unknownProvider: 'अज्ञात प्रदाता',
    cannotConnectOllamaAt: (host) =>
      `Ollama से ${host} पर कनेक्ट नहीं किया जा सकता`,
    cannotConnectOllama: (message) =>
      `Ollama से कनेक्ट नहीं किया जा सकता: ${message}। सुनिश्चित करें कि Ollama चल रहा है।`,
    apiKeyCannotBeEmpty: 'एपीआई कुंजी खाली नहीं हो सकती',
    validationFailedPrefix: 'सत्यापन विफल रहा',
    unableToConnectFallback: 'कनेक्ट करने में असमर्थ',
    saveConfigSuccess: (providerName) =>
      `${providerName} कॉन्फ़िगरेशन सफलतापूर्वक सहेजा गया!`,
    saveConfigFailed: 'कॉन्फ़िगरेशन सहेजने में विफल',
    languageSaved: (label) => `भाषा अपडेट की गई: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'एपीआई प्रदाता',
      configuration: 'एपीआई कॉन्फ़िगरेशन',
      ollamaConfiguration: 'Ollama कॉन्फ़िगरेशन',
      model: 'मॉडल',
      generateConfiguration: 'उत्पादन कॉन्फ़िगरेशन',
      settings: 'सेटिंग्स',
      addProvider: 'कस्टम प्रदाता जोड़ें',
      editProvider: 'कस्टम प्रदाता संपादित करें',
      rewriteEditor: 'Rewrite',
    },
    labels: {
      provider: 'प्रदाता',
      apiKey: 'एपीआई कुंजी',
      ollamaHostUrl: 'Ollama होस्ट URL',
      model: 'मॉडल',
      mode: 'मोड',
      conventionalCommitSections: 'पारंपरिक कमिट अनुभाग',
      includeScope: 'स्कोप शामिल करें',
      includeBody: 'बॉडी शामिल करें',
      includeFooter: 'फुटर शामिल करें',
      language: 'एक्सटेंशन भाषा',
      maxAgentSteps: 'अधिकतम एजेंट कदम',
      providerName: 'प्रदाता का नाम',
      apiBaseUrl: 'एपीआई बेस URL',
      commitMessage: 'Commit Message',
      selectedCommitMessage: 'चुना गया Commit Message',
    },
    placeholders: {
      selectProvider: 'प्रदाता का चयन करें...',
      selectModel: 'मॉडल का चयन करें...',
      selectGenerateMode: 'उत्पादन मोड का चयन करें...',
      enterApiKey: 'अपनी एपीआई कुंजी दर्ज करें',
      enterGeminiApiKey: 'अपनी Gemini एपीआई कुंजी दर्ज करें',
      enterOpenAIApiKey: 'अपनी OpenAI एपीआई कुंजी दर्ज करें',
      enterAnthropicApiKey: 'अपनी Anthropic एपीआई कुंजी दर्ज करें',
      enterCustomApiKey: 'अपनी एपीआई कुंजी दर्ज करें',
    },
    buttons: {
      save: 'सहेजें',
      validating: 'सत्यापन कर रहा है...',
      generateCommitMessage: 'कमिट संदेश उत्पन्न करें',
      cancelGenerating: 'उत्पादन रद्द करें',
      back: 'वापस',
      editProvider: 'प्रदाता संपादित करें',
      addProvider: '+ प्रदाता जोड़ें...',
      deleteProvider: 'प्रदाता हटाएं',
      rewriteCommitMessage: 'Commit Message फिर से लिखें',
      confirmRewrite: 'Rewrite की पुष्टि करें',
      cancel: 'रद्द करें',
    },
    statuses: {
      checkingStatus: 'स्थिति की जांच कर रहा है...',
      configured: 'कॉन्फ़िगर किया गया',
      notConfigured: 'कॉन्फ़िगर नहीं किया गया',
      validating: 'सत्यापन कर रहा है...',
      loadingConfiguration: 'कॉन्फ़िगरेशन लोड कर रहा है...',
      noChangesDetected: 'कोई परिवर्तन नहीं मिला',
      cancelCurrentGeneration: 'वर्तमान उत्पादन रद्द करें',
      languageSaved: 'भाषा अपडेट की गई।',
      providerNameConflict: 'इस नाम का प्रदाता पहले से मौजूद है।',
      providerNameRequired: 'प्रदाता का नाम आवश्यक है।',
      baseUrlRequired: 'एपीआई बेस URL आवश्यक है।',
      apiKeyRequired: 'एपीआई कुंजी आवश्यक है।',
      providerSaved: 'कस्टम प्रदाता सहेजा गया!',
      providerDeleted: 'कस्टम प्रदाता हटा दिया गया।',
      modelNameRequired: 'कृपया उत्पन्न करने से पहले एक मॉडल नाम दर्ज करें।',
      commitMessageCannotBeEmpty: 'Commit message खाली नहीं हो सकता।',
      pushingWithLease: 'Lease के साथ push हो रहा है...',
      forcePushWithLeaseCompleted: 'Force push with lease पूरा हुआ।',
      forcePushWithLeaseFailed: 'Force push with lease विफल।',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama डायरेक्ट डिफ मोड पर निश्चित है',
      agenticModeDescription:
        'एजेंटिक मोड गहरे विश्लेषण के लिए रिपॉजिटरी टूल का उपयोग करता है',
      directDiffDescription: 'डायरेक्ट डिफ रॉ डिफ को सीधे मॉडल में भेजता है',
      ollamaInfo:
        '<strong>Ollama</strong> आपकी मशीन पर स्थानीय रूप से चलता है।<br>डिफ़ॉल्ट होस्ट: <code>{host}</code><br>उत्पन्न करने से पहले सुनिश्चित करें कि Ollama चल रहा है।',
      googleInfo:
        '<strong>Google AI Studio</strong> से अपनी एपीआई कुंजी प्राप्त करें:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        '<strong>OpenAI Platform</strong> से अपनी एपीआई कुंजी प्राप्त करें:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        '<strong>Anthropic Console</strong> से अपनी एपीआई कुंजी प्राप्त करें:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'प्रति उत्पादन एजेंटिक टूल कॉल को सीमित करें। 0 दर्ज करें या असीमित के लिए खाली छोड़ दें।',
      customProviderInfo:
        'कस्टम प्रदाता <strong>OpenAI-संगत</strong> होने चाहिए।<br>एपीआई बेस URL को एक सेवा को इंगित करना चाहिए जो OpenAI Chat Completions API को लागू करती है।',
      rewriteEditorDescription:
        'नए commit message की समीक्षा करें और पुष्टि करें।',
    },
    options: {
      agentic: 'एजेंटिक उत्पन्न करें',
      directDiff: 'डायरेक्ट डिफ',
    },
  },
  progressMessages: {
    analyzingChanges: 'एजेंट परिवर्तनों का विश्लेषण कर रहा है...',
    generatingMessage: 'कमिट संदेश उत्पन्न कर रहा है...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `अस्थायी एपीआई त्रुटि। ${String(seconds)}s में पुनः प्रयास कर रहा है (${String(attempt)}/${String(maxAttempts)})...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `${model} को खींच रहा है: ${status} (${String(percent)}%)`
        : `${model} को खींच रहा है: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[कदम ${String(step)}] अंतर का विश्लेषण कर रहा है: ${path}`,
    stepReadingFile: (step, path) =>
      `[कदम ${String(step)}] फ़ाइल पढ़ रहा है: ${path}`,
    stepGettingOutline: (step, path) =>
      `[कदम ${String(step)}] रूपरेखा प्राप्त कर रहा है: ${path}`,
    stepFindingReferences: (step, target) =>
      `[कदम ${String(step)}] संदर्भ ढूंढ रहा है: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[कदम ${String(step)}] हाल ही के कमिट प्राप्त कर रहा है: ${String(count)} प्रविष्टियाँ`
        : `[कदम ${String(step)}] हाल ही के कमिट प्राप्त कर रहा है...`,
    stepSearchingProject: (step, keyword) =>
      `[कदम ${String(step)}] परियोजना में खोज रहा है: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[कदम ${String(step)}] ${toolName} को कॉल कर रहा है...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[कदम ${String(step)}] अंतर का विश्लेषण कर रहा है: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[कदम ${String(step)}] ${String(count)} फ़ाइलों के लिए अंतर का विश्लेषण कर रहा है...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[कदम ${String(step)}] फ़ाइलें पढ़ रहा है: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[कदम ${String(step)}] ${String(count)} फ़ाइलें पढ़ रहा है...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[कदम ${String(step)}] रूपरेखाएँ प्राप्त कर रहा है: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[कदम ${String(step)}] ${String(count)} फ़ाइलों के लिए रूपरेखाएँ प्राप्त कर रहा है...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[कदम ${String(step)}] संदर्भ ढूंढ रहा है: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[कदम ${String(step)}] ${String(count)} प्रतीकों के लिए संदर्भ ढूंढ रहा है...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[कदम ${String(step)}] परियोजना में खोज रहा है: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[कदम ${String(step)}] ${String(count)} कीवर्ड के लिए परियोजना में खोज रहा है...`,
    stepExecutingMultipleTools: (step, count) =>
      `[कदम ${String(step)}] ${String(count)} जाँच उपकरणों को निष्पादित कर रहा है...`,
  },
};
