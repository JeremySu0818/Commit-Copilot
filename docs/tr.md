# Commit Copilot Güncelleme Bilgisi

## Sürüm 1.14.0 ile Gelen Yenilikler

- Ollama proxy modu desteği: Zorunlu Direct Diff geri dönüş mekanizmasını kaldırmak için metin aracı protokolleri tanıtıldı ve üretim iptal edildiğinde Ollama modeli indirme (Pull) işleminin durdurulması desteklendi.
- Anthropic özel sağlayıcı desteği: Anthropic API biçimindeki özel uç noktaların ayarlanmasına, maksimum çıktı belirteci (token) yapılandırılmasına izin verildi; yeni alanların giriş sırası optimize edildi ve eski ayarlar otomatik olarak taşındı.
- Çekirdek mimari modülerleştirildi: Üretim yönetimi, Git işlemleri, model yönetimi ve webview protokolleri gibi temel bileşenler bağımsız modüllere ayrıldı ve yükleme performansını artırmak için dil promptları modülerleştirildi.
- Sağlayıcı görünen adları sadeleştirildi: Yerleşik sağlayıcı etiketleri daha temiz adlarla düzeltildi.
- Arayüz dil etiketleri düzeltildi: Model seçici işlem etiketi, işlev ekranıyla daha uyumlu olması için "Model Ekle"den "Modelleri Yönet..." olarak düzeltildi.
- README.md belgeleri ve yapılandırma örnekleri güncellendi ve optimize edildi.
