// Ban choi 3D cua Dao Den Long (Dem 1). Dung CHUNG loi mo phong voi che do headless.
// Moi hieu ung o day chi la hien thi - khong anh huong ket qua mo phong.
import * as THREE from "./vendor/three.module.min.js";
import { createGame, step, timeLeft, TICKS_PER_SECOND, WORLD } from "../src/core/sim.mjs";

const contract = await (await fetch("../game.contract.json", { cache: "no-store" })).json();
const T = contract.tuning;
const params = new URLSearchParams(location.search);
const DEMO = params.has("demo"); // chi de quay/kiem thu: tu dong choi
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- scene
const canvas = $("view");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const SKY_NIGHT = new THREE.Color(0x070b22);
const SKY_DAWN = new THREE.Color(0xf29a6b);
scene.background = SKY_NIGHT.clone();
scene.fog = new THREE.FogExp2(0x070b22, 0.011);

const hemi = new THREE.HemisphereLight(0x6a7cc8, 0x24324a, 0.8);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8fa4ff, 0.7);
moon.position.set(-30, 60, -20);
scene.add(moon);

// mat dao
const GROUND_DARK = new THREE.Color(0x1a3236);
const GROUND_WARM = new THREE.Color(0x4a5a3a);
const groundMat = new THREE.MeshStandardMaterial({ color: GROUND_DARK.clone(), roughness: 1 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(WORLD.island_radius, 96), groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const rim = new THREE.Mesh(
  new THREE.RingGeometry(WORLD.island_radius - 0.6, WORLD.island_radius + 0.6, 96),
  new THREE.MeshBasicMaterial({ color: 0x4a6a8a, transparent: true, opacity: 0.6 }),
);
rim.rotation.x = -Math.PI / 2;
rim.position.y = 0.02;
scene.add(rim);

// sao
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
  var stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, fog: false, transparent: true }));
  scene.add(stars);
}

// cay thong tran tri (xac dinh, khong dung Math.random)
{
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 6, 7), new THREE.MeshStandardMaterial({ color: 0x14302f, roughness: 1 }), 70);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 70; i++) {
    const a = i * 2.399963;
    const r = 52 + ((i * 37) % 24);
    const s = 0.8 + ((i * 13) % 10) / 10;
    m.compose(new THREE.Vector3(Math.cos(a) * r, 3 * s, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    trees.setMatrixAt(i, m);
  }
  scene.add(trees);
}

// ---------------------------------------------------------------- doi tuong dong
const moteGeo = new THREE.SphereGeometry(0.22, 10, 10);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
const moteGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd35a, transparent: true, opacity: 0.25, depthWrite: false });
const moteGlowGeo = new THREE.SphereGeometry(0.55, 10, 10);

function makeMote() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(moteGeo, moteMat), new THREE.Mesh(moteGlowGeo, moteGlowMat));
  scene.add(g);
  return g;
}

function makeLantern() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 8), new THREE.MeshStandardMaterial({ color: 0x6a5a45, roughness: 0.9 }));
  pole.position.y = 1.5;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x8a7a55, emissive: 0xffb84a, emissiveIntensity: 0.25, roughness: 0.6 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), lampMat);
  lamp.position.y = 3.4;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x2a2118 }));
  cap.position.y = 4.2;
  cap.rotation.y = Math.PI / 4;
  const light = new THREE.PointLight(0xffc766, 0, 34, 1.6);
  light.position.y = 3.4;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0.1, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.25, T.safe_radius, 72), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  const discMat = new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(T.safe_radius, 72), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.03;
  g.add(pole, lamp, cap, light, ring, disc);
  g.userData = { lampMat, light, ringMat, discMat };
  scene.add(g);
  return g;
}

function makeShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b1030, emissive: 0x2a0f4a, emissiveIntensity: 0.6, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 14), bodyMat);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.4, 12), bodyMat);
  tail.position.y = -0.9;
  tail.rotation.x = Math.PI;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4fd8 });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.3, 0.2, 0.75);
  e2.position.set(0.3, 0.2, 0.75);
  g.add(body, tail, e1, e2);
  g.userData = { bodyMat, eyeMat };
  scene.add(g);
  return g;
}

const player = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 6, 12), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7 }));
  body.position.y = 0.9;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), new THREE.MeshBasicMaterial({ color: 0xffe28a }));
  orb.position.set(0.55, 1.15, 0.2);
  const lamp = new THREE.PointLight(0xffd98a, 6, 16, 1.6);
  lamp.position.set(0.55, 1.4, 0.2);
  // non la cua May
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.55, 20), new THREE.MeshStandardMaterial({ color: 0xd9b86a, roughness: 0.8 }));
  hat.position.y = 2.0;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0xc9a65a, roughness: 0.8 }));
  brim.position.y = 1.74;
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x5a4a30 }));
  hook.position.set(0.55, 1.45, 0.2);
  player.add(body, hat, brim, hook, orb, lamp);
  player.userData = { body, orb, lamp };
  scene.add(player);
}

// ---------------------------------------------------------------- game state
let game;
let started = false;
let paused = false;
let acc = 0;
let last = performance.now();
let yaw = 0; // do, = cam_yaw_deg dua vao mo phong
let shake = 0;
const views = { motes: new Map(), shades: new Map(), lanterns: [] };
const fx = []; // hieu ung ngan han (chi hien thi)

function disposeAll() {
  for (const v of views.motes.values()) scene.remove(v);
  for (const v of views.shades.values()) scene.remove(v);
  for (const v of views.lanterns) scene.remove(v);
  for (const f of fx) scene.remove(f.obj);
  views.motes.clear();
  views.shades.clear();
  views.lanterns = [];
  fx.length = 0;
}

function newGame() {
  disposeAll();
  const seed = params.has("seed") && !game ? Number(params.get("seed")) | 0 : (Date.now() ^ (Math.random() * 0x7fffffff)) | 0;
  game = createGame({ seed, tuning: T, scenario: {} });
  for (const l of game.lanterns) views.lanterns.push(makeLantern());
  acc = 0;
  shake = 0;
  yaw = 0;
  window.__ddl = { game, seed, THREE, scene, camera, renderer };
  buildChips();
  hide();
}

// ---------------------------------------------------------------- input
const keys = new Set();
const latch = { jump: false, interact: false, pulse: false };
let audio;
function ensureAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch { /* khong co am thanh thi thoi */ }
}
function blip(freq, dur = 0.12, type = "sine", vol = 0.06, slide = 0) {
  if (!audio) return;
  const o = audio.createOscillator();
  const gn = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audio.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), audio.currentTime + dur);
  gn.gain.setValueAtTime(vol, audio.currentTime);
  gn.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
  o.connect(gn).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + dur);
}

addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  ensureAudio();
  if (!started) {
    if (e.code === "Enter" || e.code === "Space") start();
    return;
  }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "Space") latch.jump = true;
  if (e.code === "KeyE") latch.interact = true;
  if (e.code === "KeyF") latch.pulse = true;
  if (e.code === "KeyR") restart();
  if (e.code === "KeyP" && game.state === "playing") {
    paused = !paused;
    paused ? show("Tạm dừng", "<p>Nhấn <kbd>P</kbd> để tiếp tục.</p>") : hide();
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
let dragging = false;
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointermove", (e) => {
  if (dragging) yaw -= e.movementX * 0.3;
});

function readInput(dt) {
  if (keys.has("KeyZ")) yaw += 100 * dt;
  if (keys.has("KeyX")) yaw -= 100 * dt;
  // Camera nhin theo (sin yaw, cos yaw). Man hinh-phai = -X khi yaw=0 nen phim D => x = -1.
  const mx = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) - (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);
  const mz = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  return { move: [mx, mz], camYawDeg: yaw, jump: keys.has("Space"), interact: keys.has("KeyE"), pulse: keys.has("KeyF") };
}

