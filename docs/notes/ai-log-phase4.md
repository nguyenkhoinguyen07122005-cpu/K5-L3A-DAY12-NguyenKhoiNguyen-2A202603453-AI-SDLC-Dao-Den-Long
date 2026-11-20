# Nhật ký AI - Phase 4 (dán vào `ai-log.md`)

| Phase | Công cụ / model | Token hoặc chi phí | Việc chính | Cách tiết kiệm |
|---|---|---|---|---|
| 4 | Claude (claude.ai, Claude Sonnet 5.5) | **TODO(tôi): số Usage thật (chụp màn hình Settings → Usage trước/sau Phase 4)** | Contract v1.3; bảng xếp hạng + xuất; soak; bench trong trình duyệt thật; đổi phím, phụ đề, giảm chuyển động, chữ lớn; đóng gói và tài liệu | Giữ thứ tự lõi → script → giao diện → tài liệu; dùng InstancedMesh thay vì tối ưu mò; kiểm giao diện bằng Playwright thay vì chơi tay |

## Lần AI sai

| Phase | AI sai ở đâu | Phát hiện bằng cách nào | Chỉnh harness thế nào |
|---|---|---|---|
| 4 | Soak đầu đo RSS ngay khi vào, tỉ lệ 2,8× dù không rò rỉ | Chạy thật, so `mem_start`/`mem_end` | Khởi động tới khi RSS ổn định, ghi vào P4-3 |
| 4 | Bench đầu vẽ ~1000 draw call (từng Bóng Mực một) nên rất chậm | Số khung hình/giây thấp trong môi trường phần mềm | Chuyển sang InstancedMesh |
| 4 | Dự định ghi `peak_mem_mb` bằng số suy đoán | Đọc lại ticket: cho phép `null` kèm giải thích | Ghi `null` và `notes` (P4-7) |
