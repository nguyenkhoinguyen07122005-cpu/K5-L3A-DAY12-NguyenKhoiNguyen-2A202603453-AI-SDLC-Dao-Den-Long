// Bang chung "choi duoc va thang duoc": bot tu choi bang loi mo phong that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { playBot } from "../scripts/bot.mjs";

test("[winnable] bot don gian thang it nhat 60% trong 20 seed (man choi thang duoc, khong qua kho)", () => {
  let wins = 0;
  for (let seed = 1; seed <= 20; seed++) if (playBot(seed).state === "won") wins++;
  assert.ok(wins >= 12, `bot chi thang ${wins}/20`);
});

test("[winnable] dung yen thi THUA (game khong tu thang)", () => {
  for (const seed of [1, 2, 3]) {
    const r = playBot(seed, "idle");
    assert.equal(r.state, "lost");
    assert.equal(r.score, 0);
  }
});

test("[winnable] bot choi hai lan cung seed -> cung ket qua (tat dinh ca khi co AI)", () => {
  assert.deepEqual(playBot(7), playBot(7));
});
