// Ban choi 3D cua Dao Den Long (3 Dem). Dung CHUNG loi mo phong voi che do headless.
// Moi hieu ung/am thanh/giao dien o day chi la hien thi - khong anh huong ket qua mo phong.
import * as THREE from "./vendor/three.module.min.js";
import { createGame, step, timeLeft, TICKS_PER_SECOND, WORLD, nightDuration } from "../src/core/sim.mjs";
import { addEntry, normalize, validName } from "../src/shared/leaderboard.mjs";
import { NIGHTS } from "../src/core/maps.mjs";

const contract = await (await fetch("../game.contract.json", { cache: "no-store" })).json();
const T = contract.tuning;
const params = new URLSearchParams(location.search);
const BENCH = params.has("bench"); // benchmark (Ticket-04): canh chuan, xem scripts/bench.mjs
const DEMO = params.has("demo"); // chi de quay/kiem thu: tu dong choi
const $ = (id) => document.getElementById(id);

// Bang mau co dinh (Ticket-02)
const C = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampLit: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeLine: 0x7a3cff, shadeLineCb: 0x00b3ff, shadeStun: 0x3a3450, may: 0xe8e2d0, red: 0xc8102e, gold: 0xf2c14e, wind: 0x8fa3b8,
};

const NIGHT_TEXT = {
  1: { quote: "Cháu ơi, năm ngọn đèn ở bến tắt cả rồi. Đèn nào cũng cạn dầu dần, nên đừng thắp một lần rồi bỏ. Giữ cho ít nhất ba ngọn còn sáng tới bình minh.", tip: "Mẹo: đèn có thanh dầu; dưới 30 thì mất vùng an toàn và Bóng Mực kéo tới hút dầu. {interact} để châm thêm." },
  2: { quote: "Đảo Cau có hai bờ nối nhau bằng cầu tre, không có lan can. Coi chừng Gió Lạc: nó thích cuỗm ánh sáng của cháu. Bục nhảy sẽ đưa cháu sang bờ bên kia. Cần bốn trong sáu ngọn còn sáng khi trời hửng.", tip: "Mẹo: nhặt Bùa Gió (khăn đỏ) giữa cầu để chạy nhanh và lướt liên tục." },
  3: { quote: "Chuông trên đảo sắp ngân. Gió sẽ nổi từng đợt, cháu nghe tiếng lá xào xạc thì bám chắc vào. Muốn lên đỉnh tháp, hãy đi dốc rồi nhảy qua bục. Cần năm trong bảy ngọn còn sáng khi trời hửng.", tip: "Mẹo: đèn L1 nằm trên đỉnh, L2/L3 ở tầng giữa; dốc ở hai bên." },
};

// ---------------------------------------------------------------- cai dat (luu localStorage)
const DEFAULT_KEYS = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", jump: "Space", dash: "ShiftLeft", interact: "KeyE", pulse: "KeyF", pause: "Escape", camLeft: "KeyZ", camRight: "KeyX" };
const ACTIONS = Object.keys(DEFAULT_KEYS);
const ACTION_NAME = { up: "Đi lên", down: "Đi xuống", left: "Sang trái", right: "Sang phải", jump: "Nhảy", dash: "Lướt", interact: "Tương tác (thắp/châm đèn)", pulse: "Tỏa sáng", pause: "Tạm dừng", camLeft: "Xoay camera trái", camRight: "Xoay camera phải" };
const settings = { volume: 0.7, sens: 1, colorblind: false, reduceMotion: false, largeText: false, captions: true, keys: { ...DEFAULT_KEYS } };
try {
  const saved = JSON.parse(localStorage.getItem("ddl-settings") || "{}");
  Object.assign(settings, saved);
  settings.keys = { ...DEFAULT_KEYS };
  for (const a of ACTIONS) if (typeof saved.keys?.[a] === "string" && saved.keys[a]) settings.keys[a] = saved.keys[a];
} catch { /* khong co localStorage thi dung mac dinh */ }
// phim phu: mui ten, P, Shift phai (chi dung khi phim do chua duoc gan cho hanh dong nao)
const ALT_KEYS = { up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"], pause: ["KeyP"], dash: ["ShiftRight"] };
const assignedKey = (code) => Object.values(settings.keys).includes(code);
function matches(action, code) {
  if (settings.keys[action] === code) return true;
  if (assignedKey(code)) return false;
  return !!ALT_KEYS[action]?.includes(code) && (action !== "dash" || settings.keys.dash === "ShiftLeft");
}
function keyLabel(code) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return { Space: "Space", ShiftLeft: "Shift trái", ShiftRight: "Shift phải", ControlLeft: "Ctrl trái", ControlRight: "Ctrl phải", AltLeft: "Alt trái", AltRight: "Alt phải", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Escape: "Esc", Enter: "Enter", Tab: "Tab", Backspace: "Backspace" }[code] ?? code;
}
const K = (a) => `<kbd>${keyLabel(settings.keys[a])}</kbd>`;
const KL = (a) => keyLabel(settings.keys[a]);
function saveSettings() {
  try {
    localStorage.setItem("ddl-settings", JSON.stringify(settings));
  } catch { /* bo qua */ }
}

// Bang mau de phan biet (Ticket-03): vien/mat Bong Muc #00B3FF, UI nguy hiem #FFFFFF kem bieu tuong canh bao
const shadeLineHex = () => (settings.colorblind ? C.shadeLineCb : C.shadeLine);
function applyColorblind() {
  document.body.classList.toggle("cb", !!settings.colorblind);
  document.body.classList.toggle("big", !!settings.largeText);
  document.body.classList.toggle("rm", !!settings.reduceMotion);
}
applyColorblind();

// ---------------------------------------------------------------- scene
const canvas = $("view");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
} catch (err) {
  window.__ddlFatal?.(
    "Trình duyệt không bật được WebGL",
    `<p>Game 3D cần WebGL. Thử lần lượt:</p>
     <p>1. Mở <b>http://localhost:8080</b> bằng <b>Google Chrome</b>.<br>
     2. Edge: <b>Settings → System and performance → bật "Use graphics acceleration when available"</b>, rồi khởi động lại Edge.<br>
     3. Gõ <b>edge://gpu</b> (hoặc <b>chrome://gpu</b>) và kiểm tra dòng WebGL không phải "Disabled".</p>
     <p style="opacity:.7;font-size:13px">Chi tiết kỹ thuật: ${String(err.message).replace(/</g, "&lt;")}</p>`,
  );
  throw err;
}
let pixelRatio = Math.min(devicePixelRatio, 1.5);
let lowStreak = 0;
let fpsLow = false;
renderer.setPixelRatio(pixelRatio);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.FogExp2(C.fog, 0.012);
const ambient = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0x6a7cc8, 0x24324a, 0.45);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8fa4ff, 0.55);
moon.position.set(-30, 60, -20);
scene.add(moon);

// bien may
const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: C.sea, fog: true }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -9.5;
scene.add(sea);

let stars;
{
  const n = 700;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = (i * 2.399963) % (Math.PI * 2);
    const h = 0.18 + ((i * 0.618034) % 1) * 0.8;
    const r = 190;
    pos[i * 3] = Math.cos(a) * r * Math.sqrt(1 - h * h);
    pos[i * 3 + 1] = h * r;
    pos[i * 3 + 2] = Math.sin(a) * r * Math.sqrt(1 - h * h);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, fog: false, transparent: true }));
  scene.add(stars);
}

// ---------------------------------------------------------------- do hoa (chi hien thi, khong dung RNG cua loi)
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const lcg = (seed) => {
  let x = seed >>> 0;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
};
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, "rgba(255,240,190,1)");
  r.addColorStop(0.25, "rgba(255,200,110,.55)");
  r.addColorStop(1, "rgba(255,160,60,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, w, h);
});
const cloudTex = canvasTex(128, 64, (g, w, h) => {
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 11;
    const y = 30 + Math.sin(i * 1.7) * 8;
    const r = g.createRadialGradient(x, y, 0, x, y, 24);
    r.addColorStop(0, "rgba(150,165,225,.5)");
    r.addColorStop(1, "rgba(150,165,225,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  }
});
const grassTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#2f5d50";
  g.fillRect(0, 0, w, h);
  const rnd = lcg(7);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const rr = 6 + rnd() * 22;
    g.fillStyle = rnd() < 0.5 ? "rgba(70,130,100,.16)" : "rgba(20,55,48,.2)";
    g.beginPath();
    g.arc(x, y, rr, 0, 7);
    g.fill();
  }
  for (let i = 0; i < 900; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    g.strokeStyle = rnd() < 0.5 ? "rgba(120,190,130,.35)" : "rgba(25,70,55,.45)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 4);
    g.stroke();
  }
}, [7, 7]);
const rockTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = "#6b5a46";
  g.fillRect(0, 0, w, h);
  const rnd = lcg(11);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = rnd() < 0.5 ? "rgba(40,30,22,.28)" : "rgba(190,160,120,.14)";
    g.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 26, 2 + rnd() * 6);
  }
}, [10, 1]);
const seaTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#12384a";
  g.fillRect(0, 0, w, h);
  const rnd = lcg(3);
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = `rgba(140,190,230,${0.05 + rnd() * 0.12})`;
    g.lineWidth = 1 + rnd() * 1.5;
    const x = rnd() * w;
    const y = rnd() * h;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 8 + rnd() * 22, y);
    g.stroke();
  }
}, [40, 40]);

