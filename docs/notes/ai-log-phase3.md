# Nhật ký AI - Phase 3 (dán vào `ai-log.md` đúng bảng Phase 3 và "Lần AI sai")

## Dòng cho bảng "Dùng AI" (điền số thật của bạn vào chỗ TODO)

| Phase | Công cụ / model | Token hoặc chi phí | Việc chính | Cách tiết kiệm |
|---|---|---|---|---|
| 3 | Claude (claude.ai, Claude Sonnet 5.5) | **TODO(tôi): số Usage thật hoặc "ước tính" kèm cách tính** | Ticket-03: nhiên liệu đèn, Bóng Mực `drain`, thắng ở bình minh, sức chứa động, điểm mới, bảng màu dễ phân biệt; Contract v1.2; 18 test mới, sửa 9 test cũ có lý do; ADR + CHANGELOG | Dán nguyên văn ticket một lần; giữ nguyên thứ tự lõi → test → tài liệu → giao diện; bot tự chơi để đo cân bằng thay vì chơi tay |

## Dòng cho bảng "Lần AI sai"

| Phase | AI sai ở đâu | Phát hiện bằng cách nào | Chỉnh harness thế nào |
|---|---|---|---|
| 3 | Bản đầu cho Bóng Mực wander đi tới đèn tắt gần nhất: bóng đứng chắn đèn, bot thắng 1/20 | Chạy bot, in dòng sự kiện một seed: mang đủ 10 đom đóm cả đêm mà không thắp được | Hoàn lại lang thang như Phase 2 (P3-3), ghi vào ADR |
| 3 | Bot ưu tiên châm dầu đèn còn nhiều, nên chỉ thắp được 3 đèn khi cần 4 | Trace sự kiện: nhiều `refuel`, ít `lantern_lit` | Viết lại mục tiêu bot theo kinh tế (thắp tới đủ ngưỡng, chỉ châm khi sắp cạn) và chỉ thắp ở ~90–140 s cuối |
| 3 | Bot cắt chéo khỏi cầu tre khi đổi mục tiêu giữa cầu (rơi, mất lửa) | Trace: `player_hit by fall` | Thêm luật: đang trên cầu thì đi hết cầu rồi mới rẽ |
| 3 | Test nhặt đom đóm đặt 14 đom đóm cách nhau 0.1 m nên chỉ 11 cái nằm trong bán kính nhặt 1 m | Test đỏ (11 thay vì 14) | Đổi khoảng cách 0.05 m |
| 3 | Kỳ vọng `fuel_drain` ở tick 60 và `fuel` 14.0, nhưng bóng vào `drain` sau bước trừ dầu của tick 1 | Test đỏ, đọc snapshot | Sửa kỳ vọng (61, 121; 59 tick hút) và ghi P3-5 |