// tu dong choi don gian cho ?demo (chi de kiem thu/quay man hinh)
function demoInput(g, tick) {
  const P = g.player;
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const lantern = g.lanterns.filter((l) => !l.lit).sort((a, b) => d2(P.pos, a.pos) - d2(P.pos, b.pos))[0];
  const near = g.motes.slice().sort((a, b) => d2(P.pos, a.pos) - d2(P.pos, b.pos))[0];
  const target = P.carried >= T.lantern_cost && lantern ? lantern.pos : (near ?? lantern)?.pos;
  const out = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false };
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

// ---------------------------------------------------------------- HUD / man hinh
function buildChips() {
  const root = $("lanterns");
  root.innerHTML = "";
  for (const l of game.lanterns) {
    const d = document.createElement("div");
    d.className = "box chip";
    d.id = `chip-${l.id}`;
    root.appendChild(d);
  }
  const carry = $("carry");
  carry.innerHTML = "";
  for (let i = 0; i < T.carry_capacity; i++) carry.appendChild(document.createElement("i"));
  $("carryCap").textContent = T.carry_capacity;
}

function updateHud() {
  const g = game;
  const P = g.player;
  $("flames").textContent = "🔥".repeat(Math.max(0, P.flames)) + "·".repeat(Math.max(0, T.flames - P.flames));
  $("score").textContent = g.score;
  const left = Math.ceil(timeLeft(g));
  $("time").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  $("carryN").textContent = P.carried;
  [...$("carry").children].forEach((c, i) => c.classList.toggle("on", i < P.carried));
  for (const l of g.lanterns) {
    const el = $(`chip-${l.id}`);
    el.classList.toggle("lit", l.lit);
    el.innerHTML = `${l.id}<b>${l.lit ? "Sáng" : `${l.deposited}/${T.lantern_cost}`}</b>`;
  }
  const un = g.lanterns.filter((l) => !l.lit).sort((a, b) => Math.hypot(a.pos[0] - P.pos[0], a.pos[2] - P.pos[2]) - Math.hypot(b.pos[0] - P.pos[0], b.pos[2] - P.pos[2]))[0];
  $("nearest").textContent = un ? `Đèn chưa sáng gần nhất: ${un.id} (${Math.round(Math.hypot(un.pos[0] - P.pos[0], un.pos[2] - P.pos[2]))} m)` : "Tất cả đèn đã sáng!";
}

let hintTimer = 0;
function hint(text) {
  $("hint").textContent = text;
  $("hint").classList.add("show");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => $("hint").classList.remove("show"), 1800);
}

function show(title, html) {
  $("card").innerHTML = `<h1>${title}</h1>${html}`;
  $("screen").classList.remove("hidden");
}
function hide() {
  $("screen").classList.add("hidden");
}

function intro() {
  show(
    "Đảo Đèn Lồng",
    `<p class="big">Đêm sắp tàn, 5 chiếc đèn trên đảo đã tắt.</p>
     <p>Nhặt <b>đom đóm ánh sáng</b>, mang đến từng cột đèn và nạp <b>${T.lantern_cost}</b> ánh sáng để thắp sáng nó.<br>
     Thắp đủ <b>${T.lantern_count_night1}</b> đèn trước bình minh (${Math.round(T.night1_duration_s / 60)} phút) để thắng.</p>
     <p>Tránh <b>Bóng Mực</b>: mỗi lần chạm mất 1 trong ${T.flames} mạng và đánh rơi một nửa ánh sáng đang mang.<br>
     Vùng quanh đèn đã thắp là chỗ an toàn. <kbd>F</kbd> tốn ${T.pulse_cost} ánh sáng để làm choáng và đẩy lùi chúng.</p>
     <p class="go">Nhấn <kbd>Enter</kbd> hoặc <kbd>Space</kbd> để bắt đầu</p>`,
  );
}

