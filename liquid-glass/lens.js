// Shared "liquid glass" lens math — used by BOTH the browser widget and the
// offline Node preview renderer, so the still I verify == what you get live.
//
// Given a background RGBA buffer, it warps a circular region as a refractive
// lens: magnified centre, compressed edge, chromatic fringing, plus specular
// rim highlights. Pure JS, no deps.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.LiquidLens = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // bilinear sample of an RGBA Uint8/Float buffer
  function sample(buf, W, H, x, y, out) {
    x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
    for (let c = 0; c < 3; c++) {
      const a = buf[i00 + c] + (buf[i10 + c] - buf[i00 + c]) * fx;
      const b = buf[i01 + c] + (buf[i11 + c] - buf[i01 + c]) * fx;
      out[c] = a + (b - a) * fy;
    }
  }

  // maps a pixel radius (0..1) to the background radius it samples from.
  // continuous at the rim (=1) so there's no seam; <nr in the middle => magnify.
  function srcRadius(nr, mag) {
    const base = nr * mag;
    const edge = Math.pow(nr, 5) * (1 - mag);   // steep compression near the rim
    return base + edge;
  }

  // Warp the lens region of `bg` into `out` (both RGBA, same WxH, premultiplied
  // by `scale` for retina). cx,cy,R in buffer pixels. opts tunable.
  function render(bg, out, W, H, cx, cy, R, opts) {
    opts = opts || {};
    const mag = opts.mag != null ? opts.mag : 0.62;       // <1 => magnification
    const ca  = opts.ca  != null ? opts.ca  : 0.018;      // chromatic aberration
    const frost = opts.frost != null ? opts.frost : 0.06; // milky tint
    const Lx = -0.55, Ly = -0.83;                         // light direction
    const px = [0, 0, 0], pr = [0, 0, 0], pb = [0, 0, 0];

    const x0 = Math.max(0, Math.floor(cx - R - 2));
    const x1 = Math.min(W, Math.ceil(cx + R + 2));
    const y0 = Math.max(0, Math.floor(cy - R - 2));
    const y1 = Math.min(H, Math.ceil(cy + R + 2));

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
        const o = (y * W + x) * 4;
        if (d > R + 1) continue;

        const nr = d / R;
        const ux = d > 0.0001 ? dx / d : 0, uy = d > 0.0001 ? dy / d : 0;

        // --- refraction: sample background along the radial direction ---
        const s = srcRadius(Math.min(nr, 1), mag);
        const edgeAmt = Math.pow(Math.min(nr, 1), 3);     // 0 centre -> 1 rim
        const sg = s * R;
        const sr = (s - ca * edgeAmt) * R;
        const sb = (s + ca * edgeAmt) * R;
        sample(bg, W, H, cx + ux * sg, cy + uy * sg, px);
        sample(bg, W, H, cx + ux * sr, cy + uy * sr, pr);
        sample(bg, W, H, cx + ux * sb, cy + uy * sb, pb);
        let r = pr[0], g = px[1], b = pb[2];

        // --- milky frost + slight overall lift ---
        r = r + (255 - r) * frost;
        g = g + (255 - g) * frost;
        b = b + (255 - b) * frost;

        // --- specular rim highlights (lit side + soft opposite) ---
        const facing = ux * Lx + uy * Ly;                 // -1..1
        const rim = Math.pow(clamp(nr, 0, 1), 8);         // concentrate at edge
        const hiLit = Math.pow(Math.max(0, facing), 3) * rim * 230;
        const hiOpp = Math.pow(Math.max(0, -facing), 4) * rim * 90;
        const thinRing = clamp(1 - Math.abs(nr - 0.97) / 0.03, 0, 1) * 60;
        const hi = hiLit + hiOpp + thinRing;
        r = clamp(r + hi, 0, 255); g = clamp(g + hi, 0, 255); b = clamp(b + hi, 0, 255);

        // --- inner contact shadow just inside the rim (glass thickness) ---
        const sh = clamp(1 - Math.abs(nr - 0.88) / 0.10, 0, 1) * (1 - Math.max(0, facing)) * 26;
        r = clamp(r - sh, 0, 255); g = clamp(g - sh, 0, 255); b = clamp(b - sh, 0, 255);

        // --- anti-aliased alpha at the very edge ---
        const a = clamp((R - d) + 0.5, 0, 1) * 255;
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
      }
    }
  }

  return { render, srcRadius };
});