// bau troi: gradient dem + trang + may + den troi bay
const skyGroup = new THREE.Group();
scene.add(skyGroup);
{
  const geo = new THREE.SphereGeometry(300, 24, 16);
  const col = [];
  const top = new THREE.Color(0x060a1c);
  const hor = new THREE.Color(0x2c3a78);
  const v = geo.attributes.position;
  for (let i = 0; i < v.count; i++) {
    const k = Math.min(1, Math.max(0, v.getY(i) / 200));
    const c = hor.clone().lerp(top, Math.pow(k, 0.6));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);
  const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xdfe8ff, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  moonDisc.position.set(-110, 95, -170);
  moonDisc.scale.set(75, 75, 1);
  scene.add(moonDisc);
  const moonCore = new THREE.Mesh(new THREE.CircleGeometry(9, 28), new THREE.MeshBasicMaterial({ color: 0xf4f1dc, fog: false }));
  moonCore.position.copy(moonDisc.position).multiplyScalar(0.985);
  moonCore.lookAt(0, 0, 0);
  scene.add(moonCore);
  const rnd = lcg(21);
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, transparent: true, opacity: 0.55, depthWrite: false }));
    const a = rnd() * Math.PI * 2;
    c.position.set(Math.cos(a) * 200, 35 + rnd() * 50, Math.sin(a) * 200);
    c.scale.set(90 + rnd() * 70, 40, 1);
    skyGroup.add(c);
  }
}
const skyLanterns = [];
{
  const rnd = lcg(5);
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    const a = rnd() * Math.PI * 2;
    const r = 70 + rnd() * 110;
    sp.userData = { a, r, y: -8 + rnd() * 90, sp: 0.8 + rnd() * 1.4, s: 2.2 + rnd() * 2 };
    sp.scale.set(sp.userData.s, sp.userData.s, 1);
    scene.add(sp);
    skyLanterns.push(sp);
  }
}
// hon dao xa (bong toi)
{
  const rnd = lcg(33);
  const m = new THREE.MeshLambertMaterial({ color: 0x1a2748 });
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 130 + rnd() * 90;
    const isle = new THREE.Mesh(new THREE.ConeGeometry(8 + rnd() * 12, 6 + rnd() * 12, 7), m);
    isle.position.set(Math.cos(a) * r, -9.5 + 3 + rnd() * 3, Math.sin(a) * r);
    scene.add(isle);
  }
}
sea.material.map = seaTex;
sea.material.color.set(0xffffff);
sea.material.needsUpdate = true;
function animateScenery(time) {
  seaTex.offset.set(time * 0.004, time * 0.002);
  skyGroup.rotation.y = time * 0.004;
  for (const l of skyLanterns) {
    const u = l.userData;
    const y = ((u.y + time * u.sp) % 100) - 10;
    const a = u.a + time * 0.01;
    l.position.set(Math.cos(a) * u.r, y, Math.sin(a) * u.r);
    l.material.opacity = 0.35 + 0.5 * Math.sin(time * 2 + u.a * 5) ** 2;
  }
}

// ---------------------------------------------------------------- dung dia hinh theo dem (hien thi; vat ly o loi)
const grassWorldTex = grassTex.clone();
grassWorldTex.repeat.set(0.07, 0.07);
grassWorldTex.needsUpdate = true;
const mats = {
  grass: new THREE.MeshLambertMaterial({ map: grassTex }),
  grassWorld: new THREE.MeshLambertMaterial({ map: grassWorldTex }),
  sand: new THREE.MeshLambertMaterial({ color: C.sand }),
  rock: new THREE.MeshLambertMaterial({ map: rockTex }),
  wood: new THREE.MeshLambertMaterial({ color: C.wood }),
};
let terrain = null;
function disc(r, topY, thick = 3) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.93, thick, 72), [mats.rock, mats.grass, mats.rock]);
  m.position.y = topY - thick / 2;
  return m;
}
function buildTerrain(night) {
  if (terrain) {
    scene.remove(terrain);
    terrain.traverse((o) => o.geometry?.dispose?.());
  }
  const t = new THREE.Group();
  const map = NIGHTS[night];
  if (night === 1) t.add(disc(40, 0));
  if (night === 2) {
    const a = disc(28, 0);
    const b = disc(28, 0);
    b.position.x = 70;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mats.wood);
    bridge.position.set(35, -0.15, 0);
    t.add(a, b, bridge);
    for (let i = 0; i < 9; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.34, 4.04), new THREE.MeshLambertMaterial({ color: 0x4a3322 }));
      plank.position.set(27 + i * 2, -0.14, 0);
      t.add(plank);
    }
  }
  if (night === 3) {
    t.add(disc(45, 0, 4));
    // tang 1: vanh khan nua z>0 cao 3 m
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, Math.PI, Math.PI * 2, false);
    shape.lineTo(12, 0);
    shape.absarc(0, 0, 12, Math.PI * 2, Math.PI, true);
    shape.closePath();
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 40 }), [mats.grassWorld, mats.rock]);
    t1.rotation.x = -Math.PI / 2;
    t.add(t1);
    t.add(disc(8, 6, 6));
    // thap chuong
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2, 8, 16), new THREE.MeshLambertMaterial({ color: C.sand }));
    tower.position.y = 6 + 4;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 16), mats.wood);
    roof.position.y = 6 + 9;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.8), new THREE.MeshLambertMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0.35 }));
    bell.position.y = 6 + 7;
    t.add(tower, roof, bell);
    // hai doc 3 m rong, tu chan (r=30,y=0) len dinh (r=24,y=3)
    for (const a of [30, 150]) {
      const ang = (a * Math.PI) / 180;
      const len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), mats.wood);
      ramp.position.set(27 * Math.cos(ang), 1.5 - 0.15, 27 * Math.sin(ang));
      ramp.rotation.y = -ang;
      ramp.rotation.z = Math.atan2(3, 6);
      t.add(ramp);
    }
  }
  for (const pad of map.pads) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 24), new THREE.MeshLambertMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0.6 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: C.lampCore }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    g.add(base, ring);
    g.position.set(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]);
    t.add(g);
  }
  decorate(t, night, map);
  scene.add(t);
  terrain = t;
}

// canh quan: co, hoa, da, cay cau, ben da quanh dao (chi de dep; khong va cham, khong anh huong loi)
let lowGfx = false;
function decorate(t, night, map) {
  const root = t;
  t = new THREE.Group(); // props: co/hoa/da/cay (tat khi may yeu)
  root.add(t);
  root.userData.props = t;
  t.visible = !lowGfx;
  const rnd = lcg(1000 + night);
  const spots = [];
  const pts = [...map.lanterns.map(([, p]) => p), ...map.pads.map((p) => p.pos), ...map.charms.map(([, p]) => p), map.start];
  const R = night === 3 ? 48 : night === 2 ? 100 : 44;
  const x0 = night === 2 ? -30 : -R;
  const x1 = night === 2 ? 100 : R;
  const zr = night === 2 ? 30 : R;
  const onBridge = (x, z) => night === 2 && x > 23 && x < 47 && Math.abs(z) < 3.2;
  const edgeNear = (x, z) => [0, 1, 2, 3, 4, 5, 6, 7].some((k) => map.ground(x + Math.cos(k * 0.785) * 3.5, z + Math.sin(k * 0.785) * 3.5) == null);
  for (let i = 0; i < 4200 && spots.length < 700; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const z = -zr + rnd() * 2 * zr;
    const y = map.ground(x, z);
    if (y == null || onBridge(x, z)) continue;
    if (pts.some((p) => Math.hypot(p[0] - x, p[2] - z) < 3.2)) continue;
    spots.push([x, y, z, rnd(), edgeNear(x, z)]);
  }
  const tuftGeo = new THREE.ConeGeometry(0.14, 0.55, 4);
  const tuftMat = new THREE.MeshLambertMaterial({ color: 0x5fa07a });
  const tufts = spots.filter((s) => s[3] < 0.6);
  const ti = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length * 3);
  const flowers = spots.filter((s) => s[3] >= 0.6 && s[3] < 0.72);
  const fi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd1e0 }), flowers.length);
  const rocks = spots.filter((s) => s[3] >= 0.72 && s[3] < 0.8);
  const ri = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0x59606e, flatShading: true }), rocks.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const e = new THREE.Euler();
  let k = 0;
  for (const s of tufts) {
    for (let j = 0; j < 3; j++) {
      e.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4);
      q.setFromEuler(e);
      const h = 0.7 + rnd() * 0.9;
      sc.set(1, h, 1);
      m.compose(new THREE.Vector3(s[0] + (j - 1) * 0.22, s[1] + 0.25 * h, s[2] + (rnd() - 0.5) * 0.3), q, sc);
      ti.setMatrixAt(k++, m);
    }
  }
  flowers.forEach((s, i) => {
    m.compose(new THREE.Vector3(s[0], s[1] + 0.3, s[2]), q.identity(), sc.set(1, 1, 1));
    fi.setMatrixAt(i, m);
    fi.setColorAt?.(i, new THREE.Color([0xffd1e0, 0xfff2a8, 0xb9d6ff][i % 3]));
  });
  rocks.forEach((s, i) => {
    e.set(rnd() * 3, rnd() * 6, rnd() * 3);
    const z = 0.5 + rnd() * 1.1;
    m.compose(new THREE.Vector3(s[0], s[1] + 0.15, s[2]), q.setFromEuler(e), sc.set(z, z * 0.7, z));
    ri.setMatrixAt(i, m);
  });
  t.add(ti, fi, ri);
  // cay cau (than cao + tan la) quanh bo dao
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x2f7d5a, flatShading: true });
  const rimSpots = spots.filter((s) => s[4] && s[3] > 0.3 && s[3] < 0.45).slice(0, 26);
  for (const s of rimSpots) {
    const h = 3.2 + rnd() * 2.4;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h, 6), trunkMat);
    tr.position.set(s[0], s[1] + h / 2, s[2]);
    tr.rotation.z = (rnd() - 0.5) * 0.25;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 7), leafMat2);
    crown.position.set(s[0] + tr.rotation.z * -h * 0.5, s[1] + h + 0.4, s[2]);
    t.add(tr, crown);
  }
  // ben da/vien phat sang quanh mep dao de de nhin ranh gioi
  for (const sp of spots.filter((s) => s[4] && s[3] > 0.8 && s[3] < 0.92).slice(0, 40)) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    lamp.position.set(sp[0], sp[1] + 0.12, sp[2]);
    t.add(lamp);
  }
}

// ---------------------------------------------------------------- doi tuong dong
const moteGeo = new THREE.SphereGeometry(0.22, 10, 10);
const moteMat = new THREE.MeshBasicMaterial({ color: C.moteCore });
const moteGlowMat = new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.28, depthWrite: false });
const moteGlowGeo = new THREE.SphereGeometry(0.55, 10, 10);
function makeMote() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(moteGeo, moteMat), new THREE.Mesh(moteGlowGeo, moteGlowMat));
  scene.add(g);
  return g;
}

