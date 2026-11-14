/* ------------------------------------------------------------------
   robot.js — the Hasta humanoid, its articulated hands, and the tray.
   Everything is modelled procedurally from lofted shells. Units: metres.
------------------------------------------------------------------ */
function mk(geo, mat, parent, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (parent) parent.add(m);
  return m;
}
/* chamfered disc along Y (axis 'x' or 'z' rotates it) */
function puck(r, h, b = Math.min(r, h) * 0.18, axis = 'y', seg = 40) {
  const g = lathe([[0, -h / 2], [r - b, -h / 2], [r - b * 0.3, -h / 2 + b * 0.3], [r, -h / 2 + b], [r, h / 2 - b], [r - b * 0.3, h / 2 - b * 0.3], [r - b, h / 2], [0, h / 2]], seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}
function planarUV(g, x0, x1, y0, y1) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0) / (x1 - x0), (p.getY(i) - y0) / (y1 - y0));
  uv.needsUpdate = true;
  return g;
}

/* ================= HAND =================
   Canonical right hand: wrist at the origin, fingers along +Y, palm facing +Z,
   thumb on +X. Each finger has three hinged phalanges with an exposed metal
   core and hinge pin, a hard back shell and a ribbed soft pad. */
const FINGERS = [
  { x: 0.0268, y: 0.0945, fan: -0.055, len: [0.045, 0.028, 0.023], w: 0.0172 },
  { x: 0.0086, y: 0.0990, fan: -0.012, len: [0.050, 0.031, 0.024], w: 0.0176 },
  { x: -0.0098, y: 0.0955, fan: 0.040, len: [0.046, 0.029, 0.023], w: 0.0170 },
  { x: -0.0272, y: 0.0870, fan: 0.105, len: [0.036, 0.023, 0.021], w: 0.0152 }
];
const SPREAD = [-0.16, -0.03, 0.10, 0.26];
const THUMB = { len: [0.040, 0.031, 0.026], w: 0.0205 };

