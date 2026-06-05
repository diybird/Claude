/**********************************************************************
 * Liquid Glass TOOLBAR — null-driven, affects layers underneath.  (build 2)
 *
 * RUN:  File › Scripts › Run Script File…  ›  this file
 *
 * • A "Glass" null moves the whole toolbar. Drag it in the comp.
 * • The frost is an ADJUSTMENT layer, so it blurs / tints whatever
 *   layers are BELOW it, clipped to the capsule and following the null.
 *   --> Put YOUR content on layers BELOW "Glass Frost" (above the demo)
 *       and the glass will affect them as you drag over them.
 * • "Controls" null: Frost (blur amount), Float (1 = auto drift demo).
 *
 * The green card + dots + text at the bottom are just a DEMO so you can
 * see the effect — delete them and drop in your own layers.
 *********************************************************************/

(function liquidGlassToolbarNull() {

    var W = 900, H = 440, FPS = 30, DUR = 6;

    // pill geometry, defined around the comp CENTRE so it moves as one unit
    var CX = W / 2, CY = H / 2;          // = solid anchor (mask centre)
    var PW = 436, PH = 132, PR = 66;
    var pTopY = CY - PH / 2, pBotY = CY + PH / 2;
    var START = [W / 2, 150];            // where the null (pill) starts
    var distortType = null;              // which refraction effect loaded

    app.beginUndoGroup("Build Liquid Glass Toolbar (null)");

    // ===================== helpers =====================
    function setExpr(p, e) { if (p) p.expression = e; }
    function pos(L) { return L.property("ADBE Transform Group").property("ADBE Position"); }
    function setOp(L, v) { L.property("ADBE Transform Group").property("ADBE Opacity").setValue(v); }
    function setPos(L, p) { pos(L).setValue(p); }
    function follow(L, ox, oy) {
        setExpr(pos(L), 'thisComp.layer("Glass").transform.position + [' + (ox||0) + ',' + (oy||0) + ']');
    }
    function roundedRectShape(cx, cy, w, h, r) {
        var k = r * 0.5523, l = cx - w/2, rt = cx + w/2, t = cy - h/2, b = cy + h/2;
        var s = new Shape();
        s.vertices = [[l+r,t],[rt-r,t],[rt,t+r],[rt,b-r],[rt-r,b],[l+r,b],[l,b-r],[l,t+r]];
        s.inTangents  = [[-k,0],[0,0],[0,-k],[0,0],[k,0],[0,0],[0,k],[0,0]];
        s.outTangents = [[0,0],[k,0],[0,0],[0,k],[0,0],[-k,0],[0,0],[0,-k]];
        s.closed = true; return s;
    }
    function ellipseShapeObj(cx, cy, rx, ry) {
        var kx = rx*0.5523, ky = ry*0.5523, s = new Shape();
        s.vertices    = [[cx,cy-ry],[cx+rx,cy],[cx,cy+ry],[cx-rx,cy]];
        s.inTangents  = [[-kx,0],[0,-ky],[kx,0],[0,ky]];
        s.outTangents = [[kx,0],[0,ky],[-kx,0],[0,-ky]];
        s.closed = true; return s;
    }
    function addMask(L, shape, feather, mode) {
        var m = L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        m.property("ADBE Mask Shape").setValue(shape);
        if (feather != null) m.property("ADBE Mask Feather").setValue([feather, feather]);
        if (mode) m.maskMode = mode;
        return m;
    }
    function prop(fx, name, idx) {
        var p = null;
        try { p = fx.property(name); } catch (e) {}
        if (!p) { try { p = fx.property(idx); } catch (e2) {} }
        return p;
    }
    // expression that rebuilds the capsule mask AT the null (so the mask moves
    // while the adjustment layer's transform stays identity -> no content drag)
    function capsulePathExpr(w, h, r) {
        return [
            'var n = thisComp.layer("Glass").transform.position;',
            'var w=' + w + ', h=' + h + ', r=' + r + ';',
            'var cx=n[0], cy=n[1];',
            'var l=cx-w/2, rt=cx+w/2, t=cy-h/2, b=cy+h/2, k=r*0.5523;',
            'var pts=[[l+r,t],[rt-r,t],[rt,t+r],[rt,b-r],[rt-r,b],[l+r,b],[l,b-r],[l,t+r]];',
            'var inT=[[-k,0],[0,0],[0,-k],[0,0],[k,0],[0,0],[0,k],[0,0]];',
            'var outT=[[0,0],[k,0],[0,0],[0,k],[0,0],[-k,0],[0,0],[0,-k]];',
            'createPath(pts,inT,outT,true);'
        ].join('\n');
    }
    function addGauss(L, amt, repeatEdge) {
        var fx;
        try { fx = L.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2"); }
        catch (e) { fx = L.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur"); }
        if (amt != null) fx.property(1).setValue(amt);
        if (repeatEdge) { try { fx.property(3).setValue(1); } catch (e2) {} }
        return fx;
    }
    function addRamp(L, p1, c1, p2, c2, shape) {
        var fx = L.property("ADBE Effect Parade").addProperty("ADBE Ramp");
        fx.property("ADBE Ramp-0001").setValue(p1); fx.property("ADBE Ramp-0002").setValue(c1);
        fx.property("ADBE Ramp-0003").setValue(p2); fx.property("ADBE Ramp-0004").setValue(c2);
        if (shape) fx.property("ADBE Ramp-0005").setValue(shape);
        return fx;
    }

    var comp = app.project.items.addComp("Liquid Glass Toolbar", W, H, 1, DUR, FPS);
    comp.bgColor = [0, 0, 0];
    comp.openInViewer();
    function solid(name, color) { return comp.layers.addSolid(color, name, W, H, 1); }

    // ============================================================
    // Control nulls FIRST — so every expression below resolves to a
    // layer/slider that already exists (avoids eval-order errors).
    // ============================================================
    var controls = comp.layers.addNull(DUR); controls.name = "Controls";
    setPos(controls, [26, 26]);
    var cFx = controls.property("ADBE Effect Parade");
    function slider(name, val) { var fx = cFx.addProperty("ADBE Slider Control"); fx.name = name; fx.property(1).setValue(val); return fx; }
    slider("Frost", 14);
    var refractFx = slider("Refract", 60);     // default finalised after distortion is known
    slider("Float", 0);

    var glass = comp.layers.addNull(DUR); glass.name = "Glass";
    setPos(glass, START);
    setExpr(pos(glass),
        'var f = thisComp.layer("Controls").effect("Float")("Slider");\n' +
        '(f > 0) ? [' + (W/2) + ' + Math.cos(time*0.6)*' + (W*0.26) + ', ' + START[1] + '] : value;');

    // ============================================================
    // DEMO content (delete & replace with your own layers)
    // ============================================================
    var demoBg = solid("DEMO bg", [0.02, 0.02, 0.02]);
    var green = solid("DEMO green card", [0.3, 0.6, 0.28]);
    addMask(green, roundedRectShape(450, 560, 840, 760, 78), 1.5);
    addRamp(green, [450, 175], [0.42, 0.74, 0.34], [450, 470], [0.15, 0.40, 0.16]);

    var txt = comp.layers.addText("LIQUID GLASS");
    (function () {
        var td = txt.property("ADBE Text Properties").property("ADBE Text Document");
        var d = td.value; d.fontSize = 46; d.applyFill = true; d.fillColor = [1, 1, 1];
        try { d.font = "Arial-BoldMT"; } catch (e) {}
        td.setValue(d); setPos(txt, [250, 150]); setOp(txt, 85);
    })();

    var dots = comp.layers.addShape(); dots.name = "DEMO dots";
    (function () {
        var c = dots.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var cols = [[0.2,0.55,1],[0.1,0.82,0.75],[0.62,0.38,1],[1,0.45,0.5],[0.3,0.85,0.4],[1,0.8,0.2]];
        for (var i = 0; i < cols.length; i++) {
            var g = c.addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var e = g.addProperty("ADBE Vector Shape - Ellipse");
            e.property("ADBE Vector Ellipse Size").setValue([34, 34]);
            e.property("ADBE Vector Ellipse Position").setValue([120 + i * 130, 250]);
            g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(cols[i]);
        }
    })();

    // ----- PUT YOUR OWN CONTENT LAYERS HERE (above demo, below Glass Frost) -----

    // ============================================================
    // GLASS — everything below follows the "Glass" null
    // ============================================================

    // soft drop shadow on the content under the pill
    var shadow = solid("Glass / Drop Shadow", [0, 0, 0]);
    addMask(shadow, roundedRectShape(CX, CY, PW + 6, PH + 6, PR), 26);
    setOp(shadow, 32); follow(shadow, 0, 16);

    // BUMP/HEIGHT map for EDGE refraction: a soft-edged capsule. CC Glass
    // displaces the background by the SLOPE of this map -> strong at the rim,
    // flat in the centre, like the rounded edge of a thick glass slab.
    var height = solid("Glass / Height (map)", [1, 1, 1]);
    var hMask = addMask(height, roundedRectShape(CX, CY, PW, PH, PR), 2);
    setExpr(hMask.property("ADBE Mask Shape"), capsulePathExpr(PW, PH, PR));
    addGauss(height, 16, true);          // soft edges = slope only near the rim
    height.enabled = false;              // used as a map only, not rendered

    // FROST = adjustment layer -> refracts (edge) + blurs EVERYTHING below it.
    var frost = solid("Glass / Frost (adjustment)", [0, 0, 0]);
    frost.adjustmentLayer = true;
    var fMask = addMask(frost, roundedRectShape(CX, CY, PW, PH, PR), 3);
    setExpr(fMask.property("ADBE Mask Shape"), capsulePathExpr(PW, PH, PR));

    var fParade = frost.property("ADBE Effect Parade");
    function tryAddD(mn) { try { return fParade.addProperty(mn); } catch (e) { return null; } }
    function pn(fx, names) { for (var i = 0; i < names.length; i++) { try { var p = fx.property(names[i]); if (p) return p; } catch (e) {} } return null; }
    var centerExpr  = 'thisComp.layer("Glass").transform.position';
    var refractExpr = 'thisComp.layer("Controls").effect("Refract")("Slider")';

    // (1) REFRACTION — prefer CC Glass (true edge refraction via the bump map)
    var ccg = tryAddD("CC Glass");
    if (ccg) {
        distortType = "ccglass";
        var bmp = pn(ccg, ["Bump Map"]);    if (bmp) bmp.setValue(height.index);
        var prp = pn(ccg, ["Property"]);    if (prp) { try { prp.setValue(4); } catch (e) {} }  // 4 = Alpha
        var sft = pn(ccg, ["Softness"]);    if (sft) { try { sft.setValue(10); } catch (e) {} }
        var hgt = pn(ccg, ["Height"]);      if (hgt) { try { hgt.setValue(18); } catch (e) {} }
        var dsp = pn(ccg, ["Displacement"]);if (dsp) setExpr(dsp, refractExpr);
        // calm CC Glass's own lighting so it doesn't fight our manual shading
        try { var lg = ccg.property("Light"); var li = pn(lg, ["Light Intensity"]); if (li) li.setValue(45); } catch (e) {}
        try { var sg = ccg.property("Shading"); var sp = pn(sg, ["Specular"]); if (sp) sp.setValue(15); } catch (e) {}
    } else {
        // fallback: Spherize / Bulge (centre magnify) if CC Glass is unavailable
        var dfx;
        if      ((dfx = tryAddD("ADBE Spherize"))) distortType = "spherize";
        else if ((dfx = tryAddD("ADBE BULGE")))    distortType = "bulge";
        else if ((dfx = tryAddD("ADBE Bulge")))    distortType = "bulge";
        if (distortType === "spherize") {
            setExpr(prop(dfx, "Radius", 1), refractExpr);
            setExpr(prop(dfx, "Center of Sphere", 2), centerExpr);
        } else if (distortType === "bulge") {
            var hr = dfx.property(1); if (hr) hr.setValue(PW / 2);
            var vr = dfx.property(2); if (vr) vr.setValue(PH / 2);
            setExpr(dfx.property(3), refractExpr);
            setExpr(dfx.property(5), centerExpr);
        }
    }

    // (2) FROST blur
    var gb = addGauss(frost, null, true);
    setExpr(gb.property(1), 'thisComp.layer("Controls").effect("Frost")("Slider")');

    // (3) a little extra glass vividness on whatever is underneath
    try {
        var hs = fParade.addProperty("ADBE HUE SATURATION");
        hs.property(4).setValue(12); hs.property(5).setValue(4);
    } catch (e) {}

    // milky tint
    var tint = solid("Glass / Tint", [1, 1, 1]);
    addMask(tint, roundedRectShape(CX, CY, PW, PH, PR), 2);
    setOp(tint, 10); follow(tint, 0, 0);

    // thickness shading: dark top -> light bottom (Overlay)
    var shade = solid("Glass / Shading", [0.5, 0.5, 0.5]);
    addMask(shade, roundedRectShape(CX, CY, PW, PH, PR), 2);
    addRamp(shade, [CX, pTopY + 4], [0.06, 0.07, 0.06], [CX, pBotY - 4], [0.95, 0.98, 0.95]);
    try { shade.blendingMode = BlendingMode.OVERLAY; } catch (e) {}
    setOp(shade, 90); follow(shade, 0, 0);

    // focused dark band at the top edge
    var topDark = solid("Glass / Top Shade", [0, 0, 0]);
    addMask(topDark, ellipseShapeObj(CX, pTopY + 4, PW * 0.46, 26), 18);
    setOp(topDark, 55); follow(topDark, 0, 0);

    // bright bottom rim glow
    var botLight = solid("Glass / Bottom Glow", [1, 1, 1]);
    addMask(botLight, ellipseShapeObj(CX, pBotY - 4, PW * 0.44, 22), 16);
    try { botLight.blendingMode = BlendingMode.ADD; } catch (e) {}
    setOp(botLight, 55); follow(botLight, 0, 0);

    // crisp rim stroke
    var rim = solid("Glass / Rim", [1, 1, 1]);
    addMask(rim, roundedRectShape(CX, CY, PW, PH, PR), 1.2);
    addMask(rim, roundedRectShape(CX, CY, PW - 3, PH - 3, PR - 1.5), 1.2, MaskMode.SUBTRACT);
    try { rim.blendingMode = BlendingMode.ADD; } catch (e) {}
    setOp(rim, 50); follow(rim, 0, 0);

    // ---------------- icons (thin white strokes, follow the null) ----------------
    var ICON = [1, 1, 1], LW = 3.2;
    function vGroup(L) { return L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group"); }
    function rectIn(c, w, h, round) { var r = c.addProperty("ADBE Vector Shape - Rect");
        r.property("ADBE Vector Rect Size").setValue([w, h]); r.property("ADBE Vector Rect Roundness").setValue(round); }
    function pathIn(c, verts, closed) { var g = c.addProperty("ADBE Vector Shape - Group");
        var s = new Shape(); s.vertices = verts; s.closed = !!closed; g.property("ADBE Vector Shape").setValue(s); }
    function ellipseIn(c, dia, off) { var e = c.addProperty("ADBE Vector Shape - Ellipse");
        e.property("ADBE Vector Ellipse Size").setValue([dia, dia]); if (off) e.property("ADBE Vector Ellipse Position").setValue(off); }
    function strokeIn(c, col, w) { var s = c.addProperty("ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Color").setValue(col); s.property("ADBE Vector Stroke Width").setValue(w);
        try { s.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {}
        try { s.property("ADBE Vector Stroke Line Join").setValue(2); } catch (e2) {} }
    function fillIn(c, col) { c.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col); }
    function iconLayer(name) { var L = comp.layers.addShape(); L.name = name; return L; }

    var add = iconLayer("Glass / Icon Add");
    var ca = vGroup(add); rectIn(ca, 52, 42, 11);
    pathIn(ca, [[-11,0],[11,0]], false); pathIn(ca, [[0,-11],[0,11]], false); strokeIn(ca, ICON, LW);
    follow(add, -132, 0);

    var bm = iconLayer("Glass / Icon Bookmark");
    var cb = vGroup(bm); pathIn(cb, [[-17,-24],[17,-24],[17,24],[0,11],[-17,24]], true); strokeIn(cb, ICON, LW);
    follow(bm, 0, 0);

    var more = iconLayer("Glass / Icon More");
    var cm = vGroup(more); ellipseIn(cm, 6.2, [-16,0]); ellipseIn(cm, 6.2, [0,0]); ellipseIn(cm, 6.2, [16,0]); fillIn(cm, ICON);
    follow(more, 132, 0);

    // ============================================================
    // finalise: set Refract default for the loaded distortion, tidy stack
    // ============================================================
    refractFx.property(1).setValue(
        (distortType === "ccglass") ? 90 :
        (distortType === "bulge")   ? 0.6 :
        (distortType === "cclens")  ? 14 : 60);
    try { glass.moveToBeginning(); controls.moveToBeginning(); } catch (e) {}
    try { comp.markerProperty.setValueAtTime(0, new MarkerValue("Drag the 'Glass' null. Put your content BELOW 'Glass / Frost'.")); } catch (e) {}

    app.endUndoGroup();

    alert("Liquid Glass Toolbar — build 5 (edge refraction) ✨\n\n" +
          "Distortion used: " + (distortType ? distortType : "NONE") +
          (distortType === "ccglass" ? " (edge refraction)" : "") + "\n\n" +
          (distortType !== "ccglass" ? "NOTE: CC Glass wasn't available, so this fell back to\ncentre-magnify. For true edge refraction you need CC Glass.\n\n" : "") +
          "• Drag the 'Glass' null to move the whole toolbar.\n" +
          "• 'Glass / Frost' is an ADJUSTMENT layer — it REFRACTS + blurs\n" +
          "  every layer BELOW it inside the capsule. Put your own\n" +
          "  content on layers below it (above the DEMO layers).\n" +
          "• 'Controls' null: Frost = blur, Refract = distortion amount,\n" +
          "  Float = 1 for auto drift.");

})();