function makeLantern() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 8), new THREE.MeshLambertMaterial({ color: C.wood }));
  pole.position.y = 1.5;
  const lampMat = new THREE.MeshLambertMaterial({ color: C.lampOff, emissive: C.lampLit, emissiveIntensity: 0 });
  const lampGeo = new THREE.SphereGeometry(0.58, 18, 14);
  lampGeo.scale(1, 1.18, 1);
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  const ribMat = new THREE.MeshLambertMaterial({ color: C.wood });
  for (const ry of [-0.36, 0, 0.36]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(Math.sqrt(Math.max(0.01, 0.58 * 0.58 * (1 - (ry / (0.58 * 1.18)) ** 2))) + 0.02, 0.035, 6, 20), ribMat);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = ry;
    lamp.add(rib);
  }
  lamp.position.y = 3.4;
  const coreMat = new THREE.MeshBasicMaterial({ color: C.lampCore, transparent: true, opacity: 0 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), coreMat);
  core.position.y = 3.4;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 4), new THREE.MeshLambertMaterial({ color: C.wood }));
  cap.position.y = 4.2;
  cap.rotation.y = Math.PI / 4;
  const ringMat = new THREE.MeshBasicMaterial({ color: C.lampLit, transparent: true, opacity: 0.1, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.25, T.safe_radius, 72), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  const discMat = new THREE.MeshBasicMaterial({ color: C.lampLit, transparent: true, opacity: 0, depthWrite: false });
  const dsc = new THREE.Mesh(new THREE.CircleGeometry(T.safe_radius, 72), discMat);
  dsc.rotation.x = -Math.PI / 2;
  dsc.position.y = 0.03;
  // thanh dau tren dinh den (luon quay ve camera) + manh "giay rach" khi den tat
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.34), new THREE.MeshBasicMaterial({ color: 0x0b0f22, transparent: true, opacity: 0.9, depthTest: false, fog: false }));
  const barFillMat = new THREE.MeshBasicMaterial({ color: C.lampLit, transparent: true, opacity: 1, depthTest: false, fog: false, toneMapped: false });
  const barFill = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.22), barFillMat);
  barFill.geometry.translate(1.05, 0, 0);
  barFill.position.set(-1.05, 0, 0.02);
  const bar = new THREE.Group();
  bar.add(barBg, barFill);
  bar.position.y = 5.2;
  bar.renderOrder = 10;
  barBg.renderOrder = 10;
  barFill.renderOrder = 11;
  const tornMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4e, flatShading: true });
  const torn = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.45, 5), tornMat);
  torn.position.y = 2.75;
  torn.rotation.x = Math.PI;
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.45, 8), new THREE.MeshLambertMaterial({ color: 0x6a6f7d }));
  stone.position.y = 0.22;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshLambertMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0.3 }));
  finial.position.y = 4.55;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), new THREE.MeshLambertMaterial({ color: C.red }));
  tassel.position.y = 2.6;
  tassel.rotation.x = Math.PI;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.y = 3.4;
  halo.scale.set(6.5, 6.5, 1);
  g.add(pole, stone, lamp, core, cap, finial, tassel, halo, ring, dsc, bar, torn);
  g.userData = { lampMat, coreMat, ringMat, discMat, lamp, cap, bar, barFill, barFillMat, torn, halo };
  scene.add(g);
  return g;
}

function makeShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: C.shade, emissive: 0x1a0c2a, emissiveIntensity: 0.5 });
  const lineMat = new THREE.MeshBasicMaterial({ color: C.shadeLine, side: THREE.BackSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 14), bodyMat);
  const outline = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 14), lineMat);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.4, 12), bodyMat);
  tail.position.y = -0.9;
  tail.rotation.x = Math.PI;
  const eyeMat = new THREE.MeshBasicMaterial({ color: C.shadeLine });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.3, 0.2, 0.75);
  e2.position.set(0.3, 0.2, 0.75);
  g.add(body, outline, tail, e1, e2);
  g.userData = { bodyMat, eyeMat, lineMat };
  scene.add(g);
  return g;
}

function makeDrifter() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: C.wind, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.35 + i * 0.22, 0.05, 6, 20), m);
    t.rotation.x = Math.PI / 2 + i * 0.5;
    g.add(t);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m));
  g.userData = { m };
  scene.add(g);
  return g;
}

function makeCharm() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: C.red, emissive: C.red, emissiveIntensity: 0.7 });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), m);
  gem.position.y = 1.1;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: C.gold }));
  halo.position.y = 1.1;
  g.add(gem, halo);
  g.userData = { gem, halo };
  scene.add(g);
  return g;
}

const player = new THREE.Group();
{
  const rig = new THREE.Group();
  const L = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: e });
  const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.52, 0.95, 18), L(C.may, 0.08));
  cloak.position.y = 0.62;
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.14, 18), L(C.red, 0.1));
  sash.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 14), L(0xf1d2b3, 0.1));
  head.position.y = 1.4;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1b1420 });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeM);
  e1.position.set(-0.11, 1.42, 0.28);
  const e2 = e1.clone();
  e2.position.x = 0.11;
  const cheekM = new THREE.MeshBasicMaterial({ color: 0xf59aa0 });
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), cheekM);
  c1.scale.set(1.3, 0.8, 0.5);
  c1.position.set(-0.19, 1.33, 0.25);
  const c2 = c1.clone();
  c2.position.x = 0.19;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.5, 26), L(0xd9c28a, 0.06));
  hat.position.y = 1.82;
  const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), L(C.red, 0.2));
  hatTop.position.y = 2.1;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.02, 4, 16, Math.PI), L(C.red));
  strap.position.set(0, 1.3, 0.02);
  strap.rotation.x = Math.PI;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 8, 18), L(C.red, 0.1));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.13;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.05), L(C.red, 0.1));
  tail.geometry.translate(0, -0.35, 0);
  tail.position.set(-0.12, 1.15, -0.36);
  const footM = L(0x4a3322);
  const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), footM);
  f1.scale.set(1, 0.6, 1.4);
  f1.position.set(-0.17, 0.08, 0.08);
  const f2 = f1.clone();
  f2.position.x = 0.17;
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6), L(C.may, 0.05));
  armR.position.set(0.38, 1.0, 0.12);
  armR.rotation.z = -1.0;
  armR.rotation.x = -0.35;
  const armL = armR.clone();
  armL.position.x = -0.38;
  armL.rotation.z = 0.5;
  armL.rotation.x = 0;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6), L(C.wood));
  pole.position.set(0.58, 1.0, 0.2);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), new THREE.MeshBasicMaterial({ color: C.moteCore }));
  orb.position.set(0.58, 1.95, 0.2);
  const orbHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  orbHalo.position.copy(orb.position);
  orbHalo.scale.set(2.4, 2.4, 1);
  const lamp = new THREE.PointLight(0xffe58a, 6, 16, 1.6);
  lamp.position.set(0.58, 1.9, 0.2);
  rig.add(cloak, sash, head, e1, e2, c1, c2, hat, hatTop, strap, scarf, tail, f1, f2, armR, armL, pole, orb, orbHalo, lamp);
  player.add(rig);
  player.userData = { orb, lamp, rig, tail, orbHalo, f1, f2, armL };
  scene.add(player);
}

// la gio (chi hien thi): xuat hien khi gio canh bao/dang thoi
const LEAVES = 90;
const leafPos = new Float32Array(LEAVES * 3);
const leafGeo = new THREE.BufferGeometry();
leafGeo.setAttribute("position", new THREE.BufferAttribute(leafPos, 3));
const leafMat = new THREE.PointsMaterial({ color: C.wind, size: 0.35, transparent: true, opacity: 0, depthWrite: false });
const leaves = new THREE.Points(leafGeo, leafMat);
leaves.frustumCulled = false;
scene.add(leaves);

// ---------------------------------------------------------------- trang thai
let game;
let nightNo = 1;
let totals = [];
let mode = "menu"; // menu | intro | play | over
let acc = 0;
let last = performance.now();
let yaw = 0;
let shake = 0;
let lastSettingsFrom = "menu";
const views = { motes: new Map(), shades: new Map(), drifters: new Map(), charms: [], lanterns: [] };
const fx = [];

function clearViews() {
  for (const m of [views.motes, views.shades, views.drifters]) {
    for (const v of m.values()) scene.remove(v);
    m.clear();
  }
  for (const v of [...views.charms, ...views.lanterns]) scene.remove(v);
  views.charms = [];
  views.lanterns = [];
  for (const f of fx) scene.remove(f.obj);
  fx.length = 0;
}

function newGame(night = nightNo) {
  clearViews();
  resetAlerts();
  nightNo = night;
  const seed = BENCH ? Number(params.get("seed") ?? 42) | 0 : params.has("seed") && !game ? Number(params.get("seed")) | 0 : (Date.now() ^ (Math.random() * 0x7fffffff)) | 0;
  game = createGame({ seed, tuning: T, night, scenario: BENCH ? benchScenario(seed) : {} });
  buildTerrain(night);
  for (let i = 0; i < game.lanterns.length; i++) views.lanterns.push(makeLantern());
  for (let i = 0; i < game.charms.length; i++) views.charms.push(makeCharm());
  acc = 0;
  shake = 0;
  yaw = 0;
  camera.position.set(game.player.pos[0], 8, game.player.pos[2] - 11);
  $("nightName").textContent = NIGHTS[night].name;
  window.__ddl = { game, seed, THREE, scene, camera, renderer, fps: 60 };
  buildHud();
}

// ---------------------------------------------------------------- am thanh
let audio;
let master;
let windNode;
let musicTimer = 0;
function ensureAudio() {
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      master = audio.createGain();
      master.connect(audio.destination);
    }
    master.gain.value = settings.volume;
    if (audio.state === "suspended") audio.resume();
  } catch { /* khong co am thanh thi thoi */ }
}
function blip(freq, dur = 0.12, type = "sine", vol = 0.06, slide = 0, delay = 0) {
  if (!audio) return;
  const t0 = audio.currentTime + delay;
  const o = audio.createOscillator();
  const gn = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gn.gain.setValueAtTime(vol, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn).connect(master);
  o.start(t0);
  o.stop(t0 + dur);
}
const sfx = {
  pickup: (n) => blip(660 + n * 40, 0.09, "sine", 0.05),
  deposit: () => blip(330, 0.18, "triangle", 0.06, 120),
  light: () => [523, 659, 784].forEach((f, i) => blip(f, 0.25, "sine", 0.07, 0, i * 0.09)),
  pulse: () => blip(220, 0.35, "sawtooth", 0.05, 440),
  hit: () => blip(140, 0.3, "square", 0.08, -70),
  jump: () => blip(300, 0.14, "sine", 0.05, 260),
  dash: () => blip(500, 0.12, "sawtooth", 0.04, -300),
  win: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.3, "sine", 0.08, 0, i * 0.12)),
  lose: () => blip(120, 0.8, "sawtooth", 0.07, -60),
  shade: () => blip(90, 0.4, "sawtooth", 0.04, 40),
  tick: () => blip(880, 0.07, "square", 0.04),
  charm: () => [700, 900, 1200].forEach((f, i) => blip(f, 0.15, "triangle", 0.06, 0, i * 0.06)),
  steal: () => blip(520, 0.25, "triangle", 0.06, -300),
};
function windSound(on) {
  if (!audio) return;
  if (on && !windNode) {
    const len = audio.sampleRate * 2;
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.sin(i * 12.9898) * 43758.5453 % 1; // nhieu xac dinh
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500;
    const gn = audio.createGain();
    gn.gain.value = 0.05;
    src.connect(bp).connect(gn).connect(master);
    src.start();
    windNode = { src, gn };
  } else if (!on && windNode) {
    windNode.src.stop();
    windNode = null;
  }
}
// nhac nen: arpeggio ngu cung theo tung dem
const SCALES = { 1: [220, 247, 294, 330, 392], 2: [262, 294, 330, 392, 440], 3: [196, 233, 262, 294, 349] };
let noteI = 0;
function music(on) {
  clearInterval(musicTimer);
  if (!on) return;
  musicTimer = setInterval(() => {
    if (!audio || !game || game.paused || game.state !== "playing") return;
    const sc = SCALES[game.night];
    const f = sc[(noteI * 3 + (noteI >> 2)) % sc.length] * (noteI % 8 === 0 ? 0.5 : 1);
    blip(f, 0.9, "triangle", 0.025);
    noteI++;
  }, 520);
}

