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
// cuc quang: ba dai sang mem troi cham tren troi; sao bang thinh thoang
const auroraTex = canvasTex(256, 64, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "rgba(120,255,200,0)");
  gr.addColorStop(0.45, "rgba(120,255,210,0.55)");
  gr.addColorStop(0.7, "rgba(140,170,255,0.3)");
  gr.addColorStop(1, "rgba(120,100,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}, [256, 64]);
const auroras = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(260, 46, 24, 1), new THREE.MeshBasicMaterial({ map: auroraTex, transparent: true, opacity: 0.32 - i * 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  const a = -0.9 + i * 0.9;
  m.position.set(Math.sin(a) * 230, 105 + i * 12, -Math.cos(a) * 230);
  m.lookAt(0, 60, 0);
  m.userData = { base: m.position.clone(), ph: i * 2 };
  scene.add(m);
  auroras.push(m);
}
const shootStar = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
shootStar.scale.set(6, 1.2, 1);
scene.add(shootStar);
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
  for (const m of auroras) {
    const u = m.userData;
    const calm = settings.reduceMotion ? 0 : 1;
    m.position.y = u.base.y + Math.sin(time * 0.15 + u.ph) * 5 * calm;
    m.material.opacity = (0.2 + 0.1 * Math.sin(time * 0.3 + u.ph)) * (m === auroras[0] ? 1.3 : 1);
  }
  {
    const cyc = time % 17;
    if (cyc < 1.2 && !settings.reduceMotion) {
      const k = cyc / 1.2;
      shootStar.position.set(-150 + k * 150, 150 - k * 70, -170);
      shootStar.material.opacity = Math.sin(k * Math.PI) * 0.9;
    } else shootStar.material.opacity = 0;
  }
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
  // rung thong: nhieu cay (khong anh huong va cham, chi hien thi), tranh khu vuc den/bục/diem xuat phat
  {
    const forest = spots.filter((sp) => sp[3] > 0.85 && !sp[4] && !pts.some((q2) => Math.hypot(q2[0] - sp[0], q2[2] - sp[2]) < 8.5) && Math.hypot(map.start[0] - sp[0], map.start[2] - sp[2]) > 15).slice(0, 110);
    const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 1, 6);
    const coneG = new THREE.ConeGeometry(1, 1, 7);
    const ti2 = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x5b4030 }), forest.length);
    const c1i = new THREE.InstancedMesh(coneG, new THREE.MeshLambertMaterial({ color: 0x1f6b52, flatShading: true }), forest.length);
    const c2i = new THREE.InstancedMesh(coneG, new THREE.MeshLambertMaterial({ color: 0x2c8a63, flatShading: true }), forest.length);
    const c3i = new THREE.InstancedMesh(coneG, new THREE.MeshLambertMaterial({ color: 0x3aa478, flatShading: true }), forest.length);
    const mm = new THREE.Matrix4();
    forest.forEach((sp, i) => {
      const h = 3.2 + rnd() * 2.6;
      const w = 0.8 + rnd() * 0.4;
      mm.compose(new THREE.Vector3(sp[0], sp[1] + h * 0.25, sp[2]), q.identity(), new THREE.Vector3(1, h * 0.5, 1));
      ti2.setMatrixAt(i, mm);
      mm.compose(new THREE.Vector3(sp[0], sp[1] + h * 0.55, sp[2]), q.identity(), new THREE.Vector3(w * 1.9, h * 0.55, w * 1.9));
      c1i.setMatrixAt(i, mm);
      mm.compose(new THREE.Vector3(sp[0], sp[1] + h * 0.85, sp[2]), q.identity(), new THREE.Vector3(w * 1.5, h * 0.5, w * 1.5));
      c2i.setMatrixAt(i, mm);
      mm.compose(new THREE.Vector3(sp[0], sp[1] + h * 1.12, sp[2]), q.identity(), new THREE.Vector3(w * 1.05, h * 0.45, w * 1.05));
      c3i.setMatrixAt(i, mm);
    });
    t.add(ti2, c1i, c2i, c3i);
  }
  // cay hoa (tan tron hong/tim/trang tuy dem), den da ben duong, bui hoa lon
  {
    const mm2 = new THREE.Matrix4();
    const q2 = new THREE.Quaternion();
    const bl = spots.filter((sp) => sp[3] > 0.2 && sp[3] < 0.26 && !sp[4] && !pts.some((p0) => Math.hypot(p0[0] - sp[0], p0[2] - sp[2]) < 9) && Math.hypot(map.start[0] - sp[0], map.start[2] - sp[2]) > 12).slice(0, 26);
    const crownCol = night === 2 ? [0xffd1e8, 0xffe6a0] : night === 3 ? [0xc9a9ff, 0xffd1e8] : [0xffc2d9, 0xfff0f5];
    const trunk2 = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 1, 6), new THREE.MeshLambertMaterial({ color: 0x4d3a2c }), bl.length);
    const crownI = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x442233, emissiveIntensity: 0.25, flatShading: true }), bl.length * 3);
    let ci = 0;
    bl.forEach((sp, i) => {
      const h = 2.6 + rnd() * 1.8;
      mm2.compose(new THREE.Vector3(sp[0], sp[1] + h / 2, sp[2]), q2.identity(), new THREE.Vector3(1, h, 1));
      trunk2.setMatrixAt(i, mm2);
      for (let j = 0; j < 3; j++) {
        const r = 1.1 + rnd() * 0.7;
        mm2.compose(new THREE.Vector3(sp[0] + (rnd() - 0.5) * 1.8, sp[1] + h + 0.3 + rnd() * 0.9, sp[2] + (rnd() - 0.5) * 1.8), q2.identity(), new THREE.Vector3(r, r * 0.8, r));
        crownI.setMatrixAt(ci, mm2);
        crownI.setColorAt(ci, new THREE.Color(crownCol[(i + j) % 2]));
        ci++;
      }
    });
    t.add(trunk2, crownI);
    // den da (toro) quanh cac ngon den: thap, co o sang
    const stoneM3 = new THREE.MeshLambertMaterial({ color: 0x7e8798, flatShading: true });
    const winM = new THREE.MeshBasicMaterial({ color: 0xffc766 });
    for (const [, lp] of map.lanterns) {
      for (const a of [0.7, 3.8]) {
        const x = lp[0] + Math.cos(a) * 4.2;
        const z = lp[2] + Math.sin(a) * 4.2;
        const y = map.ground(x, z);
        if (y == null) continue;
        const g2 = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 6), stoneM3);
        base.position.y = 0.45;
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), stoneM3);
        box.position.y = 1.15;
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.58), winM);
        win.position.y = 1.15;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.38, 4), stoneM3);
        roof.position.y = 1.6;
        roof.rotation.y = Math.PI / 4;
        g2.add(base, box, win, roof);
        g2.position.set(x, y, z);
        t.add(g2);
      }
    }
  }
  // da dang theo tung dem (chi hien thi): nam phat sang (moi dem), truc tre + ao sen (Dem 2), tru da do nat + bia da (Dem 3)
  {
    const far = (sp) => !pts.some((q2) => Math.hypot(q2[0] - sp[0], q2[2] - sp[2]) < 5) && !(night === 2 && onBridge(sp[0], sp[2]));
    const mm = new THREE.Matrix4();
    const qq = new THREE.Quaternion();
    const mush = spots.filter((sp) => sp[3] > 0.62 && sp[3] < 0.72 && far(sp)).slice(0, 40);
    const capI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: night === 2 ? 0x7fffd4 : night === 3 ? 0xff9bd8 : 0x9bd6ff }), mush.length);
    const stemI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 6), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }), mush.length);
    mush.forEach((sp, i) => {
      const k = 0.7 + rnd() * 1.1;
      mm.compose(new THREE.Vector3(sp[0], sp[1] + 0.2 * k, sp[2]), qq.identity(), new THREE.Vector3(k, k, k));
      stemI.setMatrixAt(i, mm);
      mm.compose(new THREE.Vector3(sp[0], sp[1] + 0.38 * k, sp[2]), qq.identity(), new THREE.Vector3(k, k, k));
      capI.setMatrixAt(i, mm);
    });
    t.add(capI, stemI);
    if (night === 2) {
      const bam = spots.filter((sp) => sp[3] > 0.45 && sp[3] < 0.6 && far(sp)).slice(0, 120);
      const bI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 1, 6), new THREE.MeshLambertMaterial({ color: 0x86c06a, flatShading: true }), bam.length);
      bam.forEach((sp, i) => {
        const h = 4 + rnd() * 3.5;
        mm.compose(new THREE.Vector3(sp[0], sp[1] + h / 2, sp[2]), qq.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.12)), new THREE.Vector3(1, h, 1));
        bI.setMatrixAt(i, mm);
      });
      t.add(bI);
      const pondM = new THREE.MeshBasicMaterial({ color: 0x1f5d8e, transparent: true, opacity: 0.55, depthWrite: false });
      const lilyM = new THREE.MeshBasicMaterial({ color: 0x78e08f });
      for (const sp of spots.filter((a) => a[3] > 0.3 && a[3] < 0.33 && !a[4] && far(a)).slice(0, 5)) {
        const r = 2 + rnd() * 2;
        const pond = new THREE.Mesh(new THREE.CircleGeometry(r, 24), pondM);
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(sp[0], sp[1] + 0.05, sp[2]);
        t.add(pond);
        for (let j = 0; j < 4; j++) {
          const lily = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), lilyM);
          lily.rotation.x = -Math.PI / 2;
          lily.position.set(sp[0] + (rnd() - 0.5) * r, sp[1] + 0.07, sp[2] + (rnd() - 0.5) * r);
          t.add(lily);
        }
      }
    }
    if (night === 3) {
      const stoneM2 = new THREE.MeshLambertMaterial({ color: 0x8b93a6, flatShading: true });
      for (const sp of spots.filter((a) => a[3] > 0.45 && a[3] < 0.5 && !a[4] && far(a)).slice(0, 14)) {
        const h = 1.2 + rnd() * 3.4;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, h, 7), stoneM2);
        col.position.set(sp[0], sp[1] + h / 2, sp[2]);
        col.rotation.z = (rnd() - 0.5) * 0.15;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 1.1), stoneM2);
        cap.position.set(sp[0], sp[1] + h + 0.12, sp[2]);
        t.add(col, rnd() > 0.45 ? cap : new THREE.Object3D());
      }
    }
  }
  // cong da o diem xuat phat (hai tru, xa ngang, day den giay) + cot da co vong rune sang nhe
  {
    const stoneM = new THREE.MeshLambertMaterial({ color: 0x6d7585, flatShading: true });
    const redM = new THREE.MeshLambertMaterial({ color: 0xb23a48, emissive: 0x6a1a24, emissiveIntensity: 0.25 });
    const [gx, gy, gz] = map.start;
    const gate = new THREE.Group();
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 4.4, 8), redM);
      pillar.position.set(sx * 2.6, 2.2, 0);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.5, 8), stoneM);
      foot.position.set(sx * 2.6, 0.25, 0);
      gate.add(pillar, foot);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.36, 0.5), redM);
    beam.position.y = 4.4;
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.22, 0.4), redM);
    beam2.position.y = 3.7;
    gate.add(beam, beam2);
    for (let i = 0; i < 5; i++) {
      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
      lan.scale.y = 1.25;
      lan.position.set(-2 + i, 3.35, 0.05);
      gate.add(lan);
    }
    gate.position.set(gx, gy, gz + 6);
    gate.rotation.y = Math.PI;
    t.add(gate);
    const ringGeo = new THREE.RingGeometry(0.55, 0.7, 28);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8fd6e6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    for (const sp of spots.filter((s) => s[4] && s[3] > 0.45 && s[3] < 0.5).slice(0, 12)) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 1.7 + sp[3] * 2, 6), stoneM);
      st.position.set(sp[0], sp[1] + 0.85 + sp[3], sp[2]);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(sp[0], sp[1] + 0.06, sp[2]);
      t.add(st, ring);
    }
  }
  // suong troi thap: cac mang suong mem troi cham quanh dao
  {
    const mistMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x9fb4d8, transparent: true, opacity: 0.16, depthWrite: false, fog: false });
    const mist = [];
    for (let i = 0; i < 34; i++) {
      const sp = new THREE.Sprite(mistMat);
      const x = x0 + rnd() * (x1 - x0);
      const z = -zr + rnd() * 2 * zr;
      const y = map.ground(x, z);
      sp.position.set(x, (y ?? 0) + 0.9, z);
      const w = 9 + rnd() * 9;
      sp.scale.set(w, w * 0.32, 1);
      sp.userData = { x, z, ph: rnd() * 6.28, sp: 0.15 + rnd() * 0.25 };
      mist.push(sp);
      t.add(sp);
    }
    t.userData.mist = mist;
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
  // cot sang: chum tia dung len troi khi den dang sang (chi hien thi)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc866, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 26, 16, 1, true), beamMat);
  beam.position.y = 16;
  g.add(beam);
  g.userData = { lampMat, coreMat, ringMat, discMat, lamp, cap, bar, barFill, barFillMat, torn, halo, beamMat };
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
  // thiet ke rieng: than giot muc co xuc tu long thong, giot muc bay quanh, mat co quang
  const tendrils = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.3, 7), bodyMat);
    t.geometry.translate(0, -0.65, 0);
    t.position.set(Math.cos(a) * 0.5, -0.55, Math.sin(a) * 0.5);
    t.userData.phase = a;
    tendrils.push(t);
    g.add(t);
  }
  const drops = [];
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), bodyMat);
    d.userData.phase = (i / 3) * Math.PI * 2;
    drops.push(d);
    g.add(d);
  }
  const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: C.shadeLine, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  eyeGlow.position.set(0, 0.2, 0.8);
  eyeGlow.scale.set(1.5, 0.9, 1);
  // den long cam tay: can tre, long den giay, anh sang rieng; thanh trang thai phia tren (KHONG phai mau: loi khong co mau cho Bong Muc)
  const lanPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5), new THREE.MeshLambertMaterial({ color: 0x3a2a24 }));
  lanPole.position.set(0.95, 0.35, 0.2);
  const lanBody = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: 0xc040ff }));
  lanBody.scale.y = 1.25;
  lanBody.position.set(0.95, 1.2, 0.2);
  const lanGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xb050ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  lanGlow.position.copy(lanBody.position);
  lanGlow.scale.set(2.2, 2.2, 1);
  const barBack = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.16), new THREE.MeshBasicMaterial({ color: 0x120a1e, transparent: true, opacity: 0.8, depthTest: false, fog: false }));
  const barFill2 = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.1), new THREE.MeshBasicMaterial({ color: 0xff4050, depthTest: false, fog: false }));
  barBack.renderOrder = 998;
  barFill2.renderOrder = 999;
  const bar = new THREE.Group();
  bar.position.y = 2.2;
  bar.add(barBack, barFill2);
  g.add(body, outline, tail, e1, e2, eyeGlow, lanPole, lanBody, lanGlow, bar);
  g.userData = { bodyMat, eyeMat, lineMat, tendrils, drops, eyeGlow, lanGlow, bar, barFill2 };
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

