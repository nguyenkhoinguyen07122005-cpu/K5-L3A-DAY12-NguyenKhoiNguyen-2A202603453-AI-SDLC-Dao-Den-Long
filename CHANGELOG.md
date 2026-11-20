# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/). Mục **PHÁ VỠ** là thay đổi khiến đầu ra headless hoặc hành vi cũ không còn đúng.

## [1.0.0] - Phase 4 "Bình minh" (Contract v1.3, tag `phase-4`, Release `v1.0.0`)

### Thay đổi hợp đồng (không phá vỡ)

- `contract_version` = `"1.3"`; `game.contract.json` thêm `bench_cmd` (`node scripts/bench.mjs`) và `soak_cmd` (`node scripts/soak.mjs`). Mọi yêu cầu v1.0–v1.2 giữ nguyên; đầu ra headless không đổi so với 1.2.0.

### Thêm

- Benchmark `scripts/bench.mjs`: cảnh chuẩn 1280×720 (200 Bóng Mực, 100 đom đóm, 3 đèn, camera quay 15 s/vòng) chạy trong Chrome/Edge thật; ghi `bench.json`.
- Soak `scripts/soak.mjs`: 10 Đêm headless trong một tiến trình, đầu vào ngẫu nhiên; ghi `soak.json`.
- Bảng xếp hạng cục bộ (top 10, lưu đĩa, màn hình trong menu, nhập tên sau khi thắng Đêm 3 hoặc thua), `--export-leaderboard`.
- Hỗ trợ tiếp cận: đổi phím có phát hiện trùng và nút khôi phục, phụ đề và chỉ báo hình ảnh, giảm chuyển động, chữ ≥ 18 px và tùy chọn chữ lớn ×1,25.
- Đóng gói: README đầy đủ, CREDITS, LICENSE, bản phát hành chạy được.

### Sửa

- `peak_mem_mb` của bench là `null` kèm giải thích thay vì số bịa (trình duyệt không cho đọc RSS).

## [1.2.0] - Phase 3 "Đèn cạn dầu" (Contract v1.2, tag `phase-3`)

### PHÁ VỠ (breaking changes)

1. **Luật thắng**: `game_over` thắng chỉ xảy ra ở tick bình minh, lý do mới `dawn_survived`. Lý do `all_lit` **không còn được phát ra**. Thắp đủ đèn không kết thúc đêm.
2. **Điều kiện thắng**: phải còn sống và số đèn sáng ≥ `ceil(0.6 × tổng đèn)` (3/5, 4/6, 5/7). Không đủ → thua `dawn`. Hết Ngọn Lửa (kể cả ở tick cuối) → thua `no_flames`, kiểm tra trước.
3. **Thời lượng đêm**: 300/330/360 s → **240/270/300 s** (`night1/2/3_duration_s`).
4. **Điểm**: nạp đom đóm +10 → **+5**; thêm +40 thắp lại; Tỏa Sáng trúng bóng đang `drain` +15 (tổng); **bỏ** `per_second_left`; khi thắng: mỗi đèn sáng +50 + floor(fuel), mỗi Ngọn Lửa +50. Khóa `tuning.score` đổi: thêm `per_relight`, `per_stun_drain`, `per_dawn_lantern`; xóa `per_second_left`.
5. **Vùng an toàn**: chỉ đèn sáng **và** fuel ≥ 30 mới có vùng an toàn (trước đây mọi đèn sáng).
6. **Sức chứa**: không còn cố định 10; = `10 + 2 × lần thắp thành công`, tối đa 20.
7. **Chọn đèn khi bấm E**: chọn đèn "tiếp nhận" gần nhất (tắt, hoặc sáng nhưng chưa đầy dầu), trước đây chỉ đèn tắt.
8. **Snapshot**: mỗi đèn thêm `fuel`, `ever_lit`, `relit_count`; `player` thêm `capacity`; trạng thái Bóng Mực thêm `drain`.
9. **Sự kiện**: `lantern_lit` thêm `relight`; thêm `refuel`, `lantern_out`, `fuel_drain`; `game_over.reason` thêm `dawn_survived`.
10. **Scenario**: `lit:true` không có `fuel` → fuel 100; thêm `lanterns[].fuel/ever_lit/relit_count`, `player.successful_lights`, `shades[].target_lantern_id`; sai định dạng vẫn thoát mã 2.

### Thêm

- Nhiên liệu đèn: tối đa 100, hao 1/s, châm +10 mỗi đom đóm; cạn thì tắt; thắp lại tốn 5.
- Bóng Mực trạng thái `drain`: đứng yên cách đèn yếu ≤ 2 m, hút 5/s (cộng dồn), chuyển `chase` khi Mây vào 6 m.
- Chỉ Bóng Mực `wander` chọn đèn yếu gần nhất (hòa → id nhỏ).
- Giao diện: thanh dầu trên đèn, nhấp nháy 1 Hz khi dưới 30, đèn tắt bẹp 20% kiểu giấy rách, HUD "đèn sáng (cần N)" và "mang/sức chứa", màn kết quả mới.
- Cài đặt "Bảng màu dễ phân biệt" (lưu lại): viền/mắt Bóng Mực #00B3FF, màu nguy hiểm #FFFFFF kèm ⚠.
- Tài liệu: `docs/adr/0001-…`, `docs/spec/phase-3.md`, `docs/notes/assumptions-phase3.md`.

### Test đã sửa hoặc xóa (có lý do, không bỏ âm thầm)

| Test (nhãn) | Việc làm | Lý do |
|---|---|---|
| `[game_over won]` (contract) | Viết lại | Luật cũ "thắp đèn cuối → thắng ngay, điểm thưởng giây" đã bị thay; test mới kiểm thắng ở bình minh, điểm theo dầu |
| `[game_over lost dawn]` | Đổi tên/mô tả | Vẫn đúng nhưng lý do thua nay là "chưa đủ đèn sáng" |
| `[deposit + lantern_lit]` | Sửa số liệu | Điểm nạp +10→+5; sự kiện thêm `relight:false` |
| `[contract] game.contract.json` | Thêm khóa | Khóa tuning mới; bỏ `per_second_left` |
| `[D]` scenario | Sửa kỳ vọng | Đèn `lit:true` giờ có `fuel:100`, `ever_lit:true`, `relit_count:0` |
| `[AC-01]`, `[AC-02]` (v11) | Sửa số | Thời lượng 240/270/300; score keys; snapshot có `capacity` |
| `[AC-33]` ×2 (v11) | Thay bằng 2 test mới | Thắng khi thắp hết ở tick bình minh không còn; thay bằng thắng-ở-bình-minh + ngưỡng 60% từng đêm |
| `[winnable]` ×2 | Viết lại | Bot phải sống tới bình minh với đủ đèn, không phải "thắp hết"; Đêm 3 chứng minh bằng `successful_lights:3` (xem P3-9) |

Test Phase 1–2 không bị luật mới thay thế vẫn đạt nguyên văn. Tổng: 87 → 105 test.

## [1.1.0] - Phase 2 "Ba hòn đảo" (Contract v1.1)

Số chuẩn Ticket-02, bản đồ Đêm 1–3 (cầu, dốc, bục nhảy, tháp), lướt, rơi/hồi sinh, Gió Lạc, Bùa Gió, gió, tạm dừng. Xem `docs/notes/assumptions-phase2.md`.

## [1.0.0] - Phase 1 (Contract v1.0)

Một đêm, 5 đèn, nhặt/nạp/thắp, Bóng Mực, Tỏa Sáng, headless JSONL, tất định.
