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

    // -- refraction instance: same scene + Bulge, matted to the lens circle --
    var refr = comp.layers.add(bg);
    refr.name = "Refraction";
    var bulge = refr.property("ADBE Effect Parade").addProperty("ADBE BULGE");
    var bhR = prop(bulge, "Horizontal Radius", 1); if (bhR) bhR.setValue(R);
    var bvR = prop(bulge, "Vertical Radius", 2);   if (bvR) bvR.setValue(R);
    var bHt = prop(bulge, "Bulge Height", 3);
    var bCtr = prop(bulge, "Bulge Center", 5);
    setExpr(bhR, 'thisComp.layer("Controls").effect("Radius")("Slider")');
    setExpr(bvR, 'thisComp.layer("Controls").effect("Radius")("Slider")');
    setExpr(bHt, 'thisComp.layer("Controls").effect("Magnify")("Slider")');
    setExpr(bCtr, 'thisComp.layer("Lens").transform.position');
    addGauss(refr, 1.4);                       // glass softens a touch

    // circle matte that clips the refraction (follows the Lens)
    var matte = circle(comp, "Lens Mask", R * 2, [1,1,1], 100, null, 0, 0);
    var mp = pos(matte);
    setExpr(mp, 'thisComp.layer("Lens").transform.position');
    setExpr(matte.property("ADBE Transform Group").property("ADBE Scale"),
        'var r = thisComp.layer("Controls").effect("Radius")("Slider");\n' +
        'var s = r / ' + R + ' * 100;\n[s, s];');
    try { refr.setTrackMatte(matte, TrackMatteType.ALPHA); }
    catch (e) { try { matte.moveBefore(refr); refr.trackMatteType = TrackMatteType.ALPHA; } catch (e2) {} }

    // ============================================================
    // 3.  Glass surface (all parented to the Lens null)
    // ============================================================
    function follow(layer, offx, offy) {            // ride along with the lens
        var p = pos(layer);
        setExpr(p, 'thisComp.layer("Lens").transform.position + [' + (offx||0) + ',' + (offy||0) + ']');
    }
    function scaleWithRadius(layer, mult) {
        setExpr(layer.property("ADBE Transform Group").property("ADBE Scale"),
            'var r = thisComp.layer("Controls").effect("Radius")("Slider");\n' +
            'var s = r / ' + R + ' * ' + (mult || 100) + ';\n[s, s];');
    }

    // drop shadow (sits on the scene, behind the surface highlights)
    var shadow = circle(comp, "Drop Shadow", R * 2, [0,0,0], 100, null, 0, 0);
    addGauss(shadow, 16); setOp(shadow, 20);
    follow(shadow, 0, 9); scaleWithRadius(shadow, 105);
    shadow.moveBefore(bgLayer);                       // below the refraction, on the scene

    // chromatic fringe: a red ring nudged one way, a blue ring the other
    var caR = circle(comp, "Fringe R", R * 2 - 2, null, null, [1, 0.15, 0.15], 2, 60);
    caR.blendingMode = BlendingMode.ADD; addGauss(caR, 1); scaleWithRadius(caR);
    setExpr(pos(caR),
        'var f = thisComp.layer("Controls").effect("Fringe")("Slider");\n' +
        'thisComp.layer("Lens").transform.position + [f, f];');
    var caB = circle(comp, "Fringe B", R * 2 - 2, null, null, [0.2, 0.45, 1], 2, 60);
    caB.blendingMode = BlendingMode.ADD; addGauss(caB, 1); scaleWithRadius(caB);
    setExpr(pos(caB),
        'var f = thisComp.layer("Controls").effect("Fringe")("Slider");\n' +
        'thisComp.layer("Lens").transform.position - [f, f];');

    // milky frost (very faint white fill)
    var frost = circle(comp, "Frost", R * 2, [1,1,1], 100, null, 0, 0);
    setOp(frost, 7); follow(frost, 0, 0); scaleWithRadius(frost);

    // bright rim
    var rim = circle(comp, "Rim", R * 2 - 1, null, null, [1,1,1], 1.5, 65);
    rim.blendingMode = BlendingMode.ADD; follow(rim, 0, 0); scaleWithRadius(rim);

    // inner contact shadow
    var inner = circle(comp, "Inner Shadow", R * 2 - 10, null, null, [0,0,0], 5, 22);
    addGauss(inner, 3); follow(inner, 0, 0); scaleWithRadius(inner, 96);

    // specular crescent (top-left) + sparkle
    var spec = circle(comp, "Specular", R * 0.95, [1,1,1], 100, null, 0, 0);
    addGauss(spec, R * 0.32); spec.blendingMode = BlendingMode.ADD; setOp(spec, 60);
    follow(spec, -R * 0.42, -R * 0.46); scaleWithRadius(spec);
    var spark = circle(comp, "Sparkle", 9, [1,1,1], 100, null, 0, 0);
    addGauss(spark, 3); spark.blendingMode = BlendingMode.ADD; setOp(spark, 90);
    follow(spark, -R * 0.5, -R * 0.5);

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

    alert("Liquid Glass Lens built! 🔮\n\n" +
          "It's drifting on auto-float.\n\n" +
          "To drive it yourself:\n" +
          "  1. Select the 'Controls' null\n" +
          "  2. Set the 'Float' slider to 0\n" +
          "  3. Drag the 'Lens' null over the scene\n\n" +
          "Tune Magnify / Radius / Fringe on the Controls null.");

})();
