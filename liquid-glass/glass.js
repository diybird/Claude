// Liquid-glass refraction for a rounded-rect / capsule region.
// Edge-concentrated: bends the background strongly at the rim (like a thick
// glass bevel), clear in the centre. Shared by the browser widget and the
// offline Node preview so what I verify == what you get live.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.LiquidGlass = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  function rrSDF(x, y, cx, cy, w, h, r) {
    var dx = Math.abs(x - cx) - (w / 2 - r), dy = Math.abs(y - cy) - (h / 2 - r);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
  }

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
    var band   = opts.band   != null ? opts.band   : 34;   // edge refraction width (px)
    var amount = opts.amount != null ? opts.amount : 40;   // edge bend strength (px)
    var ca     = opts.ca     != null ? opts.ca     : 0.16; // chromatic aberration
    var frost  = opts.frost  != null ? opts.frost  : 0.5;  // blend toward blurred backdrop
    var tintT  = opts.tint   != null ? opts.tint   : 0.06; // milky tint
    var cx = cap.cx, cy = cap.cy, w = cap.w, h = cap.h, r = cap.r;
    var pg = [0,0,0], pr = [0,0,0], pb = [0,0,0], bl = [0,0,0];

    var x0 = Math.max(0, Math.floor(cx - w/2 - 2)), x1 = Math.min(W, Math.ceil(cx + w/2 + 2));
    var y0 = Math.max(0, Math.floor(cy - h/2 - 2)), y1 = Math.min(H, Math.ceil(cy + h/2 + 2));

    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var d = rrSDF(x + 0.5, y + 0.5, cx, cy, w, h, r);
        if (d > 1) continue;
        var o = (y * W + x) * 4;

        // outward normal = gradient of the SDF
        var nx = rrSDF(x + 1, y, cx, cy, w, h, r) - rrSDF(x - 1, y, cx, cy, w, h, r);
        var ny = rrSDF(x, y + 1, cx, cy, w, h, r) - rrSDF(x, y - 1, cx, cy, w, h, r);
        var nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;

        // depth inside the edge -> bend peaks at the rim, fades to centre
        var e = -d;
        var t = clamp(e / band, 0, 1);
        var mag = amount * Math.pow(1 - t, 1.7);

        // refract: sample the backdrop pulled outward along the normal (+CA)
        sample(bg, W, H, x + nx * mag,            y + ny * mag,            pg);
        sample(bg, W, H, x + nx * mag * (1 + ca), y + ny * mag * (1 + ca), pr);
        sample(bg, W, H, x + nx * mag * (1 - ca), y + ny * mag * (1 - ca), pb);
        var R = pr[0], G = pg[1], B = pb[2];

        // frost: blend toward the blurred backdrop (stronger in the clear centre)
        sample(blurred, W, H, x + nx * mag, y + ny * mag, bl);
        var fr = frost * (0.5 + 0.5 * (1 - t));
        R = R + (bl[0] - R) * fr; G = G + (bl[1] - G) * fr; B = B + (bl[2] - B) * fr;

        // milky tint
        R += (255 - R) * tintT; G += (255 - G) * tintT; B += (255 - B) * tintT;

        // vertical glass shading: dark top, bright bottom
        var v = clamp((y - (cy - h/2)) / h, 0, 1);
        var shade = (v - 0.5) * 2;                 // -1 top .. +1 bottom
        var add = shade > 0 ? shade * 42 : shade * 70;
        R = clamp(R + add, 0, 255); G = clamp(G + add, 0, 255); B = clamp(B + add, 0, 255);

        // bright rim + thin top edge highlight
        var rim = clamp(1 - Math.abs(d + 1.0) / 1.6, 0, 1);
        var rimGlow = rim * (v > 0.5 ? 120 : 40);
        R = clamp(R + rimGlow, 0, 255); G = clamp(G + rimGlow, 0, 255); B = clamp(B + rimGlow, 0, 255);

        var alpha = clamp(-d + 0.5, 0, 1) * 255;
        out[o] = R; out[o+1] = G; out[o+2] = B; out[o+3] = alpha;
      }
    }
  }

  return { render: render, rrSDF: rrSDF };
});
