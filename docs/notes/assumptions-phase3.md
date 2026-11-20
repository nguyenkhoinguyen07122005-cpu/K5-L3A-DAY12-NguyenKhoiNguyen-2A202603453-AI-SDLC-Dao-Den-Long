# Giả định và thay đổi Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

Nguyên văn ticket ở cuối file. Quyết định thiết kế chính: `docs/adr/0001-trang-thai-den-va-luat-thang.md`. Danh sách thay đổi phá vỡ: `CHANGELOG.md`.

## "Đổi": luật Phase 2 bị Ticket-03 thay thế

| Mục | Phase 2 | Phase 3 | Ảnh hưởng tới test |
|---|---|---|---|
| Thắng | Thắp đèn cuối → thắng ngay (`all_lit`) | Chỉ ở bình minh, đủ `ceil(0.6×tổng)` đèn (`dawn_survived`) | `[game_over won]`, `[AC-33]` ×2 viết lại; `[winnable]` viết lại |
| Thời lượng | 300/330/360 s | 240/270/300 s | `[AC-01]`, `[AC-02]` |
| Điểm | +10/đom đóm, thưởng giây, +50/lửa | +5/đom đóm, +40 thắp lại, +15 trúng bóng drain, bỏ thưởng giây, +50+floor(fuel)/đèn lúc bình minh, +50/lửa | `[AC-01]`, `[deposit + lantern_lit]`, `[game_over won]` |
| Vùng an toàn | Mọi đèn sáng | Đèn sáng và fuel ≥ 30 | Test `[safe_radius]` dùng `lit:true` (fuel mặc định 100) nên vẫn đạt |
| Sức chứa | Cố định 10 | 10 + 2×lần thắp thành công, tối đa 20 | Snapshot có `player.capacity` (`[AC-02]`) |
| Chọn đèn bấm E | Đèn tắt gần nhất | Đèn tắt hoặc sáng chưa đầy dầu gần nhất | Test nạp/thắp không đổi (đèn tắt) |

Không test nào bị bỏ âm thầm; lý do từng test sửa/xóa nằm trong bảng của `CHANGELOG.md`. Tổng: 87 → 105 test (18 test mới, nhãn `[AC-70]`…`[AC-86]` trong `tests/v12.test.mjs`).

## Giả định mới (P3-x)

| # | Chỗ ticket chưa nói rõ | Tôi chọn |
|---|---|---|
| P3-1 | Biểu diễn fuel | Số nguyên `fuelU = fuel×60`; hao 1 đơn vị/tick, hút 5 đơn vị/tick/bóng. Snapshot làm tròn 1 chữ số. Lý do: ADR mục 2 |
| P3-2 | Thời điểm đèn tắt | Ngay sau bước 2 (trừ dầu), trước nhặt/tương tác của tick đó, đúng câu "ngay sau bước 2" của ticket |
| P3-3 | Bóng wander không có đèn yếu: "đi về đèn tắt gần nhất như trước" | Phase 2 của tôi là đi lang thang ngẫu nhiên (P2-14), nên "như trước" = lang thang. Bản thử cho bóng đi tới đèn tắt làm bot thắng 1/20 vì bóng đứng chắn đèn |
| P3-4 | Tốc độ bóng đi tới đèn yếu | 2 m/s (tốc độ lang thang), dừng ở cách đèn 2 m (khoảng cách XZ) |
| P3-5 | Bóng vào `drain` lúc nào | Ngay tick nó tới ≤ 2 m (sau bước trừ dầu), nên lần hút đầu ở tick kế; `fuel_drain` phát khi bóng đã hút đủ 60, 120… tick, fuel làm tròn 1 chữ số sau lần trừ đó |
| P3-6 | "Mây vào trong 6 m" | Khoảng cách XZ giữa Mây và bóng ≤ 6 m (`drain_chase`) |
| P3-7 | "Đúng 30 vẫn an toàn" với hao 1/60 mỗi tick | Kiểm tra sau khi trừ dầu của tick đó; đèn đã châm lên đúng 30.0 sau trừ vẫn an toàn |
| P3-8 | Scenario | `lit:true` không `fuel` → 100 và `ever_lit` true; có `fuel>0` mà không `lit` → sáng; shade `drain` không `target_lantern_id` → đèn sáng gần nhất trong 2 m, không có thì `wander` |
| P3-9 | Bằng chứng thắng được | Đêm 1 bot thắng có Bóng Mực; Đêm 2 bot thắng khi tắt Bóng Mực; Đêm 3 bot chưa tối ưu việc leo tầng nên bằng chứng dùng `successful_lights:3` (sức chứa 16). Nói thẳng: chưa chứng minh bằng bot Đêm 3 chơi thường, mới chứng minh luật và bản đồ khả thi |
| P3-10 | Đẩy bóng khi châm dầu | Chỉ khi châm làm fuel vượt từ dưới 30 lên ≥ 30; bóng trong 6 m bị đẩy ra mép ≤ 30 tick, không sát thương (như đèn mới sáng) |
| P3-11 | Đèn "đầy" không chọn được | Chỉ fuel = 100 đúng. Vì trừ dầu xảy ra trước tương tác trong cùng tick nên đèn gần như không bao giờ đầy ở lúc bấm E; vẫn cài đúng luật |
| P3-12 | Thắp lại | `deposited` về 0 khi đèn tắt; nạp từng phần cộng dồn tới 5 |
| P3-13 | Tỏa Sáng trúng bóng drain | +15 tổng (đã gồm +5); bóng mất `target`, sang `stunned`; hết choáng về `wander` |
| P3-14 | Điểm thắng | `floor(fuel)` dùng fuel ở tick bình minh sau khi trừ dầu của tick đó |
| P3-15 | Thời điểm bình minh | `simTick/60 ≥ thời lượng` (tick tạm dừng không tính), cùng quy ước Phase 2 |