function buildHand(M) {
  const hand = new THREE.Group();

  function phalanx(L, w, distal) {
    const g = new THREE.Group(), t = w * 0.92;
    mk(puck(t * 0.47, w * 1.0, t * 0.08, 'x', 24), M.metalDark, g);
    mk(puck(t * 0.2, w * 1.09, t * 0.04, 'x', 16), M.metal, g);
    mk(loft([[0, w * 0.3, t * 0.3, t * 0.3, 4], [L, w * 0.3, t * 0.3, t * 0.3, 4]], { segU: 16, segV: 2 }), M.metalDark, g);
    const top = distal ? L + w * 0.3 : L * 0.9;
    mk(loft([[L * 0.17, w * 0.5, t * 0.14, t * 0.52, 3], [top, w * (distal ? 0.47 : 0.5), t * 0.14, t * (distal ? 0.47 : 0.52), 3]],
      { capB: w * 0.2, capT: distal ? w * 0.5 : w * 0.2, segU: 28, segV: 14 }), M.shell, g);
    const pitch = 0.0021;
    const ribs = (u, y) => 1 + 0.07 * Math.pow(Math.max(0, Math.sin(u * TAU)), 0.6) * Math.pow(0.5 + 0.5 * Math.sin(y * TAU / pitch), 2);
    const padTop = distal ? L + w * 0.27 : L * 0.86;
    mk(loft([[L * 0.2, w * 0.44, t * 0.55, t * 0.05, 2.6], [padTop, w * (distal ? 0.41 : 0.44), t * (distal ? 0.5 : 0.55), t * 0.05, 2.6]],
      { capB: w * 0.24, capT: distal ? w * 0.46 : w * 0.24, mod: ribs, segU: 28, segV: distal ? 48 : 36 }), M.pad, g);
    if (distal) mk(puck(t * 0.12, 0.0012, 0.0003, 'z', 12), M.metal, g, [0, L * 0.45, -t * 0.5]);
    return g;
  }
  function finger(lens, w) {
    const root = new THREE.Group(), spread = new THREE.Group(), j = [];
    root.add(spread);
    let parent = spread;
    lens.forEach((L, i) => {
      const jg = new THREE.Group();
      if (i > 0) jg.position.y = lens[i - 1];
      parent.add(jg); jg.add(phalanx(L, w, i === 2)); j.push(jg); parent = jg;
    });
    return { root, spread, j };
  }

  /* palm */
  mk(loft([[0.012, 0.027, 0.011, 0.011, 3.2], [0.04, 0.036, 0.012, 0.012, 3.4], [0.075, 0.0415, 0.012, 0.012, 3.6], [0.099, 0.040, 0.0105, 0.0105, 3.4]],
    { capB: 0.01, capT: 0.008, segU: 44, segV: 14 }), M.metalDark, hand);
  mk(loft([[0.016, 0.026, 0.004, 0.0150, 3], [0.045, 0.0365, 0.004, 0.0172, 3.2], [0.08, 0.042, 0.004, 0.0165, 3.4], [0.096, 0.040, 0.004, 0.0138, 3.2]],
    { capB: 0.012, capT: 0.012, segU: 44, segV: 16 }), M.shell, hand);
  mk(planarUV(loft([[0.02, 0.024, 0.0150, 0.003, 2.6], [0.045, 0.0335, 0.0176, 0.003, 2.8], [0.072, 0.0375, 0.016, 0.003, 3], [0.091, 0.0365, 0.0128, 0.003, 3]],
    { capB: 0.012, capT: 0.012, segU: 44, segV: 18 }), -0.04, 0.04, 0.012, 0.098), M.palmPad, hand);
  const thenar = mk(new THREE.SphereGeometry(0.0155, 28, 20), M.pad, hand, [0.021, 0.041, 0.0105]);
  thenar.scale.set(0.9, 1.45, 0.5); thenar.rotation.z = 0.35;
  mk(puck(0.0076, 0.079, 0.0015, 'x', 24), M.metal, hand, [0, 0.097, 0]);
  [[0.023, 0.03], [-0.023, 0.03], [0.03, 0.083], [-0.03, 0.083]].forEach(p => mk(puck(0.0023, 0.0022, 0.0005, 'z', 12), M.metal, hand, [p[0], p[1], -0.0158]));
  const win = mk(new THREE.CapsuleGeometry(0.0042, 0.022, 6, 16), M.gloss, hand, [0, 0.057, -0.0158]);
  win.scale.z = 0.45;
  mk(new THREE.SphereGeometry(0.0014, 10, 8), M.led, hand, [0, 0.07, -0.0178]);
  /* wrist */
  mk(new THREE.SphereGeometry(0.0215, 28, 20), M.rubber, hand);
  mk(puck(0.0248, 0.012, 0.002, 'y', 36), M.metal, hand, [0, 0.014, 0]);

  const fingers = FINGERS.map(f => {
    const fg = finger(f.len, f.w);
    fg.root.position.set(f.x, f.y, 0);
    hand.add(fg.root);
    return fg;
  });
  /* thumb: opposition → splay → roll → three curls */
  const tRoot = new THREE.Group(), tOpp = new THREE.Group(), tSplay = new THREE.Group(), tRoll = new THREE.Group();
  tRoot.position.set(0.034, 0.031, 0.004);
  hand.add(tRoot); tRoot.add(tOpp); tOpp.add(tSplay); tSplay.add(tRoll);
  mk(puck(0.0135, 0.02, 0.003, 'z', 28), M.metalDark, tRoot);
  mk(puck(0.006, 0.0215, 0.001, 'z', 16), M.metal, tRoot);
  const thumb = finger(THUMB.len, THUMB.w);
  tRoll.add(thumb.root);

  /* pose vector: 12 finger joint angles, spread, thumb [opp, splay, roll, c1, c2, c3] */
  function set(p) {
    for (let i = 0; i < 4; i++) {
      const f = fingers[i];
      f.j[0].rotation.x = p[i * 3]; f.j[1].rotation.x = p[i * 3 + 1]; f.j[2].rotation.x = p[i * 3 + 2];
      f.spread.rotation.z = FINGERS[i].fan + SPREAD[i] * p[12];
    }
    tOpp.rotation.y = -p[13]; tSplay.rotation.z = -p[14]; tRoll.rotation.y = p[15];
    thumb.j[0].rotation.x = p[16]; thumb.j[1].rotation.x = p[17]; thumb.j[2].rotation.x = p[18];
  }
  return { group: hand, fingers, thumb, set };
}
/* build a pose vector; a single number per finger expands to a natural curl */
function handPose(c, sp, th) {
  const p = [];
  c.forEach(v => { if (Array.isArray(v)) p.push(v[0], v[1], v[2]); else p.push(v, v * 1.15, v * 0.7); });
  p.push(sp, ...th);
  return p;
}