// ---------------------------------------------------------------- input
const keys = new Set();
const latch = { jump: false, interact: false, pulse: false, dash: false, pause: false };
let screenDefault = null;

let capturing = null; // dang cho phim moi cho hanh dong nay (man Dieu khien)
addEventListener("keydown", (e) => {
  if (e.target?.tagName === "INPUT" && e.target.type === "text") return; // dang go ten xep hang
  if (capturing) {
    e.preventDefault();
    handleCapture(e);
    return;
  }
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  ensureAudio();
  if (mode !== "play") {
    if ((e.code === "Enter" || e.code === "Space") && screenDefault) screenDefault();
    return;
  }
  if (e.repeat) return;
  keys.add(e.code);
  for (const a of ["jump", "interact", "pulse", "dash", "pause"]) if (matches(a, e.code)) latch[a] = true;
  if (e.code === "KeyR" && game.paused && !assignedKey("KeyR")) restartNight();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => {
  keys.clear();
  if (mode === "play" && game && !game.paused && game.state === "playing") latch.pause = true; // mat focus -> tam dung
});
let dragging = false;
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointermove", (e) => {
  if (dragging) yaw -= e.movementX * 0.3 * settings.sens;
});

const isDown = (a) => {
  for (const c of keys) if (matches(a, c)) return true;
  return false;
};
function readInput(dt) {
  if (isDown("camLeft")) yaw += 100 * dt * settings.sens;
  if (isDown("camRight")) yaw -= 100 * dt * settings.sens;
  // Camera nhin theo (sin yaw, cos yaw). Man hinh-phai = -X khi yaw=0 nen phim phai => x = -1.
  const mx = (isDown("left") ? 1 : 0) - (isDown("right") ? 1 : 0);
  const mz = (isDown("up") ? 1 : 0) - (isDown("down") ? 1 : 0);
  return {
    move: [mx, mz], camYawDeg: yaw,
    jump: isDown("jump") || latch.jump, interact: isDown("interact") || latch.interact, pulse: isDown("pulse") || latch.pulse,
    dash: isDown("dash") || latch.dash, pause: latch.pause,
  };
}

// tu dong choi don gian cho ?demo (chi de kiem thu/quay man hinh)
function demoInput(g, tick) {
  const P = g.player;
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const lantern = g.lanterns.filter((l) => !l.lit || l.fuelU < 60 * 70).sort((a, b) => d2(P.pos, a.pos) - d2(P.pos, b.pos))[0];
  const near = g.motes.slice().sort((a, b) => d2(P.pos, a.pos) - d2(P.pos, b.pos))[0];
  const target = P.carried >= Math.min(T.lantern_cost, capacityNow(g)) && lantern ? lantern.pos : (near ?? lantern)?.pos;
  const out = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  if (!target) return out;
  if (target === lantern?.pos && d2(P.pos, target) < T.interact_radius - 0.5) out.interact = tick % 2 === 0;
  else {
    const dx = target[0] - P.pos[0];
    const dz = target[2] - P.pos[2];
    const d = Math.hypot(dx, dz) || 1;
    out.move = [dx / d, dz / d];
  }
  return out;
}

// ---------------------------------------------------------------- HUD
function buildHud() {
  const bar = $("motebar");
  bar.innerHTML = "";
  for (let i = 0; i < T.capacity_max; i++) bar.appendChild(document.createElement("i"));
}
const capacityNow = (g) => Math.min(T.capacity_max, T.carry_capacity + 2 * g.player.successfulLights);
const needLit = (g) => Math.ceil(T.win_ratio * g.lanterns.length - 1e-9);
// phu de / chi bao hinh anh (Ticket-04 muc 4): Bong Muc xuat hien, gio sap thoi, 10 s cuoi, den fuel < 30
let subsList = [];
let subsT = 0;
let lastTenShown = false;
let windWarnedFor = -1;
let alertShade = null;
const lowFuelSeen = new Set();
function caption(text, secs = 3.5) {
  if (!settings.captions) return;
  subsList.push({ text, until: performance.now() + secs * 1000 });
  if (subsList.length > 3) subsList.shift();
  renderSubs();
}
function renderSubs() {
  const now = performance.now();
  subsList = subsList.filter((x) => x.until > now);
  $("subs").innerHTML = subsList.map((x) => `<div>${x.text}</div>`).join("");
  $("subs").classList.toggle("show", subsList.length > 0);
}
function resetAlerts() {
  subsList = [];
  lastTenShown = false;
  windWarnedFor = -1;
  alertShade = null;
  lowFuelSeen.clear();
  if ($("subs")) renderSubs();
}
function edgeArrow(el, wx, wy, wz) {
  const v = new THREE.Vector3(wx, wy, wz).project(camera);
  const off = v.z > 1 || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.9;
  if (!off) return (el.style.display = "none");
  let x = v.x;
  let y = v.y;
  if (v.z > 1) (x = -x), (y = -y);
  const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
  x = (x / m) * 0.88;
  y = (y / m) * 0.82;
  el.style.display = "block";
  el.style.left = `${((x + 1) / 2) * innerWidth}px`;
  el.style.top = `${((1 - y) / 2) * innerHeight}px`;
  el.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
}
let hintTimer = 0;
function banner(text, cls = "") {
  const b = $("banner");
  b.textContent = text;
  b.className = `hud box show ${cls}`;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => b.classList.remove("show"), 2000);
}

let lastSecond = -1;
function updateHud(time) {
  const g = game;
  const P = g.player;
  $("flames").textContent = "🔥".repeat(Math.max(0, P.flames)) + "·".repeat(Math.max(0, T.flames - P.flames));
  const left = Math.ceil(timeLeft(g));
  $("time").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const low = timeLeft(g) <= 30;
  $("timer").className = `hud box${low ? " low" : ""}${low && !settings.reduceMotion && Math.floor(time * 2) % 2 === 0 ? " blink" : ""}`;
  if (left <= 10 && left !== lastSecond && g.state === "playing" && !g.paused && left > 0) sfx.tick();
  lastSecond = left;
  $("score").textContent = g.score;
  const litN = g.lanterns.filter((l) => l.lit).length;
  const cap = capacityNow(g);
  $("lanternCount").textContent = `${litN}/${g.lanterns.length} đèn (cần ${needLit(g)})`;
  $("lanternCount").classList.toggle("danger", litN < needLit(g) && timeLeft(g) <= 60);
  $("cap").textContent = `✦ ${P.carried}/${cap}`;
  [...$("motebar").children].forEach((c, i) => {
    c.style.display = i < cap ? "" : "none";
    c.classList.toggle("on", i < P.carried);
  });
  // hoi chieu
  const setCd = (id, cd, total) => {
    const el = $(id);
    el.querySelector(".fill").style.height = `${total ? Math.min(100, (cd / total) * 100) : 0}%`;
    el.classList.toggle("ready", cd <= 0);
  };
  setCd("cdDash", P.dashCd / TICKS_PER_SECOND, T.dash_cooldown_s);
  setCd("cdPulse", P.pulseCd / TICKS_PER_SECOND, T.pulse_cooldown_s);
  $("charm").classList.toggle("show", P.charm > 0);
  $("charmS").textContent = P.charm > 0 ? `${Math.ceil(P.charm / TICKS_PER_SECOND)}s` : "";
  // loi nhac gan den
  let prompt = null;
  {
    let best = null;
    let bd = Infinity;
    for (const l of g.lanterns) {
      if (l.lit && l.fuelU >= T.fuel_max * 60) continue;
      const d = Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]);
      if (d <= T.interact_radius && Math.abs(l.pos[1] - P.pos[1]) < 2.5 && d < bd) (best = l), (bd = d);
    }
    if (best) {
      if (best.lit) prompt = `${KL("interact")} — Châm dầu (${Math.floor(best.fuelU / 60)}/${T.fuel_max}, +${T.fuel_per_mote} mỗi ánh sáng)`;
      else {
        const cost = best.everLit ? T.relight_cost : T.lantern_cost;
        prompt = `${KL("interact")} — ${best.everLit ? "Thắp lại" : "Nạp ánh sáng"} (${best.deposited + Math.min(P.carried, cost - best.deposited)}/${cost})`;
      }
    }
  }
  $("prompt").textContent = prompt ?? "";
  $("prompt").classList.toggle("show", !!prompt && P.carried > 0);
  // canh bao gio
  if (g.wind.enabled) {
    const ph = g.simTick % WORLD.wind_period;
    if (!g.wind.active && ph >= WORLD.wind_period - WORLD.wind_warning && g.simTick > 0) banner("🍃 Gió sắp nổi — bám chắc!", "wind");
    else if (g.wind.active) banner("🍃 Gió đang thổi", "wind");
  }
  // chi bao hinh anh
  if (performance.now() - subsT > 250 && subsList.length) (subsT = performance.now()), renderSubs();
  if (g.state === "playing" && !g.paused) {
    if (left <= 10 && left > 0 && !lastTenShown) (lastTenShown = true), caption("⏳ 10 giây cuối!", 4);
    if (g.wind.enabled) {
      const cyc = Math.floor(g.simTick / WORLD.wind_period);
      if (!g.wind.active && g.simTick % WORLD.wind_period >= WORLD.wind_period - WORLD.wind_warning && g.simTick > 0 && windWarnedFor !== cyc) (windWarnedFor = cyc), caption("🍃 Gió sắp nổi — bám chắc!", 4);
    }
    for (const l of g.lanterns) {
      const weak = l.lit && l.fuelU < T.low_fuel_threshold * 60;
      if (weak && !lowFuelSeen.has(l.id)) (lowFuelSeen.add(l.id), caption(`⚠ Đèn ${l.id} sắp cạn dầu (dưới ${T.low_fuel_threshold})`, 4));
      else if (!weak) lowFuelSeen.delete(l.id);
    }
  }
  const a2 = $("arrow2");
  const sh = alertShade && performance.now() < alertShade.until ? g.shades.find((x) => x.id === alertShade.id) : null;
  if (sh && g.state === "playing") edgeArrow(a2, sh.pos[0], sh.pos[1] + 1, sh.pos[2]);
  else a2.style.display = "none";
  // mui ten toi den chua sang gan nhat khi ngoai man hinh
  const un = g.lanterns.filter((l) => !l.lit || l.fuelU < 60 * 30).sort((a, b) => Math.hypot(a.pos[0] - P.pos[0], a.pos[2] - P.pos[2]) - Math.hypot(b.pos[0] - P.pos[0], b.pos[2] - P.pos[2]))[0];
  const arrow = $("arrow");
  if (un && g.state === "playing") {
    const v = new THREE.Vector3(un.pos[0], un.pos[1] + 3, un.pos[2]).project(camera);
    const off = v.z > 1 || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.9;
    if (off) {
      let x = v.x;
      let y = v.y;
      if (v.z > 1) (x = -x), (y = -y);
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x = (x / m) * 0.88;
      y = (y / m) * 0.82;
      arrow.style.display = "block";
      arrow.style.left = `${((x + 1) / 2) * innerWidth}px`;
      arrow.style.top = `${((1 - y) / 2) * innerHeight}px`;
      arrow.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
    } else arrow.style.display = "none";
  } else arrow.style.display = "none";
}

