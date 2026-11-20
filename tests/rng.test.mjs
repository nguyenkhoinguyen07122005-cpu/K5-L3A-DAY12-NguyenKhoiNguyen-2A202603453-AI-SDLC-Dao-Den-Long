import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/core/rng.mjs";

test("cung seed -> cung chuoi so (tat dinh)", () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test("khac seed -> khac chuoi so", () => {
  assert.notEqual(createRng(1)(), createRng(2)());
});

test("gia tri nam trong [0, 1)", () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});