function endScreen() {
  const g = game;
  const won = g.state === "won";
  const why = { dawn: "Bình minh đã lên khi vẫn còn đèn chưa sáng.", no_flames: "Bạn đã hết mạng trước Bóng Mực." }[g.result.reason];
  show(
    won ? "Bạn đã thắp sáng cả đảo!" : "Đêm đã trôi qua…",
    `<p class="big">Điểm: <b>${g.score}</b></p>
     <p>${won ? `Còn ${Math.floor(timeLeft(g))} giây và ${g.player.flames} mạng.` : why}</p>
     <p>Đèn sáng: ${g.lanterns.filter((l) => l.lit).length}/${g.lanterns.length}</p>
     <p class="go">Nhấn <kbd>R</kbd> để chơi lại</p>`,
  );
}

function start() {
  started = true;
  newGame();
}
function restart() {
  paused = false;
  newGame();
}

// ---------------------------------------------------------------- hieu ung
function addRing(x, z, radius, color, life = 0.45) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 56), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.08, z);
  scene.add(m);
  fx.push({ obj: m, age: 0, life, kind: "ring", radius });
}
function addBurst(x, y, z, color = 0xffd35a, n = 22) {
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
    if (e.name === "mote_picked") blip(660 + e.data.carried * 40, 0.09, "sine", 0.05);
    if (e.name === "deposit") blip(330, 0.18, "triangle", 0.06, 120);
    if (e.name === "lantern_lit") {
      const l = game.lanterns.find((x) => x.id === e.data.lantern_id);
      addBurst(l.pos[0], 3.4, l.pos[2]);
      addRing(l.pos[0], l.pos[2], T.safe_radius, 0xffc766, 0.9);
      [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.25, "sine", 0.07), i * 90));
      hint(`Đèn ${l.id} đã sáng!`);
    }
    if (e.name === "pulse") {
      addRing(P.pos[0], P.pos[2], T.pulse_radius, 0x9fd8ff, 0.5);
      blip(220, 0.35, "sawtooth", 0.05, 440);
    }
    if (e.name === "player_hit") {
      $("flash").classList.add("on");
      setTimeout(() => $("flash").classList.remove("on"), 60);
      shake = 0.5;
      blip(140, 0.3, "square", 0.08, -70);
      hint(e.data.dropped ? `Bị chạm! Đánh rơi ${e.data.dropped} ánh sáng.` : "Bị chạm!");
    }
    if (e.name === "game_over") {
      if (e.data.result === "won") [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.3, "sine", 0.08), i * 120));
      else blip(120, 0.8, "sawtooth", 0.07, -60);
      setTimeout(endScreen, 600);
    }
  }
}

