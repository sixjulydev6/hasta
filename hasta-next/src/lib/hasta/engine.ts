import * as THREE from 'three';
import { TAU, clamp, ctx2d, lerp, makeEnvironment, makeMaterials, makePost, makeStudioEnv, roundedRect, smooth, softDisc, v3 } from './core';
import type { Post } from './core';
import { buildProps, buildRobot, buildRoom, buildTray, handPose } from './robot';
import type { Arm, HandPose, PropName } from './robot';

declare global {
  interface Window {
    /** test hooks: pin the timeline, trigger the greeting */
    __hasta?: { tau: (v: number | null) => void; hello: (v?: number) => void };
    /** test hook: cap the frame rate for headless screenshots */
    __hastaFrameMs?: number;
  }
}

type Box = { el: HTMLElement; top: number; h: number };
type ArmPose = { W: THREE.Vector3; q: THREE.Quaternion; P: THREE.Vector3; h: HandPose };
type Still = { tau: number; cam: number[]; tgt: number[]; fov: number; prop?: Exclude<PropName, 'glass'>; glass?: boolean; hideTray?: boolean };
type Shot = Still & { w: number; h: number };
type HudBox = { el: HTMLElement; c: THREE.Vector3; h: THREE.Vector3; egg?: boolean };
type Primitive = string | number | boolean;

/** interpolates numbers with smoothstep between keys [tau, value] */
function trackN(keys: [number, number][]): (t: number) => number {
  return function (t) {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1], f = smooth(clamp((t - a[0]) / (b[0] - a[0])));
    return lerp(a[1], b[1], f);
  };
}
/** interpolates arrays with smoothstep between keys [tau, value]; returns a shared output array */
function trackV(keys: [number, number[]][]): (t: number) => number[] {
  const out = new Array<number>(keys[0][1].length);
  return function (t) {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1], f = smooth(clamp((t - a[0]) / (b[0] - a[0])));
    for (let k = 0; k < out.length; k++) out[k] = lerp(a[1][k], b[1][k], f);
    return out;
  };
}

