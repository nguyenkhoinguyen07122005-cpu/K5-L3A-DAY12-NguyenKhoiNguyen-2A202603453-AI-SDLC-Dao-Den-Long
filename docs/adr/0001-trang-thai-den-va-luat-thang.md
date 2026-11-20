# ADR-0001: Mô hình trạng thái của đèn và luật thắng "sống tới bình minh"

- Trạng thái: Chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu", Contract v1.2)
- Ngày: 2026-11-20
- Người quyết định: Nguyễn Khôi Nguyên (AI đề xuất, người duyệt)

## Bối cảnh

Đến Phase 2 mỗi đèn chỉ có hai trạng thái (tắt / sáng) và đã sáng thì sáng mãi. Luật thắng là "thắp đủ đèn", thắng ngay khi đèn cuối sáng. Ticket-03 đổi hai thứ cùng lúc:

1. Đèn có **nhiên liệu** (hao dần, châm thêm được, cạn thì tắt, thắp lại rẻ hơn).
2. Thắng **không còn sớm**: phải sống tới bình minh với ít nhất `ceil(0.6 × tổng đèn)` đèn sáng.

Hai thay đổi này chạm vào gần như mọi phần của lõi (nhặt, nộp, vùng an toàn, AI Bóng Mực, điểm, thắng/thua, snapshot), nên cần chốt mô hình trước khi sửa mã.

## Quyết định

### 1. Mô hình trạng thái của đèn

Mỗi đèn có: `lit`, `deposited` (ánh sáng đã nạp khi còn tắt), `fuel`, `ever_lit`, `relit_count`. Ba trạng thái hiệu dụng:

| Trạng thái | Điều kiện | Chuyển sang |
|---|---|---|
| Chưa từng sáng | `lit=false, ever_lit=false` | Sáng khi nạp đủ 10 (fuel=100, ever_lit=true) |
| Tắt (đã từng sáng) | `lit=false, ever_lit=true` | Sáng khi nạp đủ 5 (fuel=100, `relit_count`+1) |
| Sáng | `lit=true`, 0 < fuel ≤ 100 | Tắt khi fuel ≤ 0 (`deposited=0`, sự kiện `lantern_out`) |

Bên trong sáng có hai miền: **đủ dầu** (fuel ≥ 30, có vùng an toàn 6 m) và **yếu** (fuel < 30, mất vùng an toàn, trở thành mục tiêu của Bóng Mực). Ngưỡng 30 tính "đúng 30 vẫn an toàn".

### 2. Biểu diễn nhiên liệu bằng số nguyên

Lõi lưu `fuelU = fuel × 60` (số nguyên, đơn vị 1/60). Hao 1/s = trừ 1 đơn vị mỗi tick; hút 5/s = trừ 5 đơn vị mỗi tick mỗi Bóng Mực. Lý do: so sánh `fuel < 30` và `fuel ≤ 0` phải chính xác và tất định; cộng dồn 1/60 bằng số thực sẽ trôi sai số theo thời gian. Snapshot xuất `fuel = fuelU/60` làm tròn 1 chữ số thập phân (đúng format Ticket-03).

### 3. Thứ tự trong một tick

Giữ thứ tự Ticket-02, thêm hai điểm: (a) ở bước 2 trừ dầu (hao + hút), đèn nào fuel ≤ 0 thì tắt ngay sau bước 2, tức là trước khi nhặt/nộp/tương tác của chính tick đó; (b) thắng/thua kiểm tra sau mọi cập nhật. Hệ quả cố ý: người chơi không thể "cứu" một đèn đã cạn ở đúng tick nó cạn bằng cách châm dầu cùng tick.

### 4. Luật thắng

Chỉ kiểm tra thắng ở **tick bình minh** (`simTick/60 ≥ thời lượng`). Không còn thắng sớm. Thứ tự ưu tiên: hết Ngọn Lửa (`no_flames`) trước, rồi đủ đèn → `dawn_survived` (thắng), còn lại → `dawn` (thua). Lý do giữ `no_flames` đứng đầu: chết ở tick cuối vẫn là chết (Ticket-03 nói rõ).

Ngưỡng `ceil(win_ratio × tổng)` tính với hiệu chỉnh `−1e-9` để `0.6 × 5` (thực ra 3.0000000000000004 trong số thực) không bị làm tròn lên 4.

### 5. Điểm

Điểm đổi sang: +5 mỗi đom đóm nộp, +100 thắp lần đầu, +40 thắp lại, +5 Tỏa Sáng trúng (+15 nếu bóng đang `drain`), và chỉ khi thắng lúc bình minh: mỗi đèn sáng +50 + floor(fuel), mỗi Ngọn Lửa còn +50. Bỏ thưởng thời gian (vì không còn thắng sớm). Tổng điểm game vẫn là tổng các đêm thắng.

## Các phương án đã cân nhắc

| Phương án | Vì sao không chọn |
|---|---|
| Lưu fuel bằng số thực, trừ 1/60 mỗi tick | Sai số tích lũy; có thể cạn lệch 1 tick giữa hai máy, vi phạm tính tất định |
| Tách "đèn cạn" thành trạng thái riêng ngoài `lit` | Test ẩn và snapshot chỉ có `lit`; thêm trạng thái làm lệch hợp đồng |
| Cho phép thắng sớm khi đủ 60% đèn | Trái ticket ("không thắng sớm"), và làm vô nghĩa việc giữ đèn tới bình minh |
| Cho Bóng Mực wander đi tới đèn tắt như một mục tiêu bắt buộc | Ticket nói "như trước"; Phase 2 là đi lang thang. Bot thử nghiệm thắng 1/20 vì bóng đứng chắn đèn tắt, nên giữ lang thang (giả định P3-3) |

## Hệ quả

- Đèn sáng tốn đom đóm liên tục (1 đom đóm/10 s/đèn), nên chiến thuật tối ưu là **thắp muộn**: chỉ cần đủ đèn ở tick bình minh. Bot thể hiện điều này (chỉ thắp trong khoảng 90–140 s cuối).
- Mọi test dựa trên "thắng khi đủ đèn" và điểm cũ phải sửa; danh sách và lý do trong `CHANGELOG.md` và `docs/notes/assumptions-phase3.md`.
- Hợp đồng headless đổi (v1.1 → v1.2, có thay đổi phá vỡ); xem `CHANGELOG.md`.