## Nguyên văn Ticket-03


Đảo Đèn Lồng Day 12 · AI SDLC Lab

Phase 1
PRD-0

Phase 2
Ticket-02 · Ba hòn đảo

Phase 3
Ticket-03 · Đèn cạn dầu

Phase 4
Chưa phát hành
Bật nền 3D
TICKET-03 — CHANGE REQUEST "Đèn cạn dầu" (Phase 3)
Loại: Change Request — thay đổi luật cốt lõi · Ưu tiên: Rất cao · Tag nộp: phase-3 · Contract: v1.2

Vì sao thay đổi
Playtest cho thấy người chơi giỏi thắp hết đèn trong 2 phút rồi game kết thúc, thiếu căng thẳng ở cuối Đêm. Nhà thiết kế quyết định: đèn thắp rồi vẫn có thể tắt, mục tiêu chuyển từ "thắp hết" sang "giữ đảo sáng tới bình minh".

⚠ Ticket này thay thế một số luật đã có. Những luật cũ bị thay được đánh dấu [THAY THẾ]. Bạn phải ghi lại quyết định thiết kế (ví dụ một ADR ngắn) và cập nhật test của mình.

Về sáng tạo: phần sáng tạo của bạn từ các phase trước vẫn được giữ và vẫn được thêm ý riêng (kể cả nhân vật, kẻ địch mới), miễn là luật, số liệu và Test Contract dưới đây không bị đổi và đầu ra headless không đổi. Ý sáng tạo nào xung đột với luật mới thì phải điều chỉnh theo luật mới.

1. Nhiên liệu đèn — [THAY THẾ] luật "đèn đã sáng không nhận thêm đom đóm"
Quy tắc	Giá trị
Nhiên liệu tối đa	100
Khi vừa thắp (lần đầu hoặc thắp lại)	fuel = 100
Hao hụt khi đang sáng	1.0 đơn vị/giây (tính theo tick: 1/60 mỗi tick)
Châm dầu	Bấm Tương tác ở đèn đang sáng: used = min(đang mang, ceil((100 − fuel) / 10)), fuel = min(100, fuel + 10 × used), trừ used đom đóm. Đèn đầy dầu (used = 0) không được chọn khi tương tác, không phát sự kiện, không cộng điểm
Chọn đèn khi tương tác	Chỉ xét đèn nhận được (chưa sáng, hoặc sáng nhưng chưa đầy dầu); gần nhất, bằng nhau thì id nhỏ hơn
Độ chính xác	Nên tính dầu theo đơn vị nguyên 1/60 để không bị sai số số thực; chỉ làm tròn khi xuất ra
Hết dầu (fuel ≤ 0)	Đèn chuyển sang tắt, deposited = 0, phát sự kiện lantern_out, ánh sáng môi trường giảm theo. Đèn nhớ ever_lit = true
Thắp lại	Đèn đã từng sáng (ever_lit) chỉ cần 5 đom đóm; đèn chưa từng sáng vẫn cần 10
Hiển thị	Thanh dầu trên đèn đang sáng; khi fuel < 30 thì đèn và thanh dầu nhấp nháy chậm (1 Hz)
2. Bóng Mực hút dầu — [THAY THẾ] luật "Bóng Mực không bao giờ vào vùng an toàn"
Đèn có fuel < 30 mất vùng an toàn. Đúng 30 thì vẫn còn vùng an toàn.
Chỉ Bóng Mực ở trạng thái wander mới chọn đèn yếu: đi tới đèn sáng có fuel < 30 gần nhất (bằng nhau thì id nhỏ hơn). Không có thì đi về đèn tắt gần nhất như trước. Bóng đang chase không đổi mục tiêu.
Khi cách đèn đó ≤ 2 m (XZ): chuyển sang trạng thái mới drain, đứng yên và hút 5 fuel/giây liên tục (5/60 mỗi tick). Nhiều con thì cộng dồn. Đèn vẫn tự hao 1/giây.
Từ drain: sang chase nếu Mây vào trong 6 m; sang stunned nếu trúng Tỏa Sáng; sang wander nếu đèn tắt, nếu fuel được châm lên ≥ 30, hoặc nếu cách đèn > 2 m.
Hết choáng thì về wander.
Khi đèn được châm dầu lên ≥ 30 lúc có Bóng Mực trong vùng 6 m, các con đó bị đẩy ra mép vùng trong tối đa 30 tick và không gây sát thương trong lúc đó (giống khi đèn vừa thắp).
3. Luật thắng mới — [THAY THẾ] "thắng ngay khi tất cả đèn sáng"
Quy tắc	Giá trị mới
Thời gian Đêm 1 / 2 / 3	240 / 270 / 300 s
Thắng	Mây còn sống khi hết giờ (bình minh) và số đèn đang sáng tại tick cuối ≥ ceil(0.6 × tổng đèn): Đêm 1 cần 3/5, Đêm 2 cần 4/6, Đêm 3 cần 5/7
Không còn thắng sớm	Thắp đủ đèn không kết thúc Đêm
Thua	Hết Ngọn Lửa (ngay lập tức, kể cả ở tick cuối) · hoặc hết giờ mà số đèn sáng dưới ngưỡng
Lý do kết thúc	Thắng: dawn_survived · Thua: dawn hoặc no_flames
Thứ tự trong tick	Theo thứ tự xử lý của Ticket-02, bổ sung: ở bước 2 trừ dầu (hao + bị hút); ngay sau bước 2, đèn có fuel ≤ 0 tắt. Bước "xét thắng/thua" diễn ra sau mọi cập nhật của tick, kể cả tick bình minh: hết Ngọn Lửa luôn thua no_flames trước
4. Sức chứa tăng dần (mới)
Sức chứa = 10 + 2 × successful_lights, tối đa 20. successful_lights = số lần thắp thành công trong Đêm (tính cả thắp lại; đèn đặt sẵn bằng scenario không tính). Đặt lại về 0 ở đầu mỗi Đêm. HUD hiển thị đang mang / sức chứa.

