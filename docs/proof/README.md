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

Bằng chứng sinh tự động trong `docs/proof/phase-2/`: `test-output.txt` (toàn bộ `npm test`), `bot-output.txt` (bot tự chơi 20 seed trên mỗi Đêm + đối chứng đứng yên + chế độ `--calm` cho Đêm 2/3), `determinism.txt` + `sample-run.jsonl`, `perf-fullnight.txt` (mỗi Đêm chạy đủ 21 600 tick headless, thời gian và băm hai lần chạy). Spec và tiêu chí: `docs/spec/phase-2.md`. Giả định/thay đổi: `docs/notes/assumptions-phase2.md`.

| Yêu cầu (Ticket-02 / Contract v1.1) | Cách kiểm | Nhãn test / file bằng chứng | Kết quả |
|---|---|---|---|
| Số chuẩn thay mọi số tự chọn; contract v1.1 | Đọc `game.contract.json` qua test | `[AC-01]` | Đạt |
| Test Phase 1 còn đạt với số chuẩn (regression) | 41 test `contract.test.mjs` viết lại theo số chuẩn (bảng "Đổi") | `contract.test.mjs` | Đạt |
| `--night 1/2/3`, `night_start`, snapshot v1.1, bản đồ chuẩn | Chạy CLI thật | `[AC-02]`, `[AC-03]`, `[AC-04]` | Đạt |
| Lướt; bục nhảy (Đêm 2, 3); cầu tre; dốc/vách/tháp | Chạy CLI thật với inputs | `[AC-10]`…`[AC-13]` | Đạt |
| Rơi khỏi đảo, hồi sinh; tạm dừng; gió mạnh | Chạy CLI thật | `[AC-14]`, `[AC-15]`, `[AC-16]` | Đạt |
| Gió Lạc; Bùa Gió | Chạy CLI thật | `[AC-20]` (4 test), `[AC-21]` (2 test) | Đạt |
| Vùng an toàn, lịch sinh Bóng Mực, điểm, thắng/thua, thứ tự trong tick | Chạy CLI thật | `[AC-30]`…`[AC-34]` | Đạt |
| Định dạng scenario/inputs v1.1, mã thoát 2 | 8 ca sai + 3 ca đúng | `[AC-40]` | Đạt |
| Headless một Đêm ≤ 30 s | Đo đồng hồ tường | `[AC-50]`, `phase-2/perf-fullnight.txt` | Đạt (< 1 s) |
| Mọi đèn trên Đêm 2/3 tới được (qua cầu, dốc, bục nhảy) | Bot `--calm` thắng | `[winnable]`, `phase-2/bot-output.txt` | Đạt |
| Chuỗi 3 Đêm, tạm dừng, cài đặt, HUD, âm thanh, bảng màu | Kiểm tay trên Chrome + ảnh | `docs/media/phase2-*.png`, `docs/spec/phase-2.md` (AC-60..67) | Đạt, kiểm tay (âm thanh chỉ kiểm tai) |
| ≥ 30 FPS ở 1280×720 | Playwright + Chrome GL phần mềm (2 CPU): 30–39 FPS; máy có GPU cao hơn | `assumptions-phase2.md` P2-12, `?fps` | Đạt (đo trong môi trường yếu nhất) |
| Sáng tạo/hiển thị không đổi đầu ra headless | Test ranh giới lõi/hiển thị | `[purity]` | Đạt |

Ghi chú trung thực: bot ngây thơ chỉ thắng được Đêm 1 (≥ 4/20 seed); Đêm 2/3 có kẻ địch nên bot không thắng ổn định, nhưng đã chứng minh mọi đèn tới được khi tắt kẻ địch (`--calm`). Chưa kiểm một người chơi thật hoàn thành Đêm 2/3.

## Phase 3

## Phase 4
