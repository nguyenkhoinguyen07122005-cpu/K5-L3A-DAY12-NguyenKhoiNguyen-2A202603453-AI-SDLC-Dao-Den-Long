# Bằng chứng kiểm chứng

> File trong `phase-N/` do `node scripts/evidence.mjs N` sinh ra, không sửa tay. Bảng dưới là truy vết yêu cầu -> bằng chứng. Yêu cầu chưa đạt ghi "chưa đạt" kèm lý do.
> Muốn kiểm lại: `npm test` (tên test chứa nhãn trong ngoặc vuông, ví dụ `[pulse]`, để lọc: `node --test --test-name-pattern="pulse"`).

## Phase 1

Bằng chứng sinh tự động trong `docs/proof/phase-1/`: `test-output.txt` (toàn bộ output `npm test` kèm commit, giờ UTC, phiên bản Node, máy), `bot-output.txt` (bot tự chơi 20 seed + đối chứng đứng yên), `determinism.txt` + `sample-run.jsonl` (chạy headless 2 lần, so sha256).

| Yêu cầu (PRD-0 / Test Contract v1.0) | Cách kiểm | Nhãn test / file bằng chứng | Kết quả |
|---|---|---|---|
| Một màn Đêm 1, đảo tròn, 5 đèn `L1..L5` | Test scenario mặc định + `game.contract.json` | `[contract]`, `[D]` | Đạt |
| Đi lại, camera theo `cam_yaw_deg`, chuẩn hóa vector, nhảy | Chạy CLI thật với inputs | `[C]` (7 test) | Đạt |
| Đom đóm rải rác, nhặt được, giới hạn sức chứa | Chạy CLI thật | `[mote_picked]` (3 test), `[random]` | Đạt |
| Nạp ánh sáng để thắp đèn (cả nạp từng phần) | Chạy CLI thật | `[deposit + lantern_lit]`, `[deposit]` (4 test) | Đạt |
| Bóng Mực đuổi, chạm mất mạng, bất tử, rơi ánh sáng | Chạy CLI thật | `[shade]`, `[player_hit]` | Đạt |
| Tỏa sáng xua Bóng Mực (tốn ánh sáng, bán kính, choáng, đẩy, hồi chiêu) | Chạy CLI thật | `[pulse]` (4 test) | Đạt |
| Bóng Mực không vào vùng an toàn quanh đèn đã thắp | Quét mọi snapshot 900 tick | `[safe_radius]` (2 test) | Đạt |
| Thắng, thua (dawn / no_flames), điểm số | Chạy CLI thật | `[game_over won]`, `[game_over lost dawn]`, `[player_hit]` | Đạt |
| Định dạng JSONL (snapshot/event/end, làm tròn 3 chữ số, tick 0, mô hình tick) | Chạy CLI thật | `[B/E]`, `[E]`, `[B]` | Đạt |
| Tính tất định (cùng seed → output giống hệt, kể cả id tự sinh) | So sánh chuỗi output + sha256 | `[tat dinh]`, `phase-1/determinism.txt` | Đạt |
| Mã thoát: 0 / 2 (file sai định dạng) / khác 0 (lỗi khác) | 12 ca sai định dạng + 6 ca sai tham số | `[loi]` | Đạt |
| Game chơi được từ đầu tới thắng/thua, chơi lại | Bot thắng 15/20 seed, đứng yên thua; kiểm tay bản 3D trên Chrome (phím thật) | `[winnable]`, `phase-1/bot-output.txt`, `docs/media/*.png` | Đạt (xem ghi chú) |
| Máy chủ `npm run play` phục vụ đúng tệp trên cả Windows và Linux, chặn `.env`/traversal | Test mô phỏng đường dẫn `win32` và `posix` | `[serve]` (4 test) | Đạt |
| Sáng tạo không làm đổi đầu ra headless | Test ranh giới lõi/hiển thị | `[purity]` (3 test) | Đạt |

Ghi chú trung thực: phần hiển thị 3D (hình ảnh, HUD, âm thanh) không có test tự động chặt như lõi. Bằng chứng là ảnh chụp trong `docs/media/` (chụp bằng Chrome headless trong lúc phát triển, bấm phím thật) và người chấm có thể chạy `npm run play` để kiểm. Âm thanh chưa kiểm tự động.

## Phase 2

## Phase 3

## Phase 4
