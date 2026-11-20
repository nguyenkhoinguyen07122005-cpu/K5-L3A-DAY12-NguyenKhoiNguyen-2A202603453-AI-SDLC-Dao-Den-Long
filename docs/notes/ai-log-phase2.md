# Nhật ký AI - Phase 2 (dán vào `ai-log.md` đúng bảng Phase 2 và "Lần AI sai")

## Dòng cho bảng "Dùng AI" (điền số thật của bạn vào chỗ TODO)

| Phase | Công cụ / model | Token hoặc chi phí | Việc chính | Cách tiết kiệm |
|---|---|---|---|---|
| 2 | Claude (claude.ai, Claude Sonnet 5.5) | **TODO(tôi): số Usage thật hoặc "ước tính" kèm cách tính** | Số chuẩn Ticket-02, 3 bản đồ (cầu, dốc, bục nhảy, tháp), lướt, rơi/hồi sinh, Gió Lạc, Bùa Gió, gió, tạm dừng; Contract v1.1; 34 test mới; chuỗi 3 Đêm, HUD, âm thanh, cài đặt | Dán nguyên văn ticket một lần; viết lõi + test trước, giao diện sau; bot tự chơi thay cho chơi tay để kiểm bản đồ; dùng Playwright đo FPS thay vì đoán |

## Dòng cho bảng "Lần AI sai"

| Phase | AI sai ở đâu | Phát hiện bằng cách nào | Chỉnh harness thế nào |
|---|---|---|---|
| 2 | Viết test tỏa sáng với bóng đặt ở y=0 và bán kính 5: ticket đo khoảng cách **3D** tới tâm = chân + 0.8 m nên bóng ở sát mép không trúng (test đỏ) | Chạy `npm test`, tái hiện bằng CLI: khoảng cách thực √(25+0.64) > 5 | Sửa test (bóng ở y=0.8), ghi P2-x; spec ghi rõ "3D" |
| 2 | Test choáng đặt `carried: 2` trong khi chi phí tỏa sáng mới là 3, nên tỏa sáng không kích hoạt | Test đỏ, đối chiếu `pulse_cost` | Test đọc số từ `game.contract.json` thay vì số cứng |
| 2 | Giả sử "trần 30 đom đóm" đạt được ở mọi Đêm, nhưng Đêm 1 chỉ có 24 điểm sinh nên tối đa 24 | Test đỏ: số đom đóm dừng ở 24 | Giữ đúng luật "hết điểm trống thì bỏ lượt", ghi P2-6, test cả hai Đêm |
| 2 | Bot né Bóng Mực đẩy chính nó ra khỏi đảo (rơi) và bot Đêm 2 đi thẳng khỏi cầu | Chạy bot 20 seed, thắng 0/20, đọc dòng sự kiện một seed | Chặn hướng né nếu mặt đất phía trước trống, thêm điểm trung gian qua cầu/dốc/bục; có chế độ `--calm` chứng minh mọi đèn tới được |
| 2 | Test "vách tầng 2 không leo được" đặt người chơi sát bục nhảy nên bị bắn lên (y>3) | Test đỏ, in vị trí | Đổi điểm xuất phát; ghi rõ bục nhảy trong spec |
