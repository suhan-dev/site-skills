/* Intro scene engine: the three.js picture behind the intro. intro.js imports this module only when the intro is shown,
   so the rest of the site never loads three.js. Importing it builds the scene; intro.js then calls frame(p, dt) once per
   animation frame with the smoothed scroll progress p (0 → 1). The default export is that controller.
   What the picture shows comes from one scene module (STORY_SCENE below): its objects, the anchors the camera looks at,
   the camera keys, the beat events and how objects follow them. This file is the machinery around it:
   - Render tiers: touch or small screens get the low tier (no GTAO, no Bokeh, smaller textures and shadow map); the
     starting effect level follows the GPU (renderer string) and the resolution starts inside a pixel budget.
   - Smoothness: every program is compiled before the first frame (warm() below), so nothing compiles mid-scroll.
     frame() then lowers the quality within three late frames (half-size AO and depth of field, then resolution, then
     AO off, then depth of field off) and raises the resolution slowly when there is room. Only the scene pass uses MSAA;
     the depth of field skips in-focus pixels.
   - Time-driven life: a short arrival move (2.5 s dolly-in and focus pull), a slow drift and turntable sweep under fixed
     soft boxes, and beat events that play on the clock once their scroll point is reached. Scroll never moves on its own.
   - Portrait screens (aspect < 0.8) get a wider lens (30° → 46°), per-key framing and the subject lifted above the text.
   - Real materials only: PBR, procedural CanvasTextures, RoomEnvironment, GTAO, Bokeh, fog. No bloom, no glow. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import STORY_SCENE from './scenes/example-device.js';   // ← your scene module

/* ================================================================== params */
// URL parameters (for stills and posters): ?t= freezes the clock (snap mode), ?ev= the phase of the latest event,
// ?tier=low|high, ?dpr= pixel ratio (posters), ?arrive=login. ?fx=0..3 fixes the effect level (3 full, 2 half-size AO
// and depth of field, 1 no AO, 0 neither); with ?fx= or ?dpr= the quality stays fixed (stills and measurements).
const Q = new URLSearchParams(location.search);
const qn = k => (Q.has(k) && Q.get(k) !== '' && isFinite(+Q.get(k))) ? +Q.get(k) : null;
const qT = qn('t'), qEv = qn('ev'), qFx = qn('fx');
// arriving from the sign-in page: the scene starts settled (the same frame as the sign-in background)
let ARRIVE = Q.get('arrive') === 'login' || document.documentElement.classList.contains('ix-login');
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
let REDUCED = RMQ.matches;
const sec = document.getElementById('intro'), stage = sec.querySelector('.ix-stage');
// low tier: tablets (touch) or small screens
const LOW = Q.get('tier') ? Q.get('tier') === 'low'
  : (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600);
const qDpr = qn('dpr'), DPR_CAP = qDpr != null ? Math.min(3, Math.max(0.5, qDpr)) : (LOW ? 1.5 : 2); // ?dpr= only for posters

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };   // smootherstep
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }   // mulberry32: same picture every load

// markings drawn as canvas text: wait (briefly) for the page font
const FONT = (getComputedStyle(document.body).fontFamily || 'Arial, sans-serif');
try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* canvas text falls back */ }

/* ================================================================== renderer */
const canvas = sec.querySelector('.ix-gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); // throws without WebGL
if (!renderer.getContext()) throw new Error('no WebGL');
canvas.style.visibility = 'hidden';   // until the first real frame (the warm-up draws tiny frames into it)
// GPU class from the renderer string (where the browser gives it): a fast discrete GPU starts with every effect, an
// integrated or unknown one with half-size AO and depth of field, a software renderer with neither. Stills keep them all.
const GPU = (() => { try {
  const gl = renderer.getContext(); let r = String(gl.getParameter(gl.RENDERER) || '');
  if (/^(WebKit WebGL|Mozilla)$/i.test(r)) { const x = gl.getExtension('WEBGL_debug_renderer_info'); if (x) r = String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL) || r); }
  return r; } catch (e) { return ''; } })();
