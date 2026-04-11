import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const idLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Bukan repositori Git',
      action: 'Silakan buka folder yang berisi repositori Git.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Gagal melakukan stage perubahan',
      action: 'Periksa apakah Git dikonfigurasi dengan benar.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'Tidak ada perubahan untuk dikomit',
      action: 'Lakukan beberapa perubahan pada file Anda terlebih dahulu.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'Tidak ada perubahan yang di-stage terdeteksi',
      action:
        'File yang tidak dilacak ditemukan. Silakan stage untuk menghasilkan pesan komit.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Hanya file yang tidak dilacak ditemukan',
      action:
        'Anda memiliki file yang baru dibuat tetapi tidak ada modifikasi yang dilacak. Silakan stage untuk menghasilkan komit.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Pembuatan dibatalkan',
      action: 'Pembuatan dibatalkan oleh pengguna.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Perubahan campuran terdeteksi',
      action:
        'Anda memiliki perubahan yang di-stage dan belum di-stage. Silakan pilih bagaimana untuk melanjutkan.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API Key tidak dikonfigurasi',
      action: 'Silakan atur API Key Anda di panel Commit-Copilot.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'API Key tidak valid',
      action:
        'API Key Anda tidak valid atau telah dicabut. Silakan periksa dan perbarui.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'Kuota API terlampaui',
      action:
        'Anda telah melampaui kuota API Anda. Silakan periksa akun penyedia Anda.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'Permintaan API gagal',
      action:
        'Terjadi kesalahan saat berkomunikasi dengan API. Silakan coba lagi.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Gagal mengkomit perubahan',
      action: 'Periksa apakah ada konflik atau masalah Git.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'Terjadi kesalahan yang tidak terduga',
      action: 'Periksa keluaran "Commit-Copilot Debug" untuk detailnya.',
    },
  },
  extensionText: {
    output: {
      generationIgnored:
        'Permintaan pembuatan diabaikan: pembuatan sedang berlangsung.',
      generationStart: (timestamp) =>
        `[${timestamp}] Memulai pembuatan commit-copilot...`,
      gitExtensionMissing: 'Kesalahan: Ekstensi Git tidak ditemukan.',
      selectedRepoFromScm: (path) =>
        `Repositori yang dipilih dari konteks SCM: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Repositori yang dipilih dari editor aktif: ${path}`,
      noRepoMatchedActiveEditor:
        'Tidak ada repositori yang cocok dengan editor aktif.',
      noActiveEditorForRepoSelection:
        'Tidak ditemukan editor aktif untuk pemilihan repositori.',
      selectedOnlyRepo: (path) => `Hanya memilih repositori: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Ditemukan ${count} repositori tetapi tidak dapat menentukan yang aktif.`,
      noRepoInApi: 'Tidak ada repositori yang ditemukan di API.',
      usingProvider: (providerName) => `Menggunakan penyedia: ${providerName}`,
      usingGenerateMode: (mode) => `Mode pembuatan: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Opsi keluaran komit: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Peringatan: Tidak ada API Key yang ditemukan untuk ${provider}.`,
      cancelRequestedFromProgress: 'Pembatalan diminta dari UI kemajuan.',
      callingGenerateCommitMessage: 'Memanggil generateCommitMessage...',
      repositoryPath: (path) => `Jalur repositori: ${path}`,
      usingModel: (model) => `Menggunakan model: ${model}`,
      generatedMessage: (message) => `Pesan yang dihasilkan: ${message}`,
      generationError: (errorCode, message) =>
        `Kesalahan: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Kesalahan tidak terduga: ${message}`,
      openingLanguageSettings:
        'Membuka pengaturan bahasa di tampilan aktivitas...',
    },
    notification: {
      gitExtensionMissing:
        'Ekstensi Git tidak ditemukan. Pastikan Git terinstal dan ekstensi Git diaktifkan.',
      multiRepoWarning:
        'Ditemukan beberapa repositori Git. Silakan fokus pada file di repositori target atau jalankan dari tampilan SCM.',
      repoNotFound:
        'Tidak ada repositori Git yang ditemukan. Silakan buka folder yang berisi repositori Git.',
      apiKeyMissing: (providerName) =>
        `API Key ${providerName} tidak dikonfigurasi. Silakan atur API Key Anda di panel Commit-Copilot terlebih dahulu.`,
      configureApiKeyAction: 'Konfigurasi API Key',
      mixedChangesQuestion:
        'Anda memiliki perubahan yang di-stage dan belum di-stage. Bagaimana Anda ingin melanjutkan?',
      stageAllAndGenerate: 'Stage Semua & Hasilkan',
      proceedStagedOnly: 'Lanjutkan dengan yang Di-stage Saja',
      cancel: 'Batal',
      noStagedButUntrackedQuestion:
        'Tidak ada perubahan yang di-stage terdeteksi. File yang tidak dilacak ditemukan. Apakah Anda ingin men-stage semua file (termasuk yang tidak dilacak) atau hanya menghasilkan untuk file yang dilacak yang dimodifikasi?',
      stageAndGenerateAll: 'Stage & Hasilkan Semua',
      generateTrackedOnly: 'Hasilkan yang Dilacak Saja',
      onlyUntrackedQuestion:
        'Hanya ada file yang tidak dilacak dengan tidak ada modifikasi yang dilacak. Apakah Anda ingin men-stage dan melacak file-file baru ini untuk menghasilkan komit?',
      stageAndTrack: 'Stage & Lacak',
      commitGenerated: 'Pesan komit berhasil dihasilkan!',
      viewProviderConsoleAction: 'Lihat Konsol Penyedia',
      noChanges:
        'Tidak ada perubahan untuk dikomit. Lakukan beberapa perubahan terlebih dahulu!',
      generationCanceled: 'Pembuatan pesan komit dibatalkan.',
      failedPrefix: 'Commit-Copilot gagal',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'API Key tidak valid',
    quotaExceededPrefix: 'Kuota API terlampaui',
    apiRequestFailedPrefix: 'Permintaan API gagal',
    connectionErrorPrefix: 'Kesalahan koneksi',
    unknownProvider: 'Penyedia tidak diketahui',
    cannotConnectOllamaAt: (host) =>
      `Tidak dapat terhubung ke Ollama di ${host}`,
    cannotConnectOllama: (message) =>
      `Tidak dapat terhubung ke Ollama: ${message}. Pastikan Ollama berjalan.`,
    apiKeyCannotBeEmpty: 'API Key tidak boleh kosong',
    validationFailedPrefix: 'Validasi gagal',
    unableToConnectFallback: 'Tidak dapat terhubung',
    saveConfigSuccess: (providerName) =>
      `Konfigurasi ${providerName} berhasil disimpan!`,
    saveConfigFailed: 'Gagal menyimpan konfigurasi',
    languageSaved: (label) => `Bahasa diperbarui: ${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'Penyedia API',
      configuration: 'Konfigurasi API',
      ollamaConfiguration: 'Konfigurasi Ollama',
      model: 'Model',
      generateConfiguration: 'Konfigurasi Pembuatan',
      settings: 'Pengaturan',
      addProvider: 'Tambahkan Penyedia Kustom',
      editProvider: 'Edit Penyedia Kustom',
    },
    labels: {
      provider: 'Penyedia',
      apiKey: 'API Key',
      ollamaHostUrl: 'URL Host Ollama',
      model: 'Model',
      mode: 'Mode',
      conventionalCommitSections: 'Bagian Conventional Commit',
      includeScope: 'Sertakan Scope',
      includeBody: 'Sertakan Body',
      includeFooter: 'Sertakan Footer',
      language: 'Bahasa Ekstensi',
      maxAgentSteps: 'Maks. Langkah Agen',
      providerName: 'Nama Penyedia',
      apiBaseUrl: 'URL Dasar API',
    },
    placeholders: {
      selectProvider: 'Pilih penyedia...',
      selectModel: 'Pilih model...',
      selectGenerateMode: 'Pilih mode pembuatan...',
      enterApiKey: 'Masukkan API Key Anda',
      enterGeminiApiKey: 'Masukkan API Key Gemini Anda',
      enterOpenAIApiKey: 'Masukkan API Key OpenAI Anda',
      enterAnthropicApiKey: 'Masukkan API Key Anthropic Anda',
      enterCustomApiKey: 'Masukkan API Key Anda',
    },
    buttons: {
      save: 'Simpan',
      validating: 'Memvalidasi...',
      generateCommitMessage: 'Hasilkan Pesan Komit',
      cancelGenerating: 'Batalkan Pembuatan',
      back: 'Kembali',
      editProvider: 'Edit Penyedia',
      addProvider: '+ Tambah Penyedia...',
      deleteProvider: 'Hapus Penyedia',
    },
    statuses: {
      checkingStatus: 'Memeriksa status...',
      configured: 'Dikonfigurasi',
      notConfigured: 'Belum dikonfigurasi',
      validating: 'Memvalidasi...',
      loadingConfiguration: 'Memuat konfigurasi...',
      noChangesDetected: 'Tidak ada perubahan terdeteksi',
      cancelCurrentGeneration: 'Batalkan pembuatan saat ini',
      languageSaved: 'Bahasa diperbarui.',
      providerNameConflict: 'Penyedia dengan nama ini sudah ada.',
      providerNameRequired: 'Nama penyedia diperlukan.',
      baseUrlRequired: 'URL Dasar API diperlukan.',
      apiKeyRequired: 'API Key diperlukan.',
      providerSaved: 'Penyedia kustom disimpan!',
      providerDeleted: 'Penyedia kustom dihapus.',
      modelNameRequired: 'Silakan masukkan nama model sebelum menghasilkan.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama ditetapkan ke mode Direct Diff',
      agenticModeDescription:
        'Mode Agentic menggunakan alat repositori untuk analisis yang lebih dalam',
      directDiffDescription:
        'Direct Diff mengirimkan diff mentah langsung ke model',
      ollamaInfo:
        '<strong>Ollama</strong> berjalan secara lokal di mesin Anda.<br>Host default: <code>{host}</code><br>Pastikan Ollama berjalan sebelum menghasilkan.',
      googleInfo:
        'Dapatkan API key Anda dari <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Dapatkan API key Anda dari <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Dapatkan API key Anda dari <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription:
        'Batasi panggilan alat agenik per pembuatan. Masukkan 0 atau biarkan kosong untuk tidak terbatas.',
      customProviderInfo:
        'Penyedia kustom harus <strong>Kompatibel dengan OpenAI</strong>.<br>URL Dasar API harus mengarah ke layanan yang menerapkan API Chat Completions OpenAI.',
    },
    options: {
      agentic: 'Agentic Generate',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    analyzingChanges: 'Agen sedang menganalisis perubahan...',
    generatingMessage: 'Menghasilkan pesan komit...',
    transientApiError: (attempt, maxAttempts, seconds) =>
      `Kesalahan API sementara. Mencoba kembali (${attempt}/${maxAttempts}) dalam ${seconds}s...`,
    pulling: (model, status, percent) =>
      percent !== undefined
        ? `Menarik ${model}: ${status} (${percent}%)`
        : `Menarik ${model}: ${status}`,

    stepAnalyzingDiff: (step, path) =>
      `[Langkah ${step}] Menganalisis diff: ${path}`,
    stepReadingFile: (step, path) => `[Langkah ${step}] Membaca file: ${path}`,
    stepGettingOutline: (step, path) =>
      `[Langkah ${step}] Mendapatkan outline: ${path}`,
    stepFindingReferences: (step, target) =>
      `[Langkah ${step}] Mencari referensi: ${target}`,
    stepFetchingRecentCommits: (step, count) =>
      count !== undefined
        ? `[Langkah ${step}] Mengambil komit terbaru: ${count} entri`
        : `[Langkah ${step}] Mengambil komit terbaru...`,
    stepSearchingProject: (step, keyword) =>
      `[Langkah ${step}] Mencari proyek untuk: ${keyword}`,
    stepCalling: (step, toolName) =>
      `[Langkah ${step}] Memanggil ${toolName}...`,

    stepAnalyzingMultipleDiffs: (step, paths) =>
      `[Langkah ${step}] Menganalisis diff: ${paths}`,
    stepAnalyzingDiffsForCount: (step, count) =>
      `[Langkah ${step}] Menganalisis diff untuk ${count} file...`,
    stepReadingMultipleFiles: (step, paths) =>
      `[Langkah ${step}] Membaca file: ${paths}`,
    stepReadingFilesForCount: (step, count) =>
      `[Langkah ${step}] Membaca ${count} file...`,
    stepGettingMultipleOutlines: (step, paths) =>
      `[Langkah ${step}] Mendapatkan outline: ${paths}`,
    stepGettingOutlinesForCount: (step, count) =>
      `[Langkah ${step}] Mendapatkan outline untuk ${count} file...`,
    stepFindingReferencesForMultiple: (step, targets) =>
      `[Langkah ${step}] Mencari referensi: ${targets}`,
    stepFindingReferencesForCount: (step, count) =>
      `[Langkah ${step}] Mencari referensi untuk ${count} simbol...`,
    stepSearchingProjectForMultiple: (step, keywords) =>
      `[Langkah ${step}] Mencari proyek untuk: ${keywords}`,
    stepSearchingProjectForCount: (step, count) =>
      `[Langkah ${step}] Mencari proyek untuk ${count} kata kunci...`,
    stepExecutingMultipleTools: (step, count) =>
      `[Langkah ${step}] Mengeksekusi ${count} alat investigasi...`,
  },
};