// ---------------------------------------------------------------- man hinh / menu
function show(html, def = null) {
  $("card").innerHTML = html;
  $("screen").classList.remove("hidden");
  document.body.classList.toggle("nohud", mode === "menu" || mode === "intro"); // menu/gioi thieu: an HUD cua van truoc
  screenDefault = def;
  for (const b of $("card").querySelectorAll("button[data-act]")) b.onclick = () => ACT[b.dataset.act]?.();
  $("card").querySelector("button.primary")?.focus();
}
function hide() {
  document.body.classList.remove("nohud");
  $("screen").classList.add("hidden");
  screenDefault = null;
}
const ACT = {
  play: () => startRun(1),
  help: () => showHelp(),
  nights: () => showNightSelect(),
  night1: () => startRun(1),
  night2: () => startRun(2),
  night3: () => startRun(3),
  menu: () => toMenu(),
  settings: () => showSettings(),
  controls: () => showControls(),
  resetkeys: () => {
    settings.keys = { ...DEFAULT_KEYS };
    saveSettings();
    showControls("Đã khôi phục phím mặc định.");
  },
  leaderboard: () => showLeaderboard(),
  continue: () => {
    latch.pause = true;
    hide();
  },
  restart: () => restartNight(),
  next: () => showIntro(nightNo + 1),
  retry: () => restartNight(),
  begin: () => beginNight(),
  back: () => (lastSettingsFrom === "pause" ? showPause() : toMenu()),
};

function toMenu() {
  mode = "menu";
  music(false);
  windSound(false);
  if (!game) newGame(1);
  show(
    `<h1>Đảo Đèn Lồng</h1><h2>Mây và ba hòn đảo</h2>
     <p>Mây phải thắp sáng những ngọn đèn trên ba hòn đảo trước bình minh.</p>
     <button class="primary" data-act="play">Bắt đầu ▶</button>
     <button data-act="nights">Chọn đêm</button>
     <button data-act="leaderboard">Bảng xếp hạng</button>
     <button data-act="help">Hướng dẫn</button>
     <button data-act="settings">Cài đặt</button>`,
    ACT.play,
  );
}

function showNightSelect() {
  show(
    `<h1>Chọn đêm</h1><h2>Chơi thẳng một đêm; thắng đêm nào thì sang đêm kế như thường</h2>
     <button class="primary" data-act="night1">Đêm 1 — ${NIGHTS[1].name}</button>
     <button data-act="night2">Đêm 2 — ${NIGHTS[2].name}</button>
     <button data-act="night3">Đêm 3 — ${NIGHTS[3].name}</button>
     <button data-act="menu">Quay lại</button>`,
    ACT.night1,
  );
}

function showHelp() {
  show(
    `<h1>Hướng dẫn</h1>
     <p class="help">${K("up")}${K("left")}${K("down")}${K("right")}: di chuyển · ${K("jump")}: nhảy · ${K("dash")}: lướt<br>
     ${K("interact")}: nạp ánh sáng / châm dầu · ${K("pulse")}: tỏa sáng (tốn ${T.pulse_cost} ánh sáng, làm choáng Bóng Mực)<br>
     kéo chuột hoặc ${K("camLeft")}/${K("camRight")}: xoay camera · ${K("pause")}: tạm dừng · <kbd>R</kbd> (khi tạm dừng): chơi lại đêm<br>
     Đổi phím: Cài đặt → Điều khiển.</p>
     <p class="help">Nhặt đom đóm (mang ${T.carry_capacity}, thêm 2 mỗi lần thắp thành công, tối đa ${T.capacity_max}), nạp ${T.lantern_cost} ánh sáng để thắp đèn lần đầu, ${T.relight_cost} để thắp lại. Đèn hao dầu ${T.fuel_decay_per_s}/giây; bấm ${K("interact")} bên đèn đang sáng để châm (+${T.fuel_per_mote} dầu mỗi ánh sáng). Đèn dưới ${T.low_fuel_threshold} dầu mất vùng an toàn và bị Bóng Mực tới hút dầu. Thắng khi sống tới bình minh với ít nhất ${Math.round(T.win_ratio * 100)}% số đèn còn sáng. Vùng ${T.safe_radius} m quanh đèn đủ dầu là chỗ an toàn.
     Bóng Mực chạm vào: mất 1 ngọn lửa và đánh rơi nửa số ánh sáng. Gió Lạc cuỗm ánh sáng của bạn. Rơi khỏi đảo cũng mất 1 ngọn lửa.</p>
     <button class="primary" data-act="menu">Quay lại</button>`,
    ACT.menu,
  );
}

function showSettings() {
  show(
    `<h1>Cài đặt</h1>
     <label>Âm lượng <input id="setVol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
     <label>Độ nhạy chuột <input id="setSens" type="range" min="0.3" max="2.5" step="0.1" value="${settings.sens}"></label>
     <label><span>Bảng màu dễ phân biệt</span><input id="setCb" type="checkbox" ${settings.colorblind ? "checked" : ""}></label>
     <label><span>Giảm chuyển động (không rung camera, không chớp màn hình)</span><input id="setRm" type="checkbox" ${settings.reduceMotion ? "checked" : ""}></label>
     <label><span>Chữ lớn (×1,25)</span><input id="setBig" type="checkbox" ${settings.largeText ? "checked" : ""}></label>
     <label><span>Phụ đề và chỉ báo hình ảnh</span><input id="setCap" type="checkbox" ${settings.captions ? "checked" : ""}></label>
     <button data-act="controls">Điều khiển (đổi phím)</button>
     <button class="primary" data-act="back">Xong</button>`,
    ACT.back,
  );
  $("setVol").oninput = (e) => {
    settings.volume = Number(e.target.value);
    if (master) master.gain.value = settings.volume;
    saveSettings();
  };
  const flag = (id, key) => {
    $(id).onchange = (e) => {
      settings[key] = e.target.checked;
      applyColorblind();
      saveSettings();
    };
  };
  flag("setCb", "colorblind");
  flag("setRm", "reduceMotion");
  flag("setBig", "largeText");
  flag("setCap", "captions");
  $("setSens").oninput = (e) => {
    settings.sens = Number(e.target.value);
    saveSettings();
  };
}

// Man doi phim: moi hanh dong mot phim; trung phim thi bao va khong doi; co nut khoi phuc mac dinh; duoc luu
function showControls(msg = "") {
  const rows = ACTIONS.map((a) => `<div class="krow"><span>${ACTION_NAME[a]}</span><button data-rebind="${a}">${keyLabel(settings.keys[a])}</button></div>`).join("");
  show(
    `<h1>Điều khiển</h1>
     <p class="help">Bấm vào một phím rồi nhấn phím mới. Nhấn Esc để hủy.</p>
     ${rows}
     <p class="msg" id="keyMsg" role="alert">${msg}</p>
     <button data-act="resetkeys">Khôi phục mặc định</button>
     <button class="primary" data-act="settings">Xong</button>`,
    ACT.settings,
  );
  for (const b of $("card").querySelectorAll("[data-rebind]")) b.onclick = () => startCapture(b.dataset.rebind, b);
}
function startCapture(action, btn) {
  capturing = action;
  btn.textContent = "Nhấn phím…";
  $("keyMsg").textContent = `Nhấn phím mới cho «${ACTION_NAME[action]}» (Esc để hủy)`;
}
function handleCapture(e) {
  const action = capturing;
  capturing = null;
  if (e.code === "Escape") return showControls("Đã hủy.");
  const other = ACTIONS.find((x) => x !== action && settings.keys[x] === e.code);
  if (other) return showControls(`⚠ Phím ${keyLabel(e.code)} đang dùng cho «${ACTION_NAME[other]}». Hãy chọn phím khác.`);
  settings.keys[action] = e.code;
  saveSettings();
  showControls(`Đã gán ${keyLabel(e.code)} cho «${ACTION_NAME[action]}».`);
}

