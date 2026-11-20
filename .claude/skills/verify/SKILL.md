---
name: verify
description: Chay kiem chung that cho phase hien tai va luu bang chung. Dung khi sap bao "xong" mot yeu cau hoac truoc khi gan tag phase-N.
---

# Kiem chung mot phase

1. Chay `npm test` - phai xanh. Doc output, khong tin loi tu thuat.
2. Chay tung scenario headless trong `tests/scenarios/` bang `npm run headless` voi dau vao cua scenario, so voi dau ra mong doi.
3. Neu contract yeu cau tat dinh: chay hai lan cung dau vao, so sanh output byte-by-byte.
4. Voi moi yeu cau chinh cua phase, cap nhat bang truy vet `docs/proof/README.md` (yeu cau | cach kiem | bang chung | ket qua). Yeu cau chua dat ghi "chua dat" + ly do.
5. Chot phase N: `node scripts/evidence.mjs N` roi gan tag. Khong sua tay file sinh ra.

Khong dung skill nay de "lam cho test xanh": neu test sai thi sua test kem ly do, neu code sai thi sua code.
