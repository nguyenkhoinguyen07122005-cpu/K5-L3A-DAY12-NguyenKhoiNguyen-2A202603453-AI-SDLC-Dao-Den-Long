// Ban do chuan cua 3 Dem (Ticket-02, Phan 2). Du lieu thuan, khong phu thuoc gi.
// Quy uoc goc: do tu truc +X, x = cx + r*cos(a), z = cz + r*sin(a) (a tang nguoc chieu kim dong ho
// khi nhin tu tren xuong voi +Z huong len tren man hinh). Dua vao day: doc dung cua dốc Dem 3 noi tang 1 (z > 0).
const rad = (a) => (a * Math.PI) / 180;
const r3 = (v) => Math.round(v * 1000) / 1000;
export function ring(cx, cz, r, startDeg, stepDeg, n, y = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(startDeg + i * stepDeg);
    return [r3(cx + r * Math.cos(a)), y, r3(cz + r * Math.sin(a))];
  });
}
const inDisc = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) <= r + 1e-9;

// ---------------- Dem 1 - Dao Ben ----------------
const night1 = {
  night: 1,
  name: "Đảo Bến",
  start: [0, 0, 0],
  lanterns: [
    ["L1", [0, 0, 25]],
    ["L2", [23.8, 0, 7.7]],
    ["L3", [14.7, 0, -20.2]],
    ["L4", [-14.7, 0, -20.2]],
    ["L5", [-23.8, 0, 7.7]],
  ],
  moteSpawn: [...ring(0, 0, 12, 0, 45, 8), ...ring(0, 0, 33, 0, 22.5, 16)],
  shadeSpawn: ring(0, 0, 37, 15, 30, 12),
  shadeInterval: 480,
  shadeMax: 6,
  shadeSpeedKey: "shade_speed",
  durationKey: "night1_duration_s",
  charms: [],
  pads: [],
  wind: false,
  drifters: false,
  ground: (x, z) => (inDisc(x, z, 0, 0, 40) ? 0 : null),
};

// ---------------- Dem 2 - Dao Cau ----------------
const night2 = {
  night: 2,
  name: "Đảo Cau",
  start: [0, 0, 0],
  lanterns: [
    ["L1", [0, 0, 20]],
    ["L2", [17, 0, -10]],
    ["L3", [-17, 0, -10]],
    ["L4", [70, 0, 20]],
    ["L5", [87, 0, -10]],
    ["L6", [53, 0, -10]],
  ],
  moteSpawn: [
    ...ring(0, 0, 10, 0, 90, 4), ...ring(0, 0, 22, 0, 45, 8),
    ...ring(70, 0, 10, 0, 90, 4), ...ring(70, 0, 22, 0, 45, 8),
  ],
  shadeSpawn: [...ring(0, 0, 26, 22.5, 45, 8), ...ring(70, 0, 26, 22.5, 45, 8)],
  shadeInterval: 420,
  shadeMax: 8,
  shadeSpeedKey: "shade_speed",
  durationKey: "night2_duration_s",
  charms: [["C1", [35, 0, 0]]],
  // bục nhảy: chân May cham -> bay ve tam dao kia
  pads: [
    { pos: [20, 0, 18], radius: 1, vy: 14, hspeed: 24, target: [70, 0, 0] },
    { pos: [50, 0, -18], radius: 1, vy: 14, hspeed: 24, target: [0, 0, 0] },
  ],
  wind: false,
  drifters: true,
  ground: (x, z) => {
    if (inDisc(x, z, 0, 0, 28) || inDisc(x, z, 70, 0, 28)) return 0;
    if (x >= 26 && x <= 44 && Math.abs(z) <= 2) return 0; // cau tre
    return null;
  },
};

// ---------------- Dem 3 - Dao Chuong ----------------
const RAMP_ANGLES = [30, 150];
const night3 = {
  night: 3,
  name: "Đảo Chuông",
  start: [0, 0, -12], // gia dinh: (0,0,0) nam trong thap chuong cua tang 2 (xem assumptions)
  lanterns: [
    ["L1", [0, 6, 6]],
    ["L2", [18, 3, 10]],
    ["L3", [-18, 3, 10]],
    ["L4", [35, 0, -10]],
    ["L5", [-35, 0, -10]],
    ["L6", [20, 0, -35]],
    ["L7", [-20, 0, -35]],
  ],
  moteSpawn: [...ring(0, 0, 34, 0, 20, 18, 0), ...ring(0, 0, 18, 20, 20, 8, 3), ...ring(0, 0, 5, 45, 90, 4, 6)],
  shadeSpawn: ring(0, 0, 43, 0, 22.5, 16),
  shadeInterval: 360,
  shadeMax: 10,
  shadeSpeedKey: "shade_speed_night3",
  durationKey: "night3_duration_s",
  charms: [["C1", [30, 0, 25]], ["C2", [-30, 0, 25]]],
  pads: [{ pos: [0, 3, 13], radius: 1, vy: 12, hspeed: 8, dir: [0, -1] }],
  tower: { r: 2, top: 14 }, // thap chuong cao 8 m dat tren tang 2 (Y=6)
  wind: true,
  drifters: true,
  ground: (x, z) => {
    const r = Math.hypot(x, z);
    let h = r <= 40.0 + 5 ? 0 : null; // dao ban kinh 45
    if (z > 0 && r >= 12 && r <= 24) h = 3; // tang 1: vanh khan nua z > 0
    if (r <= 8) h = 6; // tang 2
    for (const a of RAMP_ANGLES) {
      const c = Math.cos(rad(a));
      const s = Math.sin(rad(a));
      const u = x * c + z * s; // doc theo ban kinh
      const v = -x * s + z * c; // ngang
      if (u >= 24 && u <= 30 && Math.abs(v) <= 1.5) h = Math.max(h ?? 0, (30 - u) / 2);
    }
    return h;
  },
};

export const NIGHTS = { 1: night1, 2: night2, 3: night3 };
