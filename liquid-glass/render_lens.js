// Offline preview of the liquid-glass LENS over a 300x300 scene.
// Uses the SAME lens.js the browser widget uses, so this still matches live.
const zlib = require('zlib');
const fs = require('fs');
const LiquidLens = require('./lens.js');

const S = 2, W = 300 * S, H = 300 * S;
const bg = new Float64Array(W * H * 4);   // RGBA 0..255
const out = new Float64Array(W * H * 4);

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sc = v => v * S;

function px(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4, A = a == null ? 1 : a;
  bg[i]   = lerp(bg[i],   r, A);
  bg[i+1] = lerp(bg[i+1], g, A);
  bg[i+2] = lerp(bg[i+2], b, A);
  bg[i+3] = 255;
}
function rrSDF(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx) - (w/2 - r), dy = Math.abs(y - cy) - (h/2 - r);
  return Math.hypot(Math.max(dx,0), Math.max(dy,0)) + Math.min(Math.max(dx,dy),0) - r;
}
function fillRR(cx, cy, w, h, r, col, op) {
  op = op == null ? 1 : op;
  for (let y = Math.floor(cy-h/2-2); y < Math.ceil(cy+h/2+2); y++)
  for (let x = Math.floor(cx-w/2-2); x < Math.ceil(cx+w/2+2); x++) {
    const cv = clamp(0.5 - rrSDF(x, y, cx, cy, w, h, r), 0, 1);
    if (cv > 0) px(x, y, col[0], col[1], col[2], cv * op);
  }
}

// ---------------- build the background scene ----------------------
// soft light-grey gradient
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const t = y / H;
  const i = (y * W + x) * 4;
  bg[i] = lerp(238, 214, t); bg[i+1] = lerp(239, 216, t); bg[i+2] = lerp(243, 222, t); bg[i+3] = 255;
}
// faint grid
for (let g = 0; g <= 300; g += 40) {
  for (let y = 0; y < H; y++) px(sc(g), y, 205, 207, 214, 0.5);
  for (let x = 0; x < W; x++) px(x, sc(g), 205, 207, 214, 0.5);
}
// a dark "title bar" + 5 brand dots + a couple of cards => stuff to refract
fillRR(sc(150), sc(150), sc(230), sc(40), sc(12), [28, 28, 32], 1);     // dark bar
const dots = [[60,'34,98,255'],[105,'24,200,180'],[150,'150,90,255'],[195,'255,90,120'],[240,'70,210,90']];
for (const [x, c] of dots) { const [r,g,b] = c.split(',').map(Number); fillRR(sc(x), sc(150), sc(26), sc(26), sc(8), [r,g,b], 1); }
fillRR(sc(78), sc(96), sc(96), sc(34), sc(10), [120, 130, 245], 0.9);
fillRR(sc(210), sc(210), sc(110), sc(40), sc(12), [255, 170, 90], 0.9);

// copy bg -> out (so area outside the lens shows the scene)
out.set(bg);

// ---------------- the lens -----------------------------------------
// convert Float bg to a flat array lens.js can sample (it reads RGBA index*4)
const lensCx = sc(150 + 18), lensCy = sc(150 - 6), lensR = sc(74);

// soft drop shadow under the lens (draw into out before warping)
for (let y = lensCy - lensR*2; y < lensCy + lensR*2; y++)
for (let x = lensCx - lensR*2; x < lensCx + lensR*2; x++) {
  if (x<0||y<0||x>=W||y>=H) continue;
  const d = Math.hypot(x - lensCx, y - (lensCy + sc(8)));
  const a = clamp((lensR + sc(10) - d) / sc(22), 0, 1) * 0.18;
  if (a > 0) { const i=(y*W+x)*4; out[i]=lerp(out[i],0,a); out[i+1]=lerp(out[i+1],0,a); out[i+2]=lerp(out[i+2],0,a); }
}

const lensBuf = new Float64Array(W * H * 4);
LiquidLens.render(bg, lensBuf, W, H, lensCx, lensCy, lensR, {});
// composite lens over out using its alpha
for (let i = 0; i < W*H; i++) {
  const a = lensBuf[i*4+3] / 255;
  if (a > 0) for (let c = 0; c < 3; c++) out[i*4+c] = lerp(out[i*4+c], lensBuf[i*4+c], a);
}

// ---------------- encode PNG (RGB) ---------------------------------
const raw = Buffer.alloc((W * 3 + 1) * H);
let p = 0;
for (let y = 0; y < H; y++) { raw[p++] = 0; for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  raw[p++] = clamp(Math.round(out[i]), 0, 255);
  raw[p++] = clamp(Math.round(out[i+1]), 0, 255);
  raw[p++] = clamp(Math.round(out[i+2]), 0, 255);
}}
const crcT = []; for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcT[n]=c>>>0;}
const crc = b => { let c=0xffffffff; for (let i=0;i<b.length;i++) c=crcT[(c^b[i])&0xff]^(c>>>8); return (c^0xffffffff)>>>0; };
const chunk = (t, d) => { const L=Buffer.alloc(4);L.writeUInt32BE(d.length);const cd=Buffer.concat([Buffer.from(t),d]);const C=Buffer.alloc(4);C.writeUInt32BE(crc(cd));return Buffer.concat([L,cd,C]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4); ihdr[8]=8; ihdr[9]=2;
fs.writeFileSync(__dirname + '/preview.png', Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
]));
console.log('wrote preview.png', W + 'x' + H);
