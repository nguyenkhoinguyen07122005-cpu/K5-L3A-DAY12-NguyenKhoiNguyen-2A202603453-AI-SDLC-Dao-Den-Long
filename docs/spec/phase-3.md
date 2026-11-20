# Spec Phase 3: Đèn cạn dầu (Ticket-03, Contract v1.2)

Tiêu chí chấp nhận (AC) dưới đây là bản dịch từng luật của ticket thành điều kiện kiểm được bằng CLI headless. Mỗi AC có ít nhất một test nhãn `[AC-xx]` trong `tests/v12.test.mjs` (riêng AC-33 nằm trong `tests/v11.test.mjs`). Quyết định thiết kế: `docs/adr/0001-trang-thai-den-va-luat-thang.md`.

| AC | Luật | Cách kiểm | Test |
|---|---|---|---|
| AC-70 | Contract v1.2: tuning mới (`fuel_max` 100, `fuel_decay_per_s` 1, `fuel_per_mote` 10, `relight_cost` 5, `win_ratio` 0.6, `drain_per_s` 5, `low_fuel_threshold` 30, `capacity_max` 20), bỏ `per_second_left` | Đọc `game.contract.json` | `[AC-70]`, `[contract]` |
| AC-71 | Đèn hao 1 dầu/giây; `lit:true` trong scenario không có `fuel` → 100 | Snapshot sau 600 tick | `[AC-71]` |
| AC-72 | fuel ≤ 0 → đèn tắt, `deposited` 0, `ever_lit` giữ true, sự kiện `lantern_out` đúng tick | Quét snapshot từng tick | `[AC-72]` |
| AC-73 | Thắp lại (đã từng sáng) tốn 5; +40; `relight:true`; `relit_count`+1; fuel 100 | CLI | `[AC-73]` |
| AC-74 | Thắp lần đầu tốn 10; +100; `relight:false` | CLI | `[AC-74]` |
| AC-75 | Châm dầu: dùng `min(mang, ceil((100−fuel)/10))` đom đóm, +10 dầu mỗi cái, +5 điểm mỗi cái, sự kiện `refuel` | CLI, hai ca (đủ / thiếu đom đóm) | `[AC-75]` |
| AC-76 | Chọn đèn tiếp nhận gần nhất; hòa → id nhỏ | CLI | `[AC-76]` |
| AC-77 | Bóng `wander` đi tới đèn yếu, ≤ 2 m thì `drain`: đứng yên, hút 5/s cộng dồn với hao 1/s, `fuel_drain` mỗi 60 tick; nhiều bóng cộng dồn | CLI | `[AC-77]` ×2 |
| AC-78 | `drain` → `chase` (Mây ≤ 6 m); → `wander` khi đèn được châm ≥ 30 hoặc đèn tắt | CLI | `[AC-78]` |
| AC-79 | Tỏa Sáng trúng bóng `drain`: +15 tổng (thường +5), sang `stunned` | CLI | `[AC-79]` |
| AC-80 | Đèn fuel < 30 mất vùng an toàn; ≥ 30 còn | Vị trí bóng sau 3 tick | `[AC-80]` |
| AC-81 | Châm dầu lên ≥ 30 khi bóng trong 6 m → bóng bị đẩy ra mép, không sát thương | CLI | `[AC-81]` |
| AC-82 | Sức chứa `10 + 2×lần thắp thành công`, tối đa 20; scenario `successful_lights` | Snapshot | `[AC-82]` |
| AC-83 | Nhặt đom đóm theo sức chứa hiện tại | CLI | `[AC-83]` |
| AC-33 | Thắng chỉ ở bình minh, đủ `ceil(0.6×tổng)` (3/5, 4/6, 5/7); thiếu đèn → `dawn`; hết lửa ở tick cuối → `no_flames` | CLI 3 đêm | `[AC-33]` ×2 (v11) |
| AC-84 | Điểm bình minh: +50+floor(fuel) mỗi đèn sáng, +50 mỗi lửa; không thắng sớm | CLI | `[AC-84]`, `[game_over won]` |
| AC-85 | Scenario v1.2 sai định dạng → mã thoát 2 | 4 ca sai + 1 ca đúng | `[AC-85]` |
| AC-86 | Tất định kể cả khi có hút dầu | Hai lần chạy so chuỗi | `[AC-86]` |
| AC-87 | Giao diện: thanh dầu, nhấp nháy dưới 30, đèn tắt bẹp 20%, HUD sức chứa và "cần N đèn", bảng màu dễ phân biệt lưu lại | Chụp màn hình Chrome headless (`docs/proof/phase-3/`) + chơi tay | Thủ công (không ảnh hưởng đầu ra headless; `[purity]`) |