/* ================= ROBOT ================= */
function buildRobot(M) {
  const root = new THREE.Group();
  const X = v3(1, 0, 0), Y = v3(0, 1, 0), Z = v3(0, 0, 1);
  /* small hardware: bolt circles on both faces of a joint, and stencilled part labels on the paint */
  const boltGeo = puck(0.0026, 0.0024, 0.0006, 'x', 10), lp = v3(), ln = v3();
  function bolts(parent, x, y, z, r, n) {
    for (const sx of [-1, 1]) for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.3; mk(boltGeo, M.metal, parent, [sx * x, y + r * Math.cos(a), z + r * Math.sin(a)]); }
  }
  function label(parent, geo, u, y, text, w) {
    geo.userData.at(u, y, lp); geo.userData.normalAt(u, y, ln);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.2),
      new THREE.MeshBasicMaterial({ map: textDecal(text, 512, 102, '500 46px "Geist Mono", ui-monospace, monospace'), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
    m.position.copy(lp).addScaledVector(ln, 0.0011); m.quaternion.setFromUnitVectors(Z, ln);
    parent.add(m);
  }

  /* ---- legs ---- */
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.x = s * 0.098; root.add(leg);
    mk(puck(0.06, 0.066, 0.008, 'x'), M.metalDark, leg, [0, 0.935, 0]);
    mk(puck(0.042, 0.016, 0.004, 'x'), M.metal, leg, [s * 0.038, 0.935, 0]);
    bolts(leg, 0.0535, 0.495, 0, 0.021, 6);
    for (const pg of panels([[0.53, 0.050, 0.054, 0.056, 2.4], [0.62, 0.060, 0.064, 0.068, 2.4], [0.74, 0.071, 0.076, 0.080, 2.3], [0.86, 0.078, 0.082, 0.088, 2.3], [0.93, 0.070, 0.072, 0.078, 2.3]], [0.725],
      { capB: 0.035, capT: 0.045, segU: 56, segV: 40 })) mk(pg, M.carbon, leg);
    mk(panels.last, M.rubber, leg);
    mk(puck(0.046, 0.094, 0.006, 'x'), M.metalDark, leg, [0, 0.495, 0]);
    mk(puck(0.03, 0.104, 0.004, 'x'), M.metal, leg, [0, 0.495, 0]);
    mk(loft([[0.44, 0.036, 0.022, 0.0, 2.6, 0, 0.034], [0.495, 0.043, 0.028, 0.0, 2.6, 0, 0.036], [0.555, 0.036, 0.022, 0.0, 2.6, 0, 0.034]],
      { capB: 0.03, capT: 0.03, segU: 36, segV: 20 }), M.shell, leg);
    mk(loft([[0.13, 0.034, 0.038, 0.038, 2.6], [0.24, 0.041, 0.044, 0.056, 2.5], [0.36, 0.050, 0.050, 0.068, 2.4], [0.465, 0.049, 0.052, 0.056, 2.5]],
      { capB: 0.03, capT: 0.035, segU: 48, segV: 36 }), M.satin, leg);
    mk(loft([[0.2, 0.030, 0.012, 0.0, 3, 0, 0.036], [0.3, 0.036, 0.012, 0.0, 3, 0, 0.042], [0.4, 0.036, 0.012, 0.0, 3, 0, 0.044]],
      { capB: 0.04, capT: 0.04, segU: 32, segV: 20 }), M.gloss, leg);
    mk(new THREE.SphereGeometry(0.036, 32, 24), M.metalDark, leg, [0, 0.105, 0]);
    mk(puck(0.039, 0.012, 0.003), M.metal, leg, [0, 0.128, 0]);
    /* foot: lofted along Z */
    const foot = loft([[-0.085, 0.040, 0.050, 0.010, 3.4], [-0.02, 0.047, 0.066, 0.010, 3.4], [0.07, 0.049, 0.048, 0.010, 3.6], [0.17, 0.044, 0.030, 0.010, 3.6]],
      { capB: 0.03, capT: 0.035, segU: 44, segV: 30 });
    mk(orient(foot, v3(-1, 0, 0), Z, Y, v3(0, 0.022, 0)), M.satin, leg);
    const sole = loft([[-0.09, 0.043, 0.012, 0.012, 4.5], [0.0, 0.050, 0.012, 0.012, 4.5], [0.175, 0.046, 0.012, 0.012, 4.5]],
      { capB: 0.03, capT: 0.035, segU: 44, segV: 20 });
    mk(orient(sole, v3(-1, 0, 0), Z, Y, v3(0, 0.012, 0)), M.rubber, leg);
  }

  /* ---- pelvis & waist ---- */
  mk(loft([[0.89, 0.095, 0.082, 0.088, 2.6], [0.95, 0.142, 0.100, 0.106, 2.9], [1.0, 0.150, 0.102, 0.106, 2.9], [1.055, 0.122, 0.090, 0.090, 2.6]],
    { capB: 0.035, capT: 0.02, segU: 64, segV: 28 }), M.satin, root);
  mk(loft([[0.93, 0.07, 0.018, 0.0, 3.2, 0, 0.09], [0.99, 0.085, 0.02, 0.0, 3.2, 0, 0.09], [1.03, 0.07, 0.016, 0.0, 3.2, 0, 0.082]],
    { capB: 0.03, capT: 0.025, segU: 40, segV: 18 }), M.gloss, root);
  mk(loft([[1.035, 0.106, 0.080, 0.078, 2.5], [1.125, 0.110, 0.083, 0.079, 2.5]],
    { segU: 64, segV: 40, mod: (u, y) => 1 + 0.035 * Math.sin((y - 1.035) / 0.09 * TAU * 5 - 1.2) }), M.rubber, root);

  /* ---- chest (pivot at the waist) ---- */
  const chest = new THREE.Group(); chest.position.set(0, 1.1, 0); root.add(chest);
  const TP = panels([[0.0, 0.112, 0.084, 0.080, 2.5], [0.07, 0.128, 0.097, 0.088, 2.5], [0.17, 0.166, 0.120, 0.100, 2.5], [0.27, 0.200, 0.134, 0.108, 2.6], [0.345, 0.202, 0.122, 0.104, 2.9], [0.40, 0.150, 0.094, 0.090, 2.6], [0.43, 0.100, 0.074, 0.074, 2.3]], [0.1, 0.238],
    { capB: 0.02, capT: 0.03, segU: 96, segV: 64 }), torsoG = TP[2];      /* abdomen, ribs, chest plate */
  TP.forEach((pg, i) => mk(pg, i === 1 ? M.satin : M.carbon, chest));
  mk(TP.core, M.rubber, chest);
  mk(new THREE.TorusGeometry(0.066, 0.011, 20, 64), M.metalDark, chest, [0, 0.424, 0.002], [Math.PI / 2, 0, 0]);
  mk(new THREE.TorusGeometry(0.058, 0.004, 14, 64), M.metal, chest, [0, 0.437, 0.002], [Math.PI / 2, 0, 0]);
  /* back pack */
  mk(loft([[0.07, 0.09, 0.01, 0.036, 4, 0, -0.085], [0.2, 0.115, 0.01, 0.046, 4, 0, -0.098], [0.35, 0.11, 0.01, 0.04, 4, 0, -0.095]],
    { capB: 0.03, capT: 0.035, segU: 48, segV: 24 }), M.satin, chest);
  /* chest sensor bar + marking, seated on the torso surface */
  const sp = v3(), sn = v3();
  torsoG.userData.at(0.25, 0.325, sp); torsoG.userData.normalAt(0.25, 0.325, sn);
  const bar = mk(new THREE.CapsuleGeometry(0.0075, 0.062, 8, 20), M.gloss, chest, [0, sp.y, sp.z - 0.002]);
  bar.rotation.z = Math.PI / 2; bar.scale.z = 0.6;
  mk(new THREE.SphereGeometry(0.0026, 12, 10), M.led, chest, [0.026, sp.y, sp.z + 0.0026]);
  torsoG.userData.at(0.305, 0.268, sp); torsoG.userData.normalAt(0.305, 0.268, sn);
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.0155),
    new THREE.MeshBasicMaterial({ map: textDecal('HASTA  H—01', 512, 128, '500 58px "Geist Mono", ui-monospace, monospace'), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  decal.position.copy(sp).addScaledVector(sn, 0.0012);
  decal.quaternion.setFromUnitVectors(Z, sn);
  chest.add(decal);

  /* ---- neck & head ---- */
  mk(lathe([[0, 0.425], [0.05, 0.425], [0.052, 0.432], [0.046, 0.44], [0.044, 0.447], [0.047, 0.452], [0.047, 0.46], [0.041, 0.466], [0.039, 0.473], [0.042, 0.478], [0.042, 0.486], [0.036, 0.492], [0.034, 0.5], [0, 0.5]], 48), M.rubber, chest);
  const head = new THREE.Group(); head.position.set(0, 0.492, 0.004); chest.add(head);
  mk(puck(0.034, 0.012, 0.003), M.metalDark, head, [0, 0.006, 0]);
  const HS = [[0.0, 0.050, 0.056, 0.050, 2.2], [0.05, 0.079, 0.089, 0.080, 2.15], [0.11, 0.095, 0.105, 0.100, 2.1], [0.17, 0.099, 0.107, 0.108, 2.05], [0.22, 0.088, 0.094, 0.100, 2], [0.258, 0.060, 0.064, 0.070, 2]];
  const visorG = loft(HS, { capB: 0.038, capT: 0.052, segU: 96, segV: 72 });
  const skull = new THREE.Group(); skull.position.y = 0.008; head.add(skull);
  mk(visorG, M.gloss, skull);
  /* rear shell: a second ovoid that only breaks through behind a raked seam */
  mk(loft(HS.map((s, i) => [s[0], s[1] * 1.012, s[2] * 0.2, s[3] + 0.046 - i * 0.004, s[4], 0, -0.042 + i * 0.004]),
    { capB: 0.038, capT: 0.052, segU: 96, segV: 64 }), M.satin, skull);
  for (const s of [-1, 1]) {
    mk(puck(0.027, 0.016, 0.004, 'x'), M.metalDark, skull, [s * 0.096, 0.128, -0.022]);
    mk(puck(0.016, 0.02, 0.003, 'x'), M.gloss, skull, [s * 0.097, 0.128, -0.022]);
  }
  mk(new THREE.SphereGeometry(0.0022, 10, 8), M.led, skull, [-0.108, 0.128, -0.022]);

  /* dot-matrix eyes laid onto the visor surface */
  const COLS = 8, ROWS = 5, eyeN = COLS * ROWS * 2;
  const eyes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.00235, 14), M.eye, eyeN);
  eyes.frustumCulled = false; skull.add(eyes);
  const eyeLevel = new Float32Array(eyeN), dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), ds = v3(1, 1, 1), col = new THREE.Color();
  const eyeCells = [];
  for (const s of [-1, 1]) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const yy = 0.153 + (r - (ROWS - 1) / 2) * 0.0062;
    const px = (c - (COLS - 1) / 2) + (r % 2 ? 0.25 : -0.25);
    const ang = s * 0.36 + px * 0.066;
    const u = 0.25 - ang / TAU;
    visorG.userData.at(u, yy, sp); visorG.userData.normalAt(u, yy, sn);
    dq.setFromUnitVectors(Z, sn);
    dm.compose(sp.clone().addScaledVector(sn, 0.0007), dq, ds);
    eyes.setMatrixAt(eyeCells.length, dm);
    eyeCells.push({ s, r, px, c });
  }
  const eyeState = { blink: 0, gx: 0, gy: 0, mode: 0, say: 0, gain: 1 };
  function updateEyes(dt) {
    for (let i = 0; i < eyeN; i++) {
      const e = eyeCells[i];
      const cy = (ROWS - 1) / 2 + eyeState.gy;
      const dx = (e.px - eyeState.gx) / 3.75, dy = (e.r - cy) / (2.45 * (1 - 0.93 * eyeState.blink));
      let on = dx * dx + dy * dy <= 1 ? 1 : 0;
      if (eyeState.say) on = e.s < 0
        ? (e.c === 2 || e.c === 5 || (e.r === 2 && e.c > 2 && e.c < 5) ? 1 : 0)
        : ((e.r === 0 || e.r === 4) ? (e.c >= 2 && e.c <= 5 ? 1 : 0) : (e.c === 3 || e.c === 4 ? 1 : 0));
      if (eyeState.mode === 1 && e.r > cy + 0.4) on = 0;               // soft squint
      eyeLevel[i] += (on - eyeLevel[i]) * Math.min(1, dt * 18);
      const v = eyeLevel[i];
      const ev = v * 1.6 * eyeState.gain;
      eyes.setColorAt(i, col.setRGB(ev, ev, ev));
    }
    eyes.instanceColor.needsUpdate = true;
  }
  updateEyes(1);

  /* ---- arms: IK chain shoulder → elbow → wrist ---- */
  const L1 = 0.292, L2 = 0.262;
  const arms = [-1, 1].map(s => {
    const shoulderPos = v3(s * 0.226, 0.338, -0.006);
    mk(new THREE.SphereGeometry(0.06, 36, 28), M.metalDark, chest, [s * 0.212, 0.338, -0.006]);
    const upper = new THREE.Group(); upper.position.copy(shoulderPos); chest.add(upper);
    const UP = panels([[-0.225, 0.043, 0.046, 0.046, 2.4, s * 0.004], [-0.15, 0.056, 0.060, 0.058, 2.4, s * 0.012], [-0.06, 0.067, 0.073, 0.069, 2.3, s * 0.018], [0.025, 0.069, 0.075, 0.071, 2.3, s * 0.018], [0.082, 0.050, 0.056, 0.053, 2.2, s * 0.012]], [-0.052],
      { capB: 0.03, capT: 0.055, segU: 64, segV: 48 });
    UP.forEach(pg => mk(pg, M.carbon, upper));
    mk(UP.core, M.rubber, upper);
    label(upper, UP[0], 0.25, -0.118, s < 0 ? 'H—01 / R ARM' : 'H—01 / L ARM', 0.05);
    bolts(upper, 0.049, -L1, 0, 0.019, 6);
    mk(new THREE.CylinderGeometry(0.033, 0.035, 0.07, 40), M.satin, upper, [0, -0.238, 0]);
    mk(puck(0.041, 0.086, 0.006, 'x'), M.metalDark, upper, [0, -L1, 0]);
    mk(puck(0.027, 0.095, 0.004, 'x'), M.metal, upper, [0, -L1, 0]);
    const fore = new THREE.Group(); fore.position.y = -L1; upper.add(fore);
    mk(loft([[-0.236, 0.029, 0.029, 0.029, 2.2], [-0.17, 0.037, 0.037, 0.040, 2.4], [-0.09, 0.045, 0.044, 0.048, 2.5], [-0.03, 0.040, 0.040, 0.042, 2.5]],
      { capB: 0.014, capT: 0.028, segU: 56, segV: 36 }), M.satin, fore);
    mk(loft([[-0.2, 0.016, 0.006, 0.0, 3, 0, 0.034], [-0.13, 0.02, 0.006, 0.0, 3, 0, 0.04], [-0.07, 0.018, 0.006, 0.0, 3, 0, 0.041]],
      { capB: 0.03, capT: 0.03, segU: 28, segV: 18 }), M.gloss, fore);
    mk(new THREE.TorusGeometry(0.0315, 0.0028, 12, 48), M.metal, fore, [0, -0.222, 0], [Math.PI / 2, 0, 0]);
    mk(puck(0.0265, 0.02, 0.003), M.metalDark, fore, [0, -0.246, 0]);
    const wrist = new THREE.Group(); wrist.position.y = -L2; fore.add(wrist);
    const hand = buildHand(M);
    if (s === 1) hand.group.scale.x = -1;
    wrist.add(hand.group);
    return { side: s, shoulderPos, upper, fore, wrist, hand, L1, L2 };
  });

  /* two-bone IK. W: wrist position, Q: hand orientation, pole: elbow hint — all in chest space */
  const d = v3(), perp = v3(), E = v3(), Wc = v3(), xa = v3(), ya = v3(), za = v3();
  const mb = new THREE.Matrix4(), qU = new THREE.Quaternion(), qF = new THREE.Quaternion(), qi = new THREE.Quaternion();
  function solveArm(arm, W, Q, pole) {
    const S = arm.shoulderPos;
    d.subVectors(W, S);
    const len = clamp(d.length(), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.004);
    d.normalize();
    const a = (L1 * L1 - L2 * L2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    perp.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
    E.copy(S).addScaledVector(d, a).addScaledVector(perp, h);
    Wc.copy(S).addScaledVector(d, len);
    xa.crossVectors(d, perp).normalize();
    ya.subVectors(S, E).normalize(); za.crossVectors(xa, ya);
    qU.setFromRotationMatrix(mb.makeBasis(xa, ya, za));
    ya.subVectors(E, Wc).normalize(); za.crossVectors(xa, ya);
    qF.setFromRotationMatrix(mb.makeBasis(xa, ya, za));
    arm.upper.quaternion.copy(qU);
    arm.fore.quaternion.copy(qi.copy(qU).invert()).multiply(qF);
    arm.wrist.quaternion.copy(qi.copy(qF).invert()).multiply(Q);
  }

  return { root, chest, head, skull, arms, solveArm, eyeState, updateEyes };
}