const SOFT = /SwiftShader|llvmpipe|softpipe|Software|Microsoft Basic/i.test(GPU);
const FAST = !SOFT && /NVIDIA|GeForce|Quadro|Radeon (RX|Pro)|Arc\(TM\)|Apple M\d+ (Pro|Max|Ultra)/i.test(GPU);
const ADAPT = qFx == null && qDpr == null;
const FX0 = qFx != null ? clamp(Math.round(qFx), 0, 3) : LOW ? 0 : (qT != null || Q.get('tier') || FAST) ? 3 : SOFT ? 0 : 2;
// start inside a pixel budget (the adaptive step raises it when frames are quick)
const PR_TOP = Math.min(devicePixelRatio || 1, DPR_CAP), PR_MIN = 0.6;
const BUDGET = LOW ? 1.0e6 : FAST ? 4.2e6 : 2.1e6;
let pixelRatio = !ADAPT ? PR_TOP : SOFT ? Math.min(PR_TOP, 1)
  : clamp(Math.sqrt(BUDGET / Math.max(1, innerWidth * innerHeight)), Math.min(1, PR_TOP), PR_TOP);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;   // once per frame (draw() asks for it), not again for the AO and depth passes
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

// the stage colour is one token (--ix-bg in intro.css): background, fog and the canvas agree with the CSS
const BG = new THREE.Color((getComputedStyle(sec).getPropertyValue('--ix-bg') || '#111216').trim() || '#111216');
const scene = new THREE.Scene();
scene.background = BG.clone();
scene.fog = new THREE.Fog(BG.clone(), 10, 100);
const pmrem = new THREE.PMREMGenerator(renderer);
function studioEnv(soft) { // a dark studio: keep the soft boxes, darken walls and props
  const env = new RoomEnvironment(renderer);
  env.traverse(o => {
    if (o.isMesh && o.material.isMeshStandardMaterial) { o.material = o.material.clone(); o.material.color.setScalar(o.material.side === THREE.BackSide ? 0.035 : 0.06); }
    if (o.isPointLight) o.intensity *= 0.35;
    // soft: the panels become large, dim soft boxes, so polished metal and glass show a broad highlight, never a blown spot
    if (soft && o.isMesh && o.material.isMeshBasicMaterial) {
      const I = o.material.color.r, top = o.position.y > 19;
      const [k, R] = top ? [0, 1.3] : I > 45 ? [2.0, 2.4] : I > 30 ? [1.8, 2.0] : I > 18 ? [2.0, 2.0] : [1.4, 2.4];
      if (top) o.scale.set(9, 0.1, 6);
      else { const sc = o.scale, m = Math.min(sc.x, sc.y, sc.z); sc.set(sc.x === m ? sc.x : sc.x * k, sc.y === m ? sc.y : sc.y * k, sc.z === m ? sc.z : sc.z * k); }
      o.material = o.material.clone(); o.material.color.setScalar(R);
    }
  });
  if (soft) { // a dim low strip on every wall: grazing views of polished faces pick up a soft horizon line
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(0.4) });
    for (const [x, z, sx, sz] of [[0, -13.3, 26, 0.1], [0, 14.7, 26, 0.1], [-16.3, 0, 0.1, 24], [14.8, 0, 0.1, 24]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), strip); b.position.set(x, 3.2, z); b.scale.set(sx, 3.6, sz); env.add(b);
    }
  }
  return pmrem.fromScene(env, 0.04).texture;
}
scene.environment = studioEnv(false);
const ENV_SOFT = studioEnv(true);
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
const root = new THREE.Group(); scene.add(root);

const key = new THREE.DirectionalLight(0xfff0e0, 2.3);   // warm key from the upper left front
key.castShadow = true;
key.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
key.shadow.bias = -0.0003;
scene.add(key, key.target);
const KEY_DIR = new THREE.Vector3(-0.5, 1.0, 0.62).normalize();
const rim = new THREE.DirectionalLight(0xdfe7f5, 0.55); scene.add(rim, rim.target);   // cool rim from behind right
const RIM_DIR = new THREE.Vector3(0.75, 0.45, -0.8).normalize();
const hemi = new THREE.HemisphereLight(0xe9edf5, 0x0d0e11, 0.18); scene.add(hemi);