// vet bui sang sau chan May khi chay
const TRAIL = 22;
const trail = [];
for (let i = 0; i < TRAIL; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.userData = { life: 0 };
  sp.visible = false;
  scene.add(sp);
  trail.push(sp);
}

// ---------------------------------------------------------------- nhan vat 2D (ve bang canvas, thiet ke rieng): kiem khach non la, mat na, den long
const swordTex = canvasTex(64, 256, (g) => {
  g.lineJoin = "round";
  g.beginPath(); g.moveTo(32, 6); g.lineTo(42, 40); g.lineTo(38, 196); g.lineTo(26, 196); g.lineTo(22, 40); g.closePath();
  const gr = g.createLinearGradient(22, 0, 42, 0); gr.addColorStop(0, "#cfd8e8"); gr.addColorStop(0.5, "#ffffff"); gr.addColorStop(1, "#9fb0c8");
  g.fillStyle = gr; g.fill(); g.lineWidth = 4; g.strokeStyle = "#1a1420"; g.stroke();
  g.beginPath(); g.rect(14, 196, 36, 9); g.fillStyle = "#f2c14e"; g.fill(); g.stroke();
  g.beginPath(); g.rect(26, 205, 12, 44); g.fillStyle = "#3a1f24"; g.fill(); g.stroke();
}, [1, 1]);
let ghostI = 0;
let heroYaw = 0;
// kiem xoay tao loc: 3 thanh kiem bay quanh + 5 vong loc ttang dan
const blades = [];
for (let i = 0; i < 3; i++) {
  const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: swordTex, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
  b.scale.set(0.55, 2.1, 1);
  scene.add(b);
  blades.push(b);
}
const twister = new THREE.Group();
const twRings = [];
for (let i = 0; i < 5; i++) {
  const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06 + i * 0.012, 6, 36, Math.PI * 1.55), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd27a : 0xfff3cf, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  r.rotation.x = Math.PI / 2;
  r.userData = { i };
  twister.add(r);
  twRings.push(r);
}
scene.add(twister);
let slashDir = [0, 1];
let slashDist = 6;
const wave = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 30, Math.PI * 0.95), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
scene.add(wave);
// dom dom trong den long (so luong theo ap luc mang theo) va tia sang bay ve den khi nhat
const INNER = 8;
const inner = [];
for (let i = 0; i < INNER; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.scale.set(0.34, 0.34, 1);
  scene.add(sp);
  inner.push(sp);
}
const STREAKS = 12;
const streaks = [];
for (let i = 0; i < STREAKS; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe58a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.userData = { t: 1, from: new THREE.Vector3() };
  sp.visible = false;
  scene.add(sp);
  streaks.push(sp);
}
let streakI = 0;
const lanternWorld = new THREE.Vector3();
const PETALS = 90;
const petalGeo = new THREE.BufferGeometry();
petalGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PETALS * 3), 3));
const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({ color: 0xffc2d9, map: glowTex, size: 7, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
petals.frustumCulled = false;
scene.add(petals);
const SLASH_LEN = 0.6;
let slashT = 0;
let dashT = 0;
let trailI = 0;
let trailT = 0;
const player = new THREE.Group();
const GHOSTS = 8;
const ghosts = [];
{
  // ---- Nguoi Gac Den: nhan vat 3D to vẽ tay (hand-painted) kieu game MOBA: dau to, khoi ro, vien muc, toi sang theo bac
  const rig = new THREE.Group();
  rig.scale.setScalar(1.65);
  const toonGrad = new THREE.DataTexture(Uint8Array.from([90, 150, 210, 255]), 4, 1, THREE.RedFormat);
  toonGrad.minFilter = toonGrad.magFilter = THREE.NearestFilter;
  toonGrad.needsUpdate = true;
  const paint = (geo, top, bot) => {
    geo.computeBoundingBox();
    const y0 = geo.boundingBox.min.y;
    const h = Math.max(1e-4, geo.boundingBox.max.y - y0);
    const ct = new THREE.Color(top);
    const cb = new THREE.Color(bot);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      c.copy(cb).lerp(ct, (pos.getY(i) - y0) / h);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  };
  const toon = (top, bot = top, side = THREE.FrontSide) => ({ geo: null, mat: new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: toonGrad, emissive: 0x2a2a3c, emissiveIntensity: 0.55, side }), top, bot });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x120c18, side: THREE.BackSide, fog: false });
  outlineMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = position + normal * 0.022;");
  };
  const solid = []; // luoi dung cho tan anh
  const mk = (geo, top, bot, outline = true, side = THREE.FrontSide) => {
    const t = toon(top, bot, side);
    paint(geo, top, bot);
    const m = new THREE.Mesh(geo, t.mat);
    if (outline) {
      const o = new THREE.Mesh(geo, outlineMat);
      o.userData.outline = true;
      m.add(o);
    }
    solid.push(m);
    return m;
  };
  const flat = (geo, color) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    solid.push(m);
    return m;
  };
  const cap = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg);
  const skin = [0xf2c9a0, 0xd99c6e];
  const coat = [0xe8a950, 0xb8732a];
  const green = [0x3f8a6a, 0x23513f];
  const pants = [0x35506c, 0x233649];
  const brown = [0x7a4a2c, 0x3d2216];
  // chan (xoay quanh hong)
  const legs = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.13, 0.68, 0);
    const lg = cap(0.105, 0.32);
    lg.translate(0, -0.28, 0);
    g.add(mk(lg, pants[0], pants[1]));
    const bg = new THREE.SphereGeometry(0.135, 12, 9);
    bg.scale(1, 0.75, 1.5);
    bg.translate(0, -0.6, 0.05);
    g.add(mk(bg, 0x5a3a28, 0x2b1a12));
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.02, 5, 14), new THREE.MeshBasicMaterial({ color: 0xeadfbf }));
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = -0.46;
    g.add(wrap);
    rig.add(g);
    return g;
  });
  // than: ao ngan cam + vat ao kem + dai + khan co
  const torso = mk(new THREE.CylinderGeometry(0.25, 0.33, 0.56, 16), coat[0], coat[1]);
  torso.position.y = 0.98;
  const skirt = mk(new THREE.CylinderGeometry(0.33, 0.43, 0.24, 16, 1, true), 0xf6e8bb, 0xcdb680, false, THREE.DoubleSide);
  skirt.position.y = 0.7;
  const belt = mk(new THREE.TorusGeometry(0.3, 0.05, 6, 20), brown[0], brown[1], false);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.8;
  const buckle = mk(new THREE.SphereGeometry(0.06, 8, 6), 0xffd96a, 0xd9a52e, false);
  buckle.position.set(0, 0.8, 0.31);
  const collar = mk(new THREE.TorusGeometry(0.24, 0.07, 8, 18), 0xf6e8bb, 0xdcc88e, false);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.26;
  const charm = flat(new THREE.SphereGeometry(0.055, 8, 6), 0xffb347);
  charm.position.set(0.2, 0.62, 0.34);
  // dau
  const head = mk(new THREE.SphereGeometry(0.3, 20, 16), skin[0], skin[1]);
  head.position.y = 1.58;
  const eyeG = new THREE.SphereGeometry(0.055, 10, 8);
  eyeG.scale(1, 1.3, 0.5);
  const eyes = [-1, 1].map((sx) => {
    const e = flat(eyeG, 0x1a1420);
    e.position.set(sx * 0.115, 1.59, 0.275);
    const h = flat(new THREE.SphereGeometry(0.016, 6, 5), 0xffffff);
    h.position.set(sx * 0.115 + 0.012, 1.612, 0.3);
    rig.add(e, h);
    return e;
  });
  const brows = [-1, 1].map((sx) => {
    const b = flat(new THREE.BoxGeometry(0.11, 0.028, 0.02), 0x2a1a16);
    b.position.set(sx * 0.115, 1.675, 0.27);
    b.rotation.z = sx * -0.28;
    b.rotation.y = sx * 0.3;
    rig.add(b);
    return b;
  });
  const scar = flat(new THREE.BoxGeometry(0.1, 0.018, 0.01), 0xb5473b);
  scar.position.set(0.14, 1.5, 0.275);
  scar.rotation.z = 0.7;
  const mouth = flat(new THREE.BoxGeometry(0.07, 0.014, 0.01), 0x7a3a34);
  mouth.position.set(-0.02, 1.47, 0.292);
  // toc: nua sau dau + duoi toc
  const hair = mk(new THREE.SphereGeometry(0.325, 16, 12, Math.PI, Math.PI), 0x4a3028, 0x1f1210, false, THREE.DoubleSide);
  hair.position.set(0, 1.6, -0.02);
  const pony = new THREE.Group();
  pony.position.set(0, 1.66, -0.3);
  const pg = cap(0.07, 0.34);
  pg.translate(0, -0.24, 0);
  pony.add(mk(pg, 0x4a3028, 0x1f1210));
  const pt = flat(new THREE.TorusGeometry(0.07, 0.02, 5, 10), 0xe9573f);
  pt.rotation.x = Math.PI / 2;
  pony.add(pt);
  // non la + bang xanh
  const hat = new THREE.Group();
  hat.position.set(0, 1.9, -0.06);
  hat.rotation.x = -0.3;
  const hatCone = mk(new THREE.ConeGeometry(0.6, 0.34, 26), 0xf0d98e, 0xc79f52);
  hatCone.position.y = 0.17;
  const hatBand = mk(new THREE.TorusGeometry(0.6, 0.035, 6, 32), green[0], green[1], false);
  hatBand.rotation.x = Math.PI / 2;
  const hatTop = mk(new THREE.SphereGeometry(0.07, 8, 6), 0xffd96a, 0xd9a52e, false);
  hatTop.position.y = 0.36;
  hat.add(hatCone, hatBand, hatTop);
  for (const k of [0.25, 0.5, 0.75]) {
    const wr = new THREE.Mesh(new THREE.TorusGeometry(0.6 * (1 - k) + 0.012, 0.012, 4, 30), new THREE.MeshBasicMaterial({ color: 0xa8803c }));
    wr.rotation.x = Math.PI / 2;
    wr.position.y = k * 0.34 + 0.01;
    hat.add(wr);
  }
  // ao choang xanh la sau lung
  const capeG = new THREE.CylinderGeometry(0.28, 0.5, 1.0, 18, 1, true, Math.PI - 1.0, 2.0);
  capeG.translate(0, -0.5, 0);
  const cape = new THREE.Group();
  cape.position.set(0, 1.3, -0.04);
  cape.add(mk(capeG, green[0], green[1], false, THREE.DoubleSide));
  // kiem deo lung
  const sheath = new THREE.Group();
  sheath.position.set(0, 1.0, -0.3);
  sheath.rotation.z = 0.75;
  const sh = cap(0.05, 0.85);
  sheath.add(mk(sh, brown[0], brown[1]));
  const hilt = mk(cap(0.032, 0.2), 0xffd96a, 0x8a5a24, false);
  hilt.position.y = 0.62;
  const guard = flat(new THREE.BoxGeometry(0.2, 0.035, 0.05), 0xffd96a);
  guard.position.y = 0.5;
  sheath.add(hilt, guard);
  // tay trai (vung kiem) va tay phai (cam can den)
  const armL = new THREE.Group();
  armL.position.set(-0.34, 1.28, 0);
  const alg = cap(0.075, 0.28);
  alg.translate(0, -0.2, 0);
  armL.add(mk(alg, coat[0], coat[1]));
  const handL = mk(new THREE.SphereGeometry(0.075, 8, 6), skin[0], skin[1], false);
  handL.position.y = -0.46;
  armL.add(handL);
  const blade = new THREE.Group(); // thanh kiem cam tay khi chem
  const bg2 = new THREE.BoxGeometry(0.08, 1.35, 0.02);
  bg2.translate(0, -1.2, 0);
  const bm = new THREE.Mesh(bg2, new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
  const bgd = flat(new THREE.BoxGeometry(0.26, 0.05, 0.06), 0xffd96a);
  bgd.position.y = -0.5;
  blade.add(bm, bgd);
  blade.position.y = -0.46;
  blade.visible = false;
  armL.add(blade);
  const shR = new THREE.Vector3(0.34, 1.28, 0);
  const handR = new THREE.Vector3(0.56, 1.1, 0.34);
  const armR = new THREE.Group();
  armR.position.copy(shR);
  const arg = cap(0.075, 0.2);
  arg.rotateX(Math.PI / 2);
  arg.translate(0, 0, 0.18);
  armR.add(mk(arg, coat[0], coat[1]));
  armR.lookAt(handR.clone().add(new THREE.Vector3(0, 0, 0)));
  armR.updateMatrix();
  const handRM = mk(new THREE.SphereGeometry(0.08, 8, 6), skin[0], skin[1], false);
  handRM.position.copy(handR);
  // can tre + den long
  const poleG = new THREE.CylinderGeometry(0.03, 0.036, 1.95, 7);
  const pole = mk(poleG, 0xb98a55, 0x7a5430, false);
  pole.position.set(0.56, 1.1, 0.34);
  for (const y of [-0.5, 0.1, 0.7]) {
    const n = flat(new THREE.TorusGeometry(0.038, 0.01, 4, 10), 0x5c3b20);
    n.rotation.x = Math.PI / 2;
    n.position.y = y;
    pole.add(n);
  }
  const lan = new THREE.Group();
  lan.position.set(0.56, 2.0, 0.34);
  const hook = flat(new THREE.TorusGeometry(0.06, 0.012, 4, 10, Math.PI), 0x3a2a20);
  hook.position.y = 0.37;
  const shellG = new THREE.SphereGeometry(0.27, 16, 12);
  shellG.scale(1, 1.2, 1);
  const shell = new THREE.Mesh(shellG, new THREE.MeshBasicMaterial({ color: 0xffc866, transparent: true, opacity: 0.92, fog: false }));
  const shellOl = new THREE.Mesh(shellG, outlineMat);
  shellOl.userData.outline = true;
  shell.add(shellOl);
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.011, 4, 24), new THREE.MeshBasicMaterial({ color: 0x5a2a14 }));
    rib.scale.set(1, 1.2, 1);
    rib.rotation.y = (i * Math.PI) / 3;
    lan.add(rib);
  }
  const capT = mk(new THREE.CylinderGeometry(0.12, 0.15, 0.06, 12), 0x8a5a34, 0x4a2f22, false);
  capT.position.y = 0.33;
  const capB = mk(new THREE.CylinderGeometry(0.17, 0.12, 0.07, 12), 0x4a2f22, 0x2a1810, false);
  capB.position.y = -0.33;
  const tas = flat(new THREE.ConeGeometry(0.05, 0.26, 6), 0xe9573f);
  tas.geometry.translate(0, -0.13, 0);
  tas.rotation.x = Math.PI;
  tas.position.y = -0.36;
  tas.rotation.x = 0;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ color: C.moteCore, fog: false }));
  const orbHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  orbHalo.scale.set(2.4, 2.4, 1);
  const lamp = new THREE.PointLight(0xffd98a, 6, 16, 1.6);
  lan.add(hook, shell, capT, capB, tas, orb, orbHalo, lamp);
  rig.add(torso, skirt, belt, buckle, collar, charm, head, scar, mouth, hair, pony, hat, cape, sheath, armL, armR, handRM, pole, lan);
  player.add(rig);
  player.userData = { orb, lamp, rig, lan, orbHalo, legs, armL, armR, cape, pony, hat, sheath, blade, tas, eyes, solid };
  scene.add(player);
  // tan anh khi luot: ban chup tu the, mau vang cam, mo dan
  for (let i = 0; i < GHOSTS; i++) {
    const gm = new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
    const gg = new THREE.Group();
    gg.userData = { life: 0, parts: solid.map((src) => {
      const m = new THREE.Mesh(src.geometry, gm);
      m.matrixAutoUpdate = false;
      gg.add(m);
      return { src, m };
    }), mat: gm };
    gg.visible = false;
    scene.add(gg);
    ghosts.push(gg);
  }
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
const arrowPool = [];
function caption(text, secs = 3.5) {
  if (!settings.captions) return;
  const last = subsList.at(-1);
  if (last && last.text === text && last.until > performance.now() + (secs - 2) * 1000) return; // khong lap lai cung mot dong
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
  el.dataset.rot = String(Math.atan2(-y, x));
  if (el.id === "arrow2") el.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
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
  {
    // mui ten bao quai: moi Bong Muc ngoai man hinh co mot mui ten lon o mep, mau theo trang thai, kem khoang cach (m)
    const a2 = $("arrow2");
    a2.style.display = "none";
    const live = g.state === "playing" ? g.shades.filter((x) => x.state !== "spawning" && Math.hypot(x.pos[0] - g.player.pos[0], x.pos[2] - g.player.pos[2]) < 45) : [];
    while (arrowPool.length < Math.min(live.length, 8)) {
      const el = document.createElement("div");
      el.className = "sarrow";
      el.innerHTML = '<b>➤</b><i></i>';
      document.body.appendChild(el);
      arrowPool.push(el);
    }
    const P0 = g.player.pos;
    live.sort((a, b) => Math.hypot(a.pos[0] - P0[0], a.pos[2] - P0[2]) - Math.hypot(b.pos[0] - P0[0], b.pos[2] - P0[2]));
    arrowPool.forEach((el, i) => {
      const x = live[i];
      if (!x) return void (el.style.display = "none");
      edgeArrow(el, x.pos[0], x.pos[1] + 1, x.pos[2]);
      if (el.style.display === "none") return;
      const d = Math.hypot(x.pos[0] - P0[0], x.pos[2] - P0[2]);
      const hot = x.state === "chase" || x.state === "drain";
      el.classList.toggle("hot", hot);
      el.classList.toggle("stun", x.state === "stunned");
      el.querySelector("i").textContent = `${Math.round(d)} m`;
      el.querySelector("b").style.transform = `rotate(${el.dataset.rot || 0}rad)`;
    });
  }
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
  $("screen").classList.toggle("hero", html.includes("Mây và ba hòn đảo"));
  if (!$("screen").querySelector(".fl")) {
    // den long bay len o man hinh chinh (CSS thuan; tat khi bat Giam chuyen dong)
    for (let i = 0; i < 12; i++) {
      const d = document.createElement("div");
      d.className = "fl";
      d.style.left = `${5 + ((i * 83) % 90)}%`;
      d.style.animationDuration = `${11 + ((i * 7) % 9)}s`;
      d.style.animationDelay = `${-((i * 5) % 14)}s`;
      d.style.transform = `scale(${0.7 + (i % 4) * 0.2})`;
      $("screen").prepend(d);
    }
  }
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
     <p>Một kiếm khách đội nón, đeo mặt nạ, cầm đèn lồng giữa rừng thông trên đảo giữa biển đêm. Thu đom đóm, thắp sáng đèn, cầm cự tới bình minh.</p>
     <div class="chips"><span>🏮 3 Đêm</span><span>🌪 Chém lốc</span><span>👻 Bóng Mực</span><span>🏆 Xếp hạng</span></div>
     <button class="primary" data-act="play">Bắt đầu ▶</button>
     <button data-act="nights">Chọn đêm</button>
     <button data-act="leaderboard">Bảng xếp hạng</button>
     <button data-act="help">Hướng dẫn</button>
     <button data-act="settings">Cài đặt</button>
     <p class="hint">Nhấn <kbd>Enter</kbd> để chơi · cuộn chuột để zoom · bản 1.0.0</p>`,
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
      case "mote_picked": {
        sfx.pickup(e.data.carried);
        let bv = null;
        let bd = 9;
        for (const v of views.motes.values()) {
          const d = Math.hypot(v.position.x - game.player.pos[0], v.position.z - game.player.pos[2]);
          if (d < bd) (bd = d), (bv = v);
        }
        const st = streaks[streakI++ % STREAKS];
        st.userData.from.copy(bv ? bv.position : new THREE.Vector3(game.player.pos[0], game.player.pos[1] + 1, game.player.pos[2]));
        st.userData.t = 0;
        st.visible = true;
        break;
      }
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
        slashT = SLASH_LEN;
        {
          // chem ve phia Bong Muc gan nhat (trong 18 m); khong co thi chem ve huong dang quay
          const P1 = game.player.pos;
          let best = null;
          let bd = 18;
          for (const sh of game.shades) {
            const d = Math.hypot(sh.pos[0] - P1[0], sh.pos[2] - P1[2]);
            if (d < bd) (bd = d), (best = sh);
          }
          if (best) {
            slashDir = [(best.pos[0] - P1[0]) / bd, (best.pos[2] - P1[2]) / bd];
            slashDist = Math.min(bd, 10);
          } else {
            const th = (yaw * Math.PI) / 180;
            slashDir = [Math.sin(th), Math.cos(th)];
            slashDist = 6;
          }
        }
        addRing(P.pos[0], P.pos[1], P.pos[2], T.pulse_radius, C.moteHalo, 0.5);
        sfx.pulse();
        break;
      case "dash": dashT = 0.3; sfx.dash(); addBurst(P.pos[0], P.pos[1] + 0.8, P.pos[2], C.wind, 8); break;
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
    {
      const dx = game.player.pos[0] - m.pos[0];
      const dz = game.player.pos[2] - m.pos[2];
      const d = Math.hypot(dx, dz);
      const pull = d < 2.6 && d > 0.01 ? (1 - d / 2.6) * Math.min(0.9, d) * 0.7 : 0; // vong hut hien thi, khong doi luat nhat
      v.position.set(m.pos[0] + (dx / (d || 1)) * pull, m.pos[1] + 0.9 + Math.sin(time * 2 + m.pos[0]) * 0.18 * (1 - pull), m.pos[2] + (dz / (d || 1)) * pull);
    }
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
    {
      const u = v.userData;
      const calm = settings.reduceMotion ? 0.3 : 1;
      for (const t of u.tendrils) {
        t.rotation.x = Math.sin(time * 4 + t.userData.phase * 2) * 0.35 * calm;
        t.rotation.z = Math.cos(time * 3.2 + t.userData.phase) * 0.35 * calm;
      }
      for (const d of u.drops) {
        const a = time * 1.6 + d.userData.phase;
        d.position.set(Math.cos(a) * 1.25, 0.5 + Math.sin(a * 2) * 0.35, Math.sin(a) * 1.25);
      }
      u.lanGlow.material.opacity = 0.45 + 0.2 * Math.sin(time * 5 + s.pos[0]);
      // thanh trang thai: do day = dang truy duoi / hut dau; xanh tim giam dan = choang con lai; xam = lang thang
      u.bar.quaternion.copy(camera.quaternion);
      const fillW = stunned ? Math.max(0.02, s.ticks / WORLD.pulse_stun_ticks) : s.state === "spawning" ? 0.02 : 1;
      u.barFill2.scale.x = fillW;
      u.barFill2.position.x = -(1 - fillW) * 0.72;
      u.barFill2.material.color.setHex(stunned ? 0x6fd0ff : s.state === "chase" || s.state === "drain" ? 0xff4050 : 0x8a8a9a);
      u.eyeGlow.material.color.setHex(stunned ? C.moteCore : shadeLineHex());
      u.eyeGlow.material.opacity = stunned ? 0.2 : 0.45 + 0.15 * Math.sin(time * 6);
    }
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
    u.beamMat.opacity = BENCH ? 0 : l.lit ? (blinkOff ? 0.02 : 0.05 + 0.07 * (fuel / T.fuel_max) + (settings.reduceMotion ? 0 : Math.sin(time * 2 + i) * 0.012)) : 0;
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
  {
    const mist = terrain?.userData.props?.userData.mist;
    if (mist && !settings.reduceMotion) for (const m of mist) m.position.x = m.userData.x + Math.sin(time * m.userData.sp + m.userData.ph) * 3;
  }
  {
    const spd = Math.hypot(P.vel[0], P.vel[2]);
    trailT += 1;
    if (spd > 3 && P.grounded && trailT % 3 === 0 && !settings.reduceMotion) {
      const sp = trail[trailI++ % TRAIL];
      sp.position.set(P.pos[0] + (Math.random() - 0.5) * 0.3, P.pos[1] + 0.12, P.pos[2] + (Math.random() - 0.5) * 0.3);
      sp.userData.life = 1;
      sp.userData.big = 1;
      sp.material.color.setHex(0xffe9a8);
      sp.visible = true;
    }
    for (const sp of trail) {
      if (sp.userData.life > 0) {
        sp.userData.life = Math.max(0, sp.userData.life - 0.028);
        const k = sp.userData.life;
        sp.material.opacity = k * 0.7;
        sp.scale.setScalar((0.25 + (1 - k) * 0.7) * (sp.userData.big ?? 1));
        sp.position.y += 0.012;
        if (k === 0) sp.visible = false;
      }
    }
  }
  {
    // timer chem / luot
    const dtf = 1 / 60;
    if (slashT > 0) slashT = Math.max(0, slashT - dtf);
    if (dashT > 0) dashT = Math.max(0, dashT - dtf);
    // luot: boc nhieu bong sang theo duong luot
    if (dashT > 0 && !settings.reduceMotion) {
      for (let i = 0; i < 2; i++) {
        const sp = trail[trailI++ % TRAIL];
        sp.position.set(P.pos[0] + (Math.random() - 0.5) * 0.4, P.pos[1] + 0.9 + (Math.random() - 0.5) * 0.6, P.pos[2] + (Math.random() - 0.5) * 0.4);
        sp.material.color.setHex(0xffd27a);
        sp.userData.life = 1;
        sp.userData.big = 1.6;
        sp.visible = true;
      }
    }
  }
  player.visible = !(P.invuln > 0 && Math.floor(time * 14) % 2 === 0) && P.fallWait === 0;
  player.userData.lamp.intensity = 6 + P.carried * 1.6;
  player.userData.orb.scale.setScalar(0.7 + (P.carried / capacityNow(g)) * 0.9);
  const sp = Math.hypot(P.vel[0], P.vel[2]);
  {
    // ---- nhan vat 3D: quay mat theo huong chay (hoac huong chem), chay co nhip chan, ao choang bay, lac den
    const u = player.userData;
    const run = Math.min(1, sp / 6);
    const calm = settings.reduceMotion ? 0.3 : 1;
    const kk = slashT > 0 ? 1 - slashT / SLASH_LEN : 0;
    let want = heroYaw;
    if (slashT > 0) want = Math.atan2(slashDir[0], slashDir[1]);
    else if (sp > 0.6) want = Math.atan2(P.vel[0], P.vel[2]);
    let dy = want - heroYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    heroYaw += dy * Math.min(1, (slashT > 0 ? 0.5 : 0.22));
    player.rotation.y = heroYaw;
    const ph = time * 11;
    const bob = run > 0.05 ? Math.abs(Math.sin(ph)) * 0.1 * run * calm : Math.sin(time * 2) * 0.02 * calm;
    u.rig.position.y = bob;
    u.rig.rotation.x = run * 0.14 + (dashT > 0 ? 0.45 : 0);
    // quay tron khi chem (kiem xoay tao loc)
    const spinE = 1 - Math.pow(1 - kk, 2.2);
    u.rig.rotation.y = slashT > 0 ? spinE * Math.PI * 6 : 0;
    u.legs[0].rotation.x = Math.sin(ph) * 0.75 * run * calm;
    u.legs[1].rotation.x = -Math.sin(ph) * 0.75 * run * calm;
    u.cape.rotation.x = 0.12 + run * 0.6 + Math.sin(time * 9) * 0.1 * run + Math.sin(time * 2) * 0.03 + (slashT > 0 ? 0.7 : 0);
    u.cape.rotation.z = Math.sin(time * 6) * 0.06 * run;
    u.pony.rotation.x = 0.4 + run * 0.7 + Math.sin(time * 10) * 0.2 * run + Math.sin(time * 2.3) * 0.05;
    u.pony.rotation.z = Math.sin(time * 7) * 0.25 * run;
    u.hat.rotation.z = Math.sin(ph * 0.5) * 0.05 * run;
    u.lan.rotation.z = Math.sin(time * 2.1) * 0.05 + (-Math.sin(ph) * 0.1 * run);
    u.lan.rotation.x = Math.cos(time * 1.7) * 0.04 + run * 0.12;
    u.tas.rotation.z = Math.sin(time * 5) * 0.3;
    u.orbHalo.scale.setScalar(2.2 + (P.carried / capacityNow(g)) * 2.2 + Math.sin(time * 5) * 0.12);
    // tay trai: vung kiem khi chem, xoay tu nhien khi chay
    if (slashT > 0) {
      u.armL.rotation.set(-Math.PI / 2, 0, -0.1);
      u.blade.visible = true;
      u.sheath.visible = false;
    } else {
      u.armL.rotation.set(-Math.sin(ph) * 0.55 * run * calm, 0, 0.12);
      u.blade.visible = false;
      u.sheath.visible = true;
    }
    u.lan.getWorldPosition(lanternWorld);
    {
      const n = Math.round((P.carried / capacityNow(g)) * INNER);
      inner.forEach((sp2, i) => {
        const on = i < n;
        const a = time * (1.4 + i * 0.17) + i * 2.1;
        sp2.position.set(lanternWorld.x + Math.cos(a) * 0.12, lanternWorld.y - 0.04 + Math.sin(a * 1.7) * 0.14, lanternWorld.z + Math.sin(a) * 0.12);
        sp2.material.opacity = on ? 0.8 + 0.2 * Math.sin(time * 6 + i) : 0;
        sp2.visible = on && player.visible;
      });
      for (const st of streaks) {
        if (st.userData.t < 1) {
          st.userData.t = Math.min(1, st.userData.t + 0.07);
          const k = st.userData.t;
          const e2 = k * k * (3 - 2 * k);
          st.position.lerpVectors(st.userData.from, lanternWorld, e2);
          st.position.y += Math.sin(k * Math.PI) * 0.8;
          st.material.opacity = 1 - k * 0.3;
          st.scale.setScalar(0.5 * (1 - k * 0.6));
          if (k >= 1) st.visible = false;
        }
      }
    }
    // tan anh khi luot: chup lai tu the 3D, vang cam, mo dan
    if (dashT > 0 && !settings.reduceMotion && Math.floor(time * 60) % 2 === 0) {
      const gg = ghosts[ghostI++ % GHOSTS];
      player.updateWorldMatrix(true, true);
      for (const { src, m } of gg.userData.parts) {
        src.updateWorldMatrix(true, false);
        m.matrix.copy(src.matrixWorld);
        m.matrixWorldNeedsUpdate = true;
      }
      gg.userData.life = 1;
      gg.visible = true;
    }
    for (const gg of ghosts) {
      if (gg.userData.life > 0) {
        gg.userData.life = Math.max(0, gg.userData.life - 0.05);
        gg.userData.mat.opacity = gg.userData.life * 0.4;
        if (gg.userData.life === 0) gg.visible = false;
      }
    }
    // chem tao loc: kiem quet, loc xoay va luoi kiem bay ve phia quai
    const env = slashT > 0 ? Math.sin(kk * Math.PI) : 0;
    const rad = T.pulse_radius * 0.5;
    const travel = kk * slashDist;
    const cx = P.pos[0] + slashDir[0] * travel;
    const cz = P.pos[2] + slashDir[1] * travel;
    blades.forEach((b, i) => {
      const a = kk * Math.PI * 7 + (i * Math.PI * 2) / 3;
      b.position.set(P.pos[0] + Math.cos(a) * 1.7 * env, P.pos[1] + 1.5 + Math.sin(kk * 9 + i) * 0.1, P.pos[2] + Math.sin(a) * 1.7 * env);
      b.material.rotation = -a;
      b.material.opacity = env * 0.8;
    });
    wave.position.set(cx, P.pos[1] + 1.15, cz);
    wave.rotation.set(0, Math.atan2(slashDir[0], slashDir[1]), 0);
    wave.rotation.z = Math.PI * 0.025;
    wave.scale.setScalar(0.8 + kk * 1.6);
    wave.material.opacity = env * 0.95;
    twister.position.set(cx, P.pos[1], cz);
    twRings.forEach((r) => {
      const i = r.userData.i;
      const s2 = rad * (0.25 + i * 0.16) * (0.5 + env * 0.8);
      r.scale.set(s2, s2, s2);
      r.position.y = 0.2 + i * 0.6 * (0.6 + env * 0.6);
      r.rotation.z = time * (9 + i * 2) * (i % 2 ? 1 : -1);
      r.material.opacity = env * (0.6 - i * 0.07) * (settings.reduceMotion ? 0.5 : 1);
    });
  }
  {
    // canh hoa troi quanh nguoi choi
    const pa = petalGeo.attributes.position.array;
    for (let i = 0; i < PETALS; i++) {
      const sp1 = 0.5 + (i % 5) * 0.18;
      const k = (i * 13.37 + time * sp1 * 1.4) % 36;
      pa[i * 3] = P.pos[0] + ((i * 7.31) % 30) - 15 + Math.sin(time * 0.7 + i) * 1.5 + k * 0.25 - 4.5;
      pa[i * 3 + 1] = P.pos[1] + 9 - k * 0.3 + Math.sin(time * 2 + i * 2) * 0.25;
      pa[i * 3 + 2] = P.pos[2] + ((i * 11.9) % 30) - 15 + Math.cos(time * 0.6 + i) * 1.5;
    }
    petalGeo.attributes.position.needsUpdate = true;
    petals.visible = !lowGfx && !BENCH && !settings.reduceMotion;
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

let camZoom = 1.12; // cuon chuot de xem rong hon / gan hon
addEventListener("wheel", (e) => { camZoom = Math.min(1.9, Math.max(0.8, camZoom + Math.sign(e.deltaY) * 0.08)); }, { passive: true });
function updateCamera(dt) {
  if (mode === "menu") yaw += 7 * dt; // sanh cho: camera quay cham quanh Mây
  const P = game.player;
  const th = (yaw * Math.PI) / 180;
  const f = [Math.sin(th), Math.cos(th)];
  const y = Math.max(P.pos[1], -2);
  const target = new THREE.Vector3(P.pos[0] + f[0] * 3, 1.2 + y * 0.9, P.pos[2] + f[1] * 3);
  const want = new THREE.Vector3(P.pos[0] - f[0] * 11 * camZoom, 7.5 * camZoom + y * 0.95, P.pos[2] - f[1] * 11 * camZoom);
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
  if (fpsLow && !lowGfx && mode === "play" && !params.has("high")) { // ?high: giu do hoa cao, khong tu ha cap
    // may yeu: da giam do phan giai toi muc thap nhat van < 28 FPS -> tat cay co, may, den troi (khong anh huong luat choi)
    lowGfx = true;
    if (terrain?.userData.props) terrain.userData.props.visible = false;
    skyGroup.visible = false;
    for (const l of skyLanterns) l.visible = false;
    for (const m of auroras) m.visible = false;
    shootStar.visible = false;
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
  for (const m of auroras) m.visible = false; // bench: khong co hieu ung sang tao
  shootStar.visible = false;
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