/* ================= TRAY ================= */
function buildTray(M) {
  const g = new THREE.Group();
  /* a slim black stand: foot plate, column, bracket and a thin top */
  for (const [geo, pos] of [[slab(0.36, 0.022, 0.28, 0.008, 0.003), [0, 0, 0]], [new THREE.BoxGeometry(0.07, 0.85, 0.07), [0, 0.446, 0]],
    [new THREE.BoxGeometry(0.2, 0.012, 0.16), [0, 0.874, 0]], [slab(0.54, 0.014, 0.38, 0.01, 0.003), [0, 0.88, 0]]]) mk(geo, M.stand, g, pos).renderOrder = -1;
  const tray = new THREE.Group(); tray.position.y = 0.896; g.add(tray);
  const base = new THREE.ExtrudeGeometry(roundedRect(0.4, 0.27, 0.04), { depth: 0.007, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 3, curveSegments: 20 });
  const rimS = roundedRect(0.4, 0.27, 0.04); rimS.holes.push(roundedRect(0.374, 0.244, 0.028));
  const rim = new THREE.ExtrudeGeometry(rimS, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 3, curveSegments: 20 });
  mk(base, M.oak, tray, null, [-Math.PI / 2, 0, 0]).renderOrder = -1;
  mk(rim, M.oak, tray, [0, 0.004, 0], [-Math.PI / 2, 0, 0]).renderOrder = -1;
  const top = 0.009;
  const cupPos = v3(-0.105, top, -0.02);
  mk(lathe([[0, 0], [0.019, 0], [0.0205, 0.003], [0.011, 0.009], [0.008, 0.02], [0.013, 0.028], [0.0205, 0.037], [0.0215, 0.045], [0.0205, 0.047], [0.019, 0.045], [0.016, 0.036], [0, 0.03]], 48), M.cup, tray, cupPos.toArray());
  const cupMesh = tray.children[tray.children.length - 1]; cupMesh.renderOrder = -1;
  const cloche = new THREE.Group(); cloche.position.set(0.09, top, 0.014);
  mk(lathe([[0, 0], [0.045, 0], [0.05, 0.004], [0.076, 0.03], [0.083, 0.045], [0.085, 0.048], [0.083, 0.05]], 64), M.ceramic, cloche);
  mk(lathe([[0.084, 0.049], [0.083, 0.054], [0.078, 0.076], [0.062, 0.1], [0.034, 0.116], [0.013, 0.121], [0.008, 0.124], [0.011, 0.13], [0.0135, 0.136], [0.011, 0.142], [0, 0.145]], 64), M.ceramic, cloche);
  /* egg: 57 mm long, 43 mm across, blunt end down */
  const pts = [];
  for (let i = 0; i <= 40; i++) { const f = i / 40 * Math.PI; pts.push([0.0215 * Math.sin(f) * (1 + 0.17 * Math.cos(f)) / 0.985, -0.0285 * Math.cos(f)]); }
  const egg = mk(lathe(pts, 48), M.egg, null);
  const eggRest = v3().copy(cupPos).add(v3(0, 0.061, 0));
  return { group: g, tray, egg, cupMesh, cupPos, eggRest, cloche, top };
}

