/* ------------------------------------------------------------------
   core.js — maths, lofted-surface modelling, procedural textures,
   materials and the studio lighting environment.
------------------------------------------------------------------ */
const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const sgnpow = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);
const v3 = (x = 0, y = 0, z = 0) => new V3(x, y, z);

/* ---------- lofted surfaces ----------
   A loft is a stack of superelliptic cross-sections along Y. Each section is
   [y, rx, rFront, rBack, n, ox, oz]; values are Hermite-interpolated, the ends
   close with elliptical caps, and normals are taken from the surface itself,
   so every shell is smooth and seam-free. */
function makeProfile(secs) {
  const S = secs.map(s => ({
    y: s[0], rx: s[1], rf: s[2] ?? s[1], rb: s[3] ?? s[2] ?? s[1],
    n: s[4] ?? 2, ox: s[5] ?? 0, oz: s[6] ?? 0
  }));
  const keys = ['rx', 'rf', 'rb', 'n', 'ox', 'oz'], N = S.length, tan = {};
  for (const k of keys) {
    tan[k] = S.map((s, i) => {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(N - 1, i + 1)];
      return b.y === a.y ? 0 : (b[k] - a[k]) / (b.y - a.y);
    });
  }
  return function (y, o) {
    let i = 0;
    while (i < N - 2 && y > S[i + 1].y) i++;
    const a = S[i], b = S[i + 1], h = b.y - a.y, t = clamp((y - a.y) / h);
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    for (const k of keys) o[k] = h00 * a[k] + h10 * h * tan[k][i] + h01 * b[k] + h11 * h * tan[k][i + 1];
    return o;
  };
}

function loft(secs, o = {}) {
  const prof = makeProfile(secs);
  const y0 = secs[0][0], y1 = secs[secs.length - 1][0], H = y1 - y0;
  const cb = o.capB || 0, ct = o.capT || 0, cp = o.capPow || 2;
  const segU = o.segU || 48, segV = o.segV || 28, mod = o.mod;
  const tmp = {};
  function at(u, y, out) {
    prof(y, tmp);
    let k = 1;
    if (cb > 0 && y < y0 + cb) { const q = 1 - (y - y0) / cb; k = Math.pow(Math.max(0, 1 - Math.pow(q, cp)), 1 / cp); }
    if (ct > 0 && y > y1 - ct) { const q = 1 - (y1 - y) / ct; k *= Math.pow(Math.max(0, 1 - Math.pow(q, cp)), 1 / cp); }
    const th = u * TAU, c = Math.cos(th), s = Math.sin(th), e = 2 / tmp.n;
    const m = mod ? k * mod(u, y) : k;
    return out.set(tmp.ox + tmp.rx * m * sgnpow(c, e), y, tmp.oz + (s >= 0 ? tmp.rf : tmp.rb) * m * sgnpow(s, e));
  }
  const pa = v3(), pb = v3(), pc = v3(), pd = v3();
  function normalAt(u, y, out) {
    const du = 2e-3, dy = Math.max(H, 0.004) * 2e-3;
    at(u + du, y, pa); at(u - du, y, pb);
    at(u, Math.min(y1, y + dy), pc); at(u, Math.max(y0, y - dy), pd);
    pa.sub(pb); pc.sub(pd);
    out.crossVectors(pc, pa);
    if (out.lengthSq() < 1e-16) return out.set(0, y > (y0 + y1) / 2 ? 1 : -1, 0);
    return out.normalize();
  }
  const fb = cb > 0 ? (o.fracB ?? 0.24) : 0, ft = ct > 0 ? (o.fracT ?? 0.24) : 0;
  function yOf(t) {
    if (t < fb) return y0 + cb * (1 - Math.cos(t / fb * Math.PI / 2));
    if (t > 1 - ft) return y1 - ct * (1 - Math.cos((1 - t) / ft * Math.PI / 2));
    return y0 + cb + (H - cb - ct) * ((t - fb) / (1 - fb - ft));
  }
  const tile = o.tile || 0.03;
  const mid = prof((y0 + y1) / 2, {});
  const ur = o.ur ?? Math.max(1, Math.round(Math.PI * (mid.rx + (mid.rf + mid.rb) / 2) / tile));
  const nV = (segU + 1) * (segV + 1);
  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), uv = new Float32Array(nV * 2);
  const p = v3(), n = v3();
  let q = 0;
  for (let i = 0; i <= segV; i++) {
    const y = yOf(i / segV);
    for (let j = 0; j <= segU; j++, q++) {
      const u = j / segU;
      at(u, y, p); normalAt(u, y, n);
      pos[q * 3] = p.x; pos[q * 3 + 1] = p.y; pos[q * 3 + 2] = p.z;
      nor[q * 3] = n.x; nor[q * 3 + 1] = n.y; nor[q * 3 + 2] = n.z;
      uv[q * 2] = u * ur; uv[q * 2 + 1] = (y - y0) / tile;
    }
  }
  const idx = [];
  for (let i = 0; i < segV; i++) for (let j = 0; j < segU; j++) {
    const a = i * (segU + 1) + j, b = a + 1, c = a + segU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.at = at; g.userData.normalAt = normalAt;
  return g;
}

