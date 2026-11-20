// Kiem tra dinh dang file inputs / scenario theo Test Contract v1.1.
// Moi ham nem FormatError neu sai; CLI doi thanh ma thoat 2.
export class FormatError extends Error {}

export const SHADE_STATES = ["spawning", "wander", "chase", "recoil", "stunned"];
export const DRIFTER_STATES = ["idle", "chase", "flee"];
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const fail = (msg) => {
  throw new FormatError(msg);
};
const vec3 = (v, where) => {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(`${where}: can mang 3 so [x, y, z]`);
};
const nonNegInt = (v, where) => {
  if (!Number.isInteger(v) || v < 0) fail(`${where}: can so nguyen >= 0`);
};

export function validateInputs(doc) {
  if (!isObj(doc) || !Array.isArray(doc.frames)) fail("inputs: can doi tuong co mang 'frames'");
  let last = -1;
  doc.frames.forEach((f, i) => {
    const w = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${w}: phai la doi tuong`);
    if (!Number.isInteger(f.tick) || f.tick < 0) fail(`${w}.tick: can so nguyen >= 0`);
    if (f.tick <= last) fail(`${w}.tick: phai tang nghiem ngat (${f.tick} <= ${last})`);
    last = f.tick;
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum)) fail(`${w}.move: can [x, z]`);
      if (f.move.some((c) => c < -1 || c > 1)) fail(`${w}.move: moi thanh phan phai trong [-1, 1]`);
    }
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) fail(`${w}.cam_yaw_deg: can so`);
    for (const b of ["jump", "interact", "pulse", "dash", "pause"]) {
      if (f[b] !== undefined && typeof f[b] !== "boolean") fail(`${w}.${b}: can true/false`);
    }
  });
  return doc;
}

export function validateScenario(doc, lanternIds) {
  if (!isObj(doc)) fail("scenario: phai la doi tuong");
  if (doc.player !== undefined) {
    if (!isObj(doc.player)) fail("scenario.player: phai la doi tuong");
    if (doc.player.pos !== undefined) vec3(doc.player.pos, "scenario.player.pos");
    if (doc.player.carried !== undefined) nonNegInt(doc.player.carried, "scenario.player.carried");
    if (doc.player.flames !== undefined) nonNegInt(doc.player.flames, "scenario.player.flames");
    for (const k of ["invuln_ticks", "dash_cd_ticks", "pulse_cd_ticks", "charm_ticks"]) {
      if (doc.player[k] !== undefined) nonNegInt(doc.player[k], `scenario.player.${k}`);
    }
  }
  for (const k of ["random_motes", "random_shades", "random_drifters", "wind_enabled"]) {
    if (doc[k] !== undefined && typeof doc[k] !== "boolean") fail(`scenario.${k}: can true/false`);
  }
  if (doc.motes !== undefined) {
    if (!Array.isArray(doc.motes)) fail("scenario.motes: phai la mang");
    doc.motes.forEach((m, i) => vec3(isObj(m) ? m.pos : m, `scenario.motes[${i}]`));
  }
  if (doc.shades !== undefined) {
    if (!Array.isArray(doc.shades)) fail("scenario.shades: phai la mang");
    doc.shades.forEach((s, i) => {
      if (!isObj(s)) fail(`scenario.shades[${i}]: phai la doi tuong`);
      vec3(s.pos, `scenario.shades[${i}].pos`);
      if (s.id !== undefined && typeof s.id !== "string") fail(`scenario.shades[${i}].id: can chuoi`);
      if (s.state !== undefined && !SHADE_STATES.includes(s.state)) fail(`scenario.shades[${i}].state: mot trong ${SHADE_STATES.join(", ")}`);
      if (s.state_ticks_left !== undefined) nonNegInt(s.state_ticks_left, `scenario.shades[${i}].state_ticks_left`);
    });
  }
  if (doc.drifters !== undefined) {
    if (!Array.isArray(doc.drifters)) fail("scenario.drifters: phai la mang");
    doc.drifters.forEach((d, i) => {
      const w = `scenario.drifters[${i}]`;
      if (!isObj(d)) fail(`${w}: phai la doi tuong`);
      vec3(d.pos, `${w}.pos`);
      if (d.id !== undefined && typeof d.id !== "string") fail(`${w}.id: can chuoi`);
      if (d.state !== undefined && !DRIFTER_STATES.includes(d.state)) fail(`${w}.state: mot trong ${DRIFTER_STATES.join(", ")}`);
      if (d.stolen !== undefined) nonNegInt(d.stolen, `${w}.stolen`);
    });
  }
  if (doc.charms !== undefined) {
    if (!Array.isArray(doc.charms)) fail("scenario.charms: phai la mang");
    doc.charms.forEach((c, i) => {
      const w = `scenario.charms[${i}]`;
      if (!isObj(c) || typeof c.id !== "string") fail(`${w}: can doi tuong co 'id'`);
      vec3(c.pos, `${w}.pos`);
      if (c.available !== undefined && typeof c.available !== "boolean") fail(`${w}.available: can true/false`);
      if (c.respawn_ticks !== undefined) nonNegInt(c.respawn_ticks, `${w}.respawn_ticks`);
    });
  }
  if (doc.lanterns !== undefined) {
    if (!Array.isArray(doc.lanterns)) fail("scenario.lanterns: phai la mang");
    doc.lanterns.forEach((l, i) => {
      const w = `scenario.lanterns[${i}]`;
      if (!isObj(l) || typeof l.id !== "string") fail(`${w}: can doi tuong co 'id'`);
      if (!lanternIds.includes(l.id)) fail(`${w}.id: '${l.id}' khong co (hop le: ${lanternIds.join(", ")})`);
      if (l.pos !== undefined) vec3(l.pos, `${w}.pos`);
      if (l.deposited !== undefined) nonNegInt(l.deposited, `${w}.deposited`);
      if (l.lit !== undefined && typeof l.lit !== "boolean") fail(`${w}.lit: can true/false`);
    });
  }
  if (doc.time_left_s !== undefined && (!isNum(doc.time_left_s) || doc.time_left_s < 0)) {
    fail("scenario.time_left_s: can so >= 0");
  }
  return doc;
}
