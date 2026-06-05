// Liquid-glass refraction for a rounded-rect / capsule region.
// Uses the LENS magnification model (magnified centre, compressed rim) adapted
// to the capsule via its SDF normal + depth — plus all-edge reflections, frost
// and shading. Shared by the browser widget and the offline Node preview.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.LiquidGlass = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  function rrSDF(x, y, cx, cy, w, h, r) {
    var dx = Math.abs(x - cx) - (w / 2 - r), dy = Math.abs(y - cy) - (h / 2 - r);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
  }

  // lens profile: maps normalised depth-from-spine (1 at rim, 0 at centre) to the
  // source position. <nr in the middle => magnify; steep near 1 => rim compression.
  function srcRadius(nr, mag) { return nr * mag + Math.pow(nr, 5) * (1 - mag); }

  function sample(buf, W, H, x, y, out) {
    x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
    var x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    var i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
    for (var c = 0; c < 3; c++) {
      var a = buf[i00 + c] + (buf[i10 + c] - buf[i00 + c]) * fx;
      var b = buf[i01 + c] + (buf[i11 + c] - buf[i01 + c]) * fx;
      out[c] = a + (b - a) * fy;
    }
  }

  // bg, blurred, out: RGBA buffers (0..255). cap = {cx,cy,w,h,r}.
  function render(bg, blurred, out, W, H, cap, opts) {
    opts = opts || {};
    var mag   = opts.mag   != null ? opts.mag   : 0.62;  // <1 => stronger magnification
    var ca    = opts.ca    != null ? opts.ca    : 0.035; // chromatic aberration
    var frost = opts.frost != null ? opts.frost : 0.28;  // milky frost (lens is clearer)
    var tintT = opts.tint  != null ? opts.tint  : 0.06;
    var cx = cap.cx, cy = cap.cy, w = cap.w, h = cap.h, r = cap.r;
    var thick = opts.thickness != null ? opts.thickness : Math.min(w, h) / 2; // half-thickness
    var pg = [0,0,0], pr = [0,0,0], pb = [0,0,0], bl = [0,0,0];

    var x0 = Math.max(0, Math.floor(cx - w/2 - 2)), x1 = Math.min(W, Math.ceil(cx + w/2 + 2));
    var y0 = Math.max(0, Math.floor(cy - h/2 - 2)), y1 = Math.min(H, Math.ceil(cy + h/2 + 2));

    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var d = rrSDF(x + 0.5, y + 0.5, cx, cy, w, h, r);
        if (d > 1) continue;
        var o = (y * W + x) * 4;

        // outward normal (gradient of SDF)
        var nx = rrSDF(x + 1, y, cx, cy, w, h, r) - rrSDF(x - 1, y, cx, cy, w, h, r);
        var ny = rrSDF(x, y + 1, cx, cy, w, h, r) - rrSDF(x, y - 1, cx, cy, w, h, r);
        var nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;

        // LENS magnification along the normal: nr = 1 at rim, 0 at the spine.
        var e = -d;                                   // depth from the edge
        var nr = clamp(1 - e / thick, 0, 1);
        var s  = srcRadius(nr, mag);
        var ea = nr * nr * nr;                        // chromatic grows toward the rim
        var og = (s - nr) * thick;                    // inward offset (negative) => magnify
        var oR = (s - ca * ea - nr) * thick;
        var oB = (s + ca * ea - nr) * thick;
        sample(bg, W, H, x + nx * og, y + ny * og, pg);
        sample(bg, W, H, x + nx * oR, y + ny * oR, pr);
        sample(bg, W, H, x + nx * oB, y + ny * oB, pb);
        var R = pr[0], G = pg[1], B = pb[2];

        // frost: blend toward the blurred backdrop
        sample(blurred, W, H, x + nx * og, y + ny * og, bl);
        R = R + (bl[0] - R) * frost; G = G + (bl[1] - G) * frost; B = B + (bl[2] - B) * frost;

        // milky tint
        R += (255 - R) * tintT; G += (255 - G) * tintT; B += (255 - B) * tintT;

        // gentle body shading: darker up top, lighter toward the bottom
        var v = clamp((y - (cy - h/2)) / h, 0, 1);
        var body = (v - 0.45) * 34;
        R = clamp(R + body, 0, 255); G = clamp(G + body, 0, 255); B = clamp(B + body, 0, 255);

        // REFLECTIONS on every edge (normal-based): bright top rim, bottom glow,
        // faint highlight all around.
        var rm = clamp(1 - e / 5.0, 0, 1); rm *= rm;
        var refl = rm * (Math.max(0, -ny) * 150 + Math.max(0, ny) * 95 + 26);
        R = clamp(R + refl, 0, 255); G = clamp(G + refl, 0, 255); B = clamp(B + refl, 0, 255);

        // soft dark "glass thickness" just inside the top edge
        var topDark = clamp(1 - e / 18, 0, 1) * Math.max(0, -ny) * 44;
        R = clamp(R - topDark, 0, 255); G = clamp(G - topDark, 0, 255); B = clamp(B - topDark, 0, 255);

        out[o] = R; out[o+1] = G; out[o+2] = B; out[o+3] = clamp(-d + 0.5, 0, 1) * 255;
      }
    }
  }

  return { render: render, rrSDF: rrSDF, srcRadius: srcRadius };
});
