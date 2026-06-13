# Informasi Pembaruan Commit Copilot

## Fitur Baru di Versi 1.14.0

- Dukungan mode proksi Ollama: Memperkenalkan protokol alat agen teks untuk menghapus mekanisme cadangan Direct Diff yang dipaksakan, dan mendukung pembatalan proses pengunduhan (Pull) model Ollama saat pembuatan dibatalkan.
- Dukungan penyedia kustom Anthropic: Memungkinkan konfigurasi endpoint kustom dengan format API Anthropic, konfigurasi token output maksimum, mengoptimalkan urutan input bidang baru, dan memigrasikan pengaturan lama secara otomatis.
- Modularisasi arsitektur inti: Memisahkan komponen inti seperti orkestrasi pembuatan, operasi Git, manajemen model, dan protokol webview menjadi modul independen, serta memodularisasi prompt bahasa untuk meningkatkan performa pemuatan.
- Penyederhanaan nama tampilan penyedia: Memperbaiki label penyedia bawaan menjadi nama yang lebih bersih.
- Perbaikan label bahasa UI: Mengubah label tindakan pemilih model dari "Tambah Model" menjadi "Kelola Model..." agar lebih sesuai dengan tampilan fitur.
- Pembaruan dan pengoptimalan dokumentasi README.md serta contoh konfigurasi.
