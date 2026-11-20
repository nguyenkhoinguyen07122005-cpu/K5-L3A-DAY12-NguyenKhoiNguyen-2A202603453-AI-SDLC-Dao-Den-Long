# Credits

Ghi nguồn và giấy phép của mọi asset, âm thanh, thư viện và công cụ AI tạo nội dung.

| Thành phần | Nguồn | Giấy phép / ghi chú |
|---|---|---|
| Mã nguồn game (lõi, headless, bản chơi, test, script) | Tự viết, có hỗ trợ AI (Claude, Anthropic) | MIT |
| Three.js r160 (`web/vendor/three.module.min.js`) | https://threejs.org, gói npm `three@0.160.0`, bản gốc không sửa | MIT, bản quyền Three.js Authors. Nội dung giấy phép: `web/vendor/THREE_LICENSE.txt` |
| Hình ảnh, mô hình 3D | Dựng bằng hình khối cơ bản của Three.js ngay trong mã | Không dùng asset ngoài |
| Âm thanh | Tổng hợp bằng WebAudio trong mã (`web/main.js`) | Không dùng file âm thanh |
| Phông chữ | Phông hệ thống của trình duyệt | Không nhúng phông |
| Công cụ AI | Claude (claude.ai) hỗ trợ viết mã, test, tài liệu | Người nộp bài đã đọc, chạy và chịu trách nhiệm về kết quả |
| Mô-đun bảng xếp hạng, bench, soak | Tự viết, có hỗ trợ AI (Claude) | MIT |
| Ảnh chụp trong `docs/media/` | Chụp từ chính game (Chrome headless), không dùng nguồn ngoài | Cùng giấy phép của repo |
| Video demo | Quay màn hình chính game bằng công cụ của hệ điều hành | Không có nhạc/âm thanh ngoài |
| Tên nhân vật, lời thoại, mô tả | Theo ticket của khóa học AI20K (Mây, Ông Đăng, Bóng Mực, Gió Lạc) | Nội dung đề bài |

Công cụ AI cụ thể: Claude Sonnet 5.5 qua Claude Code / claude.ai (viết mã, test, tài liệu, ảnh chụp bằng Playwright). Không dùng công cụ AI sinh ảnh hay âm thanh. Không dùng asset có bản quyền ngoài.
