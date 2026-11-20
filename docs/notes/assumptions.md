# Giả định theo phase

> Mỗi chỗ mơ hồ trong yêu cầu: ghi giả định, con số tự chọn, và lý do. Khi phase sau đổi luật, thêm dòng "Đổi" kèm lý do.
> Các con số dưới đây là con số thật trong `game.contract.json` (nguồn duy nhất; các test đọc thẳng từ file đó).

## Phase 1 (PRD-0)

### Lựa chọn kỹ thuật

| # | Chỗ mơ hồ | Giả định / con số chọn | Lý do |
|---|---|---|---|
| T1 | Công nghệ | Node.js (ESM, không thư viện ngoài) cho lõi + headless; Three.js r160 (đã vendor trong `web/vendor/`) cho bản chơi 3D chạy trên trình duyệt | Chạy được trên Windows/macOS/Linux chỉ với Node ≥ 20, không cần Docker, không cần GPU cho headless. Đáp ứng điều kiện "có cách chạy trên macOS/Linux" của PRD |
| T2 | `run_cmd` | `npm run play` mở máy chủ tĩnh ở `http://localhost:8080` (đổi cổng bằng biến `PORT`) | Chơi bằng trình duyệt, không cài thêm gì |
| T3 | Một lõi hay hai | Cùng một `src/core/sim.mjs` cho cả headless và bản 3D | Số liệu headless chính là số liệu game thật, không có hai bản logic lệch nhau |
| T4 | Ngẫu nhiên | Chỉ qua `createRng(seed)` (mulberry32). Cấm `Math.random`/`Date` trong `src/core` (có test `purity`) | Tính tất định theo contract |

### Luật game (chỗ PRD-0 để mở)