// ---------------------------------------------------------------- vong lap
function syncViews(time) {
  const g = game;
  // dom dom
  const alive = new Set();
  for (const m of g.motes) {
    alive.add(m.id);
    let v = views.motes.get(m.id);
    if (!v) views.motes.set(m.id, (v = makeMote()));
    v.position.set(m.pos[0], 0.9 + Math.sin(time * 2 + m.pos[0]) * 0.18, m.pos[2]);
  }
  for (const [id, v] of views.motes) if (!alive.has(id)) (scene.remove(v), views.motes.delete(id));
  // bong muc
  const aliveS = new Set();
  for (const s of g.shades) {
    aliveS.add(s.id);
    let v = views.shades.get(s.id);
    if (!v) views.shades.set(s.id, (v = makeShade()));
    const stunned = s.state === "stunned";
    v.position.set(s.pos[0], (stunned ? 0.9 : 1.3 + Math.sin(time * 3 + s.pos[0]) * 0.15), s.pos[2]);
    v.scale.setScalar(stunned ? 0.75 : 1);
    v.userData.bodyMat.color.setHex(stunned ? 0x2f4a78 : 0x1b1030);
    v.userData.eyeMat.color.setHex(stunned ? 0x9fd8ff : 0xff4fd8);
    v.rotation.y = Math.atan2(g.player.pos[0] - s.pos[0], g.player.pos[2] - s.pos[2]);
  }
  for (const [id, v] of views.shades) if (!aliveS.has(id)) (scene.remove(v), views.shades.delete(id));
  // den
  g.lanterns.forEach((l, i) => {
    const v = views.lanterns[i];
    v.position.set(l.pos[0], 0, l.pos[2]);
    const prog = l.lit ? 1 : Math.min(1, l.deposited / T.lantern_cost) * 0.55;
    v.userData.lampMat.emissiveIntensity = l.lit ? 2.2 + Math.sin(time * 5 + i) * 0.25 : 0.25 + prog * 1.2;
    v.userData.light.intensity = l.lit ? 120 + Math.sin(time * 4 + i) * 12 : prog * 25;
    v.userData.ringMat.opacity = l.lit ? 0.55 : 0.1 + prog * 0.2;
    v.userData.discMat.opacity = l.lit ? 0.08 : 0;
  });
  // nguoi choi
  const P = g.player;
  player.position.set(P.pos[0], P.pos[1], P.pos[2]);
  const blink = P.invuln > 0 && Math.floor(time * 14) % 2 === 0;
  player.visible = !blink;
  player.userData.lamp.intensity = 6 + P.carried * 1.6;
  player.userData.orb.scale.setScalar(0.7 + (P.carried / T.carry_capacity) * 0.9);
  // huong nhan vat theo huong di
  const dxv = Math.sin((yaw * Math.PI) / 180);
  player.rotation.y = Math.atan2(dxv, Math.cos((yaw * Math.PI) / 180));
}

function updateCamera(dt, time) {
  const P = game.player;
  const th = (yaw * Math.PI) / 180;
  const f = [Math.sin(th), Math.cos(th)];
  const target = new THREE.Vector3(P.pos[0] + f[0] * 3, 1.2 + P.pos[1] * 0.5, P.pos[2] + f[1] * 3);
  const want = new THREE.Vector3(P.pos[0] - f[0] * 11, 7.5 + P.pos[1] * 0.6, P.pos[2] - f[1] * 11);
  camera.position.lerp(want, 1 - Math.exp(-8 * dt));
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 2);
  }
  camera.lookAt(target);
}

function updateSky() {
  const lit = game.lanterns.filter((l) => l.lit).length / game.lanterns.length; // dao sang dan khi thap den
  hemi.intensity = 0.8 + lit * 0.9;
  groundMat.color.copy(GROUND_DARK).lerp(GROUND_WARM, lit);
  const k = 1 - timeLeft(game) / game.t0; // 0 -> 1 khi den gan binh minh
  const dawn = Math.max(0, (k - 0.7) / 0.3);
  scene.background.copy(SKY_NIGHT).lerp(SKY_DAWN, dawn * 0.55);
  scene.fog.color.copy(scene.background);
  stars.material.opacity = 1 - dawn * 0.85;
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!game) {
    renderer.render(scene, camera);
    return;
  }
  if (started && !paused && game.state === "playing") {
    acc += dt;
    while (acc >= 1 / TICKS_PER_SECOND && game.state === "playing") {
      acc -= 1 / TICKS_PER_SECOND;
      const input = DEMO ? demoInput(game, game.tick) : readInput(1 / TICKS_PER_SECOND);
      if (!DEMO) {
        input.jump ||= latch.jump;
        input.interact ||= latch.interact;
        input.pulse ||= latch.pulse;
      }
      const ev = step(game, input);
      latch.jump = latch.interact = latch.pulse = false;
      onEvents(ev);
    }
  }
  const time = now / 1000;
  syncViews(time);
  updateCamera(dt, time);
  updateSky();
  updateFx(dt);
  updateHud();
  renderer.render(scene, camera);
}

// khoi dong
if (params.has("autostart") || DEMO) start();
else {
  newGame(); // dung canh nen sau man hinh gioi thieu
  intro();
}
requestAnimationFrame(frame);