/* split one lofted shell into separate body panels along Y, each with a rolled edge and a shadow gap */
function panels(secs, cuts, o, gap = 0.0036) {
  const prof = makeProfile(secs), y0 = secs[0][0], y1 = secs[secs.length - 1][0], t = {}, edges = [y0].concat(cuts, [y1]), out = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const first = k === 0, last = k === edges.length - 2;
    const a = edges[k] + (first ? 0 : gap / 2), b = edges[k + 1] - (last ? 0 : gap / 2), n = Math.max(4, Math.ceil((b - a) / 0.025)), ss = [];
    for (let i = 0; i <= n; i++) { const y = a + (b - a) * i / n; prof(y, t); ss.push([y, t.rx, t.rf, t.rb, t.n, t.ox, t.oz]); }
    out.push(loft(ss, Object.assign({}, o, {
      capB: first ? o.capB : 0.0055, capT: last ? o.capT : 0.0055,
      segV: Math.max(12, Math.round((o.segV || 28) * (b - a) / (y1 - y0)) + 8)
    })));
  }
  /* a dark inner body, so the gaps between panels read as shadow lines and never as holes */
  panels.last = out.core = loft(secs.map(q => [q[0], q[1] * 0.955, (q[2] ?? q[1]) * 0.955, (q[3] ?? q[2] ?? q[1]) * 0.955, q[4] ?? 2, q[5] ?? 0, q[6] ?? 0]), Object.assign({}, o, { segV: 24 }));
  return out;
}

/* re-orient a geometry by a basis; flips winding when the basis mirrors */
function orient(g, xa, ya, za, t) {
  const m = new THREE.Matrix4().makeBasis(xa, ya, za);
  if (t) m.setPosition(t);
  g.applyMatrix4(m);
  if (m.determinant() < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const s = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = s; }
    g.index.needsUpdate = true;
  }
  return g;
}

const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* a clean monolith: box with softly rounded corners and a fine bevel, base at y = 0 */
function slab(w, h, d, r = 0.014, b = 0.005) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0);
  return g;
}