| # | Chỗ mơ hồ | Giả định / con số chọn | Lý do |
|---|---|---|---|
| G1 | Bản đồ | Đảo tròn bán kính 80 m, tâm (0,0,0), người chơi xuất phát ở tâm. 5 đèn `L1..L5` xếp vòng tròn bán kính 28 m quanh tâm, `L1` ở +Z, cách đều 72° | "Đảo tròn, 5 đèn". Đèn đủ xa để phải đi nhưng đủ gần để hoàn thành trong thời gian đêm |
| G2 | Rơi khỏi đảo | `fall_enabled: false`: bị chặn ở mép đảo (không phạt, không có sự kiện `player_hit` với `by: "fall"`) | PRD không nhắc rơi. Contract cho phép khai `false` |
| G3 | Lướt (dash) | Không có | PRD không yêu cầu. Frame inputs có `dash` vẫn hợp lệ (kiểm kiểu boolean) nhưng bị bỏ qua |
| G4 | Tốc độ, nhảy | `player_speed` 6 m/s. Nhảy: vận tốc đầu 7 m/s, trọng lực 20 m/s² (cao ~1,2 m, ~0,7 s trên không), chỉ nhảy khi đang chạm đất, vẫn đi ngang được khi nhảy | Cảm giác nhanh vừa phải. Bóng Mực 4 m/s nên người chơi luôn chạy thoát được nếu không bị chặn góc |
| G5 | Nhảy có né được Bóng Mực không | Không. Khoảng cách chạm đo theo mặt phẳng XZ (đúng quy ước contract) | Contract quy định đo theo XZ |
| G6 | Đom đóm | Ban đầu 30 con rải đều trong đĩa bán kính 50 m. Mỗi 6 s sinh thêm 1 con (tối đa 30 con trên đảo). Nhặt tự động khi khoảng cách ≤ `pickup_radius` 1,5 m và còn chỗ trong giỏ | PRD: "rải rác". Cần tổng ≥ 25 ánh sáng (5 đèn × 5) cộng dư để bù khi bị đánh rơi |
| G7 | Sức chứa, giá đèn | `carry_capacity` 10, `lantern_cost` 5, `lantern_count_night1` 5 | Mang đủ cho 2 đèn mỗi chuyến |
| G8 | Nạp ánh sáng | Nhấn tương tác (cạnh lên) → nạp vào đèn **chưa sáng** gần nhất trong `interact_radius` 3 m: `min(carried, cost − deposited)`. Đủ `cost` thì đèn sáng. Mỗi lần nạp > 0 phát `deposit`; sáng thì phát thêm `lantern_lit` (cùng tick, `deposit` trước). Không có đèn trong tầm hoặc tay không → không làm gì, không phát sự kiện | Cho phép nạp từng phần (contract có `deposited`) |
| G9 | Thắp đèn đẩy Bóng Mực | Khi một đèn vừa sáng, Bóng Mực đang ở trong `safe_radius` của đèn đó bị đẩy ra rìa vùng an toàn | Giữ bất biến "Bóng Mực không ở trong vùng an toàn của đèn đã thắp" |
| G10 | Vùng an toàn | `safe_radius` 6 m quanh đèn **đã sáng**. Bóng Mực không vào được (bị đẩy ra rìa). Người chơi đứng sát đèn không bị chạm vì `safe_radius` (6) > `shade_hit_radius` (1) | PRD: "Bóng Mực sợ những chiếc đèn" |
| G11 | Bóng Mực | Ban đầu 2 con ở cách người chơi ≥ 25 m. Mỗi 10 s sinh thêm 1 con (tối đa 6), phát `shade_spawned`. Đuổi thẳng theo người chơi với `shade_speed` 4 m/s. Con khai báo trong scenario ở trạng thái `chase` ngay | Đủ áp lực mà né được |
| G12 | Bị chạm | Khoảng cách XZ ≤ `shade_hit_radius` 1 m → mất 1 mạng (`flames` 3), đánh rơi `floor(carried × 0,5)` ánh sáng (rơi thành đom đóm trên đất quanh người chơi, 2,5–4 m), bất tử `invuln_s` 1,5 s (hết mạng → thua `no_flames`) | PRD: "bị chạm thì mất máu". Rơi một nửa tạo cân nhắc rủi ro khi mang nhiều |
| G13 | Tỏa sáng | `pulse` (cạnh lên): cần `carried ≥ pulse_cost` 2 và hết hồi chiêu (`pulse_cooldown_s` 2). Trừ 2 ánh sáng. Bóng Mực trong `pulse_radius` 8 m bị choáng `pulse_stun_s` 3 s (đứng yên, `state: "stunned"`) và bị đẩy xa người chơi `pulse_push_m` 3 m. Tỏa sáng khi không có con nào trong tầm vẫn tốn ánh sáng và phát `pulse` với `stunned_ids: []` | Đúng mô tả "tốn ánh sáng" của PRD |
| G14 | Thắng, thua | Thắng ngay trong tick thắp đèn thứ 5 (không tính tiếp di chuyển của Bóng Mực tick đó). Thua `dawn` khi `tick/60 ≥ time_left_s` ban đầu (300 s → tick 18000). Thua `no_flames` khi hết mạng. Hết trận thì headless dừng sớm | Contract: "dừng khi game kết thúc" |
| G15 | Điểm | `per_mote` 10, `per_lantern` 100, `per_stun` 25 (mỗi Bóng Mực bị choáng, kể cả con đang choáng), thắng cộng thêm `per_second_left` 2 × số giây còn lại (làm tròn xuống) + `per_flame_left` 50 × số mạng còn lại. Điểm thưởng thắng cộng trước sự kiện `game_over` | Thưởng nhanh và thưởng ít bị chạm |
| G16 | Thứ tự trong một tick | bộ đếm → di chuyển/nhảy → nhặt → tương tác → tỏa sáng → Bóng Mực (choáng/đuổi/chạm) → sinh thêm → hết giờ | Cố định để mọi kết quả tất định và dễ kiểm tra |

### Diễn giải Test Contract

| # | Chỗ mơ hồ | Giả định / con số chọn | Lý do |
|---|---|---|---|
| C1 | Snapshot cuối | Snapshot chỉ ở tick 0 và các bội của `--snapshot-every`; **không** thêm snapshot ở tick cuối nếu không chia hết. Trạng thái cuối nằm ở dòng `end` | Đọc đúng chữ: "mỗi --snapshot-every tick, bắt đầu từ tick 0" |
| C2 | Dựng scenario | Dựng đúng như viết, **không chỉnh lại** (kể cả Bóng Mực đặt trong vùng an toàn). Chỉ từ bước 1 trở đi luật mới áp dụng | "Dựng scenario không phát sự kiện, không cộng điểm" |
| C3 | `time_left_s` trong scenario | Đặt cả thời lượng của đêm (dùng cho điểm thưởng và thua `dawn`) | Đồng nhất với công thức `time_left_s = thời lượng Đêm − bước/60` |
| C4 | `--night` khác 1 | Lỗi tham số (mã thoát 1) vì Phase 1 chỉ có Đêm 1 | Chưa có đêm khác |
| C5 | Lỗi | Thiếu/ sai tham số → mã 1. File inputs/scenario không đọc được, JSON hỏng, sai kiểu, `tick` không tăng ngặt, `move` ngoài [−1,1], id đèn lạ → mã 2, thông báo ở stderr | Đúng contract |
| C6 | Frame có `tick` ≥ `--ticks` | Bị bỏ qua | Chỉ chạy đúng N bước |
| C7 | Mảng `motes` trong snapshot | Có (khuyến nghị v1.0), mỗi phần tử `{id, pos}` | Giúp người chấm kiểm tra rơi/nhặt |
| C8 | `y` Bóng Mực | Sinh ngẫu nhiên: y = 1 (tâm). Trong scenario giữ đúng `y` đã cho | Chỉ XZ được dùng khi tính khoảng cách |

