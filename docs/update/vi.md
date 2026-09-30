# Thông tin cập nhật Commit Copilot

## Tính năng mới trong Phiên bản 1.20.0

- Sửa lỗi lệnh gọi công cụ tại điểm cuối OpenAI bị thất bại do các từ khóa schema không được hỗ trợ, làm sạch chính xác schema tham số công cụ cho lệnh gọi hàm và Responses API.
- Tắt chế độ thinking của Ollama trong các yêu cầu Agent và Direct Diff để đảm bảo nội dung thông điệp commit và lệnh gọi công cụ được trả về.
- Sửa lỗi lệnh gọi công cụ Google Gemini bị thất bại bằng cách truyền chính xác các tham số khai báo hàm qua trường JSON Schema gốc.
- Thêm hỗ trợ cho Gemini 3.8 Flash trong nhà cung cấp Google Gemini và nâng cấp mô hình Google mặc định thành Gemini 3.8 Flash.
- Thêm hỗ trợ cho GPT-6 Astra trong nhà cung cấp OpenAI.
- Thêm hỗ trợ cho Claude Fable 5.1 trong nhà cung cấp Anthropic Claude.
- Cập nhật danh mục mô hình DeepSeek với DeepSeek V4.1 Flash, đồng thời loại bỏ các mô hình không còn được hỗ trợ.
- Thêm hỗ trợ cho GPT-6 Luna, GPT-6 Sol và GPT-6.1 Sol trong nhà cung cấp OpenAI, đồng thời nâng cấp mô hình OpenAI mặc định thành GPT-6.1 Sol.
- Thêm hỗ trợ cho Claude Opus 5.5 trong nhà cung cấp Anthropic Claude.
- Thêm hỗ trợ cho Grok 4.7 trong nhà cung cấp xAI Grok.
- Cập nhật danh mục mô hình Groq với Qwen 3.8 27b, đồng thời loại bỏ các mô hình không còn được hỗ trợ.