/* ---------- procedural textures ---------- */
function heightToNormal(size, hfn, strength) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size), Hm = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) Hm[y * size + x] = hfn(x / size, y / size);
  const at = (x, y) => Hm[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/* 2×2 twill carbon weave: tows pass over two, under two */
const TW = 8;
function twillCell(u, v) {
  const x = u * TW, y = v * TW, ix = Math.floor(x), iy = Math.floor(y);
  const horiz = (((ix - iy) % 4) + 4) % 4 < 2;
  return { horiz, across: horiz ? y - iy : x - ix, along: horiz ? x - ix : y - iy };
}
function twillHeight(u, v) {
  const c = twillCell(u, v);
  return 0.2 + 0.8 * Math.pow(Math.sin(c.across * Math.PI), 0.55) * (0.82 + 0.18 * Math.sin(c.along * Math.PI));
}
function twillAlbedo(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const t = twillCell(x / size, y / size);
    const edge = Math.pow(Math.sin(t.across * Math.PI), 0.4);
    const fibre = 0.9 + 0.1 * Math.sin(t.across * Math.PI * 14);
    const base = (t.horiz ? 30 : 12) * edge * fibre + 4, i = (y * size + x) * 4;
    img.data[i] = base; img.data[i + 1] = base * 1.02; img.data[i + 2] = base * 1.08; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/* looped ridges, like a fingerprint, for the palm pad */
function whorlHeight(u, v) {
  const x = u - 0.5, y = (v - 0.5) * 1.25;
  const d = Math.hypot(x * 1.15, y) + 0.012 * Math.sin(Math.atan2(y, x) * 3);
  return 0.5 + 0.5 * Math.sin(d * TAU * 15);
}
function softDisc(size, inner, alpha) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
function textDecal(text, w, h, font) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- baked surface textures: concrete, plaster, oak, eggshell ---------- */
function makeNoise(seed) {
  const P = 512, g = new Float32Array(P * P); let s = seed >>> 0;
  for (let i = 0; i < g.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; g[i] = s / 4294967296; }
  return function (x, y, px, py) {            /* value noise, periodic over px × py lattice cells */
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    const a = g[y0 * P + x0], b = g[y0 * P + x1], c = g[y1 * P + x0], d = g[y1 * P + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, u, v, fx, fy, oct) {
  let a = 0, amp = 0.5, tot = 0;
  for (let i = 0; i < oct; i++) { a += amp * n(u * fx + i * 17, v * fy + i * 31, fx, fy); tot += amp; amp *= 0.5; fx *= 2; fy *= 2; }
  return a / tot;
}
/* fn(u, v, out) fills out = [r, g, b, height]; returns a tiling albedo and a normal map */
function bakeMaps(w, h, fn, strength) {
  const ca = document.createElement('canvas'), cn = document.createElement('canvas');
  ca.width = cn.width = w; ca.height = cn.height = h;
  const xa = ca.getContext('2d'), xn = cn.getContext('2d'), ia = xa.createImageData(w, h), im = xn.createImageData(w, h);
  const Hm = new Float32Array(w * h), o = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    fn(x / w, y / h, o);
    const i = (y * w + x) * 4;
    ia.data[i] = o[0]; ia.data[i + 1] = o[1]; ia.data[i + 2] = o[2]; ia.data[i + 3] = 255; Hm[y * w + x] = o[3];
  }
  const at = (x, y) => Hm[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    im.data[i] = (-dx / l * 0.5 + 0.5) * 255; im.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; im.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[i + 3] = 255;
  }
  xa.putImageData(ia, 0, 0); xn.putImageData(im, 0, 0);
  const map = new THREE.CanvasTexture(ca), normalMap = new THREE.CanvasTexture(cn);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { map, normalMap };
}
/* quarter-sawn oak: growth rings across v, long fibres along u */
function oakMaps(n) {
  return bakeMaps(1024, 512, (u, v, out) => {
    const warp = fbm(n, u, v, 3, 3, 3);
    const rings = v * 15 + warp * 0.9 + 0.07 * Math.sin(u * TAU + warp * 4);
    const r = rings - Math.floor(rings), late = Math.pow(r, 4);
    const fibre = n(u * 26, v * 420, 26, 420), ray = n(u * 180, v * 60, 180, 60);
    const k = clamp(0.18 + late * 0.42 + (fibre - 0.5) * 0.4 + (warp - 0.5) * 0.34 + (ray > 0.86 ? -0.1 : 0));
    out[0] = lerp(98, 50, k); out[1] = lerp(70, 33, k); out[2] = lerp(48, 21, k);          /* smoked walnut */
    out[3] = (fibre - 0.5) * 0.5 - late * 0.5;
  }, 1.1);
}
function eggMaps(n) {
  return bakeMaps(256, 256, (u, v, out) => {
    const mott = fbm(n, u, v, 5, 5, 3), fine = n(u * 96, v * 96, 96, 96), sp = n(u * 44 + 9, v * 44 + 3, 44, 44);
    let k = 1 + (mott - 0.5) * 0.09 + (fine - 0.5) * 0.04;
    const fr = sp > 0.93 ? (sp - 0.93) * 6 : 0;
    out[0] = 236 * k * (1 - fr * 0.3); out[1] = 203 * k * (1 - fr * 0.5); out[2] = 168 * k * (1 - fr * 0.66);
    out[3] = (fine - 0.5) * 0.7 + (mott - 0.5) * 0.25;
  }, 0.9);
}
/* the lightbox wall: bright and cool at its heart, falling to steel blue at the edges, in three panels */
function lightboxTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  let g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#dfe6ef'); g.addColorStop(0.3, '#eef2f7'); g.addColorStop(0.62, '#cfd8e4'); g.addColorStop(1, '#8696ad');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  g = x.createRadialGradient(512, 200, 90, 512, 240, 640);
  g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(0.42, 'rgba(160,178,205,0)'); g.addColorStop(1, 'rgba(34,46,70,.72)');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  x.fillStyle = 'rgba(22,30,46,.55)';
  for (const u of [0.5 - 1.15 / 8.4, 0.5 + 1.15 / 8.4]) x.fillRect(Math.round(u * 1024) - 1, 0, 2, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/* ---------- materials ---------- *//* ---------- materials ---------- */
function makeMaterials() {
  const P = o => new THREE.MeshPhysicalMaterial(o);
  const whorl = heightToNormal(256, whorlHeight, 1.6);
  whorl.wrapS = whorl.wrapT = THREE.ClampToEdgeWrapping;
  const S = o => new THREE.MeshStandardMaterial(Object.assign({ metalness: 0, transparent: true }, o));
  const nz = makeNoise(20261114);
  const oakT = oakMaps(nz), eggT = eggMaps(nz);
  /* painted metal: a fine bead-blast grain in the normals and a cloudy roughness, so highlights break up like real paint */
  const micro = bakeMaps(256, 256, (u, v, o) => {
    const f = fbm(nz, u, v, 52, 52, 2), m = fbm(nz, u + 0.4, v + 0.2, 5, 5, 3), g = 206 + (m - 0.5) * 78 + (f - 0.5) * 30;
    o[0] = o[1] = o[2] = g; o[3] = (f - 0.5) * 0.9 + (m - 0.5) * 0.25;
  }, 0.75);
  micro.map.colorSpace = THREE.NoColorSpace;
  const grain = k => new THREE.Vector2(k, k);
  for (const t of [oakT.map, oakT.normalMap]) t.repeat.set(1.25, 2.5);
  const M = {
    /* studio pieces fade as one, so each is transparent-capable */
    side: S({ color: 0x0d0f12, roughness: 0.7, envMapIntensity: 0.2 }),
    stand: S({ color: 0x0b0c0e, roughness: 0.42, metalness: 0.7, envMapIntensity: 0.9 }),
    oak: S({ map: oakT.map, normalMap: oakT.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.55, envMapIntensity: 0.22 }),
    cup: P({ color: 0xeeebe4, roughness: 0.2, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, transparent: true, envMapIntensity: 0.8 }),
    /* body shells: satin gunmetal paint, darker graphite secondary panels, anodised finger shells */
    carbon: P({ color: 0x33363b, normalMap: micro.normalMap, normalScale: grain(0.32), roughnessMap: micro.map, roughness: 0.58, metalness: 0.66, clearcoat: 0.14, clearcoatRoughness: 0.5, envMapIntensity: 1.05 }),
    gloss: P({ color: 0x050607, roughnessMap: micro.map, roughness: 0.07, metalness: 0.9, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 }),
    satin: P({ color: 0x141518, normalMap: micro.normalMap, normalScale: grain(0.28), roughnessMap: micro.map, roughness: 0.62, metalness: 0.42, clearcoat: 0.2, clearcoatRoughness: 0.55 }),
    shell: P({ color: 0x2b2e33, roughnessMap: micro.map, roughness: 0.5, metalness: 0.7, clearcoat: 0.22, clearcoatRoughness: 0.4 }),
    rubber: P({ color: 0x151517, roughness: 0.82, metalness: 0 }),
    pad: P({ color: 0x2b2c30, roughness: 0.72, metalness: 0, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x6a6d75) }),
    palmPad: P({ color: 0x2b2c30, roughness: 0.74, metalness: 0, normalMap: whorl, normalScale: new THREE.Vector2(0.9, 0.9) }),
    metal: P({ color: 0xa6a9af, roughness: 0.26, metalness: 1 }),
    metalDark: P({ color: 0x34363b, roughness: 0.34, metalness: 1 }),
    ceramic: P({ color: 0xe4e1da, roughness: 0.22, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
    egg: P({ map: eggT.map, normalMap: eggT.normalMap, normalScale: new THREE.Vector2(0.22, 0.22), roughness: 0.62, metalness: 0, sheen: 0.25, sheenColor: new THREE.Color(0xfff1df), transparent: true }),
    /* props for the scenario stills */
    chrome: P({ color: 0xc9ccd1, roughness: 0.16, metalness: 1, envMapIntensity: 0.85 }),
    glass: P({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, depthWrite: false }),
    water: P({ color: 0xcfe0ec, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.3, envMapIntensity: 1.2, depthWrite: false }),
    liquid: P({ color: 0x2c86ad, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.78, envMapIntensity: 1.0 }),
    tea: P({ color: 0x5b2c10, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 }),
    paper: P({ color: 0xf1efe9, roughness: 0.92, metalness: 0 }),
    pill: P({ color: 0xd9662b, roughness: 0.35, metalness: 0, clearcoat: 0.6 }),
    led: new THREE.MeshBasicMaterial({ color: 0xff7a2f, toneMapped: false }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  };
  return M;
}

/* ---------- studio environment: softboxes baked into an IBL probe ---------- */
function makeEnvironment(renderer) {
  const s = new THREE.Scene();
  const B = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide });
  s.add(new THREE.Mesh(new THREE.BoxGeometry(24, 14, 24), new THREE.MeshBasicMaterial({ color: 0x777a80, side: THREE.BackSide })));
  const panel = (w, h, k, pos, look, c = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), B(c, k));
    m.position.set(...pos); m.lookAt(...look); s.add(m);
  };
  panel(9, 9, 5.5, [0, 6.6, 1], [0, 0, 0]);                  // overhead softbox
  panel(1.6, 8, 13, [-7.5, 1.5, 3.5], [0, 1, 0]);            // left strip
  panel(1.2, 8, 9, [7.5, 1.5, 2.5], [0, 1, 0], 0xfff4e8);    // right strip, warm
  panel(10, 5, 1.6, [0, 1.5, 10], [0, 1.2, 0]);              // front fill
  panel(2.2, 7, 7, [-5, 2, -9], [0, 1.4, 0], 0xe6f0ff);      // rim, cool
  panel(2.2, 7, 6, [5.5, 2, -9], [0, 1.4, 0]);               // rim
  panel(24, 24, 1.1, [0, -6.9, 0], [0, 0, 0], 0xdcdad6);     // floor bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  return tex;
}

/* ---------- the studio as an environment: what the robot's paint and visor actually reflect on set ---------- */
function makeStudioEnv(renderer) {
  const s = new THREE.Scene(), O = [0, 1.2, 0.3], tex = lightboxTexture();
  const B = (k, map, c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c || 0xffffff).multiplyScalar(k), map: map || null, side: THREE.DoubleSide });
  const add = (w, h, mat, pos, rx) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(pos[0] - O[0], pos[1] - O[1], pos[2] - O[2]); m.rotation.x = rx || 0; s.add(m); return m; };
  s.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x030405, side: THREE.BackSide })));
  add(8.4, 2.95, B(2.4, tex), [0, 1.675, -2.4]);                                  /* the lightbox wall */
  add(8.4, 2.95, B(0.55, tex), [0, -1.675, -2.4]).scale.y = -1;                   /* its reflection in the floor */
  for (let k = 0; k < 7; k++) add(6.8, 0.64, B(5.5), [0, 3.39, -2.4 + 0.75 + k * 0.95], Math.PI / 2);   /* ceiling strips */
  add(7, 3.4, B(0.42, null, 0xdde6f4), [0, 2.0, 7]);                              /* a soft bounce behind the camera */
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return env;
}