/* ================================================================== texture helpers (handed to the scene module) */
const R = rng(20261117);
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true, rep) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function softRectTexture(w, h, pad, alpha) {   // a blurred dark rectangle: contact shadows under objects
  const [c, g] = cnv(w, h);
  g.filter = `blur(${pad * 0.45}px)`; g.fillStyle = `rgba(0,0,0,${alpha})`;
  g.fillRect(pad, pad, w - 2 * pad, h - 2 * pad);
  g.filter = 'none';
  return tex(c);
}
function contactShadow(w, d, alpha = 0.8) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: softRectTexture(512, Math.max(64, Math.round(512 * d / w)), 26, alpha), transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}
function graphiteFloor(y, rep = 36) {   // a dark graphite slab: fine mineral grain in colour and roughness
  const S = LOW ? 512 : 1024, [c, g] = cnv(S, S), [cr, gr] = cnv(S, S);
  g.fillStyle = '#1a1b1f'; g.fillRect(0, 0, S, S);
  gr.fillStyle = 'rgb(150,150,150)'; gr.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000 * (S / 1024) ** 2; i++) {
    const x = R() * S, y2 = R() * S, r = 0.6 + R() * 2.2, v = R();
    g.fillStyle = v < 0.5 ? `rgba(40,42,48,${0.10 + R() * 0.12})` : `rgba(8,8,10,${0.10 + R() * 0.12})`;
    g.beginPath(); g.arc(x, y2, r, 0, 7); g.fill();
    gr.fillStyle = `rgba(${v < 0.5 ? 120 : 185},${v < 0.5 ? 120 : 185},${v < 0.5 ? 120 : 185},0.35)`;
    gr.beginPath(); gr.arc(x, y2, r, 0, 7); gr.fill();
  }
  for (let i = 0; i < 140; i++) { // soft cloudy variation
    const x = R() * S, y2 = R() * S, r = 40 + R() * 160;
    const rg = g.createRadialGradient(x, y2, 0, x, y2, r);
    rg.addColorStop(0, `rgba(${R() < 0.5 ? '34,35,40' : '10,10,12'},0.12)`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - r, y2 - r, 2 * r, 2 * r);
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex(c, true, [rep, rep]), roughnessMap: tex(cr, false, [rep, rep]),
    roughness: 0.82, metalness: 0.25, envMapIntensity: 0.32 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = y; floor.receiveShadow = true;
  return floor;
}

/* ================================================================== the scene module */
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const story = STORY_SCENE({
  THREE, scene, root, renderer, camera, low: LOW, envSoft: ENV_SOFT, font: FONT, aniso: ANISO,
  R, rng, cnv, tex, softRectTexture, contactShadow, graphiteFloor, clamp, lerp, sstep, ease, easeOut, V,
});
// story = { anchors: { name: () => Vector3 (root space) }, keys: [[p, anchor, d, az, el, pm, paz, pel], …],
//           events: [{ k, p, dur }], update({ p, ev, t, d, low, reduced }), warm?: [p…], ao?: (p) => 0..1 }

