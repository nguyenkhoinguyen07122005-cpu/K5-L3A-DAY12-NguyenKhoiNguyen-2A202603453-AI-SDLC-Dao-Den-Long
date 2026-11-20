# Spec Phase 4: Bình minh, phát hành v1.0.0 (Ticket-04, Contract v1.3)

AC dưới đây dịch ticket thành điều kiện kiểm được. Phần chạy trên trình duyệt (bench, giao diện) không có test tự động chặt; bằng chứng là `bench.json`, ảnh chụp và chơi thử.

| AC | Yêu cầu | Cách kiểm | Test / bằng chứng |
|---|---|---|---|
| AC-90 | Contract v1.3: `contract_version "1.3"`, thêm `bench_cmd`, `soak_cmd`; khóa v1.0–v1.2 còn nguyên | Đọc `game.contract.json` | `[AC-90]` |
| AC-91 | Mục bảng xếp hạng: `name` 3–12 ký tự `[A-Za-z0-9_]` (chữ có dấu cũng nhận), `score`, `nights_won` 0–3, `achieved_at` ISO 8601 có múi giờ, `seed` | Hàm kiểm trong `src/shared/leaderboard.mjs` | `[AC-91]` ×2 |
| AC-92 | Top 10, điểm giảm dần, hòa thì ai đạt trước đứng trên | Sắp xếp theo thời điểm thật | `[AC-92]` |
| AC-93 | Lưu bền trên đĩa; `--export-leaderboard out.json` → `{"entries":[...]}` đúng thứ tự, thoát 0 | Chạy lệnh thật, khởi động lại máy chủ | `[AC-93]` ×2 |
| AC-94 | Soak: 10 Đêm một tiến trình (1→2→3), Đêm i seed 7+i, đầu vào ngẫu nhiên; `crashes = 0`, `mem_end ≤ 1,2 × mem_start`; tất định | Chạy `--nights 4` trong test; bản đủ 10 Đêm chạy tay, `soak.json` | `[AC-94]` ×2, `soak.json` |
| AC-95 | Bench: cảnh chuẩn 1280×720, 200 Bóng Mực, 100 đom đóm, 3 đèn dầu 100, camera quay 15 s/vòng, khởi động 3 s, đo `--duration` s; đủ khóa JSON, thoát 0 | Chạy `scripts/bench.mjs` bằng Chrome thật | `bench.json`, `docs/media/phase4-bench-scene.png` |
| AC-96 | Giao diện: đổi phím cho 11 hành động, cảnh báo trùng, khôi phục mặc định, lưu | Chơi thử bằng Playwright | Ảnh `phase4-doi-phim.png` |
| AC-97 | Chỉ báo hình ảnh và phụ đề: Bóng Mực xuất hiện (mũi tên ở mép), gió sắp nổi, 10 giây cuối, đèn dưới 30 dầu | Chơi thử | Phụ đề trong game |
| AC-98 | Giảm chuyển động: không rung camera, không chớp màn hình | Cài đặt | Mã `settings.reduceMotion` |
| AC-99 | Chữ UI ≥ 18 px ở 1280×720; tùy chọn ×1,25 | Kiểm CSS và ảnh chụp | `web/index.html` |
| AC-100 | Đóng gói: README, CHANGELOG 4 phase, CREDITS, LICENSE, Release v1.0.0 có bản chạy được | Đọc tài liệu; clone sạch, ≤ 3 lệnh | Release |
