/**********************************************************************
 * Liquid Glass TOOLBAR for After Effects — PROCEDURAL refraction.
 * No PNG / no plugins. The displacement map is GENERATED inside AE
 * (gradient ramps -> Set Channels -> ring matte) and fed to the stock
 * Displacement Map effect. Driven by a "Glass" null so it's movable.
 *
 * RUN:  File › Scripts › Run Script File…  ›  this file
 *
 * It refracts + frosts the layers BELOW "Glass / Refraction".
 * Controls null: Refract = edge distortion, Frost = blur.
 *********************************************************************/

(function liquidGlassToolbarProc() {

    var W = 900, H = 440, FPS = 30, DUR = 6;
    var CX = W / 2, CY = H / 2;
    var PW = 436, PH = 132, PR = 66;
    var MW = 1200, MH = 700, MCX = MW / 2, MCY = MH / 2;   // disp-map precomp (oversized)
    var report = [];

    app.beginUndoGroup("Build Liquid Glass Toolbar (procedural)");

    // ---------- helpers ----------
    function setExpr(p, e) { if (p) p.expression = e; }
    function pos(L) { return L.property("ADBE Transform Group").property("ADBE Position"); }
    function setPos(L, p) { pos(L).setValue(p); }
    function setOp(L, v) { L.property("ADBE Transform Group").property("ADBE Opacity").setValue(v); }
    function follow(L, ox, oy) { setExpr(pos(L), 'thisComp.layer("Glass").transform.position + [' + (ox||0) + ',' + (oy||0) + ']'); }
    function roundedRectShape(cx, cy, w, h, r) {
        var k = r * 0.5523, l = cx-w/2, rt = cx+w/2, t = cy-h/2, b = cy+h/2, s = new Shape();
        s.vertices = [[l+r,t],[rt-r,t],[rt,t+r],[rt,b-r],[rt-r,b],[l+r,b],[l,b-r],[l,t+r]];
        s.inTangents  = [[-k,0],[0,0],[0,-k],[0,0],[k,0],[0,0],[0,k],[0,0]];
        s.outTangents = [[0,0],[k,0],[0,0],[0,k],[0,0],[-k,0],[0,0],[0,-k]];
        s.closed = true; return s;
    }
    function addMask(L, shape, feather, mode) {
        var m = L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        m.property("ADBE Mask Shape").setValue(shape);
        if (feather != null) m.property("ADBE Mask Feather").setValue([feather, feather]);
        if (mode) m.maskMode = mode; return m;
    }
    function capsulePathExpr(w, h, r) {
        return ['var n=thisComp.layer("Glass").transform.position;',
            'var w='+w+',h='+h+',r='+r+',cx=n[0],cy=n[1];',
            'var l=cx-w/2,rt=cx+w/2,t=cy-h/2,b=cy+h/2,k=r*0.5523;',
            'var p=[[l+r,t],[rt-r,t],[rt,t+r],[rt,b-r],[rt-r,b],[l+r,b],[l,b-r],[l,t+r]];',
            'var i=[[-k,0],[0,0],[0,-k],[0,0],[k,0],[0,0],[0,k],[0,0]];',
            'var o=[[0,0],[k,0],[0,0],[0,k],[0,0],[-k,0],[0,0],[0,-k]];',
            'createPath(p,i,o,true);'].join('\n');
    }
    function addRamp(L, p1, c1, p2, c2) {
        var fx = L.property("ADBE Effect Parade").addProperty("ADBE Ramp");
        fx.property("ADBE Ramp-0001").setValue(p1); fx.property("ADBE Ramp-0002").setValue(c1);
        fx.property("ADBE Ramp-0003").setValue(p2); fx.property("ADBE Ramp-0004").setValue(c2); return fx;
    }
    function addGauss(L, amt) {
        var fx; try { fx = L.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2"); }
        catch (e) { fx = L.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur"); }
        if (amt != null) fx.property(1).setValue(amt);
        try { fx.property(3).setValue(1); } catch (e2) {} return fx;
    }

    // =================================================================
    // 1. DISPLACEMENT-MAP precomp (procedural capsule normal map)
    //    R = horizontal displacement, G = vertical, 128 = neutral.
    // =================================================================
    var dmap = app.project.items.addComp("Glass DispMap", MW, MH, 1, DUR, FPS);
    function dsolid(name, color) { return dmap.layers.addSolid(color, name, MW, MH, 1); }

    // base: neutral 128 grey everywhere
    dsolid("Base 128", [0.5, 0.5, 0.5]);

    // RampH: white(left) -> black(right) across the capsule  => R encodes X
    var rampH = dsolid("RampH", [0.5, 0.5, 0.5]);
    addRamp(rampH, [MCX - PW/2, MCY], [1,1,1], [MCX + PW/2, MCY], [0,0,0]);
    rampH.enabled = false;
    // RampV: white(top) -> black(bottom)  => G encodes Y
    var rampV = dsolid("RampV", [0.5, 0.5, 0.5]);
    addRamp(rampV, [MCX, MCY - PH/2], [1,1,1], [MCX, MCY + PH/2], [0,0,0]);
    rampV.enabled = false;

    // Normal: gray solid whose R<-RampH, G<-RampV  (via Set Channels)
    var normal = dsolid("Normal", [0.5, 0.5, 0.5]);
    var setOK = false;
    try {
        var sc = normal.property("ADBE Effect Parade").addProperty("ADBE Set Channels");
        sc.property(1).setValue(rampH.index);   // Source Layer 1
        sc.property(2).setValue(5);             // Set Red   <- Source1 Luminance
        sc.property(3).setValue(rampV.index);   // Source Layer 2
        sc.property(4).setValue(5);             // Set Green <- Source2 Luminance
        try { sc.property(7).setValue(normal.index); sc.property(8).setValue(9); } catch (eA) {} // Alpha = Full On
        setOK = true;
    } catch (e) { report.push("Set Channels FAILED: " + e.toString()); }
    report.push("Set Channels: " + (setOK ? "ok" : "MISSING"));

    // Ring: white bezel band (used as a luma matte so the normal map only
    // exists at the edge; centre + outside stay neutral 128).
    var ring = dsolid("Ring", [1, 1, 1]);
    addMask(ring, roundedRectShape(MCX, MCY, PW, PH, PR), 22);
    addMask(ring, roundedRectShape(MCX, MCY, PW - 96, PH - 96, PR - 48), 26, MaskMode.SUBTRACT);
    // place Ring directly above Normal and use it as a luma matte
    try { ring.moveBefore(normal); } catch (e) {}
    try { normal.setTrackMatte(ring, TrackMatteType.LUMA); }
    catch (e) { try { normal.trackMatteType = TrackMatteType.LUMA; } catch (e2) {} }

    // =================================================================
    // 2. MAIN comp
    // =================================================================
    var comp = app.project.items.addComp("Liquid Glass Toolbar (proc)", W, H, 1, DUR, FPS);
    comp.bgColor = [0, 0, 0]; comp.openInViewer();
    function solid(name, color) { return comp.layers.addSolid(color, name, W, H, 1); }

    // control nulls FIRST
    var controls = comp.layers.addNull(DUR); controls.name = "Controls";
    setPos(controls, [26, 26]);
    var cFx = controls.property("ADBE Effect Parade");
    function slider(name, val) { var fx = cFx.addProperty("ADBE Slider Control"); fx.name = name; fx.property(1).setValue(val); return fx; }
    slider("Refract", 40); slider("Frost", 10);

    var glass = comp.layers.addNull(DUR); glass.name = "Glass";
    setPos(glass, [CX, CY]);

    // --- DEMO content (replace; keep below Glass / Refraction) ---
    solid("DEMO bg", [0.02, 0.02, 0.02]);
    var green = solid("DEMO green card", [0.3, 0.6, 0.28]);
    addMask(green, roundedRectShape(450, 560, 840, 760, 78), 1.5);
    addRamp(green, [450, 175], [0.42, 0.74, 0.34], [450, 470], [0.15, 0.40, 0.16]);
    var dots = comp.layers.addShape(); dots.name = "DEMO dots";
    (function(){ var c=dots.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var cols=[[0.2,0.55,1],[0.1,0.82,0.75],[0.62,0.38,1],[1,0.45,0.5],[0.3,0.85,0.4],[1,0.8,0.2]];
        for(var i=0;i<cols.length;i++){var g=c.addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var e=g.addProperty("ADBE Vector Shape - Ellipse");e.property("ADBE Vector Ellipse Size").setValue([34,34]);
            e.property("ADBE Vector Ellipse Position").setValue([120+i*130,250]);
            g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(cols[i]);}})();

    // --- the generated displacement map, moved with the null, hidden ---
    var dispLayer = comp.layers.add(dmap); dispLayer.name = "Glass / DispMap";
    follow(dispLayer, 0, 0); dispLayer.enabled = false;

    // --- REFRACTION adjustment: Displacement Map + frost blur, masked to pill ---
    var refr = solid("Glass / Refraction", [0, 0, 0]); refr.adjustmentLayer = true;
    var rMask = addMask(refr, roundedRectShape(CX, CY, PW + 4, PH + 4, PR), 3);
    setExpr(rMask.property("ADBE Mask Shape"), capsulePathExpr(PW + 4, PH + 4, PR));
    var dm = refr.property("ADBE Effect Parade").addProperty("ADBE Displacement Map");
    function dmp(name, idx) { var p=null; try{p=dm.property(name);}catch(e){} if(!p){try{p=dm.property(idx);}catch(e2){}} return p; }
    var mapSel = dmp("Displacement Map Layer", 1); if (mapSel) mapSel.setValue(dispLayer.index);
    var uh = dmp("Use For Horizontal Displacement", 2); if (uh) uh.setValue(1); // Red
    var uv = dmp("Use For Vertical Displacement", 4);   if (uv) uv.setValue(2); // Green
    setExpr(dmp("Max Horizontal Displacement", 3), 'thisComp.layer("Controls").effect("Refract")("Slider")');
    setExpr(dmp("Max Vertical Displacement", 5),   'thisComp.layer("Controls").effect("Refract")("Slider")');
    var bh = dmp("Displacement Map Behavior", 6); if (bh) bh.setValue(1); // Center Map
    var gb = addGauss(refr, null);
    setExpr(gb.property(1), 'thisComp.layer("Controls").effect("Frost")("Slider")');

    // --- surface (native): frost tint, shading, rim, icons; follow null ---
    var tint = solid("Glass / Tint", [1,1,1]); var tm=addMask(tint, roundedRectShape(CX,CY,PW,PH,PR), 3);
    setExpr(tm.property("ADBE Mask Shape"), capsulePathExpr(PW,PH,PR)); setOp(tint, 10); follow(tint,0,0);

    var shade = solid("Glass / Shading", [0.5,0.5,0.5]); var sm=addMask(shade, roundedRectShape(CX,CY,PW,PH,PR), 3);
    setExpr(sm.property("ADBE Mask Shape"), capsulePathExpr(PW,PH,PR));
    addRamp(shade, [CX, CY-PH/2+4], [0.06,0.07,0.06], [CX, CY+PH/2-4], [0.95,0.98,0.95]);
    try { shade.blendingMode = BlendingMode.OVERLAY; } catch(e){} setOp(shade, 80); follow(shade,0,0);

    var rim = solid("Glass / Rim", [1,1,1]);
    var rm1=addMask(rim, roundedRectShape(CX,CY,PW,PH,PR), 1.5);
    var rm2=addMask(rim, roundedRectShape(CX,CY,PW-4,PH-4,PR-2), 1.5, MaskMode.SUBTRACT);
    setExpr(rm1.property("ADBE Mask Shape"), capsulePathExpr(PW,PH,PR));
    setExpr(rm2.property("ADBE Mask Shape"), capsulePathExpr(PW-4,PH-4,PR-2));
    try { rim.blendingMode = BlendingMode.ADD; } catch(e){} setOp(rim, 50); follow(rim,0,0);

    // icons
    var ICON=[1,1,1], LW=3.2;
    function vG(L){return L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");}
    function rectIn(c,w,h,rr){var r=c.addProperty("ADBE Vector Shape - Rect");r.property("ADBE Vector Rect Size").setValue([w,h]);r.property("ADBE Vector Rect Roundness").setValue(rr);}
    function pathIn(c,v,cl){var g=c.addProperty("ADBE Vector Shape - Group");var s=new Shape();s.vertices=v;s.closed=!!cl;g.property("ADBE Vector Shape").setValue(s);}
    function ellIn(c,d,o){var e=c.addProperty("ADBE Vector Shape - Ellipse");e.property("ADBE Vector Ellipse Size").setValue([d,d]);if(o)e.property("ADBE Vector Ellipse Position").setValue(o);}
    function strokeIn(c,col,w){var s=c.addProperty("ADBE Vector Graphic - Stroke");s.property("ADBE Vector Stroke Color").setValue(col);s.property("ADBE Vector Stroke Width").setValue(w);try{s.property("ADBE Vector Stroke Line Cap").setValue(2);}catch(e){}try{s.property("ADBE Vector Stroke Line Join").setValue(2);}catch(e2){}}
    function fillIn(c,col){c.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col);}
    function iconL(n){var L=comp.layers.addShape();L.name=n;return L;}
    var add=iconL("Glass / Icon Add");var ca=vG(add);rectIn(ca,52,42,11);pathIn(ca,[[-11,0],[11,0]],false);pathIn(ca,[[0,-11],[0,11]],false);strokeIn(ca,ICON,LW);follow(add,-132,0);
    var bm=iconL("Glass / Icon Bookmark");var cb=vG(bm);pathIn(cb,[[-17,-24],[17,-24],[17,24],[0,11],[-17,24]],true);strokeIn(cb,ICON,LW);follow(bm,0,0);
    var more=iconL("Glass / Icon More");var cm=vG(more);ellIn(cm,6.2,[-16,0]);ellIn(cm,6.2,[0,0]);ellIn(cm,6.2,[16,0]);fillIn(cm,ICON);follow(more,132,0);

    // drop shadow
    var shadow = solid("Glass / Drop Shadow", [0,0,0]);
    var shm=addMask(shadow, roundedRectShape(CX,CY,PW+8,PH+8,PR), 26);
    setExpr(shm.property("ADBE Mask Shape"), capsulePathExpr(PW+8,PH+8,PR)); setOp(shadow,30); follow(shadow,0,16);
    shadow.moveAfter(refr);

    try { comp.layer("Glass").moveToBeginning(); comp.layer("Controls").moveToBeginning(); } catch(e){}

    app.endUndoGroup();

    alert("Liquid Glass Toolbar (procedural) — build 1\n\n" +
          report.join("\n") + "\n\n" +
          "• Drag the 'Glass' null to move it.\n" +
          "• Refracts + frosts layers BELOW 'Glass / Refraction'.\n" +
          "• Controls: Refract = distortion, Frost = blur.\n\n" +
          "If there's NO refraction: tell me what 'Set Channels' says above\n" +
          "(the channel routing is the one risky part on a blind build).");

})();
