# Spec Phase 2 - Ticket-02 "Ba hòn đảo" (Contract v1.1)

Tài liệu này là spec của tôi cho Phase 2. Mỗi mục ở **Phần 3** của ticket có tiêu chí chấp nhận (AC) viết trước khi code; mỗi AC ghi **cách kiểm** (test headless có nhãn `[AC-xx]` trong `tests/v11.test.mjs`, hoặc kiểm tay + ảnh chụp). Nguyên văn ticket nằm ở `docs/notes/assumptions-phase2.md`. Chỗ ticket mơ hồ, tôi chọn một cách hiểu và ghi vào đó (mục "Đổi" và "P2-x").

Thứ tự làm: số chuẩn + bản đồ (lõi) → test headless → tài liệu/bằng chứng → giao diện. Lõi tất định, giao diện chỉ đọc trạng thái.

## A. Số chuẩn và hợp đồng

| AC | Tiêu chí chấp nhận | Cách kiểm |
|---|---|---|
| AC-01 | `game.contract.json` có `contract_version "1.1"`, mọi số khớp Phần 1 (6 m/s, 10 đom đóm, đèn 10, nhặt 1.0, tương tác 2.0, tỏa sáng 3/5/3 s, choáng 2 s, đẩy 4 m, an toàn 6, Bóng 4.0, rơi bật, lướt 14/0.2/1.5, đêm 300/330/360, điểm 10/100/5/2/50) | `[AC-01]` |
| AC-02 | `--night 1\|2\|3`; dòng `night_start {night}` ở tick 0; snapshot có `night`, `wind`, `player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}`, mảng `motes/drifters/charms`; số đèn 5/6/7, giờ 300/330/360 | `[AC-02]` |
| AC-03 | Toạ độ đèn Đêm 1/2/3 đúng bảng bản đồ chuẩn | `[AC-03]` |
| AC-04 | 20 đom đóm ở 20 điểm khác nhau lúc đầu; thêm 1 mỗi 240 tick vào điểm trống; hết điểm trống bỏ lượt (Đêm 1 chỉ có 24 điểm → tối đa 24; Đêm 3 có 30 điểm → đạt trần 30) | `[AC-04]` |
| AC-40 | Scenario/inputs v1.1 sai định dạng → mã thoát 2 (trạng thái lạ, `pause` không phải boolean, `drifters` thiếu `pos`, …); đèn `L6/L7` chỉ hợp lệ ở Đêm 2/3 | `[AC-40]` (2 test) |
| AC-50 | Chạy headless trọn một Đêm (21 600 tick) ≤ 30 s và tất định | `[AC-50]`, `docs/proof/phase-2/perf-fullnight.txt` |

## B. Cơ chế mới theo Phần 3

| AC | Mục Phần 3 | Tiêu chí chấp nhận | Cách kiểm |
|---|---|---|---|
| AC-10 | Lướt | Nhấn `dash` (cạnh lên): 14 m/s trong 12 tick (2.8 m), sự kiện `dash {}`, hồi chiêu 1.5 s tính từ lúc bắt đầu (`dash_cd_s`), nhấn lúc đang hồi bị bỏ qua; đứng yên thì lướt theo hướng đang quay mặt; lướt trên không giữ nguyên độ cao | `[AC-10]` (2 test) |
| AC-11 | Bục nhảy | Đêm 2: đứng vào bục (20,0,18) bay sang đảo B (đỉnh ≈ 4.9 m, ~1.4 s) và đáp xuống an toàn; Đêm 3: bục (0,3,13) đưa lên tầng 2 (Y=6), thắp được L1 | `[AC-11]` (2 test) |
| AC-12 | Bản đồ Đêm 2 | Đi dọc cầu tre sang đảo B không rơi; bước ra khỏi cầu (|z|>2) thì rơi | `[AC-12]` |
| AC-13 | Bản đồ Đêm 3 | Dốc 30° nối tầng 0 lên tầng 1 (Y=3); vách tầng 2 không leo được (bước ra rơi xuống tầng dưới); tháp chuông (bán kính 2) là vật cản | `[AC-13]` |
| AC-14 | Rơi khỏi đảo | Y<−10 xảy ra đúng một lần: −1 Ngọn Lửa, mất hết đom đóm (sự kiện `player_hit by=fall` có `lost`), đợi 60 tick (không nhặt, không bị chạm), hồi sinh ở điểm xuất phát, vận tốc 0, bất tử 90 tick; hết lửa → thua ngay | `[AC-14]` (2 test) |
| AC-15 | Tạm dừng | `pause` (cạnh lên) → sự kiện `paused`, snapshot `state:"paused"`, `tick` vẫn tăng, `sim_tick`/thời gian/hồi chiêu/TTL/spawn đứng yên, input bị bỏ qua; nhấn lại → `resumed` | `[AC-15]` (2 test) |
| AC-16 | Gió mạnh (Đêm 3) | Mỗi 30 s một cơn gió 5 s, hướng ngẫu nhiên từ RNG (biết trước từ lúc báo 2 s, `dir_deg`), đẩy Mây 2 m/s (≈10 m sau 5 s); Đêm 1/2 không có gió | `[AC-16]` (2 test) |
| AC-20 | Gió Lạc | Chỉ đuổi khi Mây mang ≥5 và ≤15 m (idle khi mất điều kiện); chạm XZ ≤1.2 cướp min(3, mang) một lần, không mất lửa, chuyển flee 240 tick; Tỏa Sáng lúc chase → flee không cướp; lúc flee có mang đồ → thả lại toàn bộ (`drifter_drop`), biến mất sau 120 tick; sinh tick 1200, 2400…, tối đa 2, id D1, D2 (Đêm 2–3) | `[AC-20]` (4 test) |
| AC-21 | Bùa Gió | Nhặt như đom đóm → `charm_picked`, hiệu lực 600 tick, chạy 7.2 m/s, lướt không hồi chiêu (vẫn phải nhấn lại), hồi sinh sau 2700 tick; vị trí đúng ticket | `[AC-21]` (2 test) |
| AC-30 | Vùng an toàn | Bóng Mực trong vùng khi đèn vừa thắp bị đẩy ra mép ≤30 tick, không gây sát thương | `[AC-30]` |
| AC-31 | Lịch sinh Bóng Mực | 2 con tick 300, rồi 1 con mỗi 480/420/360 tick (Đêm 1/2/3), id S1, S2…; trạng thái đúng tên `spawning/wander/chase/recoil/stunned` | `[AC-31]` (2 test) |
| AC-32 | Điểm chuẩn | +10 mỗi đom đóm nạp, +100 mỗi đèn, +5 mỗi Bóng Mực trúng Tỏa Sáng (kể cả đang choáng/lần sau) | `[AC-32]` + `[deposit + lantern_lit]` |
| AC-33 | Thắng/thua | Hết lửa → thua `no_flames`; tất cả đèn sáng → thắng kể cả đúng tick hết giờ; điểm thắng = + floor(giây còn)×2 + 50×lửa | `[AC-33]` (2 test), `[game_over …]` |
| AC-34 | Thứ tự trong tick | Gió Lạc cướp trước Bóng Mực; bất tử không chặn việc bị cướp; bóng chạm lúc bất tử không làm gì | `[AC-34]` |

