// Bang chung "choi duoc va thang duoc": bot tu choi bang loi mo phong that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { playBot } from "../scripts/bot.mjs";

test("[winnable] Dem 1 (v1.2): bot song toi binh minh voi >= 3/5 den sang, thang >= 15% so seed (co Bong Muc, Gio Lac, hut dau)", () => {
  let wins = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const r = playBot(seed);
    if (r.state === "won") {
      wins++;
      assert.equal(r.reason, "dawn_survived");
      assert.ok(r.lit >= r.need);
    }
  }
  assert.ok(wins >= 3, `bot chi thang ${wins}/20`);
});

test("[winnable] v1.2: khi tat Bong Muc/Gio Lac, bot thang Dem 1 (>=8/10) va Dem 2 (>=5/10); Dem 3 thang voi capacity 14 (successful_lights 3)", () => {
  const calm = { random_shades: false, random_drifters: false };
  let w1 = 0;
  let w2 = 0;
  let w3 = 0;
  for (let seed = 1; seed <= 10; seed++) {
    if (playBot(seed, "good", 1, calm).state === "won") w1++;
    if (playBot(seed, "good", 2, calm).state === "won") w2++;
    if (playBot(seed, "good", 3, { ...calm, player: { successful_lights: 3 } }).state === "won") w3++;
  }
  assert.ok(w1 >= 8, `dem 1: ${w1}/10`);
  assert.ok(w2 >= 5, `dem 2: ${w2}/10`);
  assert.ok(w3 >= 2, `dem 3: ${w3}/10`);
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
