# AGENTS.md - Dao Den Long

Game 3D goc nhin thu ba. Logic game la module thuan (khong phu thuoc do hoa) de chay headless theo Test Contract.

## Lenh
- Test: `npm test` (Node >= 20)
- Choi ban 3D: `npm run play` (http://localhost:8080)
- Headless: `npm run headless -- --seed 1 --night 1 --ticks 600 --out out.jsonl` (Test Contract v1.0 nguyen van trong `docs/notes/assumptions.md`)
- Bot tu choi (kiem tra thang duoc): `npm run bot`
- Sinh bang chung cho phase N: `node scripts/evidence.mjs N`
- Chot phase: `.\scripts\tag-phase.ps1 -Phase N` (Windows) - chi khi cay lam viec sach va test xanh

## Ban do ma nguon
- `game.contract.json`: nguon duy nhat cho moi con so (tuning). Sua so thi sua o day, test doc tu day.
- `src/core/sim.mjs`: toan bo luat. `src/core/validate.mjs`: kiem tra dinh dang inputs/scenario (loi -> exit 2).
- `src/headless/cli.mjs`: CLI. `web/main.js`: ban 3D, chi goi `createGame`, `step`, `timeLeft`.
- Thu tu xu ly trong mot tick: xem `step()` va muc G16 trong `docs/notes/assumptions.md`.

## Quy uoc
- `src/core/` = logic thuan, tat dinh: cam `Math.random()`, `Date.now()`, doc file/mang. Ngau nhien chi qua `createRng(seed)`.
- Hien thi (3D/UI) nam rieng, chi doc trang thai tu `src/core/`.
- Commit nho, mot viec mot commit; thong diep neu ro viec va phase.

## Quy trinh
1. Doc yeu cau cua phase, dan nguyen van doan lien quan khi giao viec. KHONG tu them yeu cau.
2. Cho nao mo ho: ghi gia dinh vao `docs/notes/assumptions.md`, roi lam theo gia dinh do.
3. Viet cach kiem chung (test/scenario) TRUOC khi viet code.
4. Chua ket thuc khi `npm test` do (hook Stop chan viec nay).
5. Phase moi lam test cu sai: sua hoac bo KEM LY DO trong `docs/notes/assumptions.md`, khong tat am tham.

## Sang tao (toi da 4/10 diem hang muc F)
- Chi them SAU khi phan loi dung va co bang chung. Y nho, ro, chay dung hon nhieu y do dang.
- Thuc the/co che them KHONG duoc lam doi dau ra headless theo Test Contract (kiem bang scenario cu).
- Ghi vao muc "Sang tao cua toi" trong README kem bang chung ngan.

## Cam
- Khong commit `.env`, API key, token. Khong sua tay file trong `docs/proof/` (chi sinh bang `scripts/evidence.mjs`).
- Khong ghi "dat" cho yeu cau chua lam. Khong dung asset ngoai tru CC0/CC-BY/MIT, ghi nguon vao `CREDITS.md`.
