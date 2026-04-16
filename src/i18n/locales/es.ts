import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const esLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'No es un repositorio Git',
      action: 'Por favor abre una carpeta que contenga un repositorio Git.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Error al preparar cambios',
      action: 'Comprueba si Git está configurado correctamente.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Sin cambios para hacer commit',
      action: 'Haz algunos cambios en tus archivos primero.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'No se detectaron cambios preparados',
      action:
        'Se encontraron archivos no rastreados. Por favor, prepáralos para generar un mensaje de commit.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Solo se encontraron archivos no rastreados',
      action:
        'Tienes archivos recién creados pero no modificaciones rastreadas. Por favor, prepáralos para generar un commit.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Generación cancelada',
      action: 'La generación fue cancelada por el usuario.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Cambios mixtos detectados',
      action:
        'Tienes cambios preparados y no preparados. Por favor elige cómo proceder.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'Clave de API no configurada',
      action:
        'Por favor, configura tu Clave API en el panel de Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Clave de API no válida',
      action:
        'Tu Clave API no es válida o ha sido revocada. Por favor, compruébala y actualízala.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'Se excedió la cuota de la API',
      action:
        'Has excedido tu cuota de API. Por favor, comprueba tu cuenta de proveedor.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'Falló la solicitud a la API',
      action:
        'Hubo un error al comunicarse con la API. Por favor, inténtalo de nuevo.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Error al hacer commit de los cambios',
      action: 'Comprueba si hay conflictos o problemas en Git.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Ocurrió un error inesperado',
      action: 'Revisa la salida de "Commit-Copilot Debug" para más detalles.',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Solicitud de generación ignorada: la generación ya está en curso.',
      generationStart: (timestamp) =>
        `[${timestamp}] Iniciando la generación de commit-copilot...`,
      gitExtensionMissing: 'Error: No se encontró la extensión de Git.',
      selectedRepoFromScm: (path) =>
        `Repositorio seleccionado desde el contexto SCM: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Repositorio seleccionado desde el editor activo: ${path}`,
      noRepoMatchedActiveEditor:
        'Ningún repositorio coincidió con el editor activo.',
      noActiveEditorForRepoSelection:
        'No se encontró editor activo para la selección de repositorio.',
      selectedOnlyRepo: (path) => `Seleccionado único repositorio: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Se encontraron ${String(count)} repositorios pero no se pudo determinar el activo.`,
      noRepoInApi: 'No se encontraron repositorios en la API.',
      usingProvider: (providerName) => `Usando proveedor: ${providerName}`,
      usingGenerateMode: (mode) => `Modo de generación: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Opciones de salida del commit: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Advertencia: No se encontró Clave API para ${provider}.`,
      cancelRequestedFromProgress:
        'Se solicitó cancelación desde la interfaz de progreso.',
      callingGenerateCommitMessage: 'Llamando generateCommitMessage...',
      repositoryPath: (path) => `Ruta del repositorio: ${path}`,
      usingModel: (model) => `Usando modelo: ${model}`,
      generatedMessage: (message) => `Mensaje generado: ${message}`,
      generationError: (errorCode, message) =>
        `Error: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Error inesperado: ${message}`,
      openingLanguageSettings:
        'Abriendo configuración de idioma en la vista de actividad...',
    },
    notification: {
      gitExtensionMissing:
        'No se encontró la extensión de Git. Asegúrate de que Git esté instalado y la extensión de Git esté activada.',
      multiRepoWarning:
        'Se encontraron múltiples repositorios Git. Por favor, enfoca un archivo en el repositorio deseado o ejecútalo desde la vista SCM.',
      repoNotFound:
        'No se encontró repositorio Git. Por favor abre una carpeta que contenga un repositorio Git.',
      apiKeyMissing: (providerName) =>
        `La Clave API de ${providerName} no está configurada. Por favor configura tu Clave API en el panel de Commit-Copilot primero.`,
      configureApiKeyAction: 'Configurar Clave API',
      mixedChangesQuestion:
        'Tienes cambios preparados y no preparados. ¿Cómo te gustaría proceder?',
      stageAllAndGenerate: 'Preparar Todos y Generar',
      proceedStagedOnly: 'Proceder solo con Preparados',
      cancel: 'Cancelar',
      noStagedButUntrackedQuestion:
        'No se detectaron cambios preparados. Se encontraron archivos no rastreados. ¿Te gustaría preparar todos los archivos (incluidos los no rastreados) o generar solo para los modificados rastreados?',
      stageAndGenerateAll: 'Preparar y Generar Todos',
      generateTrackedOnly: 'Generar solo Rastreados',
      onlyUntrackedQuestion:
        'Solo archivos no rastreados están presentes sin modificaciones rastreadas. ¿Quieres preparar y rastrear estos nuevos archivos para generar un commit?',
      stageAndTrack: 'Preparar y Rastrear',
      commitGenerated: '¡Mensaje de commit generado!',
      viewProviderConsoleAction: 'Ver Consola del Proveedor',
      noChanges: 'Sin cambios para hacer commit. ¡Haz algunos cambios primero!',
      generationCanceled: 'Generación de mensaje de commit cancelada.',
      failedPrefix: 'Commit-Copilot falló',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'Clave API no válida',
    quotaExceededPrefix: 'Cuota de API excedida',
    apiRequestFailedPrefix: 'Falló la solicitud a la API',
    connectionErrorPrefix: 'Error de conexión',
    unknownProvider: 'Proveedor desconocido',
    cannotConnectOllamaAt: (host) => `No se puede conectar a Ollama en ${host}`,
    cannotConnectOllama: (message) =>
      `No se puede conectar a Ollama: ${message}. Asegúrate de que Ollama esté en ejecución.`,
    apiKeyCannotBeEmpty: 'La clave API no puede estar vacía',
    validationFailedPrefix: 'Validación fallida',
    unableToConnectFallback: 'No se puede conectar',
    saveConfigSuccess: (providerName) =>
      `¡Configuración de ${providerName} guardada con éxito!`,
    saveConfigFailed: 'Error al guardar la configuración',
    languageSaved: (label) => `Idioma actualizado: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'Proveedor de API',
      configuration: 'Configuración de API',
      ollamaConfiguration: 'Configuración de Ollama',
      model: 'Modelo',
      generateConfiguration: 'Configuración de Generación',
      settings: 'Ajustes',
      addProvider: 'Añadir Proveedor Personalizado',
      editProvider: 'Editar Proveedor Personalizado',
    },
    labels: {
      provider: 'Proveedor',
      apiKey: 'Clave API',
      ollamaHostUrl: 'URL del Host de Ollama',
      model: 'Modelo',
      mode: 'Modo',
      conventionalCommitSections: 'Secciones de Commit Convencional',
      includeScope: 'Incluir Ámbito',
      includeBody: 'Incluir Cuerpo',
      includeFooter: 'Incluir Pie',
      language: 'Idioma de Extensión',
      maxAgentSteps: 'Pasos Máximos del Agente',
      providerName: 'Nombre del Proveedor',
      apiBaseUrl: 'URL Base de API',
    },
    placeholders: {
      selectProvider: 'Selecciona un proveedor...',
      selectModel: 'Selecciona un modelo...',
      selectGenerateMode: 'Selecciona modo de generación...',
      enterApiKey: 'Introduce tu Clave API',
      enterGeminiApiKey: 'Introduce tu Gemini API Key',
      enterOpenAIApiKey: 'Introduce tu OpenAI API Key',
      enterAnthropicApiKey: 'Introduce tu Anthropic API Key',
      enterCustomApiKey: 'Introduce tu Clave API',
    },
    buttons: {
      save: 'Guardar',
      validating: 'Validando...',
      generateCommitMessage: 'Generar Mensaje de Commit',
      cancelGenerating: 'Cancelar Generación',
      back: 'Atrás',
      editProvider: 'Editar Proveedor',
      addProvider: '+ Añadir Proveedor...',
      deleteProvider: 'Borrar Proveedor',
    },
    statuses: {
      checkingStatus: 'Comprobando estado...',
      configured: 'Configurado',
      notConfigured: 'No configurado',
      validating: 'Validando...',
      loadingConfiguration: 'Cargando configuración...',
      noChangesDetected: 'No se detectaron cambios',
      cancelCurrentGeneration: 'Cancelar generación actual',
      languageSaved: 'Idioma actualizado.',
      providerNameConflict: 'Ya existe un proveedor con este nombre.',
      providerNameRequired: 'El nombre del proveedor es obligatorio.',
      baseUrlRequired: 'La URL Base de API es obligatoria.',
      apiKeyRequired: 'La clave API es obligatoria.',
      providerSaved: '¡Proveedor personalizado guardado!',
      providerDeleted: 'Proveedor personalizado borrado.',
      modelNameRequired:
        'Por favor, introduce un nombre de modelo antes de generar.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama está fijado al modo Direct Diff',
      agenticModeDescription:
        'El modo Agente utiliza herramientas del repositorio para análisis profundo',
      directDiffDescription:
        'Direct Diff envía el diff en bruto directamente al modelo',
      ollamaInfo:
        '<strong>Ollama</strong> se ejecuta localmente en tu máquina.<br>Host por defecto: <code>{host}</code><br>Asegúrate de que Ollama esté en ejecución antes de generar.',
      googleInfo:
        'Obtén tu clave de API en <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Obtén tu clave de API en <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Obtén tu clave de API en <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Límite de llamadas de herramientas del agente por generación. Introduce 0 o deja vacío para ilimitado.',
      customProviderInfo:
        'Los proveedores personalizados deben ser <strong>compatibles con OpenAI</strong>.<br>La URL Base de API debe apuntar a un servicio que implemente la API de OpenAI Chat Completions.',
    },
    options: {
      agentic: 'Generación de Agente',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'Agente analizando cambios...',
    generatingMessage: 'Generando mensaje de commit...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Error transitorio de API. Reintentando (${String(attempt)}/${String(maxAttempts)}) en ${String(seconds)}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Descargando ${model}: ${status} (${String(percent)}%)`
        : `Descargando ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Paso ${String(step)}] Analizando diff: ${path}`,
    stepReadingFile: (step, path) => `[Paso ${String(step)}] Leyendo archivo: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Paso ${String(step)}] Obteniendo esquema: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Paso ${String(step)}] Encontrando referencias: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Paso ${String(step)}] Obteniendo commits recientes: ${String(count)} entradas`
        : `[Paso ${String(step)}] Obteniendo commits recientes...`,
    stepSearchingProject: (step, keyword) =>
      `[Paso ${String(step)}] Buscando en el proyecto: ${keyword}`,
    stepCalling: (step, toolName) => `[Paso ${String(step)}] Llamando ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Paso ${String(step)}] Analizando diffs: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Paso ${String(step)}] Analizando diffs para ${String(count)} archivos...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Paso ${String(step)}] Leyendo archivos: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Paso ${String(step)}] Leyendo ${String(count)} archivos...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Paso ${String(step)}] Obteniendo esquemas: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Paso ${String(step)}] Obteniendo esquemas para ${String(count)} archivos...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Paso ${String(step)}] Encontrando referencias: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Paso ${String(step)}] Encontrando referencias para ${String(count)} símbolos...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Paso ${String(step)}] Buscando en el proyecto: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Paso ${String(step)}] Buscando en el proyecto ${String(count)} palabras clave...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Paso ${String(step)}] Ejecutando ${String(count)} herramientas de investigación...`,
  },
};