### Test Contract v1.0 (chép nguyên văn từ lab board)

```text
Bắt buộc
Test Contract v1.0
Mọi bài nộp phải có một chế độ chạy không giao diện (headless) để giảng viên chạy kiểm thử tự động, bất kể công nghệ.

A. File game.contract.json ở gốc repo
{
  "contract_version": "1.0",
  "team": "mssv-ho-ten",
  "build_cmd": "lệnh cài đặt/biên dịch",
  "run_cmd": "lệnh mở game có giao diện",
  "headless_cmd": "lệnh chạy headless (sẽ được nối thêm tham số)",
  "tuning": {
    "player_speed": 0,
    "carry_capacity": 0,
    "lantern_cost": 0,
    "lantern_count_night1": 5,
    "pickup_radius": 0,
    "interact_radius": 0,
    "pulse_cost": 0,
    "pulse_radius": 0,
    "night1_duration_s": 0,
    "flames": 0,
    "invuln_s": 0,
    "hit_drop_ratio": 0,
    "pulse_stun_s": 0,
    "pulse_push_m": 0,
    "pulse_cooldown_s": 0,
    "safe_radius": 0,
    "shade_speed": 0,
    "shade_hit_radius": 0,
    "fall_enabled": false,
    "score": { "per_mote": 0, "per_lantern": 0, "per_stun": 0,
               "per_second_left": 0, "per_flame_left": 0 }
  }
}
tuning: bạn điền đúng các số mà game của bạn đang dùng. Nếu game không có khái niệm đó, điền null (hoặc false) và giải thích trong README. Bài test Phase 1 sinh tình huống dựa trên các số này, nên khai sai sẽ làm trượt test.
Ý nghĩa: hit_drop_ratio là tỉ lệ đom đóm đánh rơi khi bị chạm (0 nếu không rơi); safe_radius là bán kính quanh đèn mà Bóng Mực không vào được; fall_enabled cho biết rơi khỏi đảo có bị phạt hay không; score.* là điểm cho mỗi sự kiện.
Lệnh phải chạy được trên macOS/Linux sau build_cmd. Docker được phép.
B. Tham số headless
<headless_cmd> --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>]
               --ticks <int> --out <file.jsonl> [--snapshot-every <int, mặc định 10>]
Logic game chạy ở 60 tick/giây cố định (1 tick = 1/60 giây), không cần cửa sổ, không cần GPU, nhanh nhất có thể.
Dừng khi chạy đủ --ticks hoặc khi game kết thúc (thắng/thua). Thoát với mã 0.
Lỗi → mã thoát khác 0, thông báo lỗi ra stderr. File inputs/scenario sai định dạng → mã thoát 2.
Đơn vị độ dài là mét; trục Y hướng lên; mặt đất đảo ở Y = 0; người chơi xuất phát tại (0, 0, 0).
Mô hình tick (để mọi bài đếm giống nhau)
Snapshot tick 0 là trạng thái sau khi dựng scenario, trước khi áp dụng input.
Bước thứ k (k = 0 … N−1) đọc input của tick k và tạo ra trạng thái k+1. Sự kiện xảy ra trong bước đó ghi tick = k+1. --ticks N thực hiện đúng N bước.
time_left_s = thời lượng Đêm − (số bước đã chạy) / 60.
Quy ước vị trí
player.pos là chân nhân vật; shade.pos là tâm Bóng Mực; lantern.pos là chân cột đèn; vị trí đom đóm là điểm trên mặt đất (độ cao lơ lửng chỉ là hiển thị).
Mọi khoảng cách trong tuning đo giữa các điểm này, theo mặt phẳng ngang XZ, không cộng thêm kích thước nhân vật. "Trong bán kính r" nghĩa là khoảng cách ≤ r.
C. File inputs
{
  "frames": [
    { "tick": 0,   "move": [0, 1], "cam_yaw_deg": 0 },
    { "tick": 120, "move": [0, 0], "interact": true },
    { "tick": 121, "interact": false },
    { "tick": 200, "pulse": true },
    { "tick": 201, "pulse": false }
  ]
}
Giá trị mặc định trước frame đầu tiên: move [0,0], cam_yaw_deg 0, mọi nút false.
Mỗi frame chỉ đổi các trường có mặt trong frame đó; trường vắng mặt giữ giá trị cũ.
tick của các frame phải tăng nghiêm ngặt (không trùng, không giảm).
move: [x, z], mỗi thành phần trong [−1, 1]. Với θ = cam_yaw_deg đổi sang radian, hướng di chuyển trong thế giới là x' = x·cosθ + z·sinθ, z' = −x·sinθ + z·cosθ (khi θ = 0 thì x là +X, z là +Z). Vector dài hơn 1 phải được chuẩn hóa về độ dài 1.
jump, interact, pulse (và dash nếu có): boolean, hành động kích hoạt khi giá trị chuyển từ false sang true.
Không có file inputs nghĩa là người chơi đứng yên.
D. File scenario (dựng tình huống cho test)
{
  "player": { "pos": [0, 0, 0], "carried": 0, "flames": 3 },
  "random_motes": false,
  "random_shades": false,
  "motes": [[0, 0, 5]],
  "shades": [{ "pos": [10, 0, 0] }],
  "lanterns": [{ "id": "L1", "pos": [0, 0, 25], "deposited": 0 }],
  "time_left_s": 300
}
random_motes: false: không tự sinh đom đóm, chỉ có những con được liệt kê.
random_shades: false: không tự sinh Bóng Mực, chỉ có những con được liệt kê (ở trạng thái hoạt động bình thường ngay lập tức).
lanterns: cập nhật theo id các đèn của màn (L1…L5). Đèn không được nhắc tới giữ nguyên; có pos thì đổi vị trí; có thể đặt lit: true.
motes, shades: thay thế danh sách ban đầu tương ứng; mảng rỗng nghĩa là không có con nào. shades[] có thể kèm id để test tham chiếu.
Trường nào không có thì dùng mặc định của game.
Dựng scenario không phát sự kiện và không cộng điểm (ví dụ đèn đặt sẵn lit: true không được cộng điểm thắp đèn).
E. Output JSONL
Mỗi dòng là một đối tượng JSON, gồm ba loại.

Snapshot, mỗi --snapshot-every tick, bắt đầu từ tick 0:

{"type":"snapshot","tick":120,"sim_tick":120,"state":"playing","time_left_s":298.0,"score":20,
 "player":{"pos":[0.0,0.0,12.0],"flames":3,"carried":2},
 "lanterns":[{"id":"L1","pos":[0,0,25],"lit":false,"deposited":0}],
 "shades":[{"id":"S1","pos":[30.1,1.0,2.0],"state":"chase"}],
 "motes_active":19}
Event, ghi ngay khi sự kiện xảy ra. Ví dụ: {"type":"event","tick":131,"name":"mote_picked","data":{"carried":3}}

name	data
mote_picked	{"carried": n}
deposit	{"lantern_id": "L1", "amount": n, "deposited": n}
lantern_lit	{"lantern_id": "L1"}
pulse	{"stunned_ids": ["S1"]}
player_hit	{"by": "shade" | "fall", "flames": n, "dropped": n}
shade_spawned	{"id": "S3"}
game_over	{"result": "won" | "lost", "reason": "all_lit" | "dawn" | "no_flames"}
End, dòng cuối cùng và bắt buộc: {"type":"end","ticks":4800,"state":"won","score":1730}

state thuộc playing, won, lost. Trạng thái Bóng Mực tối thiểu phải có stunned; các trạng thái khác do bạn đặt tên.
Tọa độ làm tròn 3 chữ số thập phân.
Tính tất định: cùng --seed, cùng scenario và cùng inputs phải cho output giống hệt nhau giữa hai lần chạy, kể cả các id tự sinh. Các bạn không cần sinh cùng chuỗi ngẫu nhiên với nhau.
sim_tick là số bước gameplay đã chạy (ở Phase 1 bằng tick).
Mảng motes (mỗi phần tử id, pos) trong snapshot là khuyến nghị ở v1.0.
Nếu một sự kiện không xảy ra trong game của bạn (ví dụ không có rơi khỏi đảo) thì không ghi sự kiện đó.
```

## Phase 2 (Ticket-02)

(Chưa phát hành khi ghi tài liệu này.)

## Phase 3 (Ticket-03)

## Phase 4 (Ticket-04)