## C. Chuỗi Đêm, giao diện, âm thanh (kiểm tay + ảnh)

Phần này không nằm trong đầu ra headless nên không có test tự động chặt. Bằng chứng: ảnh chụp bằng Chrome thật (`docs/media/phase2-*.png`) và các bước kiểm tay dưới đây (người chấm chạy `npm run play`). Kiểm tự động chỉ kiểm được ranh giới lõi/hiển thị (`[purity]`) và FPS bằng Playwright (xem `docs/notes/assumptions-phase2.md`, mục P2-12).

| AC | Mục Phần 3 | Tiêu chí chấp nhận (kiểm tay) |
|---|---|---|
| AC-60 | Chuỗi 3 Đêm | Menu chính → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → màn Bình Minh với tổng điểm = tổng điểm các Đêm đã thắng; thua → "Thử lại đêm" chơi lại đúng Đêm đó |
| AC-61 | Tạm dừng (Esc/P) | Logic dừng hẳn (dùng đúng cơ chế `pause` của lõi); menu có Tiếp tục / Chơi lại đêm / Cài đặt / Về menu chính; mất focus cửa sổ tự tạm dừng |
| AC-62 | Cài đặt | Âm lượng và độ nhạy chuột; lưu `localStorage` (`ddl-settings`), còn nguyên sau khi tải lại trang |
| AC-63 | Âm thanh | Nhạc nền theo từng Đêm; hiệu ứng: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối (+ bùa, gió, cướp) |
| AC-64 | HUD đầy đủ | Ngọn Lửa (trên trái); mm:ss (trên giữa, đỏ + nhấp nháy khi ≤30 s); đèn k/n + điểm (trên phải); thanh 10 ô đom đóm (dưới giữa); biểu tượng hồi chiêu Lướt/Tỏa Sáng (dưới phải); nhắc "E — Nạp ánh sáng (x/10)" khi gần đèn; mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình |
| AC-65 | Bảng màu | Mã màu của trời/sương, cỏ/cát/gỗ/biển mây, đèn, đom đóm, Bóng Mực, Mây/khăn/bùa, vàng, Gió Lạc, UI nguy hiểm/chữ trong `web/main.js` (hằng `C`) và `web/index.html` (biến CSS) đúng bảng; ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn) |
| AC-66 | FPS | Bản thường ≥ 30 FPS trung bình ở 1280×720 (có tự hạ độ phân giải khi < 35 FPS; hiện bằng `?fps`) |
| AC-67 | Sáng tạo không đổi headless | Phần thêm ở hiển thị (lá gió, hiệu ứng, màn Bình Minh) không đụng `src/core`; `[purity]` canh ranh giới |

## D. Không làm / ngoài phạm vi

- Không thêm nhân vật hay kẻ địch mới ngoài Bóng Mực và Gió Lạc (ưu tiên đúng số chuẩn trước).
- Âm thanh không có test tự động (chỉ kiểm tai).
- Không đổi định dạng Phase 1 ngoài những gì Contract v1.1 yêu cầu.
