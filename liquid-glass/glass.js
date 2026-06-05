// Liquid-glass refraction for a rounded-rect / capsule region.
// PHYSICS-BASED (inspired by the iOS-26 liquid-glass demo): a flat glass centre
// with a curved BEZEL at the edge that refracts via Snell's law (real IOR).
// Per-channel IOR gives true chromatic dispersion; plus frosted blur, specular,
// inner shadow + inner rim. Shared by the browser widget and the Node preview.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.LiquidGlass = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  function smoothstep(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

  function rrSDF(x, y, cx, cy, w, h, r) {
    var dx = Math.abs(x - cx) - (w / 2 - r), dy = Math.abs(y - cy) - (h / 2 - r);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
  }

  // bezel cross-section profiles (height 0 at rim -> 1 at inner bezel edge)
  var SURFACE = {
    squircle: function (x) { return Math.pow(1 - Math.pow(1 - x, 4), 0.25); },
    circle:   function (x) { return Math.sqrt(1 - (1 - x) * (1 - x)); }
  };

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
    var ior     = opts.ior     != null ? opts.ior     : 1.7;   // index of refraction
    var caIor   = opts.ca      != null ? opts.ca      : 0.22;  // IOR spread -> dispersion
    var frost   = opts.frost   != null ? opts.frost   : 0.42;  // frosted blur strength
    var spec    = opts.specular!= null ? opts.specular: 0.55;  // specular highlight
    var tintT   = opts.tint    != null ? opts.tint    : 0.05;  // milky tint
    var cx = cap.cx, cy = cap.cy, w = cap.w, h = cap.h, r = cap.r;
    var thick   = opts.thickness != null ? opts.thickness : 70;             // glass thickness
    var bezel   = opts.bezel != null ? opts.bezel : Math.min(r, Math.min(w, h) / 2) * 0.95;
    var surf    = SURFACE[opts.surface] || SURFACE.squircle;
    var lx = 0.45, ly = -0.89;                                  // light direction (upper)
    var pr = [0,0,0], pg = [0,0,0], pb = [0,0,0], bl = [0,0,0];

    // lateral refraction displacement (px) at slope `slope`, for a given IOR
    function dispFor(slope, h0, ix) {
      var sinR = clamp(Math.sin(slope) / ix, -1, 1);
      var thetaR = Math.asin(sinR);
      return h0 * thick * (Math.tan(slope) - Math.tan(thetaR));
    }

    var x0 = Math.max(0, Math.floor(cx - w/2 - 2)), x1 = Math.min(W, Math.ceil(cx + w/2 + 2));
    var y0 = Math.max(0, Math.floor(cy - h/2 - 2)), y1 = Math.min(H, Math.ceil(cy + h/2 + 2));

    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var d = rrSDF(x + 0.5, y + 0.5, cx, cy, w, h, r);
        if (d > 1) continue;
        var o = (y * W + x) * 4;
        var e = -d;                                  // distance inward from the rim

        // outward normal (gradient of SDF)
        var nx = rrSDF(x + 1, y, cx, cy, w, h, r) - rrSDF(x - 1, y, cx, cy, w, h, r);
        var ny = rrSDF(x, y + 1, cx, cy, w, h, r) - rrSDF(x, y - 1, cx, cy, w, h, r);
        var nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;

        // bezel profile + slope -> Snell refraction (clear flat centre)
        var t = clamp(e / bezel, 0, 1);
        var hh = surf(t);
        var dh = (surf(Math.min(t + 0.001, 1)) - hh) / 0.001;
        var slope = Math.atan(dh * (thick / bezel));

        // per-channel dispersion: refract R/G/B at slightly different IOR
        var dR = dispFor(slope, hh, ior - caIor);
        var dG = dispFor(slope, hh, ior);
        var dB = dispFor(slope, hh, ior + caIor);
        sample(bg, W, H, x - nx * dR, y - ny * dR, pr);
        sample(bg, W, H, x - nx * dG, y - ny * dG, pg);
        sample(bg, W, H, x - nx * dB, y - ny * dB, pb);
        var R = pr[0], G = pg[1], B = pb[2];

        // frosted blur: blend toward the blurred backdrop
        sample(blurred, W, H, x - nx * dG, y - ny * dG, bl);
        R = R + (bl[0] - R) * frost; G = G + (bl[1] - G) * frost; B = B + (bl[2] - B) * frost;

        // milky tint
        R += (255 - R) * tintT; G += (255 - G) * tintT; B += (255 - B) * tintT;

        // gentle body shading
        var vv = clamp((y - (cy - h/2)) / h, 0, 1);
        var body = (vv - 0.45) * 28;
        R = clamp(R + body, 0, 255); G = clamp(G + body, 0, 255); B = clamp(B + body, 0, 255);

        // specular highlight on the bezel (light from above), all around
        var rimDot = Math.abs(nx * lx + ny * ly);
        var rimFall = 1 - smoothstep(0, bezel * 0.45, e);
        var sh = Math.pow(rimDot * rimFall, 1.5) * spec * 255;
        // a stronger bottom glow where the rim faces down
        sh += Math.max(0, ny) * rimFall * 70;
        R = clamp(R + sh, 0, 255); G = clamp(G + sh, 0, 255); B = clamp(B + sh, 0, 255);

        // inner shadow (glass thickness) then a thin inner rim highlight
        var innerShadow = 1 - smoothstep(0, bezel * 0.6, e);
        var dk = 1 - innerShadow * 0.22 * Math.max(0, -ny);
        R *= dk; G *= dk; B *= dk;
        var innerRim = smoothstep(0, 2, e) * (1 - smoothstep(2, 6, e)) * 60;
        R = clamp(R + innerRim, 0, 255); G = clamp(G + innerRim, 0, 255); B = clamp(B + innerRim, 0, 255);

        out[o] = R; out[o+1] = G; out[o+2] = B; out[o+3] = clamp(-d + 0.5, 0, 1) * 255;
      }
    }
  }

  return { render: render, rrSDF: rrSDF };
});
