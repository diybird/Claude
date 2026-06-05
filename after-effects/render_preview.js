// Offline rasterizer for the Liquid Glass Dock design.
// No browser / native deps — manual compositing + PNG encode via zlib.
// Renders at 2x (600x600) so the 300x300 design reads crisply.
const zlib = require('zlib');
const fs = require('fs');

const S = 2;                 // supersample / retina factor
const W = 300 * S, H = 300 * S;
const buf = new Float64Array(W * H * 3);

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const idx = (x, y) => (y * W + x) * 3;

function setPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = idx(x, y);
  buf[i]   = lerp(buf[i],   r, a);
  buf[i+1] = lerp(buf[i+1], g, a);
  buf[i+2] = lerp(buf[i+2], b, a);
}
function addPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = idx(x, y);
  buf[i]   = clamp(buf[i]   + r * a, 0, 1);
  buf[i+1] = clamp(buf[i+1] + g * a, 0, 1);
  buf[i+2] = clamp(buf[i+2] + b * a, 0, 1);
}

// signed distance to a rounded rectangle (centre cx,cy)
function rrSDF(px, py, cx, cy, w, h, r) {
  const dx = Math.abs(px - cx) - (w / 2 - r);
  const dy = Math.abs(py - cy) - (h / 2 - r);
  const ax = Math.max(dx, 0), ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r;
}
const cover = (sdf) => clamp(0.5 - sdf, 0, 1);          // AA fill coverage
const ring  = (sdf, w) => clamp(w - Math.abs(sdf), 0, 1); // AA stroke coverage

// ---- design constants (in 300-space, scaled by S) -----------------
const sc = v => v * S;
const DCX = sc(150), DCY = sc(196);
const DW = sc(252), DH = sc(74), DR = sc(26);
const BTN = sc(46), BR = sc(13);
const BX = [58, 104, 150, 196, 242].map(sc);
const BY = DCY;

const cursorX = sc(150 + 30);     // light is just right of centre
const MAG = 0.30, INFL = sc(46);  // dock magnification feel
const focus = bx => Math.exp(-((bx - cursorX) ** 2) / (2 * INFL * INFL));

// ================= 1. background gradient =========================
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const d = Math.hypot(x - sc(150), y - sc(120)) / sc(230);
  const t = clamp(d, 0, 1);
  const i = idx(x, y);
  buf[i]   = lerp(0.10, 0.015, t);
  buf[i+1] = lerp(0.11, 0.020, t);
  buf[i+2] = lerp(0.20, 0.045, t);
}

// ================= 2. soft colour blobs (analytic, no squares) =====
function blob(cx, cy, rad, col, amp) {
  const R = rad * 2.2;
  for (let y = cy - R; y < cy + R; y++) for (let x = cx - R; x < cx + R; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const d2 = (x - cx) ** 2 + (y - cy) ** 2;
    const w = Math.exp(-d2 / (2 * rad * rad)) * amp;
    addPx(x, y, col[0], col[1], col[2], w);
  }
}
blob(sc(108), sc(150), sc(70), [0.34, 0.20, 0.85], 0.55);
blob(sc(205), sc(205), sc(66), [0.06, 0.55, 0.70], 0.50);

// ================= 3. frosted glass panel =========================
// snapshot + heavy box-blur of the background to fake backdrop blur
function boxBlur(src, radius, passes) {
  let cur = src;
  for (let p = 0; p < passes; p++) {
    const out = new Float64Array(cur.length);
    // horizontal
    const tmp = new Float64Array(cur.length);
    for (let y = 0; y < H; y++) for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let x = -radius; x <= radius; x++) acc += cur[idx(clamp(x,0,W-1), y) + c];
      const n = radius * 2 + 1;
      for (let x = 0; x < W; x++) {
        tmp[idx(x, y) + c] = acc / n;
        const add = cur[idx(clamp(x + radius + 1, 0, W - 1), y) + c];
        const sub = cur[idx(clamp(x - radius, 0, W - 1), y) + c];
        acc += add - sub;
      }
    }
    // vertical
    for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let y = -radius; y <= radius; y++) acc += tmp[idx(x, clamp(y,0,H-1)) + c];
      const n = radius * 2 + 1;
      for (let y = 0; y < H; y++) {
        out[idx(x, y) + c] = acc / n;
        const add = tmp[idx(x, clamp(y + radius + 1, 0, H - 1)) + c];
        const sub = tmp[idx(x, clamp(y - radius, 0, H - 1)) + c];
        acc += add - sub;
      }
    }
    cur = out;
  }
  return cur;
}
const blurred = boxBlur(buf.slice(), sc(11), 3);

