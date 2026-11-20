# Retro

## Đánh giá từng phase

| Phase | Yêu cầu đạt | Chưa đạt (và lý do) | Có hỏng phase trước không | Cần chỉnh gì |
|---|---|---|---|---|
| 1 | Lõi mô phỏng tất định, headless theo Test Contract v1.0, Đêm 1, bot tự chơi (thắng 15/20 seed), bản chơi 3D | Phần 3D chỉ có ảnh chụp, không có test tự động chặt như lõi | — | Thêm kiểm tra tự động cho giao diện sớm hơn |
| 2 | Số chuẩn Ticket-02, 3 bản đồ, lướt, rơi/hồi sinh, Gió Lạc, Bùa Gió, gió, tạm dừng; 34 test mới | Không có mục nào chưa đạt | Không | Đo FPS bằng Playwright ngay từ đầu |
| 3 | Nhiên liệu đèn, Bóng Mực hút dầu, thắng ở bình minh, sức chứa động, bảng màu dễ phân biệt; 18 test mới | Cân bằng khó: bản đầu bot chỉ thắng 1/20 seed, phải hoàn lại hành vi lang thang của Bóng Mực | Có: luật thắng mới làm 9 test cũ sai. Đã sửa từng test kèm lý do trong CHANGELOG | Ghi bảng "luật nào bị thay" ngay trong spec |
| 4 | Contract v1.3, bảng xếp hạng + xuất, soak 10 Đêm, bench, đổi phím, phụ đề, giảm chuyển động, chữ lớn, đóng gói và Release | `peak_mem_mb` của bench là `null` (trang web không đọc được RSS của trình duyệt, đã ghi giải thích trong `notes`) | Không: 113/113 test (Phase 1–3 + mới) vẫn qua | thêm test giao diện |

Số liệu Phase 4 đo trên máy của tôi (i7-12650H, Intel UHD, Chrome): bench `avg_fps` 331, `p1_low_fps` 81,8, `load_ms` 1150; soak `crashes` 0, bộ nhớ 42,5 → 42,7 MB. Cả 10 Đêm trong soak đều `lost`, đúng như dự kiến vì đầu vào ngẫu nhiên không chơi thật. Ticket chỉ yêu cầu không crash và bộ nhớ không phình.

## Tổng kết dự án

- **Điều hiệu quả khi làm với AI:** dán nguyên văn ticket một lần; giữ lõi `src/core` thuần để test chạy nhanh (cả bộ 113 test khoảng 8 giây); dùng bot tự chơi để chứng minh màn thắng được; dùng Playwright kiểm giao diện thay vì chơi tay.
- **Điều không hiệu quả:** tối ưu đồ họa mò ở Phase 3 mất thời gian và vài thử nghiệm không kết luận được; AI tự tin về số liệu (FPS, RSS) khi chưa đo trên máy thật.
- **AI sai và cách phát hiện:** chủ yếu là test viết sai chứ không phải lõi sai (đọc nhầm snapshot, đặt sai khoảng cách 3D, đặt sai số lượng đom đóm). Phát hiện bằng cách chạy `npm test`, tái hiện bằng CLI tay và đối chiếu lại ticket. Một lỗi lớn lọt qua test là máy chủ chặn nhầm `src/core` trên Windows (so sánh đường dẫn `\` với `/`), người dùng mới thấy khi mở DevTools. Chi tiết ở `ai-log.md`.
- **Harness giúp nhiều nhất:** hook Stop chặn khi test đỏ, kết hợp `npm test` nhanh và `scripts/evidence.mjs` sinh bằng chứng thật cho từng phase.
- **Token / chi phí:** không đo được số token chính xác, chỉ có % hạn mức gói Pro: Phase 3 khoảng 3 điểm % tuần (67% → 70%), Phase 4 khoảng 2 điểm % tuần (70% → 72%) và 11 điểm % phiên (60% → 71%). Phase 1–2 ghi ở `ai-log.md`. Một phần có thể lẫn các chat khác. Cách tiết kiệm: dán ticket một lần, để script thay cho chơi thử bằng tay, giữ test nhanh để mỗi vòng sửa lỗi rẻ.
- **Nếu làm lại:** viết bench và soak ngay từ Phase 1 để thấy xu hướng; chạy thử trên GPU thật sớm; ghi bảng "luật nào đổi" trong spec mỗi phase; thêm test tự động cho giao diện từ đầu.