// Bang xep hang (Ticket-04 muc 3): luu tren dia qua may chu (data/leaderboard.json); khong co may chu thi luu o trinh duyet
const LB_KEY = "ddl-leaderboard";
const pad2 = (n) => String(n).padStart(2, "0");
function isoNow() {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${sign}${pad2(Math.floor(Math.abs(off) / 60))}:${pad2(Math.abs(off) % 60)}`;
}
async function lbLoad() {
  try {
    const r = await fetch("/api/leaderboard", { cache: "no-store" });
    if (r.ok) return { entries: normalize(await r.json()), where: "đĩa" };
  } catch { /* khong co may chu: dung bo nho trinh duyet */ }
  try {
    return { entries: normalize(JSON.parse(localStorage.getItem(LB_KEY) || "[]")), where: "trình duyệt" };
  } catch {
    return { entries: [], where: "trình duyệt" };
  }
}
async function lbSave(entry) {
  try {
    const r = await fetch("/api/leaderboard", { method: "POST", body: JSON.stringify(entry) });
    if (r.ok) return await r.json();
  } catch { /* roi xuong luu o trinh duyet */ }
  const cur = normalize(JSON.parse(localStorage.getItem(LB_KEY) || "[]"));
  const res = addEntry(cur, entry);
  localStorage.setItem(LB_KEY, JSON.stringify(res.entries));
  return res;
}
async function showLeaderboard() {
  show(`<h1>Bảng xếp hạng</h1><p>Đang tải…</p><button class="primary" data-act="menu">Quay lại</button>`, ACT.menu);
  const { entries, where } = await lbLoad();
  const rows = entries.length
    ? entries.map((e, i) => `<tr><td>${i + 1}</td><td>${e.name.replace(/[<>&]/g, "")}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${e.achieved_at.slice(0, 10)}</td></tr>`).join("")
    : `<tr><td colspan="5">Chưa có ai. Chơi một đêm để lên bảng!</td></tr>`;
  show(
    `<h1>Bảng xếp hạng</h1>
     <table class="lb"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Thắng</th><th>Ngày</th></tr>${rows}</table>
     <p style="opacity:.7">Lưu trên ${where}. Top 10.</p>
     <button class="primary" data-act="menu">Quay lại</button>`,
    ACT.menu,
  );
}
function lbFormHtml() {
  const last = (() => {
    try {
      return localStorage.getItem("ddl-lastname") ?? "";
    } catch {
      return "";
    }
  })();
  return `<div id="lbForm"><p>Lưu điểm của bạn (tên 3–12 ký tự: chữ, số, dấu _)</p>
    <input type="text" id="lbName" maxlength="12" autocomplete="off" value="${last.replace(/[<>&"]/g, "")}" aria-label="Tên của bạn">
    <p class="msg" id="lbMsg" role="alert"></p>
    <button id="lbSave">Lưu điểm</button></div>`;
}
function bindLbForm() {
  const btn = $("lbSave");
  if (!btn) return;
  const save = async () => {
    const name = $("lbName").value;
    if (!validName(name)) return void ($("lbMsg").textContent = "Tên phải dài 3–12 ký tự và chỉ gồm chữ, số, dấu gạch dưới.");
    btn.disabled = true;
    const score = totals.reduce((a, b) => a + b, 0);
    const res = await lbSave({ name, score, nights_won: totals.filter((x) => x !== undefined).length, achieved_at: isoNow(), seed: (window.__ddl?.seed ?? 0) >>> 0 });
    try {
      localStorage.setItem("ddl-lastname", name);
    } catch { /* bo qua */ }
    $("lbForm").innerHTML = `<p>Đã lưu${res.rank ? ` — hạng #${res.rank}` : " (chưa vào top 10)"}.</p><button id="lbView">Xem bảng xếp hạng</button>`;
    $("lbView").onclick = () => showLeaderboard();
  };
  btn.onclick = save;
  $("lbName").onkeydown = (e) => e.key === "Enter" && save();
}

function showPause() {
  lastSettingsFrom = "pause";
  show(
    `<h1>Tạm dừng</h1>
     <button class="primary" data-act="continue">Tiếp tục</button>
     <button data-act="restart">Chơi lại đêm này</button>
     <button data-act="settings">Cài đặt</button>
     <button data-act="menu">Về menu chính</button>`,
    ACT.continue,
  );
}

function showIntro(night) {
  nightNo = night;
  mode = "intro";
  newGame(night);
  const tx = NIGHT_TEXT[night];
  show(
    `<h2>Đêm ${night}</h2><h1>${NIGHTS[night].name}</h1>
     <p class="quote"><b>Ông Đăng:</b> “${tx.quote}”</p>
     <p>Thắp đủ <b>${game.lanterns.length}</b> đèn trong <b>${Math.round(nightDuration(T, night))} giây</b>.</p>
     <p style="opacity:.8">${tx.tip.replace("{interact}", K("interact")).replace("{dash}", K("dash"))}</p>
     <p class="go">Nhấn <kbd>Enter</kbd> hoặc <kbd>Space</kbd> để bắt đầu</p>
     <button class="primary" data-act="begin">Bắt đầu đêm ${night}</button>`,
    ACT.begin,
  );
}

function startRun(night = 1) {
  totals = [];
  lastSettingsFrom = "menu";
  showIntro(night);
}

function beginNight() {
  hide();
  mode = "play";
  lastSettingsFrom = "pause";
  ensureAudio();
  music(true);
  for (const k of Object.keys(latch)) latch[k] = false;
}

function restartNight() {
  newGame(nightNo);
  beginNight();
}

function endScreen() {
  const g = game;
  const won = g.state === "won";
  mode = "over";
  music(false);
  windSound(false);
  if (won) {
    totals[nightNo - 1] = g.score;
    if (nightNo < 3) {
      show(
        `<h2>Đêm ${nightNo} — ${NIGHTS[nightNo].name}</h2><h1>Bình minh đã tới, đảo còn sáng!</h1>
         <p class="big">Điểm đêm này: <b>${g.score}</b></p>
         <p>Đèn sáng lúc bình minh: ${g.lanterns.filter((l) => l.lit).length}/${g.lanterns.length} · ${g.player.flames} ngọn lửa. Tổng điểm: <b>${totals.reduce((a, b) => a + b, 0)}</b></p>
         <button class="primary" data-act="next">Sang đêm ${nightNo + 1} ▶</button>
         <button data-act="menu">Về menu chính</button>`,
        ACT.next,
      );
    } else {
      const total = totals.reduce((a, b) => a + b, 0);
      show(
        `<h2>Bình minh</h2><h1>Ba hòn đảo đã sáng!</h1>
         <p class="quote"><b>Ông Đăng:</b> “Cháu làm được rồi. Mặt trời lên, và đèn của cháu vẫn còn ấm.”</p>
         <p>Điểm từng đêm: ${totals.join(" + ")}</p>
         <p class="big">Tổng điểm: <b>${total}</b></p>
         ${lbFormHtml()}
         <button class="primary" data-act="menu">Về menu chính</button>`,
        ACT.menu,
      );
      bindLbForm();
    }
  } else {
    const why = { dawn: `Bình minh đã lên nhưng chỉ ${g.lanterns.filter((l) => l.lit).length} đèn còn sáng (cần ${needLit(g)}).`, no_flames: "Mây đã hết ngọn lửa." }[g.result.reason];
    show(
      `<h2>Đêm ${nightNo} — ${NIGHTS[nightNo].name}</h2><h1>Đêm đã trôi qua…</h1>
       <p>${why}</p><p>Đèn sáng: ${g.lanterns.filter((l) => l.lit).length}/${g.lanterns.length} · Điểm đêm này: ${g.score} · Tổng đã thắng: ${totals.reduce((a, b) => a + b, 0)}</p>
       ${lbFormHtml()}
       <button class="primary" data-act="retry">Thử lại đêm ${nightNo}</button>
       <button data-act="menu">Về menu chính</button>`,
      ACT.retry,
    );
    bindLbForm();
  }
}

// ---------------------------------------------------------------- hieu ung
function addRing(x, y, z, radius, color, life = 0.45) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 56), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y + 0.08, z);
  scene.add(m);
  fx.push({ obj: m, age: 0, life, kind: "ring", radius });
}
function addBurst(x, y, z, color = C.moteHalo, n = 22) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.set(x, y, z);
    const a = (i / n) * Math.PI * 2;
    scene.add(m);
    fx.push({ obj: m, age: 0, life: 0.9, kind: "spark", v: [Math.cos(a) * (2 + (i % 3)), 3 + (i % 4), Math.sin(a) * (2 + (i % 3))] });
  }
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.age += dt;
    const k = f.age / f.life;
    if (k >= 1) {
      scene.remove(f.obj);
      f.obj.geometry.dispose();
      f.obj.material.dispose();
      fx.splice(i, 1);
      continue;
    }
    if (f.kind === "ring") {
      const s = 0.5 + f.radius * k;
      f.obj.scale.set(s, s, s);
      f.obj.material.opacity = 0.8 * (1 - k);
    } else {
      f.v[1] -= 9 * dt;
      f.obj.position.x += f.v[0] * dt;
      f.obj.position.y += f.v[1] * dt;
      f.obj.position.z += f.v[2] * dt;
      f.obj.material.opacity = 1 - k;
    }
  }
}

function onEvents(events) {
  const P = game.player;
  for (const e of events) {
    switch (e.name) {
      case "mote_picked": sfx.pickup(e.data.carried); break;
      case "deposit": sfx.deposit(); break;
      case "lantern_lit": {
        const l = game.lanterns.find((x) => x.id === e.data.lantern_id);
        addBurst(l.pos[0], l.pos[1] + 3.4, l.pos[2]);
        addRing(l.pos[0], l.pos[1], l.pos[2], T.safe_radius, C.lampLit, 0.9);
        sfx.light();
        banner(e.data.relight ? `Đèn ${l.id} đã thắp lại!` : `Đèn ${l.id} đã sáng!`);
        break;
      }
      case "refuel": sfx.deposit(); banner(`Châm dầu đèn ${e.data.lantern_id}: ${Math.round(e.data.fuel)}/${T.fuel_max}`); break;
      case "lantern_out": sfx.lose(); banner(`⚠ Đèn ${e.data.lantern_id} đã tắt!`, "danger"); caption(`⚠ Đèn ${e.data.lantern_id} đã tắt`); break;
      case "fuel_drain": banner(`⚠ Bóng Mực đang hút dầu đèn ${e.data.lantern_id}!`, "danger"); break;
      case "pulse":
        addRing(P.pos[0], P.pos[1], P.pos[2], T.pulse_radius, C.moteHalo, 0.5);
        sfx.pulse();
        break;
      case "dash": sfx.dash(); addBurst(P.pos[0], P.pos[1] + 0.8, P.pos[2], C.wind, 8); break;
      case "charm_picked": sfx.charm(); banner("🧣 Bùa Gió! Chạy nhanh và lướt liên tục"); break;
      case "drifter_steal": sfx.steal(); banner(`Gió Lạc cuỗm ${e.data.amount} ánh sáng!`); break;
      case "drifter_drop": banner(`Ánh sáng rơi ra: ${e.data.amount}`); break;
      case "shade_spawned":
        sfx.shade();
        caption("⚠ Bóng Mực xuất hiện — nhìn mũi tên ở mép màn hình", 4);
        alertShade = { id: e.data.id, until: performance.now() + 6000 };
        break;
      case "player_hit":
        if (!settings.reduceMotion) {
          // giam chuyen dong: khong chop man hinh, khong rung camera
          $("flash").classList.add("on");
          setTimeout(() => $("flash").classList.remove("on"), 60);
          shake = 0.5;
        }
        sfx.hit();
        banner(e.data.by === "fall" ? `Rơi khỏi đảo! Mất ${e.data.lost} ánh sáng.` : e.data.dropped ? `Bị chạm! Đánh rơi ${e.data.dropped} ánh sáng.` : "Bị chạm!");
        break;
      case "paused": showPause(); break;
      case "resumed": hide(); break;
      case "game_over":
        e.data.result === "won" ? sfx.win() : sfx.lose();
        setTimeout(endScreen, 600);
        break;
    }
  }
  if (P.vel[1] > 5 && !onEvents.jumped) { sfx.jump(); onEvents.jumped = true; }
  if (P.grounded) onEvents.jumped = false;
}

// ---------------------------------------------------------------- dong bo hien thi
function syncViews(time) {
  const g = game;
  const alive = new Set();
  for (const m of BENCH ? [] : g.motes) {
    alive.add(m.id);
    let v = views.motes.get(m.id);
    if (!v) views.motes.set(m.id, (v = makeMote()));
    const flicker = m.ttl != null && m.ttl < 120 && Math.floor(time * 10) % 2 === 0;
    v.visible = !flicker;
    v.position.set(m.pos[0], m.pos[1] + 0.9 + Math.sin(time * 2 + m.pos[0]) * 0.18, m.pos[2]);
  }
  for (const [id, v] of views.motes) if (!alive.has(id)) (scene.remove(v), views.motes.delete(id));
  const aliveS = new Set();
  for (const s of BENCH ? [] : g.shades) {
    aliveS.add(s.id);
    let v = views.shades.get(s.id);
    if (!v) views.shades.set(s.id, (v = makeShade()));
    const stunned = s.state === "stunned";
    const bob = stunned ? 0 : Math.sin(time * 3 + s.pos[0]) * 0.15;
    v.position.set(s.pos[0], s.pos[1] + 0.3 + bob, s.pos[2]);
    v.scale.setScalar(s.state === "spawning" ? 0.3 + 0.7 * (1 - s.ticks / WORLD.shade_spawning_ticks) : stunned ? 0.75 : 1);
    v.userData.bodyMat.color.setHex(stunned ? C.shadeStun : C.shade);
    v.userData.eyeMat.color.setHex(stunned ? C.moteCore : shadeLineHex());
    v.userData.lineMat.color.setHex(shadeLineHex());
    if (s.state === "drain") v.scale.setScalar(1 + Math.sin(time * 10) * 0.08);
    v.rotation.y = Math.atan2(g.player.pos[0] - s.pos[0], g.player.pos[2] - s.pos[2]);
  }
  for (const [id, v] of views.shades) if (!aliveS.has(id)) (scene.remove(v), views.shades.delete(id));
  const aliveD = new Set();
  for (const d of g.drifters) {
    aliveD.add(d.id);
    let v = views.drifters.get(d.id);
    if (!v) views.drifters.set(d.id, (v = makeDrifter()));
    v.position.set(d.pos[0], d.pos[1] + Math.sin(time * 4) * 0.2, d.pos[2]);
    v.rotation.y = time * 4;
    v.userData.m.color.setHex(d.stolen > 0 ? C.moteHalo : C.wind);
  }
  for (const [id, v] of views.drifters) if (!aliveD.has(id)) (scene.remove(v), views.drifters.delete(id));
  g.charms.forEach((c, i) => {
    const v = views.charms[i];
    v.visible = c.available;
    v.position.set(c.pos[0], c.pos[1], c.pos[2]);
    v.userData.gem.rotation.y = time * 2;
    v.userData.halo.rotation.x = Math.PI / 2 + Math.sin(time * 3) * 0.3;
  });
  g.lanterns.forEach((l, i) => {
    const v = views.lanterns[i];
    v.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const fuel = l.fuelU / 60;
    const weak = l.lit && fuel < T.low_fuel_threshold;
    const blinkOff = weak && (settings.reduceMotion ? true : Math.floor(time * 2) % 2 === 0); // giam chuyen dong: den yeu mo han, khong nhap nhay // nhap nhay 1 Hz khi gan can
    const prog = l.lit ? 1 : Math.min(1, l.deposited / (l.everLit ? T.relight_cost : T.lantern_cost)) * 0.5;
    const u = v.userData;
    u.lampMat.color.setHex(l.lit ? C.lampLit : C.lampOff);
    u.lampMat.emissiveIntensity = l.lit ? (blinkOff ? 0.25 : 1.2 + 0.4 * (fuel / T.fuel_max) + Math.sin(time * 5 + i) * 0.2) : prog * 0.8;
    u.coreMat.opacity = l.lit ? (blinkOff ? 0.2 : 0.9) : prog * 0.4;
    u.ringMat.opacity = l.lit ? (weak ? 0.12 : 0.55) : 0.1 + prog * 0.2; // den yeu: mat vung an toan
    u.discMat.opacity = l.lit && !weak ? 0.08 : 0;
    // den tat: be 20% + giay rach; den sang: thanh dau
    u.lamp.scale.y = l.lit ? 1 : 0.8;
    u.lamp.rotation.z = l.lit ? 0 : 0.12;
    u.cap.position.y = l.lit ? 4.2 : 4.0;
    u.torn.visible = !l.lit;
    u.halo.material.opacity = l.lit ? (blinkOff ? 0.08 : 0.35 + 0.35 * (fuel / T.fuel_max)) : 0;
    u.halo.scale.setScalar(l.lit ? 5.5 + Math.sin(time * 4 + i) * 0.3 : 5);
    u.bar.visible = l.lit;
    if (l.lit) {
      u.bar.lookAt(camera.position);
      u.barFill.scale.x = Math.max(0.001, fuel / T.fuel_max);
      u.barFillMat.color.setHex(weak ? (settings.colorblind ? 0xffffff : C.red) : C.lampLit);
    }
  });
  const P = g.player;
  player.position.set(P.pos[0], P.pos[1], P.pos[2]);
  player.visible = !(P.invuln > 0 && Math.floor(time * 14) % 2 === 0) && P.fallWait === 0;
  player.userData.lamp.intensity = 6 + P.carried * 1.6;
  player.userData.orb.scale.setScalar(0.7 + (P.carried / capacityNow(g)) * 0.9);
  const sp = Math.hypot(P.vel[0], P.vel[2]);
  if (sp > 0.1) player.rotation.y = Math.atan2(P.vel[0], P.vel[2]);
  {
    const u = player.userData;
    const run = Math.min(1, sp / 6);
    u.rig.position.y = run > 0.05 ? Math.abs(Math.sin(time * 11)) * 0.09 * run : Math.sin(time * 2) * 0.02;
    u.rig.rotation.x = run * 0.12;
    u.tail.rotation.x = 0.35 + run * 0.5 + Math.sin(time * 9) * 0.18 * run + Math.sin(time * 2) * 0.05;
    u.tail.rotation.z = Math.sin(time * 7) * 0.2 * run;
    u.f1.position.z = 0.08 + Math.sin(time * 11) * 0.12 * run;
    u.f2.position.z = 0.08 - Math.sin(time * 11) * 0.12 * run;
    u.armL.rotation.x = Math.sin(time * 11) * 0.5 * run;
    u.orbHalo.scale.setScalar(2.2 + (P.carried / capacityNow(g)) * 2.2 + Math.sin(time * 5) * 0.12);
  }
  animateScenery(time);
  // gio
  const ph = g.simTick % WORLD.wind_period;
  const warn = g.wind.enabled && !g.wind.active && g.simTick > 0 && ph >= WORLD.wind_period - WORLD.wind_warning;
  const on = g.wind.enabled && (g.wind.active || warn);
  leafMat.opacity = g.wind.active ? 0.9 : warn ? 0.35 + 0.3 * Math.sin(time * 12) : 0;
  if (on) {
    const a = (g.wind.dir * Math.PI) / 180;
    for (let i = 0; i < LEAVES; i++) {
      const k = ((time * (g.wind.active ? 14 : 3) + i * 0.37) % 40) - 20;
      const lat = (((i * 7.31) % 30) - 15);
      leafPos[i * 3] = P.pos[0] + Math.cos(a) * k - Math.sin(a) * lat;
      leafPos[i * 3 + 1] = P.pos[1] + 1 + ((i * 3.17) % 6) + Math.sin(time * 3 + i) * 0.5;
      leafPos[i * 3 + 2] = P.pos[2] + Math.sin(a) * k + Math.cos(a) * lat;
    }
    leafGeo.attributes.position.needsUpdate = true;
  }
  windSound(g.wind.active && mode === "play" && !g.paused);
}

function updateCamera(dt) {
  const P = game.player;
  const th = (yaw * Math.PI) / 180;
  const f = [Math.sin(th), Math.cos(th)];
  const y = Math.max(P.pos[1], -2);
  const target = new THREE.Vector3(P.pos[0] + f[0] * 3, 1.2 + y * 0.9, P.pos[2] + f[1] * 3);
  const want = new THREE.Vector3(P.pos[0] - f[0] * 11, 7.5 + y * 0.95, P.pos[2] - f[1] * 11);
  camera.position.lerp(want, 1 - Math.exp(-8 * dt));
  if (shake > 0) {
    camera.position.x += Math.sin(shake * 90) * shake * 0.4;
    camera.position.y += Math.cos(shake * 70) * shake * 0.4;
    shake = Math.max(0, shake - dt * 2);
  }
  camera.lookAt(target);
}

function updateLight() {
  const lit = game.lanterns.filter((l) => l.lit).length / game.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * lit; // cong thuc co dinh (Ticket-02)
}

function resize() {
  const w = BENCH ? 1280 : innerWidth; // benchmark: luon ve o 1280x720, ti le 1
  const h = BENCH ? 720 : innerHeight;
  renderer.setPixelRatio(BENCH ? 1 : pixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// do FPS trung binh; neu thap thi ha do phan giai de giu >= 30
let fpsFrames = 0;
let fpsT0 = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fpsFrames++;
  if (now - fpsT0 >= 1000) {
    const fps = (fpsFrames * 1000) / (now - fpsT0);
    fpsFrames = 0;
    fpsT0 = now;
    if (window.__ddl) window.__ddl.fps = fps;
    if (params.has("fps")) {
      $("fps").style.display = "block";
      $("fps").textContent = `${fps.toFixed(0)} FPS · x${pixelRatio.toFixed(2)}`;
    }
    if (BENCH) {
      /* benchmark: khong tu giam do phan giai */
    } else if (fps < 35 && pixelRatio > 0.6 && mode === "play") {
      pixelRatio = Math.max(0.6, pixelRatio - 0.2);
      resize();
    } else if (fps < 28 && pixelRatio <= 0.6 && mode === "play") {
      lowStreak++;
      if (lowStreak >= 4) fpsLow = true;
    } else lowStreak = 0;
  }
  if (BENCH) {
    benchFrame(now);
    return;
  }
  if (fpsLow && !lowGfx && mode === "play") {
    // may yeu: da giam do phan giai toi muc thap nhat van < 28 FPS -> tat cay co, may, den troi (khong anh huong luat choi)
    lowGfx = true;
    if (terrain?.userData.props) terrain.userData.props.visible = false;
    skyGroup.visible = false;
    for (const l of skyLanterns) l.visible = false;
  }
  if (!game) {
    renderer.render(scene, camera);
    return;
  }
  if (mode === "play" && game.state === "playing") {
    acc += dt;
    let n = 0;
    while (acc >= 1 / TICKS_PER_SECOND && game.state === "playing" && n++ < 6) {
      acc -= 1 / TICKS_PER_SECOND;
      const input = DEMO ? demoInput(game, game.tick) : readInput(1 / TICKS_PER_SECOND);
      latch.jump = latch.interact = latch.pulse = latch.dash = latch.pause = false;
      onEvents(step(game, input));
    }
    if (n >= 6) acc = 0;
  }
  const time = now / 1000;
  syncViews(time);
  updateCamera(dt);
  updateLight();
  updateFx(dt);
  updateHud(time);
  renderer.render(scene, camera);
}


// ---------------------------------------------------------------- benchmark (Ticket-04, muc 1)
// Canh chuan: Dem 1, 200 Bong Muc wander rai deu (seed), 100 dom dom, L1-L3 sang fuel 100, May dung (0,0,0),
// camera bay vong tron ban kinh 30 m, cao 15 m, 15 s/vong, nguoc chieu kim dong ho khi nhin tu tren xuong.
// Trong canh nay LOI KHONG chay (khong sinh them, sat thuong, nhat dom dom, hao dau, ket thuc Dem); chi Bong Muc di lang thang
// bang bo di chuyen rieng cua ban choi, con phan sang tao (co/cay, may, den troi) bi tat de moi bai do tren cung mot canh.
function benchScenario(seed) {
  const rnd = lcg(seed >>> 0);
  const shades = [];
  for (let i = 0; i < 200; i++) {
    const r = 38 * Math.sqrt((i + 0.5) / 200); // dia deu theo dien tich
    const a = i * 2.399963 + rnd() * 0.3;
    shades.push({ pos: [r * Math.cos(a), 0, r * Math.sin(a)], state: "wander" });
  }
  const motes = [];
  for (let i = 0; i < 100; i++) {
    const r = 37 * Math.sqrt(rnd());
    const a = rnd() * Math.PI * 2;
    motes.push([r * Math.cos(a), 0, r * Math.sin(a)]);
  }
  return {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    player: { pos: [0, 0, 0], flames: 1000000 },
    lanterns: ["L1", "L2", "L3"].map((id) => ({ id, lit: true, fuel: 100 })),
    shades, motes, drifters: [],
  };
}

// Ve 200 Bong Muc + 100 dom dom bang InstancedMesh (5 + 2 lan ve thay vi ~1200): hinh dang giong het ban thuong
const benchInst = { ready: false };
function benchSetup() {
  const g = game;
  const nS = g.shades.length;
  const nM = g.motes.length;
  const body = new THREE.MeshLambertMaterial({ color: C.shade, emissive: 0x1a0c2a, emissiveIntensity: 0.5 });
  const line = new THREE.MeshBasicMaterial({ color: C.shadeLine, side: THREE.BackSide });
  const eye = new THREE.MeshBasicMaterial({ color: C.shadeLine });
  const tailGeo = new THREE.ConeGeometry(0.8, 1.4, 12);
  tailGeo.rotateX(Math.PI);
  tailGeo.translate(0, -0.9, 0);
  benchInst.body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 18, 14), body, nS);
  benchInst.line = new THREE.InstancedMesh(new THREE.SphereGeometry(1.0, 18, 14), line, nS);
  benchInst.tail = new THREE.InstancedMesh(tailGeo, body, nS);
  benchInst.eyes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 8, 8), eye, nS * 2);
  benchInst.core = new THREE.InstancedMesh(moteGeo, moteMat, nM);
  benchInst.halo = new THREE.InstancedMesh(moteGlowGeo, moteGlowMat, nM);
  for (const m of Object.values(benchInst)) if (m?.isInstancedMesh) { m.frustumCulled = false; scene.add(m); }
  benchInst.ready = true;
}
const _bm = new THREE.Matrix4();
const _bs = new THREE.Matrix4();
const _bq = new THREE.Quaternion();
const _bp = new THREE.Vector3();
const _be = new THREE.Euler();
const _one = new THREE.Vector3(1, 1, 1);
function benchInstances(time) {
  if (!benchInst.ready) benchSetup();
  const g = game;
  const P = g.player;
  g.shades.forEach((s, i) => {
    const bob = Math.sin(time * 3 + s.pos[0]) * 0.15;
    _bp.set(s.pos[0], s.pos[1] + 0.3 + bob, s.pos[2]);
    _bq.setFromEuler(_be.set(0, Math.atan2(P.pos[0] - s.pos[0], P.pos[2] - s.pos[2]), 0));
    _bm.compose(_bp, _bq, _one);
    benchInst.body.setMatrixAt(i, _bm);
    benchInst.line.setMatrixAt(i, _bm);
    benchInst.tail.setMatrixAt(i, _bm);
    benchInst.eyes.setMatrixAt(i * 2, _bs.makeTranslation(-0.3, 0.2, 0.75).premultiply(_bm));
    benchInst.eyes.setMatrixAt(i * 2 + 1, _bs.makeTranslation(0.3, 0.2, 0.75).premultiply(_bm));
  });
  g.motes.forEach((m, i) => {
    _bm.makeTranslation(m.pos[0], m.pos[1] + 0.9 + Math.sin(time * 2 + m.pos[0]) * 0.18, m.pos[2]);
    benchInst.core.setMatrixAt(i, _bm);
    benchInst.halo.setMatrixAt(i, _bm);
  });
  for (const m of [benchInst.body, benchInst.line, benchInst.tail, benchInst.eyes, benchInst.core, benchInst.halo]) m.instanceMatrix.needsUpdate = true;
}
const B = { t0: null, prev: null, last: null, dts: [], firstEpoch: null, done: false, heapPeak: 0, headings: new Map() };
function benchFrame(now) {
  const g = game;
  if (B.t0 === null) B.t0 = now;
  const el = (now - B.t0) / 1000;
  const dt = B.last === null ? 0 : Math.min(0.1, (now - B.last) / 1000);
  B.last = now;
  // Bong Muc lang thang: huong doi moi 2 s, 2 m/s, quay dau khi ra khoi dao
  const rnd = lcg(0x9e3779b1 + Math.floor(el * 0.5));
  for (const s of g.shades) {
    let h = B.headings.get(s.id);
    const slot = Math.floor(el / 2);
    if (!h || h.slot !== slot) B.headings.set(s.id, (h = { slot, a: rnd() * Math.PI * 2 }));
    const nx = s.pos[0] + Math.cos(h.a) * WORLD.shade_wander_speed * dt;
    const nz = s.pos[2] + Math.sin(h.a) * WORLD.shade_wander_speed * dt;
    if (g.map.ground(nx, nz) != null) (s.pos[0] = nx), (s.pos[2] = nz);
    else h.a += Math.PI;
  }
  const th = (el / 15) * Math.PI * 2;
  camera.position.set(30 * Math.cos(th), 15, -30 * Math.sin(th));
  camera.lookAt(0, 0, 0);
  syncViews(now / 1000);
  benchInstances(now / 1000);
  updateLight();
  renderer.render(scene, camera);
  if (B.firstEpoch === null) B.firstEpoch = Date.now();
  const mem = performance.memory?.usedJSHeapSize;
  if (mem) B.heapPeak = Math.max(B.heapPeak, mem);
  if (el >= 3 && !B.done) {
    if (el < 3 + BENCH_DURATION) B.dts.push(now - B.prev);
    else {
      B.done = true;
      let gl = "";
      try {
        const ctx = renderer.getContext();
        const ext = ctx.getExtension("WEBGL_debug_renderer_info");
        gl = ext ? `${ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL)}` : "";
      } catch { /* khong doc duoc ten GPU */ }
      fetch("/__bench", { method: "POST", body: JSON.stringify({ dts: B.dts, first_frame_epoch_ms: B.firstEpoch, gpu: gl, ua: navigator.userAgent, heap_peak_mb: B.heapPeak / 2 ** 20 }) }).catch(() => {});
      document.title = "bench xong";
    }
  }
  B.prev = now;
}
const BENCH_DURATION = Number(params.get("duration") ?? 30);
function startBench() {
  document.body.classList.add("nohud");
  $("screen")?.classList.add("hidden");
  mode = "bench";
  newGame(1);
  if (terrain?.userData.props) terrain.userData.props.visible = false;
  skyGroup.visible = false;
  for (const l of skyLanterns) l.visible = false;
  resize();
}

// khoi dong
const qn = Math.min(3, Math.max(1, Number(params.get("night")) || 1));
if (BENCH) {
  startBench();
} else if (params.has("autostart") || DEMO) {
  nightNo = qn;
  newGame(qn);
  beginNight();
} else {
  newGame(1);
  toMenu();
}
requestAnimationFrame(frame);