/* ---------- film pipeline: HDR frame → bloom → ACES → grain and a trace of lens fringing ---------- */
function makePost(renderer) {
  if (!renderer.capabilities.isWebGL2) return null;
  const RT = o => new THREE.WebGLRenderTarget(4, 4, Object.assign({ type: THREE.HalfFloatType, depthBuffer: false }, o));
  const main = RT({ depthBuffer: true, samples: 4 }), a1 = RT(), b1 = RT(), a2 = RT(), b2 = RT();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false; sc.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false });
  const bright = mat([
    'uniform sampler2D t; uniform vec2 px; varying vec2 vUv;',
    'void main(){',
    '  vec3 c = 0.25 * (texture2D(t, vUv + px * vec2(-1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(-1.0, 1.0)).rgb + texture2D(t, vUv + px).rgb);',
    '  float l = max(c.r, max(c.g, c.b));',
    '  gl_FragColor = vec4(min(c * max(l - 1.0, 0.0) / max(l, 1e-4), vec3(12.0)), 1.0);',
    '}'].join('\n'), { t: { value: null }, px: { value: new THREE.Vector2() } });
  const blur = mat([
    'uniform sampler2D t; uniform vec2 d; varying vec2 vUv;',
    'void main(){',
    '  vec3 c = texture2D(t, vUv).rgb * 0.227027;',
    '  c += (texture2D(t, vUv + d * 1.3846).rgb + texture2D(t, vUv - d * 1.3846).rgb) * 0.316216;',
    '  c += (texture2D(t, vUv + d * 3.2308).rgb + texture2D(t, vUv - d * 3.2308).rgb) * 0.070270;',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'].join('\n'), { t: { value: null }, d: { value: new THREE.Vector2() } });
  const copy = mat('uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }', { t: { value: null } });
  const fin = mat([
    'uniform sampler2D t, tA, tB; uniform float expo, bloom, grain, time; uniform vec2 res; varying vec2 vUv;',
    'vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }',
    'vec3 aces(vec3 c){',
    '  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));',
    '  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));',
    '  return clamp(O * fit(I * (c * expo / 0.6)), 0.0, 1.0);',
    '}',
    'float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
    'void main(){',
    '  vec2 d = vUv - 0.5; float fr = 0.0011 * dot(d, d);',
    '  vec4 s = texture2D(t, vUv);',
    '  vec3 c = vec3(texture2D(t, vUv + d * fr).r, s.g, texture2D(t, vUv - d * fr).b);',
    '  vec3 bl = (texture2D(tA, vUv).rgb + texture2D(tB, vUv).rgb * 1.3) * bloom;',
    '  float a = clamp(s.a + dot(bl, vec3(0.3333)), 0.0, 1.0);',
    '  c = aces(c + bl);',
    '  c = mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));',
    '  c += (hash(vUv * res + fract(time) * 61.0) - 0.5) * grain * a;',
    '  gl_FragColor = vec4(c, a);',
    '}'].join('\n'), { t: { value: main.texture }, tA: { value: a1.texture }, tB: { value: a2.texture }, expo: { value: 1 }, bloom: { value: 0.5 }, grain: { value: 0.035 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } });
  function pass(m, target) { quad.material = m; renderer.setRenderTarget(target); renderer.render(sc, cam); }
  function sep(src, tmp, w, h) {
    blur.uniforms.t.value = src.texture; blur.uniforms.d.value.set(1 / w, 0); pass(blur, tmp);
    blur.uniforms.t.value = tmp.texture; blur.uniforms.d.value.set(0, 1 / h); pass(blur, src);
  }
  let W = 4, H = 4;
  return {
    main,
    setSize(w, h) {
      W = Math.max(8, w); H = Math.max(8, h);
      main.setSize(W, H); a1.setSize(W >> 2, H >> 2); b1.setSize(W >> 2, H >> 2); a2.setSize(W >> 3, H >> 3); b2.setSize(W >> 3, H >> 3);
      fin.uniforms.res.value.set(W, H);
    },
    finish(expo, bloom, grain, time) {
      const keep = renderer.autoClear; renderer.autoClear = false;
      bright.uniforms.t.value = main.texture; bright.uniforms.px.value.set(1 / W, 1 / H); pass(bright, a1);
      sep(a1, b1, W >> 2, H >> 2);
      copy.uniforms.t.value = a1.texture; pass(copy, a2);
      sep(a2, b2, W >> 3, H >> 3); sep(a2, b2, W >> 3, H >> 3);
      fin.uniforms.expo.value = expo; fin.uniforms.bloom.value = bloom; fin.uniforms.grain.value = grain; fin.uniforms.time.value = time;
      pass(fin, null);
      renderer.autoClear = keep;
    }
  };
}
