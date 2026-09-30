# Informasi Pembaruan Commit Copilot

## Fitur Baru di Versi 1.20.0

- Memperbaiki masalah kegagalan pemanggilan alat pada endpoint OpenAI akibat kata kunci skema yang tidak didukung, dengan membersihkan skema parameter untuk pemanggilan fungsi dan Responses API secara benar.
- Menonaktifkan mode thinking Ollama pada permintaan Agent dan Direct Diff untuk memastikan pesan commit dan pemanggilan alat ditampilkan dengan benar.
- Memperbaiki masalah kegagalan pemanggilan alat di Google Gemini dengan meneruskan parameter deklarasi fungsi secara benar melalui kolom JSON Schema mentah.
- Menambahkan dukungan untuk Gemini 3.8 Flash di penyedia Google Gemini dan memperbarui model default Google ke Gemini 3.8 Flash.
- Menambahkan dukungan untuk GPT-6 Astra di penyedia OpenAI.
- Menambahkan dukungan untuk Claude Fable 5.1 di penyedia Anthropic Claude.
- Memperbarui katalog model DeepSeek dengan DeepSeek V4.1 Flash, serta menghapus model yang sudah usang.
- Menambahkan dukungan untuk GPT-6 Luna, GPT-6 Sol, dan GPT-6.1 Sol di penyedia OpenAI, serta memperbarui model default OpenAI ke GPT-6.1 Sol.
- Menambahkan dukungan untuk Claude Opus 5.5 di penyedia Anthropic Claude.
- Menambahkan dukungan untuk Grok 4.7 di penyedia xAI Grok.
- Memperbarui katalog model Groq dengan Qwen 3.8 27b, serta menghapus model yang sudah usang.
