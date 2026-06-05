/**********************************************************************
 * Liquid Glass TOOLBAR — null-driven, EDGE refraction.  (build 7)
 *
 * RUN:  File › Scripts › Run Script File…  ›  this file
 *
 * Reliable refraction pattern (same as the working lens script): the
 * content lives in a precomp "Glass Content"; a DUPLICATE of it gets
 * CC Glass (edge refraction) + blur, clipped to the capsule and driven
 * by the "Glass" null. So the rim bends/​frosts whatever is in the
 * "Glass Content" comp.
 *   --> To use your own content: open the "Glass Content" comp and put
 *       your layers in there (replace the demo green card / text / dots).
 *
 * "Controls" null: Frost (blur), Refract (edge distortion), Float (drift).
 *********************************************************************/

(function liquidGlassToolbar7() {

    var W = 900, H = 440, FPS = 30, DUR = 6;
    var CX = W / 2, CY = H / 2;          // = solid anchor / mask centre
    var PW = 436, PH = 132, PR = 66;
    var pTopY = CY - PH / 2, pBotY = CY + PH / 2;
    var START = [W / 2, 150];
    var distortType = null;

    app.beginUndoGroup("Build Liquid Glass Toolbar 7");

    // ===================== helpers =====================
    function setExpr(p, e) { if (p) p.expression = e; }
    function pos(L) { return L.property("ADBE Transform Group").property("ADBE Position"); }
    function setOp(L, v) { L.property("ADBE Transform Group").property("ADBE Opacity").setValue(v); }
    function setPos(L, p) { pos(L).setValue(p); }
    function follow(L, ox, oy) { setExpr(pos(L), 'thisComp.layer("Glass").transform.position + [' + (ox||0) + ',' + (oy||0) + ']'); }
    function roundedRectShape(cx, cy, w, h, r) {
        var k = r * 0.5523, l = cx - w/2, rt = cx + w/2, t = cy - h/2, b = cy + h/2, s = new Shape();
        s.vertices = [[l+r,t],[rt-r,t],[rt,t+r],[rt,b-r],[rt-r,b],[l+r,b],[l,b-r],[l,t+r]];
        s.inTangents  = [[-k,0],[0,0],[0,-k],[0,0],[k,0],[0,0],[0,k],[0,0]];
        s.outTangents = [[0,0],[k,0],[0,0],[0,k],[0,0],[-k,0],[0,0],[0,-k]];
        s.closed = true; return s;
    }
    function ellipseShapeObj(cx, cy, rx, ry) {
        var kx = rx*0.5523, ky = ry*0.5523, s = new Shape();
        s.vertices=[[cx,cy-ry],[cx+rx,cy],[cx,cy+ry],[cx-rx,cy]];
        s.inTangents=[[-kx,0],[0,-ky],[kx,0],[0,ky]];
        s.outTangents=[[kx,0],[0,ky],[-kx,0],[0,-ky]];
        s.closed=true; return s;
    }
    function addMask(L, shape, feather, mode) {
        var m = L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        m.property("ADBE Mask Shape").setValue(shape);
        if (feather != null) m.property("ADBE Mask Feather").setValue([feather, feather]);
        if (mode) m.maskMode = mode;
        return m;
    }
    function pn(fx, names) { for (var i=0;i<names.length;i++){ try { var p=fx.property(names[i]); if(p) return p; } catch(e){} } return null; }
    function addGauss(L, amt, repeatEdge) {
        var fx; try { fx = L.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2"); }
        catch (e) { fx = L.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur"); }
        if (amt != null) fx.property(1).setValue(amt);
        if (repeatEdge) { try { fx.property(3).setValue(1); } catch (e2) {} }
        return fx;
    }
    function addRamp(L, p1, c1, p2, c2) {
        var fx = L.property("ADBE Effect Parade").addProperty("ADBE Ramp");
        fx.property("ADBE Ramp-0001").setValue(p1); fx.property("ADBE Ramp-0002").setValue(c1);
        fx.property("ADBE Ramp-0003").setValue(p2); fx.property("ADBE Ramp-0004").setValue(c2);
        return fx;
    }
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

    // ============================================================
    // 1. content precomp (put YOUR layers in here)
    // ============================================================
    var content = app.project.items.addComp("Glass Content", W, H, 1, DUR, FPS);
    (function () {
        function s(name, color) { return content.layers.addSolid(color, name, W, H, 1); }
        s("DEMO bg", [0.02, 0.02, 0.02]);
        var green = s("DEMO green card", [0.3, 0.6, 0.28]);
        addMask(green, roundedRectShape(450, 560, 840, 760, 78), 1.5);
        addRamp(green, [450, 175], [0.42, 0.74, 0.34], [450, 470], [0.15, 0.40, 0.16]);
        var txt = content.layers.addText("LIQUID GLASS");
        var td = txt.property("ADBE Text Properties").property("ADBE Text Document");
        var d = td.value; d.fontSize = 46; d.applyFill = true; d.fillColor = [1, 1, 1];
        try { d.font = "Arial-BoldMT"; } catch (e) {}
        td.setValue(d); setPos(txt, [250, 150]); setOp(txt, 85);
        var dots = content.layers.addShape(); dots.name = "DEMO dots";
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

    // ============================================================
    // 2. main comp
    // ============================================================
    var comp = app.project.items.addComp("Liquid Glass Toolbar", W, H, 1, DUR, FPS);
    comp.bgColor = [0, 0, 0];
    comp.openInViewer();
    function solid(name, color) { return comp.layers.addSolid(color, name, W, H, 1); }

    // control nulls FIRST so all expressions resolve to existing targets
    var controls = comp.layers.addNull(DUR); controls.name = "Controls";
    setPos(controls, [26, 26]);
    var cFx = controls.property("ADBE Effect Parade");
    function slider(name, val) { var fx = cFx.addProperty("ADBE Slider Control"); fx.name = name; fx.property(1).setValue(val); return fx; }
    slider("Frost", 5); slider("Refract", 220); slider("Float", 0);

    var glass = comp.layers.addNull(DUR); glass.name = "Glass";
    setPos(glass, START);
    setExpr(pos(glass),
        'var f = thisComp.layer("Controls").effect("Float")("Slider");\n' +
        '(f > 0) ? [' + (W/2) + ' + Math.cos(time*0.6)*' + (W*0.26) + ', ' + START[1] + '] : value;');

    // background = the content
    var scene = comp.layers.add(content); scene.name = "Scene";

    // drop shadow on the scene under the pill
    var shadow = solid("Glass / Drop Shadow", [0, 0, 0]);
    addMask(shadow, roundedRectShape(CX, CY, PW + 6, PH + 6, PR), 26);
    setOp(shadow, 34); follow(shadow, 0, 16);

    // height/bump map (soft capsule) for CC Glass edge refraction
    var height = solid("Glass / Height (map)", [1, 1, 1]);
    var hMask = addMask(height, roundedRectShape(CX, CY, PW, PH, PR), 2);
    setExpr(hMask.property("ADBE Mask Shape"), capsulePathExpr(PW, PH, PR));
    addGauss(height, 30, true);            // wider slope = wider, stronger refraction band
    height.enabled = false;

    // REFRACTION = a DUPLICATE of the content (real pixels -> CC Glass works),
    // distorted + frosted, clipped to the capsule, following the null.
    var refr = comp.layers.add(content); refr.name = "Refraction";
    var rMask = addMask(refr, roundedRectShape(CX, CY, PW, PH, PR), 3);
    setExpr(rMask.property("ADBE Mask Shape"), capsulePathExpr(PW, PH, PR));
    var rFx = refr.property("ADBE Effect Parade");
    var refractExpr = 'thisComp.layer("Controls").effect("Refract")("Slider")';
    var centerExpr  = 'thisComp.layer("Glass").transform.position';
    var ccg = null;
    try { ccg = rFx.addProperty("CC Glass"); } catch (e) {}
    if (ccg) {
        distortType = "ccglass"; ccg.name = "EdgeGlass";
        var prp = pn(ccg, ["Property"]);     if (prp) { try { prp.setValue(4); } catch (e) {} } // Alpha
        var sft = pn(ccg, ["Softness"]);     if (sft) { try { sft.setValue(8); } catch (e) {} }
        var hgt = pn(ccg, ["Height"]);       if (hgt) { try { hgt.setValue(70); } catch (e) {} }
        var dsp = pn(ccg, ["Displacement"]); if (dsp) setExpr(dsp, refractExpr);
        try { var lg = ccg.property("Light"); var li = pn(lg, ["Light Intensity"]); if (li) li.setValue(40); } catch (e) {}
        try { var sg = ccg.property("Shading"); var sp = pn(sg, ["Specular"]); if (sp) sp.setValue(10); } catch (e) {}
        // Bump Map layer is linked at the end (after indices settle)
    } else {
        var dfx = null;
        try { dfx = rFx.addProperty("ADBE Spherize"); } catch (e) {}
        if (dfx) { distortType = "spherize";
            setExpr(pn(dfx, ["Radius"]) || dfx.property(1), refractExpr);
            setExpr(pn(dfx, ["Center of Sphere"]) || dfx.property(2), centerExpr); }
    }
    var rGB = addGauss(refr, null, true);
    setExpr(rGB.property(1), 'thisComp.layer("Controls").effect("Frost")("Slider")');
    try { var hs = rFx.addProperty("ADBE HUE SATURATION"); hs.property(4).setValue(12); hs.property(5).setValue(4); } catch (e) {}

    // ============================================================
    // 3. glass surface (follows the null)
    // ============================================================
    var tint = solid("Glass / Tint", [1, 1, 1]);
    addMask(tint, roundedRectShape(CX, CY, PW, PH, PR), 2); setOp(tint, 9); follow(tint, 0, 0);

    var shade = solid("Glass / Shading", [0.5, 0.5, 0.5]);
    addMask(shade, roundedRectShape(CX, CY, PW, PH, PR), 2);
    addRamp(shade, [CX, pTopY + 4], [0.06, 0.07, 0.06], [CX, pBotY - 4], [0.95, 0.98, 0.95]);
    try { shade.blendingMode = BlendingMode.OVERLAY; } catch (e) {}
    setOp(shade, 85); follow(shade, 0, 0);

    var topDark = solid("Glass / Top Shade", [0, 0, 0]);
    addMask(topDark, ellipseShapeObj(CX, pTopY + 4, PW * 0.46, 24), 18);
    setOp(topDark, 50); follow(topDark, 0, 0);

    var botLight = solid("Glass / Bottom Glow", [1, 1, 1]);
    addMask(botLight, ellipseShapeObj(CX, pBotY - 5, PW * 0.40, 14), 12);
    try { botLight.blendingMode = BlendingMode.ADD; } catch (e) {}
    setOp(botLight, 38); follow(botLight, 0, 0);

    var rim = solid("Glass / Rim", [1, 1, 1]);
    addMask(rim, roundedRectShape(CX, CY, PW, PH, PR), 1.2);
    addMask(rim, roundedRectShape(CX, CY, PW - 3, PH - 3, PR - 1.5), 1.2, MaskMode.SUBTRACT);
    try { rim.blendingMode = BlendingMode.ADD; } catch (e) {}
    setOp(rim, 45); follow(rim, 0, 0);

    // ---------------- icons (thin white strokes) ----------------
    var ICON = [1, 1, 1], LW = 3.2;
    function vGroup(L) { return L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group"); }
    function rectIn(c, w, h, round) { var r = c.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([w, h]); r.property("ADBE Vector Rect Roundness").setValue(round); }
    function pathIn(c, verts, closed) { var g = c.addProperty("ADBE Vector Shape - Group"); var s = new Shape(); s.vertices = verts; s.closed = !!closed; g.property("ADBE Vector Shape").setValue(s); }
    function ellipseIn(c, dia, off) { var e = c.addProperty("ADBE Vector Shape - Ellipse"); e.property("ADBE Vector Ellipse Size").setValue([dia, dia]); if (off) e.property("ADBE Vector Ellipse Position").setValue(off); }
    function strokeIn(c, col, w) { var s = c.addProperty("ADBE Vector Graphic - Stroke"); s.property("ADBE Vector Stroke Color").setValue(col); s.property("ADBE Vector Stroke Width").setValue(w);
        try { s.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {} try { s.property("ADBE Vector Stroke Line Join").setValue(2); } catch (e2) {} }
    function fillIn(c, col) { c.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col); }
    function iconLayer(name) { var L = comp.layers.addShape(); L.name = name; return L; }

    var add = iconLayer("Glass / Icon Add"); var ca = vGroup(add); rectIn(ca, 52, 42, 11);
    pathIn(ca, [[-11,0],[11,0]], false); pathIn(ca, [[0,-11],[0,11]], false); strokeIn(ca, ICON, LW); follow(add, -132, 0);
    var bm = iconLayer("Glass / Icon Bookmark"); var cb = vGroup(bm); pathIn(cb, [[-17,-24],[17,-24],[17,24],[0,11],[-17,24]], true); strokeIn(cb, ICON, LW); follow(bm, 0, 0);
    var more = iconLayer("Glass / Icon More"); var cm = vGroup(more); ellipseIn(cm, 6.2, [-16,0]); ellipseIn(cm, 6.2, [0,0]); ellipseIn(cm, 6.2, [16,0]); fillIn(cm, ICON); follow(more, 132, 0);

    // ============================================================
    // 4. finalise (re-fetch fresh by name; link bump map after indices settle)
    // ============================================================
    try { comp.layer("Glass").moveToBeginning(); comp.layer("Controls").moveToBeginning(); } catch (e) {}
    try {
        comp.layer("Controls").effect("Refract").property(1).setValue(distortType === "spherize" ? 90 : 220);
    } catch (e) {}
    if (distortType === "ccglass") {
        try {
            var bumpProp = pn(comp.layer("Refraction").effect("EdgeGlass"), ["Bump Map"]);
            if (bumpProp) bumpProp.setValue(comp.layer("Glass / Height (map)").index);
        } catch (e) {}
    }
    try { comp.markerProperty.setValueAtTime(0, new MarkerValue("Drag 'Glass'. Edit 'Glass Content' comp to change what's refracted.")); } catch (e) {}

    app.endUndoGroup();

    alert("Liquid Glass Toolbar — build 8 (stronger refraction) ✨\n\n" +
          "Distortion: " + (distortType ? distortType : "NONE") +
          (distortType === "ccglass" ? " (edge refraction via CC Glass)" : "") + "\n\n" +
          (distortType !== "ccglass" ?
            "NOTE: CC Glass was not available; fell back to center-magnify.\n\n" : "") +
          "• Drag the 'Glass' null to move the toolbar.\n" +
          "• The 'Refraction' layer is a DUPLICATE of the 'Glass Content'\n" +
          "  comp — that's why the rim actually refracts. Put your own\n" +
          "  layers INSIDE the 'Glass Content' comp.\n" +
          "• Controls: Frost = blur, Refract = edge distortion, Float = drift.");

})();