/* ================================================================== post */
// The scene is drawn with 4x MSAA into its own target and copied once; the passes after it run without MSAA.
class ScenePass extends Pass {
  constructor() {
    super(); this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader, depthTest: false, depthWrite: false, blending: THREE.NoBlending }));
  }
  setSize(w, h) { this.rt.setSize(w, h); }
  render(r, writeBuffer, readBuffer) {
    r.setRenderTarget(this.rt); r.render(scene, camera);
    this.quad.material.uniforms.tDiffuse.value = this.rt.texture;
    r.setRenderTarget(readBuffer); this.quad.render(r);
  }
}
const scenePass = new ScenePass();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
composer.addPass(scenePass);
let gtao = null, bokeh = null, aoScale = 1, dofScale = 1;
if (!LOW) {
  gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.updateGtaoMaterial({ radius: 0.25, distanceExponent: 1.4, thickness: 1, scale: 1.0, samples: 12, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.85;
  const aoSize = gtao.setSize.bind(gtao);   // AO can run at half size (bilinear upsample in its blend)
  gtao.setSize = (w, h) => aoSize(Math.max(1, Math.round(w * aoScale)), Math.max(1, Math.round(h * aoScale)));
  composer.addPass(gtao);
  bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.001, maxblur: 0.0085 });
  // pixels whose blur is under half a pixel are copied, not blurred with 41 taps (most of the frame is in focus)
  const mb = bokeh.materialBokeh;
  mb.uniforms.uPx = { value: 1e-3 };
  mb.fragmentShader = mb.fragmentShader.replace('uniform float aspect;', 'uniform float aspect;\nuniform float uPx;')
    .replace('vec2 dofblur9 = dofblur * 0.9;', 'if (abs(dofblur.x) < 0.5 * uPx) { gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0); return; }\nvec2 dofblur9 = dofblur * 0.9;');
  bokeh.setSize = (w, h) => {   // the depth it reads can be half size
    mb.uniforms.aspect.value = w / h; mb.uniforms.uPx.value = 1 / Math.max(1, w);
    bokeh.renderTargetDepth.setSize(Math.max(1, Math.round(w * dofScale)), Math.max(1, Math.round(h * dofScale)));
  };
  composer.addPass(bokeh);
}
composer.addPass(new OutputPass());
// last pass: a light vignette, a faint lift of the blacks, film grain, and (low tier or no Bokeh) a cheap edge blur
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.022 }, uVig: { value: 0.2 },
    uBlur: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uLift: { value: 0.07 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig, uBlur, uLift; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      if (uBlur > 0.001) { // cheap depth-of-field stand-in for small screens: soft toward the edges
        float r = uBlur * (0.25 + smoothstep(0.18, 0.75, length(d)));
        vec3 acc = c.rgb;
        for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398 + 0.39; acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r / uRes).rgb; }
        c.rgb = acc / 9.0;
      }
      float v = smoothstep(1.05, 0.25, length(d) * 1.05);
      c.rgb *= mix(1.0 - uVig, 1.0, v);
      c.rgb = mix(c.rgb, c.rgb + vec3(0.016, 0.017, 0.02) * (1.0 - c.rgb), uLift);
      c.rgb += (h(floor(vUv * uRes) + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = c;
    }` });
composer.addPass(finish);

/* ================================================================== camera choreography */
// A key: [p, anchor, d, az, el, pm, paz, pel]. d is the camera distance to the anchor, az/el the orbit angles (rad);
// pm, paz, pel are the portrait channel (distance factor, azimuth and elevation offsets), blended in below aspect 1.
// Distance is interpolated in log space and every channel with Fritsch–Carlson monotone cubic tangents, so the camera
// never overshoots a key (no bounce at a beat) and zooms feel even across scales.
const KEYS = story.keys;
const KP = KEYS.map(k => k[0]);
function monoTangents(ys) {
  const n = ys.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (KP[i + 1] - KP[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * (KP[i + 1] - KP[i]) + (KP[i] - KP[i - 1]), w2 = (KP[i + 1] - KP[i]) + 2 * (KP[i] - KP[i - 1]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return m;
}
const CH = { ld: KEYS.map(k => Math.log(k[2])), az: KEYS.map(k => k[3]), el: KEYS.map(k => k[4]),
  pm: KEYS.map(k => Math.log(k[5] ?? 1)), paz: KEYS.map(k => k[6] ?? 0), pel: KEYS.map(k => k[7] ?? 0) };
const CT = {};
for (const k in CH) CT[k] = monoTangents(CH[k]);
function herm(ch, i, u) {
  const h = KP[i + 1] - KP[i], y0 = CH[ch][i], y1 = CH[ch][i + 1], m0 = CT[ch][i] * h, m1 = CT[ch][i + 1] * h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * m1;
}
const cam = { tgt: V(), d: 1, az: 0, el: 0, pm: 1, paz: 0, pel: 0 };
const anchors = {};
function cameraAt(p) {
  for (const k in story.anchors) anchors[k] = story.anchors[k]();
  let i = 0; while (i < KEYS.length - 2 && p > KP[i + 1]) i++;
  const k1 = KEYS[i], k2 = KEYS[i + 1], u = clamp((p - k1[0]) / (k2[0] - k1[0]));
  const ld = herm('ld', i, u), d = Math.exp(ld);
  cam.az = herm('az', i, u); cam.el = herm('el', i, u); cam.d = d;
  const A = anchors[k1[1]], B = anchors[k2[1]];
  if (k1[1] === k2[1]) cam.tgt.copy(A);
  else {
    const r = Math.log(k1[2] / k2[2]); let w;
    if (Math.abs(r) > 0.7) { // a big zoom toward the next subject: it stays put on screen, then centres
      const a = 1.3;
      if (k2[2] < k1[2]) { const q = Math.pow(d / k1[2], a), q2 = Math.pow(k2[2] / k1[2], a); w = 1 - (q - q2) / (1 - q2); }
      else { const q = Math.pow(d / k2[2], a), q1 = Math.pow(k1[2] / k2[2], a); w = (q1 - q) / (q1 - 1); w = 1 - w; }
    } else w = ease(u);
    cam.tgt.copy(A).lerp(B, clamp(w));
  }
  cam.pm = Math.exp(herm('pm', i, u)); cam.paz = herm('paz', i, u); cam.pel = herm('pel', i, u);
}

/* ================================================================== events (time-driven, triggered by scroll) */
// An event's value runs 0 → 1 over dur seconds on the clock once p passes its point, and back when p goes below it.
// It always finishes, even if scrolling stops. Reduced motion: it jumps to its end.
const EV = story.events.map(e => ({ ...e, v: 0 }));
const evState = {};
function initEvents(p, evOverride) {
  let last = -1;
  EV.forEach((e, i) => { e.v = p >= e.p ? 1 : 0; if (p >= e.p) last = i; });
  if (evOverride != null && last >= 0) EV[last].v = clamp(evOverride);
}
function stepEvents(p, dt) {
  for (const e of EV) {
    const tg = p >= e.p ? 1 : 0;
    if (REDUCED) e.v = tg;
    else if (e.v < tg) e.v = Math.min(tg, e.v + dt / e.dur);
    else if (e.v > tg) e.v = Math.max(tg, e.v - dt / e.dur);
  }
}

/* ================================================================== frame */
let W = 0, H = 0, VW = stage.clientWidth, VH = stage.clientHeight, FORCE = null;
// the stage size is read when it changes (after layout), never in a frame
new ResizeObserver(() => { VW = stage.clientWidth; VH = stage.clientHeight; }).observe(stage);
function resize() {
  const w = FORCE ? FORCE[0] : VW, h = FORCE ? FORCE[1] : VH;
  if (w === W && h === H) return;
  W = w; H = h;
  renderer.setSize(w, h, false); composer.setPixelRatio(pixelRatio); composer.setSize(w, h);
  finish.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
  camera.aspect = w / h;
}
let tNow = qT != null ? qT : 0, clockRun = !(REDUCED || qT != null);
let pS = 0, frames = 0, END = 0, LIGHT = false;
RMQ.addEventListener && RMQ.addEventListener('change', e => { REDUCED = e.matches; clockRun = !(REDUCED || qT != null); });

const sweepQ = new THREE.Quaternion(), ax = V(0, 1, 0);

function draw(p) {
  if (!FORCE && (!VW || !VH)) { VW = stage.clientWidth; VH = stage.clientHeight; if (!VW || !VH) return; }   // hidden stage
  resize();
  const portrait = camera.aspect < 0.8;
  for (const e of EV) evState[e.k] = e.v;
  const drift = clockRun || qT != null ? tNow : 0;

  // --- objects (root space), then the camera, then a floating origin at the target
  root.position.set(0, 0, 0); root.quaternion.identity(); root.updateMatrixWorld(true);
  story.update({ p, ev: evState, t: drift, d: cam.d, low: LOW, reduced: REDUCED, portrait });
  root.updateMatrixWorld(true);
  cameraAt(p);
  // arrival: a 2.5 s dolly-in (distance ×1.38 → 1) with a small swing, and a focus pull below
  const A = (ARRIVE || REDUCED) ? 1 : easeOut(tNow / 2.5);
  let d = cam.d, az = cam.az + 0.11 * Math.sin(drift * 0.09) - 0.16 * (1 - A), el = cam.el + 0.018 * Math.sin(drift * 0.07 + 1.0) + 0.05 * (1 - A);
  d *= 1 + 0.38 * (1 - A);
  // portrait framing: wider lens, per-key distance and angle, subject lifted above the headline
  const kp = sstep(1.0, 0.62, camera.aspect);
  const fov = lerp(30, 46, kp), shiftY = 0.07 * kp;
  d *= Math.pow(cam.pm, kp); az += cam.paz * kp; el += cam.pel * kp;
  // the turntable sweep: the object turns slowly under fixed soft boxes, so highlights travel across it (~0.01 rad/s)
  const sweep = 0.24 * Math.sin(drift * 0.045 + 0.4) - 0.24 * Math.sin(0.4);
  sweepQ.setFromAxisAngle(ax, sweep);
  root.quaternion.copy(sweepQ);
  root.position.copy(cam.tgt).applyQuaternion(sweepQ).negate();
  const ce = Math.cos(el);
  camera.position.set(Math.sin(az) * ce, Math.sin(el), Math.cos(az) * ce).multiplyScalar(d);
  camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
  camera.fov = fov; camera.near = d * 0.012; camera.far = d * 140;
  camera.updateProjectionMatrix();
  if (shiftY) { camera.projectionMatrix.elements[9] -= 2 * shiftY; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  if (story.afterCamera) story.afterCamera({ p, d, camera, ev: evState });

  // lights and fog follow the subject's scale, so every beat is lit and framed alike
  key.position.copy(KEY_DIR).multiplyScalar(d * 4); key.target.position.set(0, 0, 0);
  const sc = key.shadow.camera, ext = d * (portrait ? 1.9 : 1.5);
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = d * 0.5; sc.far = d * 9; sc.updateProjectionMatrix();
  key.shadow.normalBias = d * 0.0012;
  key.updateMatrixWorld(); key.target.updateMatrixWorld();
  rim.position.copy(RIM_DIR).multiplyScalar(d * 4); rim.target.position.set(0, 0, 0);
  scene.fog.near = d * 2.2; scene.fog.far = d * 11;

  // depth of field follows the subject; on load the focus pulls from soft to sharp
  const soft = 1 - A;
  if (bokeh) {
    bokeh.uniforms.focus.value = d * (1 + 0.45 * soft);
    bokeh.uniforms.aperture.value = (0.0075 + 0.03 * soft) / d * (portrait ? 0.7 : 1);
    bokeh.uniforms.maxblur.value = 0.0085 + 0.008 * soft;
  }
  if (gtao) {
    const ao = story.ao ? clamp(story.ao(p)) : 1;   // a scene can fade AO out where it shades itself
    gtao.enabled = fx >= 2 && ao > 0.01; gtao.blendIntensity = 0.85 * ao;
    if (gtao.enabled) gtao.updateGtaoMaterial({ radius: d * 0.045, thickness: d * 0.03 });
  }
  // the end: the picture brightens (strongly in light mode, where it washes out to the page) and softens
  const E = END;
  renderer.toneMappingExposure = 1 + (LIGHT ? 2.6 * E * E : 0.5 * E);
  finish.uniforms.uVig.value = 0.2 * (1 - E); finish.uniforms.uGrain.value = 0.022 * (1 - E);
  if (bokeh) bokeh.uniforms.aperture.value *= 1 + 3 * E;
  finish.uniforms.uBlur.value = (!bokeh || !bokeh.enabled) ? 1.1 + 6 * soft + 5 * E : 0;
  finish.uniforms.uTime.value = drift;

  renderer.shadowMap.needsUpdate = true;
  composer.render();
}

let first = true;
/* One frame at scroll progress p (already smoothed by intro.js), dt seconds after the last drawn one.
   o.end: the fade into the page (0 → 1), o.light: the page is light, o.idle: nothing moves (frames come at 30 a second,
   so they do not count for the adaptive step) */
function frame(p, dt, o = {}) {
  if (first) { first = false; initEvents(p, qEv); } // events behind the start point are already done
  pS = p; END = o.end || 0; LIGHT = !!o.light;
  if (clockRun) tNow += dt;
  stepEvents(p, clockRun ? dt : 0);
  draw(p);
  frames++;
  if (frames === 1) canvas.style.visibility = '';
  if (ADAPT && clockRun && !o.idle) adapt(dt);
}

/* ------------------------------------------------------------------ quality */
let fx = -1;
function setFx(l) {   // 3 full · 2 half-size AO and depth-of-field depth · 1 no AO · 0 neither (edge blur instead)
  fx = l; aoScale = dofScale = fx >= 3 ? 1 : 0.5;
  if (gtao) gtao.enabled = fx >= 2;
  if (bokeh) bokeh.enabled = fx >= 1;
  W = H = 0;          // resize() sets every pass size again
}
setFx(FX0);
function setPR(pr) { pixelRatio = pr; renderer.setPixelRatio(pr); W = H = 0; }
// A frame is late past 1.4 frames at 60 Hz. Three late frames in a row, or a slow average over 20, lower the quality one
// step at once; 90 quick frames raise the resolution a little, never above the last level that was too slow.
const LATE = 0.0235, SLOW = 0.0195, EASY = 0.0125, WIN = 20;
let late = 0, win = [], hold = 45, easy = 0, prCeil = PR_TOP;
function adapt(dt) {
  if (hold > 0) { hold--; return; }   // the first frames, and the frames right after a change
  win.push(dt); if (win.length > WIN) win.shift();
  late = dt > LATE ? late + 1 : 0;
  const avg = win.length === WIN ? win.reduce((a, b) => a + b, 0) / WIN : 0;
  if (late >= 3 || avg > SLOW) { lower(avg > 0.045 || dt > 0.045); late = 0; win = []; easy = 0; hold = 10; return; }
  if (avg && avg < EASY && pixelRatio < prCeil - 0.01) {
    if (++easy >= 90) { setPR(Math.min(prCeil, pixelRatio * 1.08)); easy = 0; win = []; hold = 10; }
  } else easy = 0;
}
function lower(severe) {
  if (fx === 3) return setFx(2);
  if (pixelRatio > 1.01) { prCeil = pixelRatio * 0.97; return setPR(Math.max(1, pixelRatio * 0.82)); }
  if (fx > 0) return setFx(fx - 1);
  if (severe && pixelRatio > PR_MIN + 0.01) { prCeil = pixelRatio * 0.97; setPR(Math.max(PR_MIN, pixelRatio * 0.85)); }
}
/* true while something moves on the clock (the arrival, an event); otherwise intro.js draws 30 frames a second */
const busy = () => clockRun && ((!ARRIVE && tNow < 2.6) || EV.some(e => e.v > 0 && e.v < 1));

/* ------------------------------------------------------------------ warm-up */
// Every program is compiled before the first frame, so none compiles mid-scroll (a hitch of 0.1 s to seconds): first all
// materials, in parallel where the browser can, bound to the scene target so the variants match (linear, no tone
// mapping); then one tiny frame at each beat, with AO and depth of field on, for the shadow, AO and depth variants,
// objects that only show after an event, and the texture uploads.
async function warm() {
  renderer.setRenderTarget(scenePass.rt);
  const par = renderer.extensions.has('KHR_parallel_shader_compile');
  const ready = par ? renderer.compileAsync(scene, camera) : (renderer.compile(scene, camera), null);
  renderer.setRenderTarget(null);
  if (ready) try { await Promise.race([ready, new Promise(r => setTimeout(r, 8000))]); } catch (e) { /* compiled on first use */ }
  const evs = EV.map(e => e.v), f = fx;
  if (gtao) gtao.enabled = true;
  if (bokeh) bokeh.enabled = true;
  FORCE = [32, Math.max(8, Math.round(32 * VH / Math.max(1, VW)))];
  const points = story.warm || [...new Set([...KP, ...KP.slice(1).map((p, i) => (p + KP[i]) / 2)])].sort((a, b) => a - b);
  for (const p of points) {
    for (const e of EV) e.v = p < e.p ? 0 : p - e.p < 0.02 ? 0.5 : 1;
    for (const e of EV) evState[e.k] = e.v;
    draw(p);
  }
  EV.forEach((e, i) => { e.v = evs[i]; });
  FORCE = null; setFx(f);
}
await warm();

/* Replay (the site name in the header): back to the first frame, with the arrival move again */
function restart() {
  ARRIVE = false; first = true; hold = Math.max(hold, 20); late = 0; win = [];
  if (clockRun) tNow = 0;
}
/* With ?t= the clock is frozen and nothing draws on its own: snap({ p, t, ev, end, light }) draws one frame
   (stills, posters, the metrics run). */
const SNAP = qT != null;
function snap(o = {}) {
  return new Promise(res => {
    if ('p' in o) { pS = o.p; initEvents(o.p, o.ev); first = false; }
    if ('t' in o) tNow = o.t;
    if ('end' in o) END = clamp(o.end);
    if ('light' in o) LIGHT = !!o.light;
    draw(pS); frames++; canvas.style.visibility = '';
    requestAnimationFrame(() => requestAnimationFrame(() => res(true)));
  });
}
export default { frame, restart, snap, busy, snapMode: SNAP, tier: LOW ? 'low' : 'high', frames: () => frames,
  quality: () => ({ gpu: GPU, fx, pr: +pixelRatio.toFixed(3), programs: renderer.info.programs.length }) };
