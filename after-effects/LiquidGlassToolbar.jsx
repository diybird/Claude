/**********************************************************************
 * Liquid Glass TOOLBAR — clean frosted pill over a green card.
 * Built from code: AE layers + masks + effects. (build 1)
 *
 * RUN:  File › Scripts › Run Script File…  ›  this file
 *
 * Produces a 900 x 440 comp: a black background, a green rounded card,
 * and a floating frosted-glass capsule with 3 thin icons (add / bookmark
 * / more), a dark top edge, a bright bottom rim and a soft drop shadow.
 *********************************************************************/

(function liquidGlassToolbar() {

    var W = 900, H = 440, FPS = 30, DUR = 5;

    // pill geometry
    var PX = 450, PY = 196, PW = 436, PH = 132, PR = 66;
    var pTop = PY - PH / 2, pBot = PY + PH / 2;

    app.beginUndoGroup("Build Liquid Glass Toolbar");

    // ============================================================
    // helpers
    // ============================================================
    function roundedRectShape(cx, cy, w, h, r) {
        var k = r * 0.5523;
        var l = cx - w / 2, rt = cx + w / 2, t = cy - h / 2, b = cy + h / 2;
        var s = new Shape();
        s.vertices = [
            [l + r, t], [rt - r, t], [rt, t + r], [rt, b - r],
            [rt - r, b], [l + r, b], [l, b - r], [l, t + r]
        ];
        s.inTangents = [
            [-k, 0], [0, 0], [0, -k], [0, 0],
            [k, 0], [0, 0], [0, k], [0, 0]
        ];
        s.outTangents = [
            [0, 0], [k, 0], [0, 0], [0, k],
            [0, 0], [-k, 0], [0, 0], [0, -k]
        ];
        s.closed = true;
        return s;
    }
    function ellipseShapeObj(cx, cy, rx, ry) {
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
    function setOp(layer, v) { layer.property("ADBE Transform Group").property("ADBE Opacity").setValue(v); }
    function setPos(layer, p) { layer.property("ADBE Transform Group").property("ADBE Position").setValue(p); }
    function addGauss(layer, amt) {
        var fx;
        try { fx = layer.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2"); }
        catch (e) { fx = layer.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur"); }
        fx.property(1).setValue(amt);
        try { fx.property(3).setValue(1); } catch (e2) {}
        return fx;
    }
    function addRamp(layer, p1, c1, p2, c2, shape) {
        var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Ramp");
        fx.property("ADBE Ramp-0001").setValue(p1);
        fx.property("ADBE Ramp-0002").setValue(c1);
        fx.property("ADBE Ramp-0003").setValue(p2);
        fx.property("ADBE Ramp-0004").setValue(c2);
        if (shape) fx.property("ADBE Ramp-0005").setValue(shape);
        return fx;
    }

    // ============================================================
    // 1. green card scene (precomp, reused for the backdrop blur)
    // ============================================================
    var card = app.project.items.addComp("LG Card", W, H, 1, DUR, FPS);
    var blackBg = card.layers.addSolid([0.02, 0.02, 0.02], "Black", W, H, 1);
    var green = card.layers.addSolid([0.3, 0.6, 0.28], "Green Card", W, H, 1);
    addMask(green, roundedRectShape(450, 560, 840, 760, 78), 1.5);
    addRamp(green, [450, 175], [0.42, 0.74, 0.34], [450, 470], [0.15, 0.40, 0.16]);

    // ============================================================
    // 2. main comp
    // ============================================================
    var comp = app.project.items.addComp("Liquid Glass Toolbar", W, H, 1, DUR, FPS);
    comp.bgColor = [0, 0, 0];
    comp.openInViewer();

    function solid(name, color) { return comp.layers.addSolid(color, name, W, H, 1); }

    // -- scene (un-blurred) --
    var scene = comp.layers.add(card);  scene.name = "Scene";

    // -- frosted backdrop: blurred copy of the scene, clipped to the pill --
    var backdrop = comp.layers.add(card); backdrop.name = "Backdrop Blur";
    addGauss(backdrop, 14);
    var capMatte = solid("Pill Matte", [1, 1, 1]);
    addMask(capMatte, roundedRectShape(PX, PY, PW, PH, PR), 2);
    try { backdrop.setTrackMatte(capMatte, TrackMatteType.ALPHA); }
    catch (e) { try { capMatte.moveBefore(backdrop); backdrop.trackMatteType = TrackMatteType.ALPHA; } catch (e2) {} }

    // -- soft drop shadow on the scene, under the pill --
    var shadow = solid("Drop Shadow", [0, 0, 0]);
    addMask(shadow, roundedRectShape(PX, PY, PW + 6, PH + 6, PR), 26);
    setOp(shadow, 32); setPos(shadow, [W / 2, H / 2 + 16]);
    shadow.moveBefore(scene);

    // -- milky glass tint --
    var tint = solid("Glass Tint", [1, 1, 1]);
    addMask(tint, roundedRectShape(PX, PY, PW, PH, PR), 2);
    setOp(tint, 10);

    // -- glass thickness shading: dark top -> light bottom (Overlay) --
    var shade = solid("Glass Shading", [0.5, 0.5, 0.5]);
    addMask(shade, roundedRectShape(PX, PY, PW, PH, PR), 2);
    addRamp(shade, [PX, pTop + 4], [0.06, 0.07, 0.06], [PX, pBot - 4], [0.95, 0.98, 0.95]);
    try { shade.blendingMode = BlendingMode.OVERLAY; } catch (e) {}
    setOp(shade, 90);

    // -- focused dark band at the very top edge --
    var topDark = solid("Top Shade", [0, 0, 0]);
    addMask(topDark, ellipseShapeObj(PX, pTop + 4, PW * 0.46, 26), 18);
    setOp(topDark, 55);

    // -- bright bottom rim glow --
    var botLight = solid("Bottom Glow", [1, 1, 1]);
    addMask(botLight, ellipseShapeObj(PX, pBot - 4, PW * 0.44, 22), 16);
    try { botLight.blendingMode = BlendingMode.ADD; } catch (e) {}
    setOp(botLight, 55);

    // -- crisp rim stroke (outer minus inner), brighter toward the bottom --
    var rim = solid("Rim", [1, 1, 1]);
    addMask(rim, roundedRectShape(PX, PY, PW, PH, PR), 1.2);
    addMask(rim, roundedRectShape(PX, PY, PW - 3, PH - 3, PR - 1.5), 1.2, MaskMode.SUBTRACT);
    try { rim.blendingMode = BlendingMode.ADD; } catch (e) {}
    setOp(rim, 50);

    // ============================================================
    // 3. icons (thin white strokes)
    // ============================================================
    var ICON = [1, 1, 1], LW = 3.2;
    function shapeLayer(name) { var L = comp.layers.addShape(); L.name = name; return L; }
    function vGroup(L) {
        return L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    }
    function rectIn(c, w, h, round) {
        var r = c.addProperty("ADBE Vector Shape - Rect");
        r.property("ADBE Vector Rect Size").setValue([w, h]);
        r.property("ADBE Vector Rect Roundness").setValue(round);
    }
    function pathIn(c, verts, closed) {
        var g = c.addProperty("ADBE Vector Shape - Group");
        var s = new Shape(); s.vertices = verts; s.closed = !!closed;
        g.property("ADBE Vector Shape").setValue(s);
    }
    function ellipseIn(c, dia, off) {
        var e = c.addProperty("ADBE Vector Shape - Ellipse");
        e.property("ADBE Vector Ellipse Size").setValue([dia, dia]);
        if (off) e.property("ADBE Vector Ellipse Position").setValue(off);
    }
    function strokeIn(c, col, w) {
        var s = c.addProperty("ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Color").setValue(col);
        s.property("ADBE Vector Stroke Width").setValue(w);
        try { s.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {}
        try { s.property("ADBE Vector Stroke Line Join").setValue(2); } catch (e2) {}
    }
    function fillIn(c, col) {
        c.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col);
    }

    var ix = [PX - 132, PX, PX + 132];

    // (a) add  — rounded rectangle outline + plus
    var add = shapeLayer("Icon Add");
    var ca = vGroup(add);
    rectIn(ca, 52, 42, 11);
    pathIn(ca, [[-11, 0], [11, 0]], false);
    pathIn(ca, [[0, -11], [0, 11]], false);
    strokeIn(ca, ICON, LW);
    setPos(add, [ix[0], PY]);

    // (b) bookmark
    var bm = shapeLayer("Icon Bookmark");
    var cb = vGroup(bm);
    pathIn(cb, [[-17, -24], [17, -24], [17, 24], [0, 11], [-17, 24]], true);
    strokeIn(cb, ICON, LW);
    setPos(bm, [ix[1], PY]);

    // (c) more (ellipsis)
    var more = shapeLayer("Icon More");
    var cm = vGroup(more);
    ellipseIn(cm, 6.2, [-16, 0]);
    ellipseIn(cm, 6.2, [0, 0]);
    ellipseIn(cm, 6.2, [16, 0]);
    fillIn(cm, ICON);
    setPos(more, [ix[2], PY]);

    app.endUndoGroup();

    alert("Liquid Glass Toolbar — build 1 ✨\n\n" +
          "Comp 'Liquid Glass Toolbar' (900x440):\n" +
          "green card + frosted pill with add / bookmark / more icons.\n\n" +
          "Tweak: pill size via PX/PY/PW/PH/PR at the top of the script;\n" +
          "glass strength via the 'Glass Shading' / 'Top Shade' / 'Bottom Glow'\n" +
          "layer opacities; backdrop frost via the 'Backdrop Blur' Gaussian.");

})();