/* ================= STUDIO =================
   A dark stage: one enormous backlit wall, a black coffered ceiling with strips of light,
   charcoal side walls and a polished black tile floor that mirrors everything above it. */
function buildRoom(M) {
  const g = new THREE.Group(), mats = [M.side, M.stand, M.oak, M.cup];
  const B = o => { const m = new THREE.MeshBasicMaterial(Object.assign({ transparent: true, toneMapped: false }, o)); mats.push(m); return m; };
  const black = B({ color: 0x040506 }), frame = B({ color: 0x090b0e }), glow = B({ map: lightboxTexture() }), strip = B({ color: 0xf0f4fa });
  glow.color.setScalar(1.12); strip.color.multiplyScalar(1.7);       /* brighter than white: they bloom and clip like real fixtures */
  const add = (geo, mat, pos, rx, ry) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(rx || 0, ry || 0, 0); m.renderOrder = -2;
    g.add(m);
    return m;
  };
  const W = 8.4, H = 3.4, zb = -2.4, P = Math.PI / 2;
  add(new THREE.PlaneGeometry(W, H), frame, [0, H / 2, zb]);
  add(new THREE.PlaneGeometry(W, 2.95), glow, [0, 0.2 + 2.95 / 2, zb + 0.012]);
  add(new THREE.PlaneGeometry(12, H), M.side, [-W / 2, H / 2, zb + 6], 0, P).receiveShadow = true;
  add(new THREE.PlaneGeometry(12, H), M.side, [W / 2, H / 2, zb + 6], 0, -P).receiveShadow = true;
  const c0 = g.children.length;
  add(new THREE.PlaneGeometry(W, 12), black, [0, H, zb + 6], P);
  for (let k = 0; k < 7; k++) {
    const z = zb + 0.75 + k * 0.95;
    add(new THREE.PlaneGeometry(6.8, 0.64), strip, [0, H - 0.012, z], P);
    add(new THREE.BoxGeometry(W, 0.15, 0.31), black, [0, H - 0.075, z - 0.475]);
  }
  for (const x of [-1.15, 1.15]) add(new THREE.BoxGeometry(0.1, 0.15, 7), black, [x, H - 0.075, zb + 3.6]);
  const ceiling = g.children.slice(c0);
  /* floor: a seamless polished studio floor. Soft grey under the lights, a mirror only at a glancing angle */
  const floorMat = new THREE.ShaderMaterial({
    transparent: true, uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: [
      'uniform float uA; varying vec3 vW;',
      'float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), f.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + 1.0), f.x), f.y); }',
      'void main(){',
      '  vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;',
      '  float f = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.4);',
      '  float pool = exp(-dot(vW.xz - vec2(0.0, 0.3), vW.xz - vec2(0.0, 0.3)) / 5.0);     // light falls off away from the set',
      '  float seam = 0.0;',
      '  vec3 col = mix(vec3(0.012, 0.014, 0.018), vec3(0.062, 0.068, 0.08), pool);',
      '  float g = vn(vW.xz * 1.6) * 0.6 + vn(vW.xz * 6.5) * 0.4;                 // polish is never perfectly even',
      '  col *= 0.86 + 0.28 * g;',
      '  float a = mix(mix(0.985, 0.42 + 0.16 * g, f), 1.0, seam * 0.85);',
      '  gl_FragColor = vec4(col, a * uA);',
      '}'].join('\n')
  });
  const floor = add(new THREE.PlaneGeometry(26, 26), floorMat, [0, 0, 3], -P);
  floor.renderOrder = -3;
  return { group: g, mats, floor, floorMat, ceiling };
}

