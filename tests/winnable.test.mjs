// Bang chung "choi duoc va thang duoc": bot tu choi bang loi mo phong that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { playBot } from "../scripts/bot.mjs";

test("[winnable] Dem 1: bot ngay tho (chi biet ne + nhat + thap) van thang >= 20% so seed voi so chuan Ticket-02", () => {
  let wins = 0;
  for (let seed = 1; seed <= 20; seed++) if (playBot(seed).state === "won") wins++;
  assert.ok(wins >= 4, `bot chi thang ${wins}/20`);
});

test("[winnable] Dem 2 va Dem 3: khi tat Bong Muc/Gio Lac, bot toi du moi den (qua cau, doc, buc nhay) va thang", () => {
  const calm = { random_shades: false, random_drifters: false };
  const n2 = playBot(1, "good", 2, calm);
  assert.equal(n2.state, "won", JSON.stringify(n2));
  assert.equal(n2.lit, 6);
  const n3 = playBot(2, "good", 3, calm);
  assert.equal(n3.state, "won", JSON.stringify(n3));
  assert.equal(n3.lit, 7);
});

test("[winnable] dung yen thi THUA (game khong tu thang)", () => {
  for (const night of [1, 2, 3]) {
    const r = playBot(1, "idle", night);
    assert.equal(r.state, "lost");
    assert.equal(r.score, 0);
  }
});

test("[winnable] bot choi hai lan cung seed -> cung ket qua (tat dinh ca khi co AI)", () => {
  assert.deepEqual(playBot(7), playBot(7));
});
