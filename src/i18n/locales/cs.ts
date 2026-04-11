import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const csLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Není repozitář Git',
      action: 'Otevřete složku, která obsahuje repozitář Git.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Nepodařilo se přidat změny do stage',
      action: 'Zkontrolujte, zda je Git správně nakonfigurován.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Žádné změny k potvrzení (commit)',
      action: 'Nejprve proveďte nějaké změny v souborech.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Nebyly zjištěny žádné změny ve stage',
      action:
        'Nalezeny nesledované soubory. Chcete-li vygenerovat zprávu o potvrzení, přidejte je do stage.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Nalezeny pouze nesledované soubory',
      action:
        'Máte nově vytvořené soubory, ale žádné sledované změny. Chcete-li vygenerovat potvrzení, přidejte je do stage.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Generování zrušeno',
      action: 'Generování bylo zrušeno uživatelem.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Zjištěny smíšené změny',
      action: 'Máte změny ve stage i mimo ni. Vyberte, jak pokračovat.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API klíč není nakonfigurován',
      action: 'Nastavte svůj API klíč v panelu Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Neplatný API klíč',
      action:
        'Váš API klíč je neplatný nebo byl odvolán. Zkontrolujte jej a aktualizujte.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'Překročena kvóta API',
      action:
        'Překročili jste kvótu API. Zkontrolujte svůj účet u poskytovatele.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'Požadavek API selhal',
      action: 'Při komunikaci s API došlo k chybě. Zkuste to prosím znovu.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Nepodařilo se potvrdit (commit) změny',
      action:
        'Zkontrolujte, zda neexistují žádné konflikty nebo problémy Gitu.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Došlo k neočekávané chybě',
      action: 'Podrobnosti naleznete ve výstupu "Commit-Copilot Debug".',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Požadavek na generování ignorován: generování již probíhá.',
      generationStart: (timestamp) =>
        `[${timestamp}] Spouštění generování commit-copilot...`,
      gitExtensionMissing: 'Chyba: Rozšíření Git nebylo nalezeno.',
      selectedRepoFromScm: (path) => `Vybrán repozitář z kontextu SCM: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Vybrán repozitář z aktivního editoru: ${path}`,
      noRepoMatchedActiveEditor:
        'Aktivnímu editoru neodpovídá žádný repozitář.',
      noActiveEditorForRepoSelection:
        'Nebyl nalezen žádný aktivní editor pro výběr repozitáře.',
      selectedOnlyRepo: (path) => `Vybrán pouze repozitář: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Nalezeno ${count} repozitářů, ale nepodařilo se určit ten aktivní.`,
      noRepoInApi: 'V API nebyly nalezeny žádné repozitáře.',
      usingProvider: (providerName) =>
        `Používání poskytovatele: ${providerName}`,
      usingGenerateMode: (mode) => `Režim generování: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Možnosti výstupu potvrzení: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Varování: Nebyl nalezen žádný API klíč pro ${provider}.`,
      cancelRequestedFromProgress:
        'Generování zrušeno z uživatelského rozhraní.',
      callingGenerateCommitMessage: 'Volání generateCommitMessage...',
      repositoryPath: (path) => `Cesta k repozitáři: ${path}`,
      usingModel: (model) => `Používání modelu: ${model}`,
      generatedMessage: (message) => `Vygenerovaná zpráva: ${message}`,
      generationError: (errorCode, message) =>
        `Chyba: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Neočekávaná chyba: ${message}`,
      openingLanguageSettings:
        'Otevírání nastavení jazyka v zobrazení aktivity...',
    },
    notification: {
      gitExtensionMissing:
        'Rozšíření Git nebylo nalezeno. Ujistěte se, že je Git nainstalován a rozšíření Git je povoleno.',
      multiRepoWarning:
        'Nalezeno více repozitářů Git. Zaměřte se prosím na soubor v cílovém repozitáři nebo spusťte z pohledu SCM.',
      repoNotFound:
        'Nebyl nalezen žádný repozitář Git. Otevřete složku obsahující repozitář Git.',
      apiKeyMissing: (providerName) =>
        `Klíč API pro ${providerName} není nakonfigurován. Nastavte svůj API klíč nejprve v panelu Commit-Copilot.`,
      configureApiKeyAction: 'Konfigurovat API klíč',
      mixedChangesQuestion:
        'Máte změny ve stage i mimo ni. Jak chcete pokračovat?',
      stageAllAndGenerate: 'Přidat vše do stage a generovat',
      proceedStagedOnly: 'Pokračovat pouze se změnami ve stage',
      cancel: 'Zrušit',
      noStagedButUntrackedQuestion:
        'Nebyly zjištěny žádné změny ve stage. Nalezeny nesledované soubory. Chcete přidat do stage všechny soubory (včetně nesledovaných) nebo generovat pouze pro sledované upravené soubory?',
      stageAndGenerateAll: 'Přidat vše do stage a generovat',
      generateTrackedOnly: 'Generovat pouze pro sledované',
      onlyUntrackedQuestion:
        'Jsou přítomny pouze nesledované soubory bez sledovaných úprav. Chcete tyto nové soubory přidat do stage a sledovat je pro vygenerování potvrzení?',
      stageAndTrack: 'Přidat do stage a sledovat',
      commitGenerated: 'Zpráva k potvrzení byla vygenerována!',
      viewProviderConsoleAction: 'Zobrazit konzoli poskytovatele',
      noChanges:
        'Žádné změny k potvrzení k dispozici. Nejprve proveďte nějaké změny!',
      generationCanceled: 'Generování zprávy k potvrzení bylo zrušeno.',
      failedPrefix: 'Commit-Copilot selhal',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'Neplatný API klíč',
    quotaExceededPrefix: 'Kvóta API překročena',
    apiRequestFailedPrefix: 'Požadavek API selhal',
    connectionErrorPrefix: 'Chyba připojení',
    unknownProvider: 'Neznámý poskytovatel',
    cannotConnectOllamaAt: (host) => `Nelze se připojit k Ollama na ${host}`,
    cannotConnectOllama: (message) =>
      `Nelze se připojit k Ollama: ${message}. Ujistěte se, že Ollama běží.`,
    apiKeyCannotBeEmpty: 'API klíč nesmí být prázdný',
    validationFailedPrefix: 'Ověření se nezdařilo',
    unableToConnectFallback: 'Nelze se připojit',
    saveConfigSuccess: (providerName) =>
      `Konfigurace ${providerName} byla úspěšně uložena!`,
    saveConfigFailed: 'Uložení konfigurace se nezdařilo',
    languageSaved: (label) => `Jazyk byl aktualizován: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'Poskytovatel API',
      configuration: 'Konfigurace API',
      ollamaConfiguration: 'Konfigurace Ollama',
      model: 'Model',
      generateConfiguration: 'Konfigurace generování',
      settings: 'Nastavení',
      addProvider: 'Přidat vlastního poskytovatele',
      editProvider: 'Upravit vlastního poskytovatele',
    },
    labels: {
      provider: 'Poskytovatel',
      apiKey: 'API klíč',
      ollamaHostUrl: 'Adresa URL hostitele Ollama',
      model: 'Model',
      mode: 'Režim',
      conventionalCommitSections: 'Konvenční sekce potvrzení',
      includeScope: 'Zahrnout rozsah (scope)',
      includeBody: 'Zahrnout tělo (body)',
      includeFooter: 'Zahrnout patičku (footer)',
      language: 'Jazyk rozšíření',
      maxAgentSteps: 'Max. počet kroků agenta',
      providerName: 'Název poskytovatele',
      apiBaseUrl: 'Základní URL API',
    },
    placeholders: {
      selectProvider: 'Vyberte poskytovatele...',
      selectModel: 'Vyberte model...',
      selectGenerateMode: 'Vyberte režim generování...',
      enterApiKey: 'Zadejte svůj API klíč',
      enterGeminiApiKey: 'Zadejte svůj Gemini API klíč',
      enterOpenAIApiKey: 'Zadejte svůj OpenAI API klíč',
      enterAnthropicApiKey: 'Zadejte svůj Anthropic API klíč',
      enterCustomApiKey: 'Zadejte svůj API klíč',
    },
    buttons: {
      save: 'Uložit',
      validating: 'Ověřování...',
      generateCommitMessage: 'Generovat zprávu k potvrzení',
      cancelGenerating: 'Zrušit generování',
      back: 'Zpět',
      editProvider: 'Upravit poskytovatele',
      addProvider: '+ Přidat poskytovatele...',
      deleteProvider: 'Smazat poskytovatele',
    },
    statuses: {
      checkingStatus: 'Kontrola stavu...',
      configured: 'Nakonfigurováno',
      notConfigured: 'Nenakonfigurováno',
      validating: 'Ověřování...',
      loadingConfiguration: 'Načítání konfigurace...',
      noChangesDetected: 'Nebyly zjištěny žádné změny',
      cancelCurrentGeneration: 'Zrušit aktuální generování',
      languageSaved: 'Jazyk byl aktualizován.',
      providerNameConflict: 'Poskytovatel s tímto názvem již existuje.',
      providerNameRequired: 'Je vyžadován název poskytovatele.',
      baseUrlRequired: 'Je vyžadována základní adresa URL API.',
      apiKeyRequired: 'Je vyžadován API klíč.',
      providerSaved: 'Vlastní poskytovatel byl uložen!',
      providerDeleted: 'Vlastní poskytovatel byl smazán.',
      modelNameRequired: 'Před generováním zadejte prosím název modelu.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama je pevně nastavena na režim Direct Diff',
      agenticModeDescription:
        'Režim Agentic používá nástroje repozitáře k hlubší analýze',
      directDiffDescription:
        'Direct Diff odesílá nezpracovaný diff přímo do modelu',
      ollamaInfo:
        '<strong>Ollama</strong> běží lokálně na vašem počítači.<br>Výchozí hostitel: <code>{host}</code><br>Před generováním se ujistěte, že je Ollama spuštěna.',
      googleInfo:
        'Získejte API klíč v <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Získejte API klíč v <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Získejte API klíč v <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Omezí volání nástrojů agenta za jedno generování. Zadejte 0 nebo nechte prázdné pro neomezený počet.',
      customProviderInfo:
        'Vlastní poskytovatelé musí být kompatibilní s <strong>OpenAI</strong>.<br>Základní adresa URL rozhraní API by měla ukazovat na službu, která implementuje rozhraní OpenAI Chat Completions API.',
    },
    options: {
      agentic: 'Agentic generování',
      directDiff: 'Direct Diff (přímý rozdíl)',
    },
  },
  progressMessages: {
    analyzingChanges: 'Agent analyzuje změny...',
    generatingMessage: 'Generování zprávy k potvrzení...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Přechodná chyba API. Probíhá nový pokus (${attempt}/${maxAttempts}) za ${seconds}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Stahování ${model}: ${status} (${percent}%)`
        : `Stahování ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) => `[Krok ${step}] Analýza diffu: ${path}`,
    stepReadingFile: (step, path) => `[Krok ${step}] Čtení souboru: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Krok ${step}] Získávání osnovy: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Krok ${step}] Hledání referencí: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Krok ${step}] Načítání nedávných potvrzení: ${count} záznamů`
        : `[Krok ${step}] Načítání nedávných potvrzení...`,
    stepSearchingProject: (step, keyword) =>
      `[Krok ${step}] Prohledávání projektu na: ${keyword}`,
    stepCalling: (step, toolName) => `[Krok ${step}] Volání ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Krok ${step}] Analýza diffů: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Krok ${step}] Analýza diffů pro ${count} souborů...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Krok ${step}] Čtení souborů: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Krok ${step}] Čtení ${count} souborů...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Krok ${step}] Získávání osnov: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Krok ${step}] Získávání osnov pro ${count} souborů...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Krok ${step}] Hledání referencí: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Krok ${step}] Hledání referencí pro ${count} symbolů...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Krok ${step}] Prohledávání projektu na: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Krok ${step}] Prohledávání projektu pro ${count} klíčových slov...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Krok ${step}] Spouštění ${count} vyšetřovacích nástrojů...`,
  },
};
