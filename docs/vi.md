# Thông tin cập nhật Commit Copilot

## Tính năng mới trong Phiên bản 1.18.0

- Thêm hỗ trợ truy vấn diff của nhiều tệp trong một yêu cầu công cụ duy nhất và trả về diff chính xác, đầy đủ của từng tệp được yêu cầu.
- Thêm tùy chọn bao phủ diff đầy đủ, mặc định tắt; khi bật, tùy chọn này yêu cầu kiểm tra tất cả các tệp đã thay đổi trước khi hoàn tất thông điệp commit.
- Sửa lỗi hủy yêu cầu để ngắt ngay lập tức các kết nối HTTP đang hoạt động tới các nhà cung cấp LLM khi việc tạo bị hủy.
