/* Example scene: "Example device". A small aluminium device on a graphite slab opens into its layers, then the camera
   dives onto one chip whose metal lid lifts off to show the silicon die. Four beats (intro-story.js):
     p 0.00  Example Lab   the closed device, a three-quarter hero view
     p 0.20  Open It Up    event "lid" (p 0.18, 1.1 s): the bead-blasted aluminium lid lifts and slides back; the copper plate shows
     p 0.50  Every Layer   event "layers" (p 0.47, 1.2 s): battery, board, plate and lid rise apart; a low side view
     p 0.80  One Chip      scroll 0.70 → 0.82 takes the upper layers away; event "chip" (p 0.84, 1.2 s) lifts the chip's
                           heat spreader and fades it, the iridescent die stays (the hold)
   Everything is procedural: geometry from three.js primitives, every map a CanvasTexture drawn here. Units: about 10 cm.
   The module exports one function: build(ctx) → { anchors, keys, events, update, afterCamera?, ao?, warm? }.
   ctx comes from intro-scene.js (THREE, root, low tier flag, texture helpers, easing). */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export default function build(ctx) {
  const { THREE, root, low, envSoft, font, cnv, tex, rng, contactShadow, graphiteFloor, clamp, sstep, ease, easeOut, V } = ctx;
  const R = rng(4242);

  /* ---------------------------------------------------------------- shapes */
  const W = 3.2, D = 2.2, RC = 0.22;            // device footprint and corner radius
  function rrect(path, w, d, r) {               // a rounded rectangle centred on 0, in shape coordinates (x, y)
    const x0 = -w / 2, y0 = -d / 2, x1 = w / 2, y1 = d / 2;
    path.moveTo(x0 + r, y0); path.lineTo(x1 - r, y0); path.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
    path.lineTo(x1, y1 - r); path.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
    path.lineTo(x0 + r, y1); path.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
    path.lineTo(x0, y0 + r); path.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    return path;
  }
  // a slab from a rounded rectangle, standing on y = 0, h tall. Group 0 = top and bottom faces (UV = x, -z),
  // group 1 = walls and bevel. Maps for group 0 use mapTex(): canvas x → world x, canvas y → world z (back at the top).
  function slab(w, d, h, r, bev = 0.01, hole = null) {
    const s = rrect(new THREE.Shape(), w, d, r);
    if (hole) s.holes.push(rrect(new THREE.Path(), hole[0], hole[1], hole[2]));
    const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bev, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev,
      bevelSegments: low ? 2 : 4, curveSegments: low ? 12 : 24 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0);
    return g;
  }
  function mapTex(c, w, d, srgb = true) { const t = tex(c, srgb); t.repeat.set(1 / w, 1 / d); t.offset.set(0.5, 0.5); return t; }

  /* ---------------------------------------------------------------- textures */
  function brushed(n = 900, base = 120) {     // roughness streaks of brushed or anodized metal
    const [c, g] = cnv(512, 512); g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < n; i++) { const v = 70 + Math.round(R() * 100); g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(0, R() * 512, 512, 0.5 + R() * 1.4); }
    const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function milled() {                          // face-milling arcs on the inner floor
    const [c, g] = cnv(1024, 1024); g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, 1024, 1024);
    for (let k = 0; k < 7; k++) {
      const cx = 150 + k * 140, cy = -380;
      for (let r = 380; r < 1500; r += 3 + R() * 3) { const v = 110 + Math.round(R() * 80); g.strokeStyle = `rgba(${v},${v},${v},0.16)`; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0.2, Math.PI - 0.2); g.stroke(); }
    }
    return tex(c, false);
  }
  function datamatrix(g, x0, y0, cs, n, seed, col) {
    const rr = rng(seed); g.fillStyle = col;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (rr() < 0.5 || i === 0 || j === n - 1) g.fillRect(x0 + i * cs, y0 + j * cs, cs * 0.92, cs * 0.92);
  }

  /* ---------------------------------------------------------------- materials */
  const BR = brushed();
  function blasted() {                         // bead-blasted aluminium: a fine, even speckle in the roughness
    const [c, g] = cnv(512, 512); g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 26000; i++) { const v = 100 + Math.round(R() * 60); g.fillStyle = `rgba(${v},${v},${v},0.6)`; g.fillRect(R() * 512, R() * 512, 1.2, 1.2); }
    const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
  }
  const BL = blasted();
  const anod = new THREE.MeshPhysicalMaterial({ envMap: envSoft, color: '#b7bbc1', metalness: 1, roughness: 0.82, roughnessMap: BL, envMapIntensity: 1.05 });
  const anodDark = new THREE.MeshPhysicalMaterial({ color: '#5d6168', metalness: 1, roughness: 0.4, roughnessMap: BR, envMapIntensity: 1.0 });
  const diamondCut = new THREE.MeshPhysicalMaterial({ envMap: envSoft, color: '#c3c7cd', metalness: 1, roughness: 0.16, envMapIntensity: 1.25 });
  const floorIn = new THREE.MeshStandardMaterial({ color: '#3d4047', metalness: 0.9, roughness: 0.55, roughnessMap: milled(), envMapIntensity: 0.8 });
  const copper = new THREE.MeshPhysicalMaterial({ envMap: envSoft, color: '#cf8f69', metalness: 1, roughness: 0.3, roughnessMap: brushed(700, 110), envMapIntensity: 1.1 });
  const tinMat = new THREE.MeshStandardMaterial({ color: '#c9ccce', metalness: 1, roughness: 0.32 });
  const goldMat = new THREE.MeshPhysicalMaterial({ color: '#f0c873', metalness: 1, roughness: 0.38, envMapIntensity: 1.1 });
  const screwMat = new THREE.MeshPhysicalMaterial({ envMap: envSoft, color: '#9a9ea5', metalness: 1, roughness: 0.25 });

  /* ---------------------------------------------------------------- the device */
  const dev = new THREE.Group(); root.add(dev);
  root.add(graphiteFloor(-0.002));
  const shadow = contactShadow(W + 0.9, D + 0.9, 0.85); shadow.position.y = 0.0005; root.add(shadow);

  // the frame: anodized walls with a diamond-cut top edge, and the milled floor inside
  const FRAME_H = 0.34;
  const frame = new THREE.Mesh(slab(W, D, FRAME_H, RC, 0.022, [W - 0.16, D - 0.16, RC - 0.08]), [diamondCut, anod]);
  frame.castShadow = frame.receiveShadow = true; dev.add(frame);
  const bottom = new THREE.Mesh(slab(W - 0.12, D - 0.12, 0.04, RC - 0.06, 0.004), [floorIn, anod]);
  bottom.receiveShadow = true; dev.add(bottom);
  { // four screw bosses in the corners
    const g = new THREE.CylinderGeometry(0.06, 0.07, 0.12, low ? 16 : 28);
    const im = new THREE.InstancedMesh(g, anodDark, 4), m = new THREE.Matrix4(); let i = 0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { m.makeTranslation(sx * (W / 2 - 0.26), 0.1, sz * (D / 2 - 0.26)); im.setMatrixAt(i++, m); }
    im.castShadow = im.receiveShadow = true; dev.add(im);
  }

  // battery: a soft foil pouch with a printed label
  const battery = new THREE.Group(); dev.add(battery);
  {
    const BW = 2.5, BD2 = 1.5, s = 400, [c, g] = cnv(Math.round(BW * s), Math.round(BD2 * s));
    g.fillStyle = '#2f3238'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 2500; i++) { const v = 36 + Math.round(R() * 18); g.fillStyle = `rgba(${v},${v + 2},${v + 6},0.35)`; g.fillRect(R() * c.width, R() * c.height, 2, 2); }
    g.fillStyle = 'rgba(206,209,214,0.85)'; g.fillRect(0.16 * s, 0.18 * s, 1.1 * s, 0.62 * s);
    g.fillStyle = '#2f3238'; g.textBaseline = 'top';
    g.font = `700 ${0.11 * s}px ${font}`; g.fillText('Li-ion  3.85 V', 0.24 * s, 0.25 * s);
    g.font = `500 ${0.07 * s}px ${font}`; g.fillText('EXAMPLE LAB  ·  EX-BAT-01', 0.24 * s, 0.44 * s); g.fillText('4000 mAh  ·  15.4 Wh', 0.24 * s, 0.56 * s);
    datamatrix(g, 1.02 * s, 0.25 * s, 0.017 * s, 12, 3, '#2f3238');
    const top = new THREE.MeshPhysicalMaterial({ map: mapTex(c, BW, BD2), color: '#ffffff', metalness: 0.45, roughness: 0.5, envMapIntensity: 0.9 });
    const side = new THREE.MeshStandardMaterial({ color: '#2c2f35', metalness: 0.6, roughness: 0.45 });
    const m = new THREE.Mesh(slab(BW, BD2, 0.07, 0.05, 0.012), [top, side]); m.position.set(0.05, 0, 0); m.castShadow = m.receiveShadow = true; battery.add(m);
  }

  // the board
  const PW = 2.8, PD = 1.8, PT = 0.03;
  const CHIP = { x: -0.38, z: 0.06, w: 0.62, d: 0.62 };     // the main chip
  const MEM = [{ x: 0.62, z: -0.42 }, { x: 0.62, z: 0.46 }];  // two memory packages 0.52 × 0.36
  const PM = { x: 1.12, z: 0.02 };                           // a small power chip 0.22
  const pcb = new THREE.Group(); dev.add(pcb);
  const PASS = [], PADS = [];
  {
    const add = (x, z, rot, k) => PASS.push([x, z, rot, k]);
    for (let i = 0; i < 9; i++) add(CHIP.x - 0.3 + i * 0.075, CHIP.z - 0.43, 0, i % 3 ? 'C' : 'R');
    for (let i = 0; i < 9; i++) add(CHIP.x - 0.3 + i * 0.075, CHIP.z + 0.43, 0, i % 2 ? 'C' : 'R');
    for (let i = 0; i < 7; i++) add(CHIP.x - 0.45, CHIP.z - 0.24 + i * 0.08, 1, 'C');
    for (let i = 0; i < 6; i++) add(0.24, -0.25 + i * 0.1, 1, i % 2 ? 'R' : 'C');
    for (let i = 0; i < 5; i++) add(PM.x - 0.18 + i * 0.09, PM.z + 0.2, 0, 'C');
    for (let i = 0; i < 5; i++) add(PM.x - 0.18 + i * 0.09, PM.z - 0.2, 0, 'C');
    for (let i = 0; i < 8; i++) add(-1.2 + i * 0.07, -0.72, 0, i % 3 ? 'C' : 'R');
    for (let i = 0; i < 8; i++) add(-1.2 + i * 0.07, 0.72, 0, i % 2 ? 'C' : 'R');
    for (const [x, z, rot] of PASS) {
      const L = 0.05, dx = rot ? 0 : L * 0.38, dz = rot ? L * 0.38 : 0, pw = rot ? 0.028 : 0.018, pd = rot ? 0.018 : 0.028;
      PADS.push([x - dx, z - dz, pw, pd], [x + dx, z + dz, pw, pd]);
    }
  }
  {
    const Wc = low ? 1400 : 2400, s = Wc / PW, Hc = Math.round(PD * s);
    const X = x => (x + PW / 2) * s, Z = z => (z + PD / 2) * s;
    const [c, g] = cnv(Wc, Hc), [cb, gb] = cnv(Wc / 2, Hc / 2), [cr, gr] = cnv(Wc / 2, Hc / 2);
    gb.scale(0.5, 0.5); gr.scale(0.5, 0.5);
    g.fillStyle = '#0d1612'; g.fillRect(0, 0, Wc, Hc); gb.fillStyle = '#000'; gb.fillRect(0, 0, Wc, Hc); gr.fillStyle = 'rgb(118,118,118)'; gr.fillRect(0, 0, Wc, Hc);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R() < .5 ? '22,36,29' : '6,11,9'},${0.05 + R() * 0.06})`; const r = 15 + R() * 90; g.beginPath(); g.arc(R() * Wc, R() * Hc, r, 0, 7); g.fill(); }
    for (let i = 0; i < 14000; i++) { const v = 96 + Math.round(R() * 52); gr.fillStyle = `rgba(${v},${v},${v},0.5)`; gr.fillRect(R() * Wc, R() * Hc, 2 + R() * 3, 2 + R() * 3); }
    const path = (ctx2, pts) => { ctx2.beginPath(); pts.forEach(([x, z], i) => i ? ctx2.lineTo(X(x), Z(z)) : ctx2.moveTo(X(x), Z(z))); };
    const trace = (pts, w = 0.006) => {   // copper under the mask: darker, raised, a little glossier
      g.strokeStyle = '#08100c'; g.lineWidth = w * s; g.lineJoin = g.lineCap = 'round'; path(g, pts); g.stroke();
      g.strokeStyle = 'rgba(40,64,50,0.35)'; g.lineWidth = w * s * 0.35; path(g, pts); g.stroke();
      gb.strokeStyle = '#fff'; gb.lineWidth = w * s * 1.15; gb.lineJoin = gb.lineCap = 'round'; path(gb, pts); gb.stroke();
      gr.strokeStyle = 'rgb(70,70,70)'; gr.lineWidth = w * s; path(gr, pts); gr.stroke();
    };
    const via = (x, z, r = 0.012) => {
      g.fillStyle = '#16241c'; g.beginPath(); g.arc(X(x), Z(z), r * s, 0, 7); g.fill();
      g.fillStyle = '#020403'; g.beginPath(); g.arc(X(x), Z(z), r * 0.42 * s, 0, 7); g.fill();
      gb.fillStyle = '#fff'; gb.beginPath(); gb.arc(X(x), Z(z), r * s, 0, 7); gb.fill();
    };
    // bundles from the main chip to the memory packages and the edge connector, with 45° jogs
    for (let k = 0; k < 14; k++) { const z = CHIP.z - 0.28 + k * 0.04; trace([[CHIP.x + 0.36, z], [0.08, z], [0.18, z - 0.1 - k * 0.004], [0.34, z - 0.1 - k * 0.004]]); }
    for (let k = 0; k < 12; k++) { const x = CHIP.x - 0.25 + k * 0.045; trace([[x, CHIP.z - 0.36], [x, -0.62], [x + 0.12, -0.74], [x + 0.12, -0.86]]); trace([[x, CHIP.z + 0.36], [x, 0.62], [x - 0.1, 0.72], [x - 0.1, 0.86]]); }
    for (let k = 0; k < 10; k++) { const z = -0.3 + k * 0.065; trace([[0.95, z], [1.15, z], [1.2, z + 0.03], [1.36, z + 0.03]]); }
    for (let i = 0; i < 60; i++) { const x = -1.3 + R() * 2.6, z = (R() < .5 ? -1 : 1) * (0.55 + R() * 0.3), l = 0.05 + R() * 0.14; trace([[x, z], [x + l, z], [x + l + 0.03, z + (R() < .5 ? .03 : -.03)]], 0.005); via(x, z); }
    for (let x = -1.3; x < 1.3; x += 0.08) { via(x, -0.86, 0.01); via(x + 0.04, 0.86, 0.01); }
    for (const [x, z, w, d] of PADS) {
      g.fillStyle = '#a9adae'; g.fillRect(X(x - w / 2), Z(z - d / 2), w * s, d * s);
      gb.fillStyle = '#ccc'; gb.fillRect(X(x - w / 2), Z(z - d / 2), w * s, d * s);
      gr.fillStyle = 'rgb(60,60,60)'; gr.fillRect(X(x - w / 2), Z(z - d / 2), w * s, d * s);
    }
    // silkscreen: corner marks, reference designators, the board name
    const silk = 'rgba(226,228,222,0.92)';
    for (const ctx2 of [g, gr, gb]) { ctx2.strokeStyle = ctx2.fillStyle = ctx2 === g ? silk : ctx2 === gr ? 'rgb(205,205,205)' : '#8a8a8a'; ctx2.lineWidth = 0.004 * s; }
    const both = fn => { fn(g); fn(gr); fn(gb); };
    const outline = (x, z, w, d, m = 0.03) => both(ctx2 => {
      const x0 = X(x - w / 2 - m), z0 = Z(z - d / 2 - m), ww = (w + 2 * m) * s, dd = (d + 2 * m) * s, k = 0.07 * s;
      ctx2.beginPath();
      for (const [px, pz, sx, sz] of [[x0, z0, 1, 1], [x0 + ww, z0, -1, 1], [x0, z0 + dd, 1, -1], [x0 + ww, z0 + dd, -1, -1]]) { ctx2.moveTo(px + sx * k, pz); ctx2.lineTo(px, pz); ctx2.lineTo(px, pz + sz * k); }
      ctx2.stroke();
    });
    outline(CHIP.x, CHIP.z, CHIP.w, CHIP.d); MEM.forEach(m => outline(m.x, m.z, 0.52, 0.36)); outline(PM.x, PM.z, 0.22, 0.22, 0.02);
    const lab = (t, x, z, size = 0.045) => both(ctx2 => { ctx2.font = `600 ${size * s}px ${font}`; ctx2.textBaseline = 'middle'; ctx2.fillText(t, X(x), Z(z)); });
    lab('U1', CHIP.x - 0.36, CHIP.z - 0.36); lab('U2', MEM[0].x - 0.3, MEM[0].z - 0.24); lab('U3', MEM[1].x - 0.3, MEM[1].z + 0.25); lab('U4', PM.x - 0.14, PM.z - 0.15, 0.035);
    lab('EXAMPLE LAB  ·  EX-MB  REV A', -1.28, -0.78, 0.04); lab('J1', 1.2, -0.8, 0.04);
    const top = new THREE.MeshPhysicalMaterial({ map: mapTex(c, PW, PD), bumpMap: mapTex(cb, PW, PD, false), bumpScale: 2.0, roughnessMap: mapTex(cr, PW, PD, false),
      roughness: 1.0, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });
    const fr4 = new THREE.MeshStandardMaterial({ color: '#3a3a2c', roughness: 0.85 });
    const board = new THREE.Mesh(slab(PW, PD, PT, 0.06, 0.004), [top, fr4]); board.castShadow = board.receiveShadow = true; pcb.add(board);
    // gold edge fingers along the right edge
    const fg = new THREE.BoxGeometry(0.14, 0.004, 0.022), n = 22, im = new THREE.InstancedMesh(fg, goldMat, n), m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m.makeTranslation(PW / 2 - 0.09, PT + 0.001, -0.5 + i * (1.0 / (n - 1))); im.setMatrixAt(i, m); }
    im.receiveShadow = true; pcb.add(im);
  }
  // passives: ceramic capacitors and black resistors with tin ends
  {
    const body = new THREE.BoxGeometry(0.05, 0.024, 0.026), cap = new THREE.BoxGeometry(0.011, 0.026, 0.028);
    const capM = new THREE.MeshStandardMaterial({ color: '#b59f80', roughness: 0.6 }), resM = new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.5 });
    const caps = PASS.filter(q => q[3] === 'C'), ress = PASS.filter(q => q[3] === 'R');
    const ic = new THREE.InstancedMesh(body, capM, caps.length), ir = new THREE.InstancedMesh(body, resM, ress.length), it = new THREE.InstancedMesh(cap, tinMat, PASS.length * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(1, 1, 1), up = V(0, 1, 0);
    const place = (im, list) => list.forEach(([x, z, rot], i) => { q.setFromAxisAngle(up, rot ? Math.PI / 2 : 0); m.compose(V(x, PT + 0.012, z), q, sc); im.setMatrixAt(i, m); });
    place(ic, caps); place(ir, ress);
    PASS.forEach(([x, z, rot], i) => { for (const sgn of [-1, 1]) { q.setFromAxisAngle(up, rot ? Math.PI / 2 : 0); m.compose(V(x + (rot ? 0 : sgn * 0.022), PT + 0.013, z + (rot ? sgn * 0.022 : 0)), q, sc); it.setMatrixAt(i * 2 + (sgn > 0 ? 1 : 0), m); } });
    for (const im of [ic, ir, it]) { im.castShadow = true; pcb.add(im); }
  }
  // black mold packages with laser markings
  function moldPkg(x, z, w, d, h, lines, seed) {
    const s = 1024 / w, [c, g] = cnv(1024, Math.round(d * s)), [cr, gr] = cnv(1024, Math.round(d * s));
    g.fillStyle = '#17181b'; g.fillRect(0, 0, c.width, c.height); gr.fillStyle = 'rgb(196,196,196)'; gr.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 16000; i++) { const px = R() * c.width, py = R() * c.height, a = R();
      g.fillStyle = a < 0.5 ? `rgba(44,45,50,${0.25 + R() * 0.3})` : `rgba(6,6,7,${0.25 + R() * 0.3})`; g.fillRect(px, py, 1.4, 1.4);
      const v = 150 + Math.round(R() * 90); gr.fillStyle = `rgba(${v},${v},${v},0.7)`; gr.fillRect(px, py, 1.6, 1.6); }
    const mark = (ctx2, col) => { ctx2.fillStyle = col; ctx2.textBaseline = 'top'; let y = c.height * 0.26;
      lines.forEach(([t, size, wt]) => { ctx2.font = `${wt || 500} ${size}px ${font}`; ctx2.fillText(t, 1024 * 0.1, y); y += size * 1.3; });
      ctx2.beginPath(); ctx2.arc(1024 * 0.07, c.height * 0.13, 1024 * 0.022, 0, 7); ctx2.fill(); };
    mark(g, 'rgba(120,122,126,0.55)'); mark(gr, 'rgb(118,118,118)');
    datamatrix(g, 1024 * 0.74, c.height * 0.56, 1024 * 0.012, 12, seed, 'rgba(120,122,126,0.55)');
    const top = new THREE.MeshPhysicalMaterial({ map: mapTex(c, w, d), roughnessMap: mapTex(cr, w, d, false), color: '#ffffff', roughness: 1, metalness: 0, envMapIntensity: 0.8 });
    const side = new THREE.MeshPhysicalMaterial({ color: '#17181b', roughness: 0.85, metalness: 0 });
    const mesh = new THREE.Mesh(slab(w, d, h, 0.012, 0.006), [top, side]); mesh.position.set(x, PT, z); mesh.castShadow = mesh.receiveShadow = true; pcb.add(mesh);
    return mesh;
  }
  MEM.forEach((m, i) => moldPkg(m.x, m.z, 0.52, 0.36, 0.05, [['EXM 4G16', 84, 600], ['2547  A' + (i + 1), 62]], 20 + i));
  moldPkg(PM.x, PM.z, 0.22, 0.22, 0.04, [['PM', 220, 700]], 7);

  // the main chip: substrate, silicon die, and a nickel heat spreader that lifts off in the last beat
  const chip = new THREE.Group(); chip.position.set(CHIP.x, PT, CHIP.z); pcb.add(chip);
  const SUB_H = 0.026, DIE_H = 0.014, DIE_W = 0.36;
  {
    // substrate: dark solder mask with a ring of pads and fine fan-out traces
    {
      const S2 = 512, [c, g] = cnv(S2, S2), k = S2 / CHIP.w;
      g.fillStyle = '#1d2419'; g.fillRect(0, 0, S2, S2);
      for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${R() < .5 ? '40,50,34' : '10,14,9'},0.25)`; g.beginPath(); g.arc(R() * S2, R() * S2, 2 + R() * 9, 0, 7); g.fill(); }
      // fan-out: short traces leave each die edge straight, then jog 45° toward the package corners
      g.strokeStyle = 'rgba(56,68,46,0.95)'; g.lineWidth = 1.4; g.lineCap = 'round';
      const c0 = S2 / 2, e0 = 0.19 * k, e1 = 0.235 * k, e2 = 0.275 * k;
      for (let side = 0; side < 4; side++) for (let i = -7; i <= 7; i++) {
        const t = i * 0.022 * k, jog = Math.sign(i) * (e2 - e1) * 0.8;
        const pts = [[t, -e0], [t, -e1], [t + jog, -e2]].map(([x, y]) => side === 0 ? [x, y] : side === 1 ? [-y, x] : side === 2 ? [-x, -y] : [y, -x]);
        g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(c0 + x, c0 + y) : g.moveTo(c0 + x, c0 + y))); g.stroke();
      }
      g.fillStyle = '#8f8566'; g.font = `600 ${0.022 * k}px ${font}`; g.fillText('EX-1', 0.035 * k, 0.05 * k);
      const subMat = new THREE.MeshPhysicalMaterial({ map: tex(c), color: '#ffffff', roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.3 });
      const subSide = new THREE.MeshPhysicalMaterial({ color: '#2b2a22', roughness: 0.7 });
      const sub = new THREE.Mesh(new THREE.BoxGeometry(CHIP.w, SUB_H, CHIP.d), [subSide, subSide, subMat, subSide, subSide, subSide]);
      sub.position.y = SUB_H / 2; sub.castShadow = sub.receiveShadow = true; chip.add(sub);
    }
    // small decoupling capacitors around the die: ceramic bodies with tin ends
    {
      const body = new RoundedBoxGeometry(0.022, 0.012, 0.013, 2, 0.002), end = new RoundedBoxGeometry(0.006, 0.013, 0.014, 2, 0.002);
      const n = 20, ib = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ color: '#9b8a6f', roughness: 0.55 }), n), ie = new THREE.InstancedMesh(end, tinMat, n * 2);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1), up = V(0, 1, 0);
      for (let i = 0; i < n; i++) {
        const side = i % 4, j = Math.floor(i / 4) - 2, r = 0.255, rot = side > 1;
        const [x, z] = side === 0 ? [j * 0.07, -r] : side === 1 ? [j * 0.07, r] : side === 2 ? [-r, j * 0.07] : [r, j * 0.07];
        q.setFromAxisAngle(up, rot ? Math.PI / 2 : 0);
        m.compose(V(x, SUB_H + 0.006, z), q, one); ib.setMatrixAt(i, m);
        for (const sg of [-1, 1]) { m.compose(V(x + (rot ? 0 : sg * 0.012), SUB_H + 0.0065, z + (rot ? sg * 0.012 : 0)), q, one); ie.setMatrixAt(i * 2 + (sg > 0 ? 1 : 0), m); }
      }
      ib.castShadow = ie.castShadow = true; chip.add(ib, ie);
    }
    // the die: polished silicon. Functional blocks in faint contrast, fine array lines, a power grid over all of it,
    // a ring of bond pads; roughness varies a little per block, so the soft-box highlight breaks up across it.
    const S = low ? 1024 : 2048, [c, g] = cnv(S, S), [cr, gr] = cnv(S / 2, S / 2); gr.scale(0.5, 0.5);
    g.fillStyle = '#3b4049'; g.fillRect(0, 0, S, S); gr.fillStyle = 'rgb(200,200,200)'; gr.fillRect(0, 0, S, S);
    const u = S / 100;
    const blocks = [[5, 5, 42, 30, 'cache'], [53, 5, 42, 30, 'cache'], [5, 39, 28, 28, 'core'], [36, 39, 28, 28, 'core'], [67, 39, 28, 28, 'core'],
      [5, 71, 58, 24, 'logic'], [66, 71, 29, 24, 'io']];
    for (const [x, y, w, h, kind] of blocks) {
      const X0 = x * u, Y0 = y * u, Wb = w * u, Hb = h * u;
      g.fillStyle = kind === 'cache' ? '#42474f' : kind === 'core' ? '#383c45' : kind === 'io' ? '#454951' : '#3d414a'; g.fillRect(X0, Y0, Wb, Hb);
      if (kind === 'cache') {   // memory arrays: sub-arrays with fine rows
        for (let a = 0; a < 4; a++) for (let b2 = 0; b2 < 2; b2++) {
          const ax = X0 + a * Wb / 4 + u * 0.5, ay = Y0 + b2 * Hb / 2 + u * 0.5, aw = Wb / 4 - u, ah = Hb / 2 - u;
          g.fillStyle = '#4a4f58'; g.fillRect(ax, ay, aw, ah);
          for (let yy = ay; yy < ay + ah; yy += 2.2) { g.fillStyle = 'rgba(34,37,43,0.55)'; g.fillRect(ax, yy, aw, 0.9); }
        }
      } else if (kind === 'core') {   // standard cells: short dense rows of slightly different shades
        for (let yy = Y0; yy < Y0 + Hb; yy += 3) for (let xx = X0; xx < X0 + Wb;) { const l = 4 + R() * 22; const v = 50 + Math.round(R() * 18); g.fillStyle = `rgb(${v},${v + 4},${v + 10})`; g.fillRect(xx, yy, l - 1, 2.2); xx += l; }
        g.fillStyle = 'rgba(80,86,96,0.55)'; g.fillRect(X0 + Wb * 0.08, Y0 + Hb * 0.08, Wb * 0.38, Hb * 0.38);
      } else {
        for (let yy = Y0; yy < Y0 + Hb; yy += 2.6) for (let xx = X0; xx < X0 + Wb;) { const l = 3 + R() * 14; const v = 52 + Math.round(R() * 20); g.fillStyle = `rgb(${v},${v + 4},${v + 9})`; g.fillRect(xx, yy, l - 1, 2); xx += l; }
      }
      g.strokeStyle = 'rgba(24,26,30,0.9)'; g.lineWidth = u * 0.35; g.strokeRect(X0, Y0, Wb, Hb);
      gr.fillStyle = `rgb(${kind === 'cache' ? 160 : kind === 'io' ? 235 : 205},0,0)`; gr.fillRect(X0, Y0, Wb, Hb);
    }
    for (let k = 1; k < 25; k++) { g.fillStyle = 'rgba(120,128,140,0.10)'; g.fillRect(0, k * 4 * u, S, u * 0.35); g.fillRect(k * 4 * u, 0, u * 0.35, S); }   // power grid
    for (let i = 0; i < 46; i++) { g.fillStyle = '#7a7f87'; for (const [px, py] of [[2 * u + i * 2.08 * u, 1.2 * u], [2 * u + i * 2.08 * u, 97.6 * u], [1.2 * u, 2 * u + i * 2.08 * u], [97.6 * u, 2 * u + i * 2.08 * u]]) g.fillRect(px, py, 1.2 * u, 1.2 * u); }
    const dieMat = new THREE.MeshPhysicalMaterial({ envMap: envSoft, map: tex(c), roughnessMap: tex(cr, false), color: '#ffffff', metalness: 0.55, roughness: 0.28,
      iridescence: 0.15, iridescenceIOR: 1.3, iridescenceThicknessRange: [300, 360], envMapIntensity: 1.25 });
    const dieSide = new THREE.MeshPhysicalMaterial({ envMap: envSoft, color: '#50545c', metalness: 0.35, roughness: 0.42 });
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z; the map goes on top (+y), whose UV runs x → u and back → top of canvas
    const die = new THREE.Mesh(new THREE.BoxGeometry(DIE_W, DIE_H, DIE_W), [dieSide, dieSide, dieMat, dieSide, dieSide, dieSide]);
    die.position.y = SUB_H + DIE_H / 2; die.castShadow = die.receiveShadow = true; chip.add(die);
  }
  const ihs = new THREE.Group(); ihs.position.y = SUB_H; chip.add(ihs);
  const ihsMats = [];
  {
    const w = CHIP.w - 0.05, s = 1024 / w, [c, g] = cnv(1024, 1024);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 500; i++) { const v = 225 + Math.round(R() * 30); g.fillStyle = `rgba(${v},${v},${v},0.4)`; g.fillRect(0, R() * 1024, 1024, 0.6 + R()); }
    g.fillStyle = 'rgba(72,74,78,0.75)'; g.textBaseline = 'top';
    g.font = `700 ${0.075 * s}px ${font}`; g.fillText('EX-1', 0.08 * s, 0.1 * s);
    g.font = `500 ${0.04 * s}px ${font}`; g.fillText('EXAMPLE LAB', 0.08 * s, 0.2 * s); g.fillText('2026  ·  A0  ·  3.2 GHz', 0.08 * s, 0.26 * s);
    datamatrix(g, 0.4 * s, 0.38 * s, 0.009 * s, 14, 99, 'rgba(72,74,78,0.75)');
    const top = new THREE.MeshPhysicalMaterial({ envMap: envSoft, map: mapTex(c, w, w), color: '#c9ccd0', metalness: 1, roughness: 0.26, roughnessMap: BR, envMapIntensity: 1.2 });
    const side = new THREE.MeshPhysicalMaterial({ envMap: envSoft, color: '#b9bdc2', metalness: 1, roughness: 0.3 });
    const lid = new THREE.Mesh(slab(w, w, 0.034, 0.03, 0.006), [top, side]); lid.castShadow = lid.receiveShadow = true; ihs.add(lid);
    ihsMats.push(top, side);
  }

  // the copper plate above the chip, and the black glass lid
  const plate = new THREE.Group(); dev.add(plate);
  {
    const m = new THREE.Mesh(slab(1.4, 1.05, 0.022, 0.06, 0.005), [copper, copper]); m.position.set(-0.2, 0, 0.04); m.castShadow = m.receiveShadow = true; plate.add(m);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.5), new THREE.MeshStandardMaterial({ color: '#6c6f75', roughness: 0.8 }));
    pad.position.set(CHIP.x, -0.006, CHIP.z); plate.add(pad);
  }
  const lid = new THREE.Group(); dev.add(lid);
  {
    // the lid: bead-blasted aluminium with a polished chamfer; the mark is engraved (a little darker and shinier)
    const sc = 320, [c, g] = cnv(Math.round(W * sc), Math.round(D * sc)), [cr, gr] = cnv(c.width, c.height);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); gr.fillStyle = 'rgb(255,255,255)'; gr.fillRect(0, 0, c.width, c.height);
    const cx = W / 2 * sc, cy = D / 2 * sc - 0.06 * sc;
    for (const [ctx2, col] of [[g, '#8d9198'], [gr, 'rgb(70,70,70)']]) {
      ctx2.strokeStyle = ctx2.fillStyle = col; ctx2.lineWidth = 0.012 * sc;
      ctx2.beginPath(); ctx2.arc(cx, cy, 0.13 * sc, 0, 7); ctx2.stroke(); ctx2.beginPath(); ctx2.arc(cx, cy, 0.035 * sc, 0, 7); ctx2.fill();
      ctx2.font = `600 ${0.075 * sc}px ${font}`; ctx2.textAlign = 'center'; ctx2.textBaseline = 'top'; ctx2.fillText('Example Lab', cx, cy + 0.19 * sc);
    }
    // the blast speckle times the engraving: roughness = 0.82 × speckle (≈0.45) on the face, ≈0.12 in the mark
    const markR = mapTex(cr, W, D, false);
    const top = new THREE.MeshPhysicalMaterial({ envMap: envSoft, map: mapTex(c, W, D), color: '#b7bbc1', metalness: 1, roughness: 0.82,
      roughnessMap: BL, envMapIntensity: 1.05 });
    top.onBeforeCompile = (sh) => {   // a second roughness map (the engraving), multiplied in
      sh.uniforms.uMark = { value: markR };
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= mix(0.3, 1.0, texture2D(uMark, vMapUv).g);')
        .replace('void main() {', 'uniform sampler2D uMark;\nvoid main() {');
    };
    const m = new THREE.Mesh(slab(W, D, 0.05, RC, 0.016), [top, diamondCut]); m.castShadow = m.receiveShadow = true; lid.add(m);
    // the underside: a dark anodized inner face with a gasket line, seen when the lid lifts
    const under = new THREE.Mesh(slab(W - 0.18, D - 0.18, 0.004, RC - 0.09, 0.001), [anodDark, anodDark]); under.position.y = -0.003; lid.add(under);
  }

  /* ---------------------------------------------------------------- state */
  // closed heights (bottom of each part) and how far the layers rise apart
  const Y = { battery: 0.06, pcb: 0.14, plate: 0.262, lid: FRAME_H };
  const UP = { battery: 0.34, pcb: 0.8, plate: 1.24, lid: 0.86 };
  function update({ p, ev }) {
    const lidV = ev.lid, lv = ease(lidV), lo = easeOut(lidV);
    const sv = ev.layers, ls = ease(sv);
    // the upper layers leave the frame up and away while the camera goes down to the chip (scroll-driven, reversible)
    const away = ease(sstep(0.70, 0.82, p));
    battery.position.y = Y.battery + UP.battery * ease(sv * 1.2 - 0.2);
    pcb.position.y = Y.pcb + UP.pcb * ease(sv * 1.1 - 0.1);
    plate.position.y = Y.plate + UP.plate * ls + 3.4 * away;
    plate.visible = away < 0.98;
    // the lid: up and back with a slight tilt, then further up with the layers
    lid.position.set(0, Y.lid + 0.75 * lo + UP.lid * ls + 4.2 * away, -0.35 * lv);
    lid.rotation.x = -0.14 * lv * (1 - 0.5 * ls);
    lid.visible = away < 0.98;
    // the heat spreader: lifts, turns a little and fades, so the die stays
    const cv = ev.chip, ce = ease(cv), fade = 1 - sstep(0.3, 0.95, cv);
    ihs.position.set(0.1 * ce, SUB_H + 0.2 * ce, -0.04 * ce); ihs.rotation.z = -0.16 * ce;
    for (const m of ihsMats) { m.transparent = fade < 1; m.opacity = fade; m.depthWrite = fade > 0.6; }
    ihs.visible = fade > 0.002;
    ihs.children[0].castShadow = fade > 0.5;
  }

  /* ---------------------------------------------------------------- camera */
  const anchors = {
    dev: () => dev.localToWorld(V(0.1, 0.12, 0.05)),
    open: () => dev.localToWorld(V(-0.15, 0.3, 0.05)),
    stack: () => dev.localToWorld(V(0, 1.0, 0)),
    pcb: () => pcb.localToWorld(V(-0.1, 0.05, 0.05)),
    chip: () => chip.localToWorld(V(0.0, SUB_H + DIE_H, 0.0)),
  };
  //   p      anchor   d      az      el     | portrait: d×   az+    el+
  const keys = [
    [0.00, 'dev',   6.4,   0.62,   0.50,    1.45,  0.30,  0.10],
    [0.12, 'dev',   5.6,   0.42,   0.60,    1.45,  0.25,  0.08],
    [0.26, 'open',  4.9,   0.12,   0.78,    1.50,  0.10,  0.04],
    [0.40, 'stack', 6.2,  -0.30,   0.42,    1.55,  0.05,  0.00],
    [0.56, 'stack', 6.7,  -0.62,   0.20,    1.55,  0.00,  0.04],
    [0.70, 'pcb',   3.1,  -0.46,   0.56,    1.40,  0.00,  0.04],
    [0.82, 'chip',  1.15,  -0.26,   0.74,    1.30,  0.00,  0.00],
    [0.93, 'chip',  0.92,  -0.16,   0.80,    1.30,  0.00,  0.00],
    [1.00, 'chip',  0.88,  -0.14,   0.81,    1.30,  0.00,  0.00],
  ];
  const events = [
    { k: 'lid', p: 0.18, dur: 1.1 },
    { k: 'layers', p: 0.47, dur: 1.2 },
    { k: 'chip', p: 0.84, dur: 1.2 },
  ];
  return { anchors, keys, events, update };
}
