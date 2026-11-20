---
name: add-feature
description: Them mot tinh nang moi cua phase (co che, ban do, ke dich) theo thu tu spec -> test -> loi -> hien thi. Dung khi ticket moi them tinh nang cho Dao Den Long.
---

# Them mot tinh nang

1. **Spec truoc**: them muc `AC-xx` vao `docs/spec/phase-<N>.md` (tieu chi do duoc, co so, co don vi). Cho nao ticket mo ho: ghi gia dinh `P<N>-x` vao `docs/notes/assumptions-phase<N>.md`, roi lam theo gia dinh.
2. **Test truoc**: viet scenario headless trong `tests/v11.test.mjs` (hoac file test cua phase) co nhan `[AC-xx]`. Dung `empty()` de dung san khau trong, `run({night, ticks, scenario, inputs})` chay CLI that. Chay thay no do vi dung ly do.
3. **Loi thuan**: sua `src/core/` (`maps.mjs` cho du lieu ban do, `sim.mjs` cho luat). Khong `Math.random`/`Date`; ngau nhien chi qua `g.rng`. Giu dung thu tu trong tick cua ticket.
4. **Hop dong**: neu them truong snapshot/event/scenario, cap nhat `validate.mjs`, `cli.mjs`, va test dinh dang (ma thoat 2 khi sai).
5. **Hien thi**: sau cung, `web/main.js` chi doc trang thai. Neu ap dung bang mau chuan, dung hang `C`. Chay `npm test` (co `[purity]`) roi `npm run play` kiem tay.
6. **Chung minh**: `node scripts/evidence.mjs <N>` va cap nhat bang truy vet `docs/proof/README.md`.

Khong "lam xanh" test bang cach doi so chuan; so chuan nam trong `game.contract.json`.
