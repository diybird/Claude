/**********************************************************************
 * Liquid Glass Dock — Apple-style interactive UI (300 x 300)
 * Builds the whole thing from code: AE layers + expressions.
 *
 * HOW TO RUN
 *   After Effects  ›  File › Scripts › Run Script File…  ›  pick this file
 *   (or drop it in your ScriptUI Panels / Scripts folder)
 *
 * HOW TO USE
 *   • Out of the box "Auto Demo" is ON, so the dock animates by itself.
 *   • To drive it by hand: select the "Controls" null, set the
 *     "Auto Demo" slider to 0, then DRAG the "Cursor" null left/right
 *     across the dock in the Composition viewer. The buttons magnify,
 *     lift, and the glass sheen follows — like sliding a finger over
 *     Apple's Liquid Glass.
 *   • Tune the feel on the "Controls" null:
 *       Magnify        – how big the focused button grows
 *       Influence      – how many neighbours react (spread)
 *       Glass Opacity  – frostiness of the slab
 *       Auto Demo      – 1 = auto sweep, 0 = manual drag
 *********************************************************************/

(function liquidGlassDock() {

    // ----------------------------------------------------------------
    // Comp + global geometry
    // ----------------------------------------------------------------
    var W = 300, H = 300;
    var FPS = 30, DUR = 8;

    var DOCK_CX = 150, DOCK_CY = 205;          // dock centre
    var DOCK_W = 256, DOCK_H = 74, DOCK_R = 24;
    var BTN = 44, BTN_R = 12;
    var BTN_X = [58, 104, 150, 196, 242];      // 5 buttons, evenly spaced
    var BTN_Y = DOCK_CY;

    app.beginUndoGroup("Build Liquid Glass Dock");

    var comp = app.project.items.addComp("Liquid Glass Dock", W, H, 1, DUR, FPS);
    comp.bgColor = [0.02, 0.02, 0.05];
    comp.openInViewer();

    // ----------------------------------------------------------------
    // Small helpers — keep the layer-building readable
    // ----------------------------------------------------------------
    function setExpr(prop, expr) { prop.expression = expr; }

    function addSlider(fxParade, name, val) {
        var fx = fxParade.addProperty("ADBE Slider Control");
        fx.name = name;
        fx.property("ADBE Slider Control-0001").setValue(val);
        return fx;
    }

    // repeatEdge ONLY for the full-frame backdrop. On a small shape it smears
    // the blur out to the layer (comp) bounds -> hard-edged squares.
    function addGaussian(layer, amount, repeatEdge) {
        var parade = layer.property("ADBE Effect Parade");
        var fx;
        try { fx = parade.addProperty("ADBE Gaussian Blur 2"); }
        catch (e) { fx = parade.addProperty("ADBE Gaussian Blur"); }
        fx.property(1).setValue(amount);           // Blurriness
        if (repeatEdge) { try { fx.property(3).setValue(1); } catch (e2) {} }
        return fx;
    }

    // A rounded-rect shape layer (fill + optional stroke)
    function roundRectLayer(name, w, h, round, fill, fillOp, stroke, strokeW, strokeOp) {
        var L = comp.layers.addShape();
        L.name = name;
        var root = L.property("ADBE Root Vectors Group");
        var g = root.addProperty("ADBE Vector Group");
        g.name = "Shape";
        var c = g.property("ADBE Vectors Group");
        var rect = c.addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([w, h]);
        rect.property("ADBE Vector Rect Roundness").setValue(round);
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

    // A soft glow (white ellipse, blurred, additive). w/h let it be a streak.
    function glowLayer(name, w, h, op) {
        var L = comp.layers.addShape();
        L.name = name;
        var root = L.property("ADBE Root Vectors Group");
        var g = root.addProperty("ADBE Vector Group");
        var c = g.property("ADBE Vectors Group");
        var e = c.addProperty("ADBE Vector Shape - Ellipse");
        e.property("ADBE Vector Ellipse Size").setValue([w, h]);
        var f = c.addProperty("ADBE Vector Graphic - Fill");
        f.property("ADBE Vector Fill Color").setValue([1, 1, 1]);
        addGaussian(L, Math.min(w, h) * 0.5);
        L.property("ADBE Transform Group").property("ADBE Opacity").setValue(op);
        L.blendingMode = BlendingMode.ADD;
        return L;
    }

    // A blurred colour blob for the glass to refract / frost over
    function blobLayer(name, size, color, pos) {
        var L = comp.layers.addShape();
        L.name = name;
        var root = L.property("ADBE Root Vectors Group");
        var g = root.addProperty("ADBE Vector Group");
        var c = g.property("ADBE Vectors Group");
        var e = c.addProperty("ADBE Vector Shape - Ellipse");
        e.property("ADBE Vector Ellipse Size").setValue([size, size]);
        var f = c.addProperty("ADBE Vector Graphic - Fill");
        f.property("ADBE Vector Fill Color").setValue(color);
        addGaussian(L, size * 0.55);               // soft round blob (no repeat edge)
        var p = L.property("ADBE Transform Group").property("ADBE Position");
        p.setValue(pos);
        setExpr(p, "wiggle(0.25, 18)");            // slow drift => living refraction
        L.property("ADBE Transform Group").property("ADBE Opacity").setValue(45);
        return L;
    }

    // ================================================================
    // Build back -> front  (each new layer is created at the top)
    // ================================================================

    // --- Background gradient ----------------------------------------
    var bg = comp.layers.addSolid([0.05, 0.06, 0.10], "Background", W, H, 1);
    var ramp = bg.property("ADBE Effect Parade").addProperty("ADBE Ramp");
    ramp.property("ADBE Ramp-0001").setValue([150, 150]);          // start point
    ramp.property("ADBE Ramp-0002").setValue([0.12, 0.14, 0.24]);  // start colour
    ramp.property("ADBE Ramp-0003").setValue([150, 340]);          // end point
    ramp.property("ADBE Ramp-0004").setValue([0.02, 0.02, 0.05]);  // end colour
    ramp.property("ADBE Ramp-0005").setValue(2);                   // radial

    // --- Controls null (the tuning knobs) ---------------------------
    var controls = comp.layers.addNull(DUR);
    controls.name = "Controls";
    controls.property("ADBE Transform Group").property("ADBE Position").setValue([24, 24]);
    var cFx = controls.property("ADBE Effect Parade");
    addSlider(cFx, "Magnify", 65);
    addSlider(cFx, "Influence", 38);
    addSlider(cFx, "Glass Opacity", 22);
    addSlider(cFx, "Auto Demo", 1);

    // --- Colour blobs behind the glass ------------------------------
    blobLayer("Blob 1", 130, [0.34, 0.20, 0.85], [108, 150]);
    blobLayer("Blob 2", 124, [0.06, 0.55, 0.72], [205, 205]);

    // --- Backdrop blur (frosts whatever is behind the dock) ---------
    var backdrop = comp.layers.addSolid([0, 0, 0], "Backdrop Blur", W, H, 1);
    backdrop.adjustmentLayer = true;
    addGaussian(backdrop, 22, true);          // full-frame -> repeat edge OK

    // --- Glass matte (clips the blur to the dock shape) -------------
    var matte = roundRectLayer("Glass Matte", DOCK_W, DOCK_H, DOCK_R, [1, 1, 1], 100);
    matte.property("ADBE Transform Group").property("ADBE Position").setValue([DOCK_CX, DOCK_CY]);
    // Link the backdrop blur so it only shows inside the dock outline
    try {
        backdrop.setTrackMatte(matte, TrackMatteType.ALPHA);
    } catch (e) {
        try {
            matte.moveBefore(backdrop);
            backdrop.trackMatteType = TrackMatteType.ALPHA;
        } catch (e2) {}
    }

    // --- The glass slab itself --------------------------------------
    var glass = roundRectLayer("Glass Fill", DOCK_W, DOCK_H, DOCK_R,
                               [1, 1, 1], 26,            // translucent white
                               [1, 1, 1], 1.4, 55);      // thin rim stroke
    var glassPos = glass.property("ADBE Transform Group").property("ADBE Position");
    glassPos.setValue([DOCK_CX, DOCK_CY]);
    setExpr(glass.property("ADBE Transform Group").property("ADBE Opacity"),
            'thisComp.layer("Controls").effect("Glass Opacity")("Slider")');
    // soft drop shadow so the slab separates from the background
    var ds = glass.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow");
    ds.property("ADBE Drop Shadow-0002").setValue(60);   // opacity
    ds.property("ADBE Drop Shadow-0004").setValue(6);    // distance
    ds.property("ADBE Drop Shadow-0005").setValue(18);   // softness

    // top inner highlight line (the bright edge of real glass)
    var rim = roundRectLayer("Rim Light", DOCK_W - 8, DOCK_H - 8, DOCK_R - 4,
                             null, null, [1, 1, 1], 1, 40);
    rim.property("ADBE Transform Group").property("ADBE Position").setValue([DOCK_CX, DOCK_CY - 1]);
    rim.blendingMode = BlendingMode.ADD;
    rim.property("ADBE Transform Group").property("ADBE Opacity").setValue(55);

    // --- The dock buttons -------------------------------------------
    var btnColors = [
        [0.20, 0.55, 1.00],   // blue
        [0.10, 0.82, 0.75],   // teal
        [0.62, 0.38, 1.00],   // purple
        [1.00, 0.46, 0.55],   // coral
        [0.30, 0.86, 0.45]    // green
    ];

    function buttonScaleExpr(bx) {
        return [
            'var c = thisComp.layer("Controls");',
            'var R = c.effect("Influence")("Slider");',
            'var M = c.effect("Magnify")("Slider");',
            'var cx = thisComp.layer("Cursor").transform.position[0];',
            'var dx = ' + bx + ' - cx;',
            'var f = Math.exp(-(dx*dx)/(2*R*R));',
            'var s = 100 + M*f;',
            '[s, s];'
        ].join('\n');
    }
    function buttonPosExpr(bx) {
        return [
            'var c = thisComp.layer("Controls");',
            'var R = c.effect("Influence")("Slider");',
            'var cx = thisComp.layer("Cursor").transform.position[0];',
            'var dx = ' + bx + ' - cx;',
            'var f = Math.exp(-(dx*dx)/(2*R*R));',
            '[' + bx + ', ' + BTN_Y + ' - 16*f];'
        ].join('\n');
    }

    for (var i = 0; i < BTN_X.length; i++) {
        var b = roundRectLayer("App " + (i + 1), BTN, BTN, BTN_R,
                               btnColors[i], 100,
                               [1, 1, 1], 1, 30);
        var tg = b.property("ADBE Transform Group");
        var bp = tg.property("ADBE Position");
        bp.setValue([BTN_X[i], BTN_Y]);
        setExpr(bp, buttonPosExpr(BTN_X[i]));
        setExpr(tg.property("ADBE Scale"), buttonScaleExpr(BTN_X[i]));
    }

    // --- Specular sheen: a thin streak along the TOP of the glass ----
    var sheen = glowLayer("Sheen", 116, 22, 18);
    var shPos = sheen.property("ADBE Transform Group").property("ADBE Position");
    setExpr(shPos,
        'var cx = thisComp.layer("Cursor").transform.position[0];\n' +
        'var x = Math.max(95, Math.min(205, cx));\n' +
        '[x, ' + (DOCK_CY - 22) + '];');                 // sits on the top edge
    setExpr(sheen.property("ADBE Transform Group").property("ADBE Scale"),
        'var w = 4*Math.sin(time*3);\n[100 + w, 100 - w];');   // subtle liquid wobble

    // --- The fingertip light (small + soft, not a spotlight) --------
    var light = glowLayer("Cursor Light", 30, 30, 22);

    // --- The Cursor control null (drag me!) -------------------------
    var cursor = comp.layers.addNull(DUR);
    cursor.name = "Cursor";
    var cursorPos = cursor.property("ADBE Transform Group").property("ADBE Position");
    cursorPos.setValue([DOCK_CX, DOCK_CY]);
    setExpr(cursorPos,
        'var d = thisComp.layer("Controls").effect("Auto Demo")("Slider");\n' +
        '(d > 0) ? [150 + 96*Math.sin(time*1.1), 150] : value;');

    // Park the fingertip glow on the cursor and give it a soft pulse
    light.parent = cursor;
    light.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0]);
    setExpr(light.property("ADBE Transform Group").property("ADBE Opacity"),
        '20 + 8*Math.sin(time*4)');

    // ----------------------------------------------------------------
    // Helpful marker on the comp
    // ----------------------------------------------------------------
    var mk = new MarkerValue("Set 'Auto Demo' = 0, then drag the 'Cursor' null");
    comp.markerProperty.setValueAtTime(0, mk);

    app.endUndoGroup();

    alert("Liquid Glass Dock built! ✨\n\n" +
          "It's animating via the Auto Demo sweep.\n\n" +
          "To drive it yourself:\n" +
          "  1. Select the 'Controls' null\n" +
          "  2. Set 'Auto Demo' slider to 0\n" +
          "  3. Drag the 'Cursor' null across the dock\n\n" +
          "Tune Magnify / Influence / Glass Opacity to taste.");

})();