/* ------------------------------------------------------------------
   engine.ts (was app.js) — scroll model, page chrome, scene and the chapter timeline.
   Chapter time τ: chapter i holds over [i, i+0.5] while its copy is pinned,
   then hands over to chapter i+1 across [i+0.5, i+1].
------------------------------------------------------------------ */
/** Starts the page: scroll model, chrome and the 3D stage. Returns a cleanup that undoes all of it. */
export const startHasta = (): (() => void) => {
  const root = document.documentElement;
  const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => {
    const el = document.querySelector<T>(sel);
    if (!el) throw new Error(`Hasta: missing ${sel}`);
    return el;
  };
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string): T[] => [...document.querySelectorAll<T>(sel)];
  const ac = new AbortController(), sig = { signal: ac.signal };
  let disposed = false, raf = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = matchMedia('(min-width: 1000px)');

  /* ---------- scroll model ---------- */
  const chEls = $$('.ch'), secEls = $$('main > section, footer'), winEl = $('#about');
  /* the scroll model measures against the stable small viewport (the initial containing block, what 100svh
     resolves to), not innerHeight: on phones and tablets innerHeight changes every time the browser toolbar
     slides in or out mid-scroll, which used to re-time every chapter and make the animation jump */
  const stableVh = (): number => root.clientHeight || innerHeight;
  let chapters: Box[] = [], secs: Box[] = [], win: Box = { el: winEl, top: 0, h: 0 }, vh = stableVh();
  const box = (el: HTMLElement, y: number): Box => ({ el, top: el.getBoundingClientRect().top + y, h: el.offsetHeight });
  function measure() {
    vh = stableVh();
    const y = scrollY;
    chapters = chEls.map(el => box(el, y)); secs = secEls.map(el => box(el, y)); win = box(winEl, y);
  }
  const onScreen = (b: Box, y: number): boolean => b.top < y + vh && b.top + b.h > y;
  function tauAt(y: number): number {
    for (let i = 0; i < chapters.length; i++) {
      const c = chapters[i];
      if (y < c.top + c.h || i === chapters.length - 1) {
        const p = clamp((y - c.top) / c.h), hold = clamp((c.h - vh) / c.h, 0.05, 0.95);
        const t = i + (p < hold ? 0.5 * p / hold : 0.5 + 0.5 * (p - hold) / (1 - hold));
        const n = chapters.length;
        if (i === 0) return Math.min(t, 0.97);          /* the hero only pushes in; the move to the side is a cut, below */
        if (i === n - 2) return Math.min(t, n - 1.5);    /* the rounds keep their sky to the end */
        if (i === n - 1) return n - 1.5 + 0.5 * clamp(p / 0.3) + 0.5 * clamp((p - 0.3) / 0.7);   /* the finale arrives on that sky, then the glow is revealed */
        return t;
      }
    }
    return 0;
  }

  /* ---------- chrome ---------- */
  const menuBtn = $('#menuBtn'), nav = $('#nav'), navLinks = $$('#nav a'), tabs = $('#tabs'), tabLinks = $$('#tabs a');
  const fogs = $$('.fog');
  const bgs = $$('.bg'), forceRows = $$('#force .row').map(r => ({ out: r.querySelector('output'), bar: r.querySelector('b') }));
  let menuOpen = false;
  const last: Record<string, Primitive> = {};
  const put = <V extends Primitive>(k: string, v: V, fn: (v: V) => void): void => { if (last[k] !== v) { last[k] = v; fn(v); } };
  function setMenu(open: boolean): void {
    menuOpen = open; nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }
  const isEl = (t: EventTarget | null): t is Element => t instanceof Element;
  menuBtn.addEventListener('click', e => { e.stopPropagation(); setMenu(!menuOpen); }, sig);
  nav.addEventListener('click', e => { if (isEl(e.target) && e.target.closest('a')) setMenu(false); }, sig);
  document.addEventListener('click', e => { if (menuOpen && !(isEl(e.target) && e.target.closest('#nav'))) setMenu(false); }, sig);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { setMenu(false); menuBtn.focus(); } }, sig);

  const hpEls = $$('#stage, #topbar'), heroTitle = document.querySelector<HTMLElement>('.hero-title');
  function chrome(tau: number, tauRaw: number): number {
    const y = scrollY, hp = clamp(y / (vh * 0.45));
    /* set on the few elements that read them, not on <html>: a custom property changed on the root
       restyles the whole document every scroll frame, which is expensive on phones and tablets */
    put('hp', hp.toFixed(3), v => { for (const el of hpEls) el.style.setProperty('--hp', v); });
    put('sy', Math.min(y, vh * 1.6).toFixed(0), v => { if (heroTitle) heroTitle.style.setProperty('--sy', v); });
    for (let i = 1; i < bgs.length; i++) put('bg' + i, clamp((tau - (i - 0.5)) * 2).toFixed(3), v => { bgs[i].style.opacity = v; });
    /* mobile top fog: only while chapter i is settled (its copy pinned, tau in [i, i + 0.5]);
       it fades out quickly once the hand-over scroll starts, so no fog moves with the transition */
    for (const f of fogs) {
      const i = Number(f.dataset.ch), o = clamp((tau - (i - 0.1)) / 0.1) * (1 - clamp((tau - (i + 0.5)) / 0.1));
      put('fog' + i, o.toFixed(3), v => { f.style.opacity = v; });
    }
    chEls.forEach((el, i) => put('x' + i, clamp((tau - i - 0.5) * 5).toFixed(2), v => el.style.setProperty('--x', v)));
    const ci = clamp(Math.floor(tauRaw + 0.25), 0, chEls.length - 1);
    /* mark the nav link for whichever section fills the middle of the screen */
    let here = secs[0];
    for (const t of secs) if (t.top <= y + vh * 0.45) here = t;
    put('here', here.el.id, v => navLinks.forEach(a => {
      const on = (a.dataset.g ?? '').split(' ').includes(v);
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    }));
    const c1 = chapters[1], cN = chapters[chapters.length - 2];
    put('tabs', y > c1.top - vh * 0.35 && y < cN.top + cN.h - vh * 0.9, v => tabs.classList.toggle('show', v));
    put('tab', ci, v => tabLinks.forEach((a, i) => {
      a.classList.toggle('on', i === v - 1);
      if (i === v - 1) { a.setAttribute('aria-current', 'true'); tabs.scrollLeft = a.offsetLeft - (tabs.clientWidth - a.offsetWidth) / 2; } else a.removeAttribute('aria-current');
    }));
    put('inert', !desktop.matches && !menuOpen, v => { nav.inert = v; });
    return hp;
  }
  function setForce(f: number, time: number): void {
    const peak = [0.84, 0.47, 0.39];
    forceRows.forEach((r, i) => {
      const n = peak[i] * f * (1 + (f > 0.9 ? 0.035 * Math.sin(time * (5 + i * 1.7) + i) : 0));
      put('f' + i, n.toFixed(2), v => { if (r.out) r.out.textContent = v; if (r.bar) r.bar.style.width = (n / 45 * 100).toFixed(2) + '%'; });
    });
  }
  /* size the footer wordmark to the full measure */
  const wm = document.querySelector<HTMLElement>('.wordmark');
  function fitWordmark(): void {
    if (!wm || !wm.parentElement) return;
    wm.style.fontSize = '100px';
    const r = document.createRange(); r.selectNodeContents(wm);
    const w = r.getBoundingClientRect().width, target = wm.parentElement.clientWidth - 2 * parseFloat(getComputedStyle(wm.parentElement).paddingLeft);
    if (w > 0) wm.style.fontSize = (100 * target / w * 0.995).toFixed(1) + 'px';
  }

  /* ---------- scene ---------- */
  function init3D() {
    const canvas = $<HTMLCanvasElement>('#gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__hastaFrameMs });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene();
    const envSky = makeEnvironment(renderer), envStudio = makeStudioEnv(renderer);
    scene.environment = envSky;
    let post: Post | null = null;
    try { post = makePost(renderer); } catch { post = null; }
    const M = makeMaterials();
    const R = buildRobot(M); scene.add(R.root);
    const T = buildTray(M); T.group.position.set(0, 0, 0.42); scene.add(T.group);
    T.tray.add(T.egg); T.egg.position.copy(T.eggRest);
    const PROPS = buildProps(M), Q_UP = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), Math.PI / 2);
    for (const k of ['pill', 'jar', 'tea', 'cloche'] as const) R.arms[0].hand.group.add(PROPS[k]);
    T.tray.add(PROPS.glass); PROPS.glass.position.set(0.0, T.top, 0.04);

    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(-2.4, 4.6, 3.4); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 2.3, bottom: -1.8, near: 0.5, far: 12 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.018; key.shadow.radius = 2.5;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe9ff, 0.9); rim.position.set(2.5, 2.2, -3); scene.add(rim);
    /* the studio. Its floor mirrors the scene: each frame is drawn once upside down, then the floor over it */
    const ROOM = buildRoom(M); scene.add(ROOM.group);
    const KEY_A = v3(-2.4, 4.6, 3.4), KEY_B = v3(0.5, 5.4, 1.2), COOL = new THREE.Color(0xdfe9ff), WARM = new THREE.Color(0xff9a3a), WHITE = new THREE.Color(0xffffff);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: softDisc(256, 0.05, 0.3), transparent: true, depthWrite: false }));
    blob.renderOrder = -1;
    blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.003, 0.08); scene.add(blob);

    /* closing scene: a glowing panel behind the robot and two warm back lights */
    const panelTex = (() => {
      const c = document.createElement('canvas'); c.width = 8; c.height = 256;
      const ctx = ctx2d(c), g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#ffe65e'); g.addColorStop(0.55, '#ffd43c'); g.addColorStop(1, '#ffb224');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.5), new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, opacity: 0, toneMapped: false }));
    if (post) panel.material.color.setScalar(3.1);
    panel.position.set(-0.22, 1.5, -0.95); panel.visible = false; scene.add(panel);
    const backs = [[-1.3, 1.9, -1.7], [1.5, 1.7, -1.5]].map(pos => {
      const l = new THREE.DirectionalLight(0xff9a3a, 0); l.position.set(pos[0], pos[1], pos[2]);
      l.target.position.set(0, 1.35, 0); scene.add(l); scene.add(l.target); return l;
    });

    const camera = new THREE.PerspectiveCamera(30, 1, 0.03, 60);

    /* ----- depth view: contour rings on what the robot sees ----- */
    const scanMat = new THREE.LineBasicMaterial({ color: 0xbcd6ff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const ringGeo = (() => { const p = []; for (let i = 0; i < 72; i++) { const a = i / 72 * TAU; p.push(Math.cos(a), 0, Math.sin(a)); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g; })();
    const scanRing = (parent: THREE.Object3D, r: number, y: number, x = 0, z = 0): void => { const l = new THREE.LineLoop(ringGeo, scanMat); l.renderOrder = 10; l.scale.set(r, 1, r); l.position.set(x, y, z); parent.add(l); };
    for (let i = 1; i < 8; i++) { const f = i / 8 * Math.PI; scanRing(T.egg, 0.0222 * Math.sin(f) * (1 + 0.17 * Math.cos(f)), -0.0285 * Math.cos(f)); }
    [[0.021, 0.004], [0.009, 0.02], [0.0225, 0.044]].forEach(p => scanRing(T.tray, p[0], T.cupPos.y + p[1], T.cupPos.x, T.cupPos.z));
    for (const inset of [0, 0.014, 0.05, 0.09]) {
      const pts = roundedRect(0.4 - inset * 2, 0.27 - inset * 2, Math.max(0.01, 0.04 - inset * 0.4)).getPoints(10).map(p => v3(p.x, T.top + 0.001 + (inset ? 0 : 0.01), p.y));
      const ll = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), scanMat); ll.renderOrder = 10; T.tray.add(ll);
    }
    /* planned contact points on the shell; they pulse later as touch readings */
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff7a2f, transparent: true, opacity: 0, depthTest: false, toneMapped: false, side: THREE.DoubleSide });
    const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, toneMapped: false, side: THREE.DoubleSide });
    const contacts = [[0.004, 0, -1], [0.44, 0, 0.9], [-0.42, 0, 0.9]].map((d, i) => {
      const n = v3(d[0], d[1], d[2]).normalize(), p = n.clone().multiplyScalar(0.0222);
      const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), n);
      const dot = new THREE.Mesh(new THREE.RingGeometry(0.0026, 0.0038, 28), dotMat);
      dot.position.copy(p); dot.quaternion.copy(q); dot.renderOrder = 5; T.egg.add(dot);
      const rings = [0, 1].map(k => {
        const r = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), rippleMat.clone());
        r.position.copy(p).addScaledVector(n, 0.004); r.quaternion.copy(q); r.renderOrder = 6; T.egg.add(r);
        return { mesh: r, phase: i * 0.31 + k * 0.5 };
      });
      return { dot, rings };
    });

    /* ----- poses ----- */
    const handQ = (F: number[], N: number[]): THREE.Quaternion => {
      const f = v3(F[0], F[1], F[2]).normalize(), n = v3(N[0], N[1], N[2]);
      n.addScaledVector(f, -n.dot(f)).normalize();
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3().crossVectors(f, n), f, n));
    };
    const H = {
      relax: handPose([0.3, 0.35, 0.4, 0.45], 0.2, [0.5, 0.7, -0.2, 0.2, 0.3, 0.2]),
      open: handPose([0.07, 0.04, 0.07, 0.11], 0.75, [0.2, 0.9, 0, 0.04, 0.08, 0.04]),
      flat: handPose([0, 0, 0, 0], 1, [0.1, 1.05, 0, 0, 0, 0]),
      pre: handPose([[0.42, 0.4, 0.18], [0.42, 0.4, 0.18], [0.2, 0.25, 0.15], [0.16, 0.2, 0.12]], 0.45, [1.45, 1.25, -1.25, -0.12, 0.12, 0.1]),
      pinch: handPose([[0.7, 0.7, 0.35], [0.7, 0.7, 0.35], [0.25, 0.3, 0.2], [0.2, 0.25, 0.15]], 0.3, [1.45, 1.25, -1.25, 0.2, 0.35, 0.3]),
      cup: handPose([[0.3, 0.38, 0.25], [0.3, 0.38, 0.25], [0.34, 0.4, 0.26], [0.4, 0.42, 0.28]], 0.25, [0.55, 0.8, -0.35, 0.22, 0.3, 0.2])
    };
    const G_PINCH = v3(0.02, 0.105, 0.069), G_PALM = v3(0.003, 0.064, 0.0385);
    const Q_PINCH = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), -Math.PI / 2), Q_PALM = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5, 0.12));
    const EGG = T.eggRest.clone().add(T.tray.position).add(T.group.position);
    const arm = (W: number[], F: number[], N: number[], P: number[], h: HandPose): ArmPose => ({ W: v3(W[0], W[1], W[2]), q: handQ(F, N), P: v3(P[0], P[1], P[2]), h });
    const grasp = (dy: number, dz: number, F: number[], N: number[], P: number[], h: HandPose): ArmPose => {
      const q = handQ(F, N), W = EGG.clone().add(v3(0, dy, dz)).sub(G_PINCH.clone().applyQuaternion(q));
      return { W, q, P: v3(P[0], P[1], P[2]), h };
    };
    const restR = arm([-0.275, 0.895, 0.06], [0, -1, 0.12], [1, 0, 0.1], [-0.3, 0, -1], H.relax);
    const restL = arm([0.275, 0.895, 0.06], [0, -1, 0.12], [-1, 0, 0.1], [0.3, 0, -1], H.relax);
    const wave = arm([-0.38, 1.5, 0.22], [-0.12, 1, 0.05], [0, 0, 1], [-0.6, -1, -0.2], H.open);
    const ready = arm([-0.27, 0.97, 0.15], [0, -0.85, 0.5], [1, -0.2, 0], [-0.5, -0.2, -1], H.relax);
    const PG = [-0.8, -0.3, -0.5];
    const hover = grasp(0.085, -0.01, [0, -0.2, 1], [0, -1, -0.2], PG, H.pre);
    const over = grasp(0, 0, [0, 0, 1], [0, -1, 0], PG, H.pre);
    const hold = grasp(0, 0, [0, 0, 1], [0, -1, 0], PG, H.pinch);
    const lift = grasp(0.15, 0.03, [0, 0.06, 1], [0, -1, 0.06], PG, H.pinch);
    const show = grasp(0.24, 0.07, [0.18, 0.22, 1], [0.1, -1, 0.22], PG, H.pinch);
    const show2 = grasp(0.25, 0.085, [0.26, 0.26, 1], [0.14, -1, 0.26], PG, H.pinch);
    const offer = arm([-0.15, 1.16, 0.4], [0.08, 0.1, 1], [0, 1, -0.1], [-0.7, -0.7, -0.2], H.cup);
    const offer2 = arm([-0.14, 1.18, 0.47], [0.1, 0.12, 1], [0, 1, -0.12], [-0.7, -0.7, -0.2], H.cup);
    const serve = arm([-0.25, 1.07, 0.3], [0.05, 0.06, 1], [0, 1, -0.06], [-0.5, -0.6, -0.6], H.cup);
    const RA: [number, ArmPose][] = [[0, restR], [0.97, restR], [1, wave], [1.3, wave], [2, ready], [2.5, hover], [3, hover], [3.16, over], [3.3, hold], [3.5, lift], [4, show], [4.5, show2], [5, offer], [5.5, offer2], [6, restR], [8.5, restR]];

    const armOut: ArmPose = { W: v3(), q: new THREE.Quaternion(), P: v3(), h: new Array<number>(19) };
    function armAt(keys: [number, ArmPose][], t: number): ArmPose {
      let i = 0;
      while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
      const a = keys[i], b = keys[i + 1], f = smooth(clamp((t - a[0]) / (b[0] - a[0])));
      armOut.W.lerpVectors(a[1].W, b[1].W, f); armOut.P.lerpVectors(a[1].P, b[1].P, f);
      armOut.q.slerpQuaternions(a[1].q, b[1].q, f);
      for (let k = 0; k < 19; k++) armOut.h[k] = lerp(a[1].h[k], b[1].h[k], f);
      return armOut;
    }

    const K = {
      cam: trackV([[0, [0, 1.54, 2.3]], [0.5, [0, 1.6, 1.8]], [0.97, [0, 1.66, 1.2]], [1, [-0.28, 1.6, 1.3]], [1.3, [-0.56, 1.63, 1.2]], [2, [0, 1.84, 0.3]], [2.5, [-0.02, 1.76, 0.32]], [3, [0.2, 1.08, 1.02]], [3.5, [0.15, 1.17, 1.0]], [4, [0.3, 1.25, 1.05]], [4.5, [0.27, 1.28, 1.11]], [5, [-1.25, 1.12, 2.75]], [5.5, [-1.1, 1.12, 2.65]], [6, [0.02, 1.36, 2.5]], [6.5, [0, 1.35, 2.5]], [7, [0, 1.5, 1.66]], [8.5, [0, 1.5, 1.6]]]),
      tgt: trackV([[0, [0, 1.63, 0]], [0.5, [0, 1.66, 0]], [0.97, [0, 1.69, 0]], [1, [-0.44, 1.6, 0.2]], [1.3, [-0.42, 1.6, 0.2]], [2, [0, 0.93, 0.47]], [2.5, [-0.02, 0.93, 0.46]], [3, [-0.11, 0.96, 0.4]], [3.5, [-0.2, 1.08, 0.42]], [4, [-0.1, 1.2, 0.49]], [4.5, [-0.1, 1.21, 0.5]], [5, [-0.25, 1.1, 0.2]], [5.5, [-0.24, 1.1, 0.22]], [6, [-0.56, 1.32, 0]], [6.5, [-0.55, 1.32, 0]], [7, [0, 1.46, 0]], [8.5, [0, 1.46, 0]]]),
      fov: trackN([[0, 30], [1, 28], [1.3, 28], [2, 40], [2.5, 38], [3, 25], [3.5, 25], [4, 17], [4.5, 16], [5, 31], [6, 30], [7.5, 30]]),
      head: trackV([[0, [0, 0]], [0.97, [0, 0]], [1, [-0.46, -0.04]], [1.3, [-0.5, -0.04]], [2, [-0.05, 0.52]], [2.5, [-0.1, 0.56]], [3, [-0.2, 0.5]], [3.5, [-0.2, 0.42]], [4, [-0.22, 0.3]], [4.5, [-0.2, 0.28]], [5, [0.1, 0.03]], [5.5, [0.08, 0.03]], [6, [0, 0.02]], [6.5, [0, 0.02]], [7, [0, 0]], [8.5, [0, 0]]]),
      lean: trackN([[0, 0], [1.3, 0], [2, 0.15], [3.3, 0.16], [3.5, 0.1], [4.5, 0.07], [5, 0.05], [5.5, 0.06], [6, 0], [7.5, 0]]),
      scan: trackN([[0, 0], [1.72, 0], [2, 1], [2.5, 1], [2.8, 0], [7.5, 0]]),
      force: trackN([[0, 0], [3.18, 0], [3.32, 1], [4.55, 1], [4.95, 0], [7.5, 0]]),
      ripple: trackN([[0, 0], [3.82, 0], [4, 1], [4.5, 1], [4.72, 0], [7.5, 0]]),
      palm: trackN([[0, 0], [4.56, 0], [4.98, 1], [7.5, 1]]),
      rip: trackN([[0, 0], [0.97, 0], [1, 1], [1.5, 1], [1.7, 0], [7.5, 0]]),
      fin: trackN([[0, 0], [6.55, 0], [7, 1], [8.5, 1]]),
      expo: trackN([[0, 0.98], [1.6, 0.98], [2, 0.86], [6.55, 0.86], [7, 0.24], [8.5, 0.24]]),
      room: trackN([[0, 0], [1.62, 0], [1.95, 1], [6.55, 1], [7, 0], [8.5, 0]]),
      eggA: trackN([[0, 1], [5.55, 1], [5.85, 0], [8.5, 0]]),
      trayA: trackN([[0, 1], [5.6, 1], [5.95, 0], [8.5, 0]]),
      handsPortrait: trackN([[0, 0], [0.97, 0], [1, 1], [1.3, 1], [2, 0], [8.5, 0]])
    };

    /* ----- per-frame ----- */
    const chestInv = new THREE.Matrix4(), cq = new THREE.Quaternion(), tq = new THREE.Quaternion(), tw = v3(), tp = v3(), pv = v3();
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let five = -1, blinkAt = 2.4, W = 1, Hh = 1, greet = -1, curTau = 0, lastX: number | null = null, dir = 0, flips: number[] = [];
    function hello(v?: number): void { if (greet < 0 && curTau < 0.6) { greet = v || 0; flips = []; } }
    addEventListener('pointermove', e => {
      pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1;
      if (lastX === null) { lastX = e.clientX; return; }
      const dx = e.clientX - lastX;
      if (Math.abs(dx) < 8) return;
      lastX = e.clientX;
      if (Math.sign(dx) !== dir) {
        dir = Math.sign(dx);
        const now = performance.now();
        flips = flips.filter(t => now - t < 900); flips.push(now);
        if (flips.length >= 4) hello();
      }
    }, { passive: true, signal: ac.signal });
    const waveQ = new THREE.Quaternion(), palmAxis = v3(0, 0, 1);
    function highFive(): void { if (five < 0) five = 0; }
    function placeArm(a: Arm, p: ArmPose, extra?: THREE.Vector3 | null): void {
      tw.copy(p.W); if (extra) tw.add(extra);
      tw.applyMatrix4(chestInv);
      tq.copy(cq).multiply(p.q);
      tp.copy(p.P).applyQuaternion(cq);
      R.solveArm(a, tw, tq, tp);
      a.hand.set(p.h);
    }
    const hudBoxes: HudBox[] = [
      { el: $('#box-tray'), c: v3(0, 0.906, 0.42), h: v3(0.2, 0.012, 0.135) },
      { el: $('#box-egg'), c: v3(0, 0, 0), h: v3(0.026, 0.032, 0.026), egg: true }
    ];
    const hud = $('#hud'), ew = v3(), fx = v3();

    /* render resolution: touch devices get a lower cap (they run out of fill rate, not pixels), and
       `quality` steps down when frames keep running long, so scrolling stays fluid on slower GPUs */
    const coarse = matchMedia('(pointer: coarse)').matches;
    let quality = 1, slow = 0, sized = '';
    function resize(): void {
      /* the canvas is 100lvh tall, so the mobile toolbar sliding in and out does not resize it (and
         reallocate every render target) in the middle of a scroll */
      W = canvas.clientWidth || innerWidth; Hh = canvas.clientHeight || innerHeight;
      const pr = Math.max(1, Math.min(devicePixelRatio || 1, coarse ? 1.5 : W < 700 ? 1.75 : 2) * quality);
      const key = `${W}x${Hh}@${pr}`;
      if (key === sized) return;
      sized = key;
      renderer.setPixelRatio(pr);
      renderer.setSize(W, Hh, false);
      if (post) { const db = renderer.getDrawingBufferSize(new THREE.Vector2()); post.setSize(db.x, db.y); }
    }
    resize();
    /* after ~1 s spent below ~40 fps, drop resolution a step (never back up, so it cannot oscillate) */
    function govern(dt: number): void {
      if (dt > 1 / 40) slow += dt; else slow = Math.max(0, slow - dt * 0.5);
      if (slow > 1 && quality > 0.65) { quality -= 0.15; slow = 0; resize(); }
    }

    function frame(tau: number, dt: number, time: number, _hp: number, shot?: Shot): void {
      const idle = reduce || shot ? 0 : 1;
      if (!shot && dt > 0) govern(dt);
      /* body */
      R.chest.position.y = 1.1 + idle * 0.0022 * Math.sin(time * 1.25);
      R.chest.rotation.x = K.lean(tau) + idle * 0.004 * Math.sin(time * 1.25 + 0.6);
      const hd = K.head(tau);
      pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3); pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);
      const follow = clamp(1 - tau * 1.6) * idle;
      R.head.rotation.y = hd[0] + idle * 0.035 * Math.sin(time * 0.47) + follow * pointer.sx * 0.32;
      R.head.rotation.x = hd[1] + idle * 0.012 * Math.sin(time * 0.8) + follow * pointer.sy * 0.14;
      R.chest.updateMatrixWorld(true);
      chestInv.copy(R.chest.matrixWorld).invert();
      R.chest.getWorldQuaternion(cq); cq.invert();

      /* arms */
      curTau = tau;
      let hi = 0;
      if (greet >= 0 && !shot) {
        greet += dt / 2.8;
        if (greet >= 1) greet = -1;
        else hi = (greet < 0.14 ? smooth(greet / 0.14) : 1 - smooth(clamp((greet - 0.82) / 0.18))) * clamp(1.4 - tau * 2.4);
      }
      R.eyeState.say = hi > 0.45 ? 1 : 0;
      const pr = armAt(RA, tau);
      if (hi > 0) {
        pr.W.lerp(wave.W, hi); pr.P.lerp(wave.P, hi); pr.q.slerp(wave.q, hi);
        for (let k = 0; k < 19; k++) pr.h[k] = lerp(pr.h[k], H.open[k], hi);
        pr.q.multiply(waveQ.setFromAxisAngle(palmAxis, 0.38 * hi * Math.sin(time * 9.5)));
        pr.W.x += 0.02 * hi * Math.sin(time * 9.5);
      }
      const rip = K.rip(tau);
      if (rip > 0.001) {
        for (let i = 0; i < 4; i++) {
          const w = rip * (idle ? Math.pow(Math.max(0, Math.sin(time * 2.1 - i * 0.62)), 2) * 0.62 : 0);
          pr.h[i * 3] += w * 0.9; pr.h[i * 3 + 1] += w * 1.15; pr.h[i * 3 + 2] += w * 0.7;
        }
        const wt = rip * (idle ? Math.pow(Math.max(0, Math.sin(time * 2.1 + 0.9)), 2) : 0);
        pr.h[13] += wt * 0.75; pr.h[16] += wt * 0.25; pr.h[17] += wt * 0.4;
        pr.W.x += idle * 0.01 * Math.sin(time * 0.9); pr.W.y += idle * 0.008 * Math.sin(time * 1.3);
      }
      let extra: THREE.Vector3 | null = null;
      if (five >= 0) {
        five += dt / 0.95;
        const b = five < 0.32 ? smooth(five / 0.32) : 1 - smooth(clamp((five - 0.42) / 0.58));
        if (five >= 1) five = -1;
        for (let k = 0; k < 19; k++) pr.h[k] = lerp(pr.h[k], H.flat[k], b * rip);
        extra = pv.set(0.03, 0.02, 0.2).multiplyScalar(b * rip);
      }
      placeArm(R.arms[0], pr, extra);
      const pl = armAt([[0, restL], [7.5, restL]], tau);
      pl.W.z += idle * 0.004 * Math.sin(time * 1.1);
      placeArm(R.arms[1], pl);

      /* egg: in the cup, then carried by the hand */
      const held = tau >= 3.3;
      const rh = R.arms[0].hand.group;
      if (held && T.egg.parent !== rh) rh.add(T.egg);
      if (!held && T.egg.parent !== T.tray) { T.tray.add(T.egg); T.egg.position.copy(T.eggRest); T.egg.quaternion.identity(); }
      if (held) { const pm = K.palm(tau); T.egg.position.lerpVectors(G_PINCH, G_PALM, pm); T.egg.quaternion.slerpQuaternions(Q_PINCH, Q_PALM, pm); }
      /* scenario stills swap the egg for what Hasta carries on a round */
      const prop = shot?.prop;
      for (const k of Object.keys(PROPS) as PropName[]) PROPS[k].visible = false;
      T.egg.visible = !prop; T.cupMesh.visible = !(shot && shot.glass); PROPS.glass.visible = !!(shot && shot.glass);
      if (prop) {
        const pg = PROPS[prop]; pg.visible = true;
        if (prop === 'tea' || prop === 'cloche') { pg.position.set(0.0, prop === 'tea' ? 0.07 : 0.082, 0.026); pg.quaternion.copy(Q_UP); }
        else { pg.position.copy(T.egg.position); pg.quaternion.copy(T.egg.quaternion); }
      }

      /* eyes */
      if (time > blinkAt) { R.eyeState.blink = 1; if (time > blinkAt + 0.13) { R.eyeState.blink = 0; blinkAt = time + 2.6 + Math.random() * 3.4; } }
      const scan = K.scan(tau);
      R.eyeState.mode = scan > 0.5 ? 1 : 0;
      R.eyeState.gx = follow * pointer.sx * 1.7 + idle * 0.25 * Math.sin(time * 0.31);
      R.eyeState.gy = follow * -pointer.sy * 0.95;
      const expo = K.expo(tau);
      R.eyeState.gain = post ? clamp(0.95 / expo, 1, 4.5) : 1;
      R.updateEyes(dt);

      /* overlays */
      scanMat.opacity = scan * 0.85;
      dotMat.opacity = scan;
      put('scan', scan.toFixed(3), v => hud.style.setProperty('--scan-o', v));
      const rp = K.ripple(tau);
      for (const c of contacts) for (const r of c.rings) {
        const ph = idle ? (time * 0.75 + r.phase) % 1 : 0.4;
        r.mesh.scale.setScalar(0.003 + 0.013 * ph);
        r.mesh.material.opacity = rp * (1 - ph) * 0.95;
        r.mesh.visible = rp > 0.002;
      }
      setForce(K.force(tau), time);
      renderer.toneMappingExposure = expo;
      const fin = K.fin(tau), rm = K.room(tau);
      if (!shot) put('fin', fin.toFixed(2), v => root.style.setProperty('--fin', v));
      panel.visible = fin > 0.002; panel.material.opacity = fin;
      /* in the studio: a soft top light from the ceiling strips and cool back light off the wall */
      backs[0].color.lerpColors(WARM, COOL, clamp(rm * 1.6)); backs[1].color.copy(backs[0].color);
      backs[0].intensity = fin * 20 + rm * 3.6; backs[1].intensity = fin * 14 + rm * 3.0;
      const env = rm > 0.5 ? envStudio : envSky;
      if (scene.environment !== env) scene.environment = env;
      key.position.lerpVectors(KEY_A, KEY_B, rm); key.color.lerpColors(WHITE, COOL, rm);
      key.intensity = 1.7 * (1 - fin * 0.97) * (1 - rm) + 1.25 * rm; rim.intensity = (0.9 + 1.3 * rm) * (1 - fin);
      for (const m of ROOM.mats) m.opacity = rm;
      ROOM.floorMat.uniforms.uA.value = rm;
      ROOM.group.visible = rm > 0.01; T.group.visible = rm > 0.01 && !(shot && shot.hideTray);
      const ta = rm * K.trayA(tau), ea = (held ? 1 : rm) * K.eggA(tau);
      M.stand.opacity = M.oak.opacity = M.cup.opacity = ta; T.group.visible = ta > 0.01 && !(shot && shot.hideTray);
      M.egg.opacity = ea; if (ea < 0.01) T.egg.visible = false;
      blob.material.opacity = rm * 0.75; blob.visible = rm > 0.01;
      if (!shot) put('room', rm.toFixed(2), v => root.style.setProperty('--room', v));

      /* camera: frame for the viewport, shift for the hero's index column */
      const aspect = shot ? shot.w / shot.h : W / Hh;
      const cp = shot ? shot.cam : K.cam(tau), ct = shot ? shot.tgt.slice() : K.tgt(tau);
      /* portrait screens in the hands chapter: the view is too narrow for hand and head together,
         so pan toward the head and pull back a little (full effect at aspect ≤ 0.55, none from 1 up) */
      const pk = shot ? 0 : clamp((1 - aspect) / 0.45) * K.handsPortrait(tau);
      const panX = pk * (-0.2 - ct[0]);
      const far = (!shot && aspect < 1.25 ? Math.pow(1.25 / aspect, 0.62) : 1) * (1 + 0.2 * pk);
      camera.fov = shot ? shot.fov : K.fov(tau); camera.aspect = aspect;
      camera.position.set(ct[0] + panX + (cp[0] - ct[0]) * far, ct[1] + (cp[1] - ct[1]) * far, ct[2] + (cp[2] - ct[2]) * far);
      ct[0] += panX;
      /* on tall screens sit the subject lower, clear of the headline */
      const drop = (shot ? 0 : 1) * clamp((1.25 - aspect) / 0.75) * 0.075 * Math.hypot(camera.position.x - ct[0], camera.position.y - ct[1], camera.position.z - ct[2]);
      camera.position.y += drop; ct[1] += drop;
      camera.lookAt(ct[0], ct[1], ct[2]);
      camera.translateX(idle * pointer.sx * 0.018); camera.translateY(idle * -pointer.sy * 0.012);
      camera.lookAt(ct[0], ct[1], ct[2]);
      camera.updateProjectionMatrix();
      const pd = Math.hypot(camera.position.x - ct[0], camera.position.z - ct[2]) || 1;
      panel.position.set(ct[0] - (camera.position.x - ct[0]) / pd * 0.95, 1.52, ct[2] - (camera.position.z - ct[2]) / pd * 0.95);
      panel.lookAt(camera.position.x, panel.position.y, camera.position.z);
      if (post) renderer.setRenderTarget(post.main);
      renderer.autoClear = false; renderer.clear();
      if (rm > 0.01) {
        scene.scale.y = -1; ROOM.floor.visible = false; blob.visible = false;
        for (const m of ROOM.ceiling) m.visible = false;      /* the floor mirrors the wall and the robot, not the ceiling grid */
        renderer.render(scene, camera);                 /* the reflection */
        renderer.clearDepth();
        scene.scale.y = 1; ROOM.floor.visible = true; blob.visible = true;
        for (const m of ROOM.ceiling) m.visible = true;
        renderer.render(scene, camera);
        scene.updateMatrixWorld(true);
      } else renderer.render(scene, camera);
      renderer.autoClear = true;
      if (post) post.finish(expo, 0.3 * rm + 0.45 * fin, 0.02 + 0.02 * rm + 0.02 * fin, idle ? time : 0.37);

      /* detection boxes follow what the camera sees */
      if (scan > 0.01 && !shot) {
        T.egg.getWorldPosition(ew);
        for (const b of hudBoxes) {
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
          const c = b.egg ? ew : b.c;
          for (let i = 0; i < 8; i++) {
            fx.set(c.x + (i & 1 ? 1 : -1) * b.h.x, c.y + (i & 2 ? 1 : -1) * b.h.y, c.z + (i & 4 ? 1 : -1) * b.h.z).project(camera);
            const sx = (fx.x * 0.5 + 0.5) * W, sy = (-fx.y * 0.5 + 0.5) * Hh;
            x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
          }
          b.el.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`;
          b.el.style.width = (x1 - x0).toFixed(1) + 'px'; b.el.style.height = (y1 - y0).toFixed(1) + 'px';
        }
      }
    }
    /* stills for the card rail: the live model, re-posed and photographed off-screen */
    function stills(list: Still[], w: number, h: number): string[] {
      renderer.setPixelRatio(1); renderer.setSize(w, h, false);
      if (post) post.setSize(w, h);
      const out = list.map(s => { frame(s.tau, 0, 3, 1, Object.assign({ w, h }, s)); return canvas.toDataURL('image/jpeg', 0.9); });
      sized = ''; resize();
      return out;
    }
    function dispose(): void {
      const textures = new Set<THREE.Texture>();
      scene.traverse(o => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.Line)) return;
        o.geometry.dispose();
        const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
          m.dispose();
        }
      });
      for (const t of textures) t.dispose();
      envSky.dispose(); envStudio.dispose();
      post?.dispose();
      renderer.dispose();
    }
    return { frame, resize, highFive, stills, hello, dispose };
  }

  /* headings shimmer once, the first time they are properly on screen */
  let io: IntersectionObserver | null = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io?.unobserve(e.target); } }), { threshold: 0.6 });
    $$('.shimmer').forEach(el => io?.observe(el));
  }

  /* ---------- run ---------- */
  let gl: ReturnType<typeof init3D> | null = null;
  try { gl = init3D(); } catch { root.classList.add('no-gl'); }
  measure(); fitWordmark();
  let tauS = tauAt(scrollY), lastT = performance.now(), override: number | null = null;
  /* coalesce resize bursts into one pass per frame; the wordmark only refits when the width changes
     (a height-only resize on touch devices is the toolbar moving) */
  let resizeRaf = 0, lastW = innerWidth;
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      measure();
      if (innerWidth !== lastW) { lastW = innerWidth; fitWordmark(); }
      if (gl) gl.resize();
    });
  }, sig);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!disposed) { measure(); fitWordmark(); } });
  addEventListener('load', () => { measure(); fitWordmark(); }, sig);
  const five = () => { if (gl) gl.highFive(); };
  $('#fiveBtn').addEventListener('click', five, sig);
  $('#stage').addEventListener('click', () => { if (tauS > 0.85 && tauS < 1.6) five(); else if (gl && tauS < 0.6) gl.hello(); }, sig);
  const STILLS: Still[] = [
    { tau: 3.42, cam: [0.2, 1.07, 0.95], tgt: [-0.085, 1.0, 0.43], fov: 27, prop: 'pill', glass: true },         /* hospital: medicine cup lifted off the tray, water beside it */
    { tau: 5.3, cam: [-0.5, 1.37, 0.93], tgt: [-0.14, 1.215, 0.47], fov: 21, prop: 'tea', hideTray: true },         /* care home: tea held out, palm up */
    { tau: 5.45, cam: [0.32, 1.31, 1.12], tgt: [-0.13, 1.235, 0.53], fov: 25, prop: 'cloche', hideTray: true },     /* hotel: a covered plate carried level */
    { tau: 4.3, cam: [0.3, 1.25, 1.05], tgt: [-0.1, 1.2, 0.49], fov: 21, prop: 'jar' },                            /* laboratory: a sample jar between fingertips */
    { tau: 3.32, cam: [0.2, 1.08, 1.02], tgt: [-0.11, 0.985, 0.4], fov: 22 }                                       /* kitchen: the egg */
  ];
  const stillsTimer = setTimeout(() => {
    if (!gl || disposed) return;
    try {
      const urls = gl.stills(STILLS, 720, 900);
      $$('.shot').forEach(el => { const im = new Image(); im.alt = ''; im.src = urls[Number(el.dataset.shot)]; el.replaceChildren(im); });
    } catch { /* cards keep their colour blocks */ }
  }, 350);

  function tick(now: number): void {
    if (disposed) return;
    if (window.__hastaFrameMs && now - lastT < window.__hastaFrameMs) { raf = requestAnimationFrame(tick); return; }   /* test hook: cap the frame rate */
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const tauRaw = override ?? tauAt(scrollY);
    /* hero → hands is a hard cut, made while the intro section covers the whole screen */
    if ((tauRaw >= 1) !== (tauS >= 0.985)) tauS = tauRaw;
    tauS = reduce || override !== null ? tauRaw : tauS + (tauRaw - tauS) * (1 - Math.exp(-dt * 7));
    const hp = chrome(tauS, tauRaw);
    const y = scrollY;
    if (gl && !document.hidden && (onScreen(win, y) || chapters.some(c => onScreen(c, y)))) gl.frame(tauS, dt, now / 1000, hp);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  window.__hasta = { tau: v => { override = v; }, hello: v => { if (gl) gl.hello(v); } };

  return () => {
    disposed = true;
    ac.abort();
    cancelAnimationFrame(raf);
    cancelAnimationFrame(resizeRaf);
    clearTimeout(stillsTimer);
    io?.disconnect();
    gl?.dispose();
    gl = null;
    root.classList.remove('no-gl');
    delete window.__hasta;
  };
};
