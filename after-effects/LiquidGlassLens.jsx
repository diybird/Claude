/**********************************************************************
 * Liquid Glass LENS — interactive refractive lens (300 x 300)
 * Built from code: AE layers + effects + expressions.
 *
 * A draggable glass orb that REFRACTS & MAGNIFIES the scene behind it
 * (Bulge distortion clipped to a circle), with a specular rim, a
 * chromatic-fringe edge, an inner contact shadow and a drop shadow.
 *
 * RUN:  File › Scripts › Run Script File…  ›  this file
 *
 * USE:
 *   • Auto-float is ON, so it drifts by itself out of the box.
 *   • To drive it: select "Controls", set "Float" = 0, then DRAG the
 *     "Lens" null across the scene. The refraction follows.
 *   • Controls null sliders:
 *       Magnify  – bulge strength (how much it magnifies)
 *       Radius   – lens size
 *       Fringe   – chromatic-edge offset
 *       Float    – 1 = auto drift, 0 = manual drag
 *********************************************************************/

(function liquidGlassLens() {

    var W = 300, H = 300, FPS = 30, DUR = 8;
    var R = 74;                       // lens radius
    var CX = 150, CY = 150;

    app.beginUndoGroup("Build Liquid Glass Lens");

    // ============================================================
    // helpers
    // ============================================================
    function setExpr(p, e) { if (p) p.expression = e; }

    function addSlider(parade, name, val) {
        var fx = parade.addProperty("ADBE Slider Control");
        fx.name = name;
        fx.property(1).setValue(val);
        return fx;
    }
    function addGauss(layer, amt, repeatEdge) {
        var parade = layer.property("ADBE Effect Parade");
        // Grow Bounds FIRST, or the blur on a tight shape/solid gets clipped
        // to the layer's bounding box (the "hard white square" bug).
        try { var gb = parade.addProperty("ADBE Grow Bounds");
              gb.property(1).setValue(Math.ceil(amt * 3) + 24); } catch (e0) {}
        var fx;
        try { fx = parade.addProperty("ADBE Gaussian Blur 2"); }
        catch (e) { fx = parade.addProperty("ADBE Gaussian Blur"); }
        fx.property(1).setValue(amt);
        if (repeatEdge) { try { fx.property(3).setValue(1); } catch (e2) {} }
        return fx;
    }
    // safe property fetch by name then index
    function prop(fx, name, idx) {
        var p = null;
        try { p = fx.property(name); } catch (e) {}
        if (!p) { try { p = fx.property(idx); } catch (e2) {} }
        return p;
    }

    // generic ellipse shape layer (in a target comp)
    function circle(comp, name, dia, fill, fillOp, stroke, strokeW, strokeOp) {
        var L = comp.layers.addShape();
        L.name = name;
        var root = L.property("ADBE Root Vectors Group");
        var g = root.addProperty("ADBE Vector Group");
        var c = g.property("ADBE Vectors Group");
        var e = c.addProperty("ADBE Vector Shape - Ellipse");
        e.property("ADBE Vector Ellipse Size").setValue([dia, dia]);
        if (fill) {
            var f = c.addProperty("ADBE Vector Graphic - Fill");
            f.property("ADBE Vector Fill Color").setValue(fill);
            if (fillOp != null) f.property("ADBE Vector Fill Opacity").setValue(fillOp);
        }
        if (stroke) {
            var s = c.addProperty("ADBE Vector Graphic - Stroke");
            s.property("ADBE Vector Stroke Color").setValue(stroke);
            s.property("ADBE Vector Stroke Width").setValue(strokeW || 1);
            if (strokeOp != null) s.property("ADBE Vector Stroke Opacity").setValue(strokeOp);
        }
        return L;
    }
    function roundRect(comp, name, w, h, round, fill) {
        var L = comp.layers.addShape();
        L.name = name;
        var c = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = c.addProperty("ADBE Vector Shape - Rect");
        r.property("ADBE Vector Rect Size").setValue([w, h]);
        r.property("ADBE Vector Rect Roundness").setValue(round);
        var f = c.addProperty("ADBE Vector Graphic - Fill");
        f.property("ADBE Vector Fill Color").setValue(fill);
        return L;
    }
    function pos(layer) { return layer.property("ADBE Transform Group").property("ADBE Position"); }
    function setOp(layer, v) { layer.property("ADBE Transform Group").property("ADBE Opacity").setValue(v); }

    // ============================================================
    // 1.  Background scene precomp  (so we can use it twice)
    // ============================================================
    var bg = app.project.items.addComp("LG Scene", W, H, 1, DUR, FPS);

    // gradient backdrop
    var base = bg.layers.addSolid([0.92, 0.93, 0.95], "Backdrop", W, H, 1);
    var ramp = base.property("ADBE Effect Parade").addProperty("ADBE Ramp");
    ramp.property("ADBE Ramp-0001").setValue([150, 0]);
    ramp.property("ADBE Ramp-0002").setValue([0.93, 0.94, 0.96]);
    ramp.property("ADBE Ramp-0003").setValue([150, 300]);
    ramp.property("ADBE Ramp-0004").setValue([0.84, 0.85, 0.88]);

    // grid
    var gridL = bg.layers.addSolid([0, 0, 0], "Grid", W, H, 1);
    var grid = gridL.property("ADBE Effect Parade").addProperty("ADBE Grid");
    var gw = prop(grid, "Width", 4);  if (gw) gw.setValue(40);
    var gh = prop(grid, "Height", 5); if (gh) gh.setValue(40);
    var gb = prop(grid, "Border", 6); if (gb) gb.setValue(1.5);
    var gc = prop(grid, "Color", 9);  if (gc) gc.setValue([0.6, 0.62, 0.68]);
    setOp(gridL, 35);

    // headline text
    function text(str, size, color, font, x, y) {
        var t = bg.layers.addText(str);
        var td = t.property("ADBE Text Properties").property("ADBE Text Document");
        var d = td.value;
        d.fontSize = size;
        d.applyFill = true; d.fillColor = color;
        try { d.font = font; } catch (e) {}
        td.setValue(d);
        pos(t).setValue([x, y]);
        return t;
    }
    text("Liquid", 52, [0.10, 0.10, 0.12], "Arial-BoldMT", 28, 120);
    text("glass", 30, [0.54, 0.54, 0.58], "Arial-BoldMT", 150, 162);

    // brand chips
    var chipCols = [[0.13,0.38,1],[0.09,0.78,0.71],[0.59,0.35,1],[1,0.35,0.47],[0.27,0.82,0.35]];
    for (var i = 0; i < chipCols.length; i++) {
        var chip = roundRect(bg, "Chip " + (i+1), 38, 38, 11, chipCols[i]);
        pos(chip).setValue([53 + i * 48, 232]);
    }

    // ============================================================
    // 2.  Main comp
    // ============================================================
    var comp = app.project.items.addComp("Liquid Glass Lens", W, H, 1, DUR, FPS);
    comp.openInViewer();

    // -- background instance (un-refracted) --
    var bgLayer = comp.layers.add(bg);
    bgLayer.name = "Scene";

    // -- refraction instance: same scene + lens distortion, matted to a circle --
    var refr = comp.layers.add(bg);
    refr.name = "Refraction";

    // Different AE builds expose different distortion match names. Try the most
    // lens-like first (Spherize), then Bulge, then CC Lens — use whatever loads.
    var parade = refr.property("ADBE Effect Parade");
    function tryAdd(mn) { try { return parade.addProperty(mn); } catch (e) { return null; } }

    var lensPosExpr = 'thisComp.layer("Lens").transform.position';
    var radExpr     = 'thisComp.layer("Controls").effect("Radius")("Slider")';
    var magExpr     = 'thisComp.layer("Controls").effect("Magnify")("Slider")';

    var fx, type;
    if      ((fx = tryAdd("ADBE Spherize"))) type = "spherize";
    else if ((fx = tryAdd("ADBE BULGE")))    type = "bulge";
    else if ((fx = tryAdd("ADBE Bulge")))    type = "bulge";
    else if ((fx = tryAdd("CC Lens")))       type = "cclens";

    if (type === "spherize") {
        // props: 1 = Radius, 2 = Center of Sphere
        // a touch larger than the matte so Spherize's own hard edge hides under it
        setExpr(prop(fx, "Radius", 1), radExpr + ' + 8');
        setExpr(prop(fx, "Center of Sphere", 2), lensPosExpr);
    } else if (type === "bulge") {
        // props: 1 Horiz R, 2 Vert R, 3 Height, 5 Center
        setExpr(prop(fx, "Horizontal Radius", 1), radExpr);
        setExpr(prop(fx, "Vertical Radius", 2), radExpr);
        setExpr(prop(fx, "Bulge Height", 3), magExpr);
        setExpr(prop(fx, "Bulge Center", 5), lensPosExpr);
    } else if (type === "cclens") {
        // CC Lens: Size (0..big), Center (pixels)
        var sz = prop(fx, "Size", 1); if (sz) sz.setValue(140);
        setExpr(prop(fx, "Center", 2), lensPosExpr);
    } else {
        alert("Couldn't add a distortion effect (Spherize/Bulge/CC Lens all\n" +
              "failed on this AE build). The lens will build without refraction;\n" +
              "apply a Spherize effect to the 'Refraction' layer manually.");
    }
    addGauss(refr, 1.4);                       // glass softens a touch

    // ============================================================
    // 3.  Glass surface — comp-sized SOLIDS with FEATHERED MASKS.
    //     Mask feather can't be clipped (unlike blur on a tight shape),
    //     so every soft element stays soft on any AE build.
    // ============================================================
    var CXc = W / 2, CYc = H / 2;            // mask centre == solid anchor

    function ellipseShape(cx, cy, rx, ry) {
        ry = ry == null ? rx : ry;
        var kx = rx * 0.5523, ky = ry * 0.5523;
        var s = new Shape();
        s.vertices    = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]];
        s.inTangents  = [[-kx, 0], [0, -ky], [kx, 0], [0, ky]];
        s.outTangents = [[kx, 0], [0, ky], [-kx, 0], [0, -ky]];
        s.closed = true;
        return s;
    }
    function addMask(layer, shape, feather, mode) {
        var m = layer.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        m.property("ADBE Mask Shape").setValue(shape);
        if (feather != null) m.property("ADBE Mask Feather").setValue([feather, feather]);
        if (mode) m.maskMode = mode;
        return m;
    }
    function solid(name, color) { return comp.layers.addSolid(color, name, W, H, 1); }
    function follow(layer, offx, offy) {
        setExpr(pos(layer), 'thisComp.layer("Lens").transform.position + [' + (offx||0) + ',' + (offy||0) + ']');
    }
    function scaleWithRadius(layer, mult) {
        setExpr(layer.property("ADBE Transform Group").property("ADBE Scale"),
            'var r = thisComp.layer("Controls").effect("Radius")("Slider");\n' +
            'var s = r / ' + R + ' * ' + (mult || 100) + ';\n[s, s];');
    }

    // -- circular matte -> feathered refraction edge --
    var matte = solid("Lens Mask", [1, 1, 1]);
    addMask(matte, ellipseShape(CXc, CYc, R), 5);
    follow(matte, 0, 0); scaleWithRadius(matte);
    try { refr.setTrackMatte(matte, TrackMatteType.ALPHA); }
    catch (e) { try { matte.moveBefore(refr); refr.trackMatteType = TrackMatteType.ALPHA; } catch (e2) {} }

    // -- soft drop shadow on the scene, under the lens --
    var shadow = solid("Drop Shadow", [0, 0, 0]);
    addMask(shadow, ellipseShape(CXc, CYc, R * 1.02), 34);
    setOp(shadow, 30); follow(shadow, 0, 12); scaleWithRadius(shadow);
    shadow.moveBefore(bgLayer);

    // -- chromatic fringe: soft red/blue rings nudged opposite ways --
    function fringe(name, color, dir) {
        var L = solid(name, color);
        addMask(L, ellipseShape(CXc, CYc, R - 1), 2.5);
        addMask(L, ellipseShape(CXc, CYc, R - 5), 2.5, MaskMode.SUBTRACT);
        L.blendingMode = BlendingMode.ADD; setOp(L, 55); scaleWithRadius(L);
        setExpr(pos(L),
            'var f = thisComp.layer("Controls").effect("Fringe")("Slider");\n' +
            'thisComp.layer("Lens").transform.position + [' + dir + '*f, ' + dir + '*f];');
        return L;
    }
    fringe("Fringe R", [1, 0.20, 0.20], 1);
    fringe("Fringe B", [0.25, 0.50, 1], -1);

    // -- milky frost --
    var frost = solid("Frost", [1, 1, 1]);
    addMask(frost, ellipseShape(CXc, CYc, R - 2), 3);
    setOp(frost, 8); follow(frost, 0, 0); scaleWithRadius(frost);

    // -- soft inner contact shadow just inside the rim --
    var inner = solid("Inner Shadow", [0, 0, 0]);
    addMask(inner, ellipseShape(CXc, CYc, R - 2), 8);
    addMask(inner, ellipseShape(CXc, CYc, R - 13), 10, MaskMode.SUBTRACT);
    setOp(inner, 16); follow(inner, 0, 0); scaleWithRadius(inner);

    // -- bright soft rim --
    var rim = solid("Rim", [1, 1, 1]);
    addMask(rim, ellipseShape(CXc, CYc, R), 2.5);
    addMask(rim, ellipseShape(CXc, CYc, R - 3.5), 2.5, MaskMode.SUBTRACT);
    rim.blendingMode = BlendingMode.ADD; setOp(rim, 55); follow(rim, 0, 0); scaleWithRadius(rim);

    // -- specular CRESCENT along the top-left rim (disc minus offset disc) --
    var spec = solid("Specular", [1, 1, 1]);
    addMask(spec, ellipseShape(CXc, CYc, R * 0.94), 7);
    addMask(spec, ellipseShape(CXc + R * 0.20, CYc + R * 0.24, R * 0.90), 12, MaskMode.SUBTRACT);
    spec.blendingMode = BlendingMode.ADD; setOp(spec, 78); follow(spec, 0, 0); scaleWithRadius(spec);

    // -- tiny sparkle --
    var spark = solid("Sparkle", [1, 1, 1]);
    addMask(spark, ellipseShape(CXc, CYc, 6), 4);
    spark.blendingMode = BlendingMode.ADD; setOp(spark, 90);
    follow(spark, -R * 0.46, -R * 0.5);

    // ============================================================
    // 4.  Controls + Lens null
    // ============================================================
    var controls = comp.layers.addNull(DUR);
    controls.name = "Controls";
    pos(controls).setValue([26, 26]);
    var cFx = controls.property("ADBE Effect Parade");
    addSlider(cFx, "Magnify", 1.3);
    addSlider(cFx, "Radius", R);
    addSlider(cFx, "Fringe", 2);
    addSlider(cFx, "Float", 1);

    var lens = comp.layers.addNull(DUR);
    lens.name = "Lens";
    var lp = pos(lens);
    lp.setValue([CX, CY]);
    setExpr(lp,
        'var f = thisComp.layer("Controls").effect("Float")("Slider");\n' +
        '(f > 0) ? [150 + Math.cos(time*0.7)*62, 150 + Math.sin(time*0.9)*46] : value;');

    // marker + note
    comp.markerProperty.setValueAtTime(0, new MarkerValue("Set Controls 'Float' = 0, then drag the 'Lens' null"));

    app.endUndoGroup();

    alert("Liquid Glass Lens — build 3 (feathered masks) 🔮\n\n" +
          "Distortion used: " + (type ? type : "NONE") + "\n" +
          "(If you don't see this exact text, AE ran an older copy of the file.)\n\n" +
          "It's drifting on auto-float. To drive it yourself:\n" +
          "  1. Select the 'Controls' null\n" +
          "  2. Set the 'Float' slider to 0\n" +
          "  3. Drag the 'Lens' null over the scene\n\n" +
          "Tune Magnify / Radius / Fringe on the Controls null.");

})();