/* ================= PROPS =================
   Things Hasta carries on its rounds. They appear only in the scenario stills. */
function buildProps(M) {
  const P = {}, clear = m => { m.castShadow = false; m.renderOrder = 3; return m; };
  let g = new THREE.Group();                                  /* medicine cup with two tablets; origin at its centre */
  mk(lathe([[0, -0.014], [0.0125, -0.014], [0.0135, -0.0125], [0.0185, 0.015], [0.0178, 0.0155], [0.0128, -0.011], [0, -0.011]], 40), M.paper, g);
  mk(new THREE.CapsuleGeometry(0.0034, 0.008, 6, 12), M.pill, g, [0.003, -0.0068, 0.002], [0.2, 0.4, 1.35]);
  mk(new THREE.SphereGeometry(0.0046, 16, 10), M.cup, g, [-0.0052, -0.0082, -0.003]).scale.y = 0.45;
  P.pill = g;
  g = new THREE.Group();                                      /* sample jar; origin at its centre */
  mk(new THREE.CylinderGeometry(0.0186, 0.0186, 0.027, 36), M.liquid, g, [0, -0.0125, 0]).castShadow = false;
  clear(mk(lathe([[0, -0.027], [0.019, -0.027], [0.0205, -0.025], [0.0205, 0.016], [0.017, 0.02], [0.017, 0.024], [0, 0.024]], 40), M.glass, g));
  mk(puck(0.0186, 0.011, 0.002, 'y', 36), M.rubber, g, [0, 0.0285, 0]);
  P.jar = g;
  g = new THREE.Group();                                      /* tea cup and saucer; origin under the saucer */
  mk(lathe([[0, 0], [0.03, 0], [0.034, 0.002], [0.058, 0.008], [0.06, 0.0095], [0.058, 0.0105], [0.034, 0.0055], [0, 0.005]], 56), M.cup, g);
  mk(lathe([[0, 0.005], [0.02, 0.005], [0.022, 0.008], [0.034, 0.04], [0.0362, 0.052], [0.0348, 0.0525], [0.0325, 0.04], [0.0195, 0.0095], [0, 0.0095]], 56), M.cup, g);
  mk(new THREE.CircleGeometry(0.0335, 40), M.tea, g, [0, 0.046, 0], [-Math.PI / 2, 0, 0]);
  mk(new THREE.TorusGeometry(0.0125, 0.0032, 12, 28, Math.PI * 1.25), M.cup, g, [0.041, 0.03, 0], [0, 0, -Math.PI * 0.62]);
  P.tea = g;
  g = new THREE.Group();                                      /* covered plate: a polished cloche; origin under the plate */
  mk(lathe([[0, 0], [0.045, 0], [0.05, 0.004], [0.076, 0.012], [0.09, 0.016], [0.092, 0.018], [0.09, 0.0195], [0.074, 0.0155], [0.05, 0.008], [0, 0.0075]], 64), M.cup, g);
  mk(lathe([[0.082, 0.016], [0.081, 0.022], [0.076, 0.046], [0.06, 0.072], [0.033, 0.089], [0.013, 0.094], [0.008, 0.097], [0.011, 0.103], [0.0135, 0.109], [0.011, 0.115], [0, 0.118]], 64), M.chrome, g);
  P.cloche = g;
  g = new THREE.Group();                                      /* glass of water; origin at its base */
  mk(new THREE.CylinderGeometry(0.0296, 0.0263, 0.062, 40), M.water, g, [0, 0.035, 0]).castShadow = false;
  clear(mk(lathe([[0, 0], [0.026, 0], [0.0275, 0.002], [0.032, 0.095], [0.0308, 0.0955], [0.0262, 0.004], [0, 0.004]], 48), M.glass, g));
  P.glass = g;
  for (const k in P) P[k].visible = false;
  return P;
}
