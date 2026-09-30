# Commit Copilot Güncelleme Bilgisi

## Sürüm 1.20.0 ile Gelen Yenilikler

- Desteklenmeyen şema anahtar kelimeleri nedeniyle OpenAI uç nokta araç çağrılarının başarısız olmasına yol açan sorun düzeltildi; fonksiyon çağırma ve Responses API için parametre şemaları doğru şekilde temizlendi.
- Commit mesajlarının ve araç çağrılarının döndürülmesini sağlamak için Agent ve Direct Diff isteklerinde Ollama thinking modu devre dışı bırakıldı.
- Araç parametreleri ham JSON Schema alanı üzerinden aktarılarak Google Gemini araç çağrılarının başarısız olmasına yol açan sorun düzeltildi.
- Google Gemini sağlayıcısı için Gemini 3.8 Flash desteği eklendi ve varsayılan Google modeli Gemini 3.8 Flash olarak güncellendi.
- OpenAI sağlayıcısı için GPT-6 Astra desteği eklendi.
- Anthropic Claude sağlayıcısı için Claude Fable 5.1 desteği eklendi.
- DeepSeek model kataloğu DeepSeek V4.1 Flash ile güncellendi ve kullanım dışı bırakılan modeller kaldırıldı.
- OpenAI sağlayıcısı için GPT-6 Luna, GPT-6 Sol ve GPT-6.1 Sol desteği eklendi ve varsayılan OpenAI modeli GPT-6.1 Sol olarak güncellendi.
- Anthropic Claude sağlayıcısı için Claude Opus 5.5 desteği eklendi.
- xAI Grok sağlayıcısı için Grok 4.7 desteği eklendi.
- Groq model kataloğu Qwen 3.8 27b ile güncellendi ve kullanım dışı bırakılan modeller kaldırıldı.
