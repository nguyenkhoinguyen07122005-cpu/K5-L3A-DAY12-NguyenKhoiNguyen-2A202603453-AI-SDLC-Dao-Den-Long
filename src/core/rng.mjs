// RNG co hat giong (seeded) - mulberry32.
// Quy uoc: logic game KHONG duoc goi Math.random() / Date.now(); moi thu ngau nhien
// phai di qua day de "cung dau vao -> cung ket qua" (tinh tat dinh).
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