// soft drop shadow first
for (let y = DCY - DH; y < DCY + DH; y++) for (let x = DCX - DW; x < DCX + DW; x++) {
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const s = rrSDF(x, y + sc(6), DCX, DCY, DW, DH, DR);
  const a = clamp(-s / sc(14), 0, 1) * 0.35;
  if (a > 0) setPx(x, y, 0, 0, 0, a);
}

// the frosted slab + rim
for (let y = DCY - DH; y < DCY + DH; y++) for (let x = DCX - DW; x < DCX + DW; x++) {
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const s = rrSDF(x, y, DCX, DCY, DW, DH, DR);
  const cv = cover(s);
  if (cv > 0) {
    const i = idx(x, y);
    // frosted = blurred backdrop, brightened + desaturated toward white
    const vgrad = clamp((y - (DCY - DH / 2)) / DH, 0, 1); // top->bottom
    const tint = lerp(0.30, 0.14, vgrad);                 // brighter at top
    const r = lerp(blurred[i],   1, tint);
    const g = lerp(blurred[i+1], 1, tint);
    const b = lerp(blurred[i+2], 1, tint);
    setPx(x, y, r, g, b, cv);
  }
  // bright outer rim + faint inner top highlight
  setPx(x, y, 1, 1, 1, ring(s, sc(0.8)) * 0.55);
  const si = rrSDF(x, y, DCX, DCY - sc(1), DW - sc(6), DH - sc(6), DR - sc(3));
  if (y < DCY) addPx(x, y, 1, 1, 1, ring(si, sc(0.7)) * 0.22);
}

// ================= 4. dock buttons ================================
const btnCols = [
  [[0.30,0.62,1.0],[0.10,0.40,0.92]],
  [[0.18,0.88,0.80],[0.05,0.62,0.62]],
  [[0.70,0.46,1.0],[0.48,0.26,0.92]],
  [[1.0,0.55,0.62],[0.92,0.30,0.42]],
  [[0.40,0.90,0.52],[0.16,0.68,0.34]],
];
for (let k = 0; k < BX.length; k++) {
  const f = focus(BX[k]);
  const size = BTN * (1 + MAG * f);
  const r = BR * (1 + MAG * f);
  const cx = BX[k], cy = BY - sc(15) * f;
  const [top, bot] = btnCols[k];
  const R = size / 2 + sc(3);
  for (let y = Math.floor(cy - R); y < Math.ceil(cy + R); y++)
  for (let x = Math.floor(cx - R); x < Math.ceil(cx + R); x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const s = rrSDF(x, y, cx, cy, size, size, r);
    const cv = cover(s);
    if (cv > 0) {
      const vg = clamp((y - (cy - size / 2)) / size, 0, 1);
      setPx(x, y, lerp(top[0],bot[0],vg), lerp(top[1],bot[1],vg), lerp(top[2],bot[2],vg), cv);
    }
    setPx(x, y, 1, 1, 1, ring(s, sc(0.7)) * 0.30);          // rim
    // top gloss
    const gd = Math.hypot((x - cx) / (size * 0.42), (y - (cy - size * 0.26)) / (size * 0.20));
    if (gd < 1) addPx(x, y, 1, 1, 1, (1 - gd) * 0.16 * cv);
  }
}

// ================= 5. specular sheen near top of glass ============
(function sheen() {
  const cx = clamp(cursorX, DCX - DW * 0.35, DCX + DW * 0.35);
  const cy = DCY - DH * 0.32, rx = sc(58), ry = sc(11);
  for (let y = Math.floor(cy - ry * 3); y < Math.ceil(cy + ry * 3); y++)
  for (let x = Math.floor(cx - rx * 2); x < Math.ceil(cx + rx * 2); x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    addPx(x, y, 1, 1, 1, Math.exp(-d) * 0.22);
  }
})();

// ===================== encode PNG ================================
function toPNG() {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  let p = 0;
  for (let y = 0; y < H; y++) {
    raw[p++] = 0;
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      raw[p++] = Math.round(clamp(buf[i],   0, 1) * 255);
      raw[p++] = Math.round(clamp(buf[i+1], 0, 1) * 255);
      raw[p++] = Math.round(clamp(buf[i+2], 0, 1) * 255);
    }
  }
  const crcTable = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type);
    const cd = Buffer.concat([t, data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(cd));
    return Buffer.concat([len, cd, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(__dirname + '/preview.png', toPNG());
console.log('wrote preview.png', W + 'x' + H);