5. Điểm mới — [THAY THẾ] toàn bộ công thức điểm cũ
Sự kiện	Điểm
Mỗi đom đóm nạp vào đèn (thắp mới, thắp lại hoặc châm dầu)	+5
Thắp lần đầu	+100
Thắp lại	+40
Bóng Mực trúng Tỏa Sáng	Tổng +5 mỗi con; tổng +15 nếu ngay trước đó nó đang drain
Bình minh (chỉ khi thắng): mỗi đèn đang sáng	+50 + floor(fuel)
Bình minh (chỉ khi thắng): mỗi Ngọn Lửa còn lại	+50
Thưởng thời gian	Bỏ
Tổng điểm game, chơi lại	Không đổi so với Ticket-02
6. Chế độ mù màu (mới)
Thêm cài đặt "Bảng màu dễ phân biệt" (được lưu):

Viền và mắt Bóng Mực đổi từ #7A3CFF sang #00B3FF.
Màu cảnh báo UI đổi từ #FF5A5F sang #FFFFFF, kèm biểu tượng ⚠.
Đèn tắt và đèn sáng phải phân biệt được không cần màu: đèn tắt bị xẹp 20% và giấy có vết rách; đèn sắp hết dầu nhấp nháy.
7. Test Contract v1.2 (thay đổi)
contract_version: "1.2". tuning thêm fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20; night1_duration_s = 240, night2_duration_s = 270, night3_duration_s = 300.
Snapshot: mỗi đèn thêm fuel (số thực, 1 chữ số thập phân; đèn tắt có fuel: 0), ever_lit và relit_count; player thêm capacity. Bóng Mực có thêm trạng thái drain.
Scenario: mỗi đèn được đặt lit, fuel, ever_lit; player thêm successful_lights; shades[] thêm target_lantern_id. Đèn đặt lit: true mà không có fuel thì mặc định fuel: 100.
Sự kiện mới: refuel {lantern_id, amount, fuel}, lantern_out {lantern_id}, fuel_drain {lantern_id, shade_id, fuel} (ghi mỗi 60 tick khi đang hút). lantern_lit thêm relight: true|false. game_over.reason có thêm dawn_survived; all_lit không còn dùng.
Định nghĩa hoàn thành (DoD)
Có bằng chứng game chạy đúng các yêu cầu của phase (định dạng tự chọn).
Có ít nhất 1 ghi chú quyết định thiết kế (ADR hoặc tương đương, tên và vị trí tự chọn) mô tả cách bạn thay đổi mô hình trạng thái đèn và luật thắng.
Test cũ bị luật mới làm sai phải được cập nhật hoặc xóa có ghi lý do, không được bỏ qua (skip) âm thầm.
Có changelog (tên và vị trí tự chọn) liệt kê các thay đổi phá vỡ tương thích (breaking changes) của Phase 3.
Mọi test ẩn Phase 1–2 không bị thay thế vẫn đạt.
Hỏi trợ giảng
Đảo Đèn Lồng · Day 12 AI SDLC Lab. Các phase mới xuất hiện ở thanh trên khi giảng viên phát hành.
