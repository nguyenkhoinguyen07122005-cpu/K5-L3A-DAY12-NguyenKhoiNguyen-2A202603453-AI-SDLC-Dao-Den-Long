# Nhật ký dùng AI

> Ghi số thật từ công cụ bạn dùng (ví dụ lệnh usage/cost của công cụ, hoặc ước tính ghi rõ là ước tính). Không điền số bịa.

| Phase | Công cụ / model | Token hoặc chi phí (ghi "ước tính" nếu không đo được) | Việc chính | Cách tiết kiệm |
|---|---|---|---|---|
| 1 | Claude (claude.ai), model Claude Sonnet 5.5 | Không đo được số token chính xác (claude.ai chỉ hiển thị % quota, tính chung mọi cuộc trò chuyện). Ước tính: Phase 1 dùng 1 cuộc trò chuyện dài trên claude.ai (Claude Sonnet 5.5). Lúc 14:35 ngày 20/11/2026, Settings → Usage hiển thị: phiên hiện tại 20% đã dùng, tuần này 64% đã dùng | Lõi mô phỏng tất định + headless theo Test Contract (`src/core`, `src/headless`), 53 test, bot tự chơi, bản chơi 3D Three.js, tài liệu | Dán nguyên văn Test Contract một lần thay vì mô tả lại; làm lõi + test trước, đồ họa sau; chỉ một ý sáng tạo nhỏ (hiển thị), không thêm cơ chế |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |

## Lần AI sai

| Phase | AI sai ở đâu (bịa yêu cầu / test giả / sửa sai chỗ...) | Phát hiện bằng cách nào | Chỉnh harness thế nào |
|---|---|---|---|
| 1 | Viết test đọc "snapshot cuối" khi `--ticks` nhỏ hơn `--snapshot-every`, nên đọc nhầm tick 0 (5 test đỏ giả) | Chạy `npm test`, đọc lỗi từng ca, tái hiện bằng CLI tay: lõi đúng, test sai. Đối chiếu contract: snapshot chỉ ở bội của `--snapshot-every` | Giữ đúng chữ contract (không thêm snapshot cuối), sửa test dùng `--snapshot-every 1`; ghi vào mục C1 của `docs/notes/assumptions.md` |
| 1 | Test "nạp từng phần" tự mâu thuẫn: đom đóm đặt sẵn bị nhặt trước khi nạp nên không còn gì để nạp lần hai | Test đỏ, đối chiếu thứ tự xử lý trong tick | Viết lại kịch bản (người chơi đi nhặt rồi quay lại nạp) |
| 1 | Test "Bóng Mực không vào vùng an toàn" kiểm cả tick 0, trong khi scenario được phép đặt Bóng Mực ở bất kỳ đâu | Test đỏ ở đúng tick 0; contract nói dựng scenario không chỉnh lại trạng thái | Chỉ kiểm từ tick 1; ghi mục C2 |
| 1 | Máy chủ `npm run play` chặn nhầm `src/core` (403) trên Windows vì so sánh đường dẫn `\` với `/`; lõi chỉ test trên Linux nên không thấy. AI còn chẩn đoán sai lúc đầu (nghĩ là thiếu WebGL) | Người dùng mở DevTools Console thấy `403 sim.mjs`; AI tái hiện bằng mô phỏng đường dẫn Windows | Tách `scripts/static-paths.mjs` và thêm `tests/serve.test.mjs` chạy cả `path.win32` lẫn `path.posix` |

