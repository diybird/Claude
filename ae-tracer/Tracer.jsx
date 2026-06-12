/**********************************************************************
 * Tracer for After Effects  —  Cinema 4D-style "Tracer" rig
 * --------------------------------------------------------------------
 * Builds a shape layer whose path is driven by a single live expression
 * that reads Expression Controls in the Effect Controls panel — so the
 * tracer is configured exactly like C4D's Tracer object:
 *
 *   TRACER
 *     • Tracing Mode      (dropdown)
 *     • Trace Active       (checkbox)
 *     • Reverse Sequence   (checkbox)
 *   SPLINE
 *     • Type               (dropdown: Linear / Cubic / B-Spline)
 *     • Close Spline       (checkbox)
 *     • Interpolation      (dropdown)
 *     • Points             (slider, B-Spline resolution)
 *     • Tension            (slider, Cubic)
 *     • Angle / Max Length (parity controls)
 *   Trace Link
 *     • Trace Link 1..N    (Layer Controls — the list of sources)
 *
 * The path follows the linked layers every frame, like C4D's Tracer.
 *
 * SAVE AS AN EFFECT & PRESET:
 *   After building a tracer once, select all of its controls in the
 *   Effect Controls panel + the Path expression, then
 *   Animation > Save Animation Preset…  -> writes a .ffx that appears in
 *   the Effects & Presets panel. (AE has no API to write .ffx directly,
 *   so this one-time manual save is required to package it as a preset.)
 *
 * INSTALL (as a builder panel):
 *   Drop this file in  …/Scripts/ScriptUI Panels/  and restart AE, then
 *   open it from the Window menu. Or File > Scripts > Run Script File…
 **********************************************************************/

(function tracerMain(thisObj) {

    var SCRIPT_NAME = "Tracer";

    // 3D Beams options (mirrored from the panel)
    var beam3D = { thickness: 6, closed: false, color: [0.13, 0.85, 1.0],
                   curved: false, res: 8, tension: 0.5 };

    // ----------------------------------------------------------------
    // The live path expression. All behavior is read from the layer's
    // Expression Controls, so this string is identical on every tracer
    // (which is also what lets it be saved as a single Animation Preset).
    // ----------------------------------------------------------------
    var PATH_EXPRESSION =
"// === Tracer (Cinema 4D-style) — path expression ===\n" +
"var fx = thisLayer(\"ADBE Effect Parade\");\n" +
"\n" +
"function ctrl(name, param, def){\n" +
"    try { return fx(name)(param); } catch(e){ return def; }\n" +
"}\n" +
"\n" +
"var active  = ctrl(\"Trace Active\",     \"ADBE Checkbox Control-0001\", 1) > 0;\n" +
"var closed  = ctrl(\"Close Spline\",     \"ADBE Checkbox Control-0001\", 0) > 0;\n" +
"var type    = ctrl(\"Type\",             \"ADBE Dropdown Control-0001\", 2); // 1 Linear 2 Cubic 3 B-Spline\n" +
"var res     = Math.max(1, Math.round(ctrl(\"Points\", \"ADBE Slider Control-0001\", 8)));\n" +
"var tension = ctrl(\"Tension\",          \"ADBE Slider Control-0001\", 0.5);\n" +
"var rev     = ctrl(\"Reverse Sequence\", \"ADBE Checkbox Control-0001\", 0) > 0;\n" +
"\n" +
"// --- gather the Trace Link layers (any effect named \"Trace Link …\") ---\n" +
"var pts = [];\n" +
"for (var i = 1; i <= fx.numProperties; i++){\n" +
"    var e = fx(i);\n" +
"    if (e.name.indexOf(\"Trace Link\") === 0){\n" +
"        try {\n" +
"            var L = e(\"ADBE Layer Control-0001\");\n" +
"            // toComp() returns the active-camera SCREEN projection for 3D\n" +
"            // layers (and plain comp position for 2D). Force 2D so the\n" +
"            // shape path connects the layers as seen through the camera.\n" +
"            var sp = L.toComp(L.transform.anchorPoint);\n" +
"            pts.push(fromComp([sp[0], sp[1]]));\n" +
"        } catch(err){ /* link set to None / missing -> skip */ }\n" +
"    }\n" +
"}\n" +
"if (rev) pts.reverse();\n" +
"\n" +
"var n = pts.length;\n" +
"var V = [], inT = [], outT = [], isClosed = closed;\n" +
"\n" +
"if (!active || n < 1){\n" +
"    V = [[0,0]]; inT = [[0,0]]; outT = [[0,0]]; isClosed = false;\n" +
"} else if (n < 2){\n" +
"    V = [pts[0]]; inT = [[0,0]]; outT = [[0,0]]; isClosed = false;\n" +
"} else if (type == 1){                       // Linear\n" +
"    V = pts;\n" +
"    for (var i = 0; i < n; i++){ inT.push([0,0]); outT.push([0,0]); }\n" +
"} else if (type == 2){                       // Cubic (Catmull-Rom -> bezier tangents)\n" +
"    V = pts;\n" +
"    for (var i = 0; i < n; i++){\n" +
"        var prev = pts[(i-1+n)%n];\n" +
"        var next = pts[(i+1)%n];\n" +
"        if (!closed){ if (i == 0) prev = pts[0]; if (i == n-1) next = pts[n-1]; }\n" +
"        var tg = (next - prev) * (tension * 0.5);\n" +
"        outT.push(tg); inT.push(tg * -1);\n" +
"    }\n" +
"} else {                                     // B-Spline (uniform cubic, resampled)\n" +
"    var cp = closed ? pts.concat([pts[0], pts[1], pts[2]]) : pts;\n" +
"    var segs = closed ? n : (cp.length - 3);\n" +
"    for (var s = 0; s < segs; s++){\n" +
"        var P0 = cp[s], P1 = cp[s+1], P2 = cp[s+2], P3 = cp[s+3];\n" +
"        for (var k = 0; k < res; k++){\n" +
"            var t = k/res, t2 = t*t, t3 = t2*t;\n" +
"            var b0 = (-t3 + 3*t2 - 3*t + 1)/6;\n" +
"            var b1 = ( 3*t3 - 6*t2 + 4)/6;\n" +
"            var b2 = (-3*t3 + 3*t2 + 3*t + 1)/6;\n" +
"            var b3 = t3/6;\n" +
"            V.push(P0*b0 + P1*b1 + P2*b2 + P3*b3);\n" +
"        }\n" +
"    }\n" +
"    if (V.length < 2){ V = pts; }            // <4 points: fall back to polyline\n" +
"    for (var i = 0; i < V.length; i++){ inT.push([0,0]); outT.push([0,0]); }\n" +
"}\n" +
"\n" +
"createPath(V, inT, outT, isClosed);\n";

    // ----------------------------------------------------------------
    // 3D BEAMS mode — real geometry in 3D space.
    // A shape-layer path is always a flat 2D contour, so for a true 3D
    // connection each segment is its own thin 3D solid that spans two
    // layers. Anchored at its left edge, it is positioned at the "From"
    // layer, oriented so its local +X points at the "To" layer, and
    // scaled in X to the world distance between them. Result: real 3D
    // geometry, correct from any camera and depth-sorted.
    // Each beam carries two Layer Controls: "From" and "To".
    // ----------------------------------------------------------------
    var BEAM_POS_EXPR =
"// beam start = world position of the From layer\n" +
"var A = effect(\"From\")(\"ADBE Layer Control-0001\");\n" +
"A.toWorld([0,0,0]);\n";

    var BEAM_ORI_EXPR =
"// aim local +X from the From layer toward the To layer (in 3D)\n" +
"var A = effect(\"From\")(\"ADBE Layer Control-0001\").toWorld([0,0,0]);\n" +
"var B = effect(\"To\")(\"ADBE Layer Control-0001\").toWorld([0,0,0]);\n" +
"var d = B - A;\n" +
"var ry = -radiansToDegrees(Math.atan2(d[2], d[0]));\n" +
"var rz =  radiansToDegrees(Math.atan2(d[1], Math.sqrt(d[0]*d[0] + d[2]*d[2])));\n" +
"[0, ry, rz];\n";

    var BEAM_SCALE_EXPR =
"// stretch in X to the world distance between the two layers\n" +
"var A = effect(\"From\")(\"ADBE Layer Control-0001\").toWorld([0,0,0]);\n" +
"var B = effect(\"To\")(\"ADBE Layer Control-0001\").toWorld([0,0,0]);\n" +
"var L = length(B - A);\n" +
"[L / thisLayer.width * 100, 100, 100];\n";

    // ----------------------------------------------------------------
    // CURVED 3D beams. The segments are laid along a 3D Catmull-Rom spline
    // through the source layers, so the chain of beams reads as a smooth
    // curve in 3D. Each beam reads the control points live from a single
    // controller null (its "Trace Link" list) and owns a "Sample" index;
    // it evaluates the spline at u=i/M and u=(i+1)/M for its two ends.
    // ----------------------------------------------------------------
    var BEAM_CURVE_CORE =
"var C = effect(\"Curve\")(\"ADBE Layer Control-0001\");\n" +
"var Cfx = C(\"ADBE Effect Parade\");\n" +
"var P = [];\n" +
"for (var k = 1; k <= Cfx.numProperties; k++){\n" +
"    var e = Cfx(k);\n" +
"    if (e.name.indexOf(\"Trace Link\") === 0){\n" +
"        try { P.push(e(\"ADBE Layer Control-0001\").toWorld([0,0,0])); } catch(err){}\n" +
"    }\n" +
"}\n" +
"var n = P.length;\n" +
"var M = Math.max(1, Math.round(C.effect(\"Samples\")(\"ADBE Slider Control-0001\")));\n" +
"var s = C.effect(\"Tension\")(\"ADBE Slider Control-0001\");\n" +
"var closed = C.effect(\"Closed Loop\")(\"ADBE Checkbox Control-0001\") > 0;\n" +
"var i = Math.round(effect(\"Sample\")(\"ADBE Slider Control-0001\"));\n" +
"function idx(a){ return closed ? ((a % n) + n) % n : Math.max(0, Math.min(n-1, a)); }\n" +
"function CR(p0,p1,p2,p3,t){\n" +
"    var t2 = t*t, t3 = t2*t;\n" +
"    var m1 = (p2 - p0) * s;\n" +
"    var m2 = (p3 - p1) * s;\n" +
"    var a = p1*2 - p2*2 + m1 + m2;\n" +
"    var b = p1*(-3) + p2*3 - m1*2 - m2;\n" +
"    return a*t3 + b*t2 + m1*t + p1;\n" +
"}\n" +
"function evalU(u){\n" +
"    var spanCount = closed ? n : (n - 1);\n" +
"    if (spanCount < 1) spanCount = 1;\n" +
"    var f = u * spanCount;\n" +
"    var jr = Math.floor(f);\n" +
"    if (!closed && jr > n - 2) jr = n - 2;\n" +
"    if (jr < 0) jr = 0;\n" +
"    var lt = f - jr;\n" +
"    return CR(P[idx(jr-1)], P[idx(jr)], P[idx(jr+1)], P[idx(jr+2)], lt);\n" +
"}\n" +
"var A, B;\n" +
"if (n < 2){ A = [0,0,0]; B = [0,0,0]; }\n" +
"else { A = evalU(i / M); B = evalU((i + 1) / M); }\n";

    var BEAM_CURVE_POS = BEAM_CURVE_CORE + "A;\n";
    var BEAM_CURVE_ORI = BEAM_CURVE_CORE +
"var d = B - A;\n" +
"var ry = -radiansToDegrees(Math.atan2(d[2], d[0]));\n" +
"var rz =  radiansToDegrees(Math.atan2(d[1], Math.sqrt(d[0]*d[0] + d[2]*d[2])));\n" +
"[0, ry, rz];\n";
    var BEAM_CURVE_SCALE = BEAM_CURVE_CORE +
"var L = length(B - A);\n" +
"[L / thisLayer.width * 100, 100, 100];\n";



    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------
    function getActiveComp() {
        var c = app.project ? app.project.activeItem : null;
        return (c && c instanceof CompItem) ? c : null;
    }

    // Format a caught error with its source line for precise diagnosis.
    function errStr(e) {
        var s = e.toString();
        if (e.line) s += "  (line " + e.line + ")";
        return s;
    }

    function isTracerLayer(layer) {
        if (!(layer instanceof ShapeLayer)) return false;
        try {
            if (layer.property("ADBE Effect Parade").property("Trace Active")) return true;
        } catch (e) {}
        return layer.name.indexOf(SCRIPT_NAME) === 0;
    }

    function findSelectedTracer(comp) {
        var sel = comp.selectedLayers;
        for (var i = 0; i < sel.length; i++) if (isTracerLayer(sel[i])) return sel[i];
        return null;
    }

    // --- expression-control builders ---
    function fxParade(layer) { return layer.property("ADBE Effect Parade"); }

    function addCheckbox(layer, name, val) {
        var e = fxParade(layer).addProperty("ADBE Checkbox Control");
        e.name = name;
        e.property("ADBE Checkbox Control-0001").setValue(val ? 1 : 0);
        return e;
    }
    function addSlider(layer, name, val) {
        var e = fxParade(layer).addProperty("ADBE Slider Control");
        e.name = name;
        e.property("ADBE Slider Control-0001").setValue(val);
        return e;
    }
    function addAngle(layer, name, val) {
        var e = fxParade(layer).addProperty("ADBE Angle Control");
        e.name = name;
        e.property("ADBE Angle Control-0001").setValue(val);
        return e;
    }
    function addDropdown(layer, name, items, idx) {
        var fx = fxParade(layer), e;
        try {
            e = fx.addProperty("ADBE Dropdown Control");
            e.name = name;
            var menu = e.property("ADBE Dropdown Control-0001") || e.property(1);
            menu = menu.setPropertyParameters(items); // returns the live ref
            menu.setValue(idx);
            return e;
        } catch (err) {
            // AE older than 17.0.1 (no Dropdown Menu Control) -> Slider fallback.
            try { if (e) e.remove(); } catch (e2) {}
            return addSlider(layer, name, idx);
        }
    }
    function addLayerControl(layer, name, srcIndex) {
        var e = fxParade(layer).addProperty("ADBE Layer Control");
        e.name = name;
        try { e.property("ADBE Layer Control-0001").setValue(srcIndex); } catch (err) {}
        return e;
    }

    function nextLinkNumber(layer) {
        var fx = fxParade(layer), max = 0;
        for (var i = 1; i <= fx.numProperties; i++) {
            var m = fx(i).name.match(/^Trace Link (\d+)$/);
            if (m) { var v = parseInt(m[1], 10); if (v > max) max = v; }
        }
        return max + 1;
    }

    // Build the full C4D-style control rig on a fresh shape layer.
    function buildControls(layer) {
        // --- TRACER ---
        addDropdown(layer, "Tracing Mode", ["Connect All Objects"], 1);
        addCheckbox(layer, "Trace Active", true);
        addCheckbox(layer, "Reverse Sequence", false);
        // --- SPLINE ---
        addDropdown(layer, "Type", ["Linear", "Cubic", "B-Spline"], 2);
        addCheckbox(layer, "Close Spline", false);
        addDropdown(layer, "Interpolation",
                    ["None", "Natural", "Uniform", "Automatic", "Subdivided"], 2);
        addSlider(layer, "Points", 8);
        addSlider(layer, "Tension", 0.5);
        addAngle(layer, "Angle", 5);
        addSlider(layer, "Max Length", 50);
    }

    function createTracerLayer(comp, sources) {
        var layer = comp.layers.addShape();
        layer.name = SCRIPT_NAME + " (" + sources.length + ")";

        // Keep the tracer 2D: its path is built from the active-camera screen
        // projection of the (possibly 3D) source layers, so the line tracks
        // them correctly as the camera moves. A 3D tracer would mis-place the
        // 2D screen points. No transform fix-up needed: the expression uses
        // fromComp(), which compensates for this layer's position/anchor.
        layer.threeDLayer = false;

        // Path + stroke
        var contents = layer.property("ADBE Root Vectors Group");
        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = "Tracer Path";
        var gc = grp.property("ADBE Vectors Group");
        gc.addProperty("ADBE Vector Shape - Group");
        var stroke = gc.addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("ADBE Vector Stroke Width").setValue(4);
        stroke.property("ADBE Vector Stroke Color").setValue([0.13, 0.85, 1.0]);

        // Controls + links
        buildControls(layer);
        for (var i = 0; i < sources.length; i++) {
            addLayerControl(layer, "Trace Link " + (i + 1), sources[i].index);
        }

        // Wire the live path
        getTracerPathProp(layer).expression = PATH_EXPRESSION;
        return layer;
    }

    function getTracerPathProp(layer) {
        var grp = layer.property("ADBE Root Vectors Group").property("Tracer Path");
        var gc = grp.property("ADBE Vectors Group");
        return gc.property("ADBE Vector Shape - Group").property("ADBE Vector Shape");
    }

    // ----------------------------------------------------------------
    // Actions
    // ----------------------------------------------------------------
    function selectionSources(comp) {
        var sel = comp.selectedLayers, out = [];
        for (var i = 0; i < sel.length; i++) if (!isTracerLayer(sel[i])) out.push(sel[i]);
        return out;
    }

    function createTracer() {
        var comp = getActiveComp();
        if (!comp) { alert("Open a composition first.", SCRIPT_NAME); return; }
        var sources = selectionSources(comp);
        if (sources.length < 2) {
            alert("Select 2+ source layers (in the order you want them joined).",
                  SCRIPT_NAME);
            return;
        }
        app.beginUndoGroup(SCRIPT_NAME + ": Create");
        try {
            var layer = createTracerLayer(comp, sources);
            layer.selected = true;
        } catch (e) {
            alert("Tracer error: " + errStr(e), SCRIPT_NAME);
        } finally { app.endUndoGroup(); }
    }

    function addLinks() {
        var comp = getActiveComp();
        if (!comp) { alert("Open a composition first.", SCRIPT_NAME); return; }
        var tracer = findSelectedTracer(comp);
        if (!tracer) { alert("Select a Tracer layer + the new source layers.", SCRIPT_NAME); return; }
        var sources = selectionSources(comp);
        if (!sources.length) { alert("Also select the layers to add as links.", SCRIPT_NAME); return; }
        app.beginUndoGroup(SCRIPT_NAME + ": Add Links");
        try {
            var num = nextLinkNumber(tracer);
            for (var i = 0; i < sources.length; i++) {
                addLayerControl(tracer, "Trace Link " + (num + i), sources[i].index);
            }
        } catch (e) {
            alert("Add Links error: " + errStr(e), SCRIPT_NAME);
        } finally { app.endUndoGroup(); }
    }

    function reapplyExpression() {
        var comp = getActiveComp();
        if (!comp) { alert("Open a composition first.", SCRIPT_NAME); return; }
        var tracer = findSelectedTracer(comp);
        if (!tracer) { alert("Select a Tracer layer.", SCRIPT_NAME); return; }
        app.beginUndoGroup(SCRIPT_NAME + ": Re-apply Expression");
        try { getTracerPathProp(tracer).expression = PATH_EXPRESSION; }
        catch (e) { alert("Error: " + errStr(e), SCRIPT_NAME); }
        finally { app.endUndoGroup(); }
    }

    function bake() {
        var comp = getActiveComp();
        if (!comp) { alert("Open a composition first.", SCRIPT_NAME); return; }
        var layer = findSelectedTracer(comp);
        if (!layer) { alert("Select a Tracer layer to bake.", SCRIPT_NAME); return; }
        app.beginUndoGroup(SCRIPT_NAME + ": Bake");
        try {
            var p = getTracerPathProp(layer);
            var step = comp.frameDuration;
            for (var t = 0; t <= comp.duration + 1e-6; t += step) {
                p.setValueAtTime(t, p.valueAtTime(t, false));
            }
            p.expression = "";
            p.expressionEnabled = false;
        } catch (e) {
            alert("Bake error: " + errStr(e), SCRIPT_NAME);
        } finally { app.endUndoGroup(); }
    }

    // --- 3D Beams (real geometry) ---
    function makeBeam(comp, name, fromLayer, toLayer, color, thickness) {
        var h = Math.max(1, Math.round(thickness));
        var solid = comp.layers.addSolid(color, name, 100, h, 1);
        solid.threeDLayer = true;
        var tg = solid.property("ADBE Transform Group");
        // anchor at the left-center so the solid grows toward the To layer
        tg.property("ADBE Anchor Point").setValue([0, h / 2, 0]);
        addLayerControl(solid, "From", fromLayer.index);
        addLayerControl(solid, "To", toLayer.index);
        tg.property("ADBE Position").expression = BEAM_POS_EXPR;
        tg.property("ADBE Orientation").expression = BEAM_ORI_EXPR;
        tg.property("ADBE Scale").expression = BEAM_SCALE_EXPR;
        return solid;
    }

    // Curved beams: one solid per spline sub-segment, reading control points
    // from a shared controller null.
    function makeCurvedBeam(comp, name, controller, sampleIndex, color, thickness) {
        var h = Math.max(1, Math.round(thickness));
        var solid = comp.layers.addSolid(color, name, 100, h, 1);
        solid.threeDLayer = true;
        var tg = solid.property("ADBE Transform Group");
        tg.property("ADBE Anchor Point").setValue([0, h / 2, 0]);
        addLayerControl(solid, "Curve", controller.index);
        addSlider(solid, "Sample", sampleIndex);
        tg.property("ADBE Position").expression = BEAM_CURVE_POS;
        tg.property("ADBE Orientation").expression = BEAM_CURVE_ORI;
        tg.property("ADBE Scale").expression = BEAM_CURVE_SCALE;
        return solid;
    }

    function createBeams() {
        var comp = getActiveComp();
        if (!comp) { alert("Open a composition first.", SCRIPT_NAME); return; }
        var sources = selectionSources(comp);
        if (sources.length < 2) {
            alert("Select 2+ layers to connect in 3D.", SCRIPT_NAME);
            return;
        }
        app.beginUndoGroup(SCRIPT_NAME + ": Create 3D Beams");
        try {
            var made = [], i;
            if (beam3D.curved) {
                // shared controller null holds the control-point list + options
                var controller = comp.layers.addNull();
                controller.name = "Tracer 3D Curve";
                controller.threeDLayer = true;
                for (i = 0; i < sources.length; i++) {
                    addLayerControl(controller, "Trace Link " + (i + 1), sources[i].index);
                }
                var res = Math.max(1, Math.round(beam3D.res));
                var span = beam3D.closed ? sources.length : (sources.length - 1);
                var M = Math.max(1, span * res);
                addSlider(controller, "Samples", M);
                addSlider(controller, "Tension", beam3D.tension);
                addCheckbox(controller, "Closed Loop", beam3D.closed);
                for (i = 0; i < M; i++) {
                    made.push(makeCurvedBeam(comp, "Tracer Beam " + (i + 1),
                              controller, i, beam3D.color, beam3D.thickness));
                }
            } else {
                for (i = 0; i < sources.length - 1; i++) {
                    made.push(makeBeam(comp, "Tracer Beam " + (i + 1),
                              sources[i], sources[i + 1], beam3D.color, beam3D.thickness));
                }
                if (beam3D.closed && sources.length > 2) {
                    made.push(makeBeam(comp, "Tracer Beam " + sources.length,
                              sources[sources.length - 1], sources[0],
                              beam3D.color, beam3D.thickness));
                }
            }
            for (var j = 0; j < made.length; j++) made[j].selected = true;
        } catch (e) {
            alert("3D Beams error: " + errStr(e), SCRIPT_NAME);
        } finally { app.endUndoGroup(); }
    }

    // ----------------------------------------------------------------
    // UI
    // ----------------------------------------------------------------
    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ? thisObj
                : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 8;
        pal.margins = 12;

        var b1 = pal.add("button", undefined, "Create Tracer from Selection");
        b1.onClick = createTracer;

        var row = pal.add("group");
        row.alignChildren = ["fill", "center"];
        var b2 = row.add("button", undefined, "Add Selected as Links");
        b2.onClick = addLinks;

        var row2 = pal.add("group");
        row2.alignChildren = ["fill", "center"];
        var b3 = row2.add("button", undefined, "Re-apply Expr");
        var b4 = row2.add("button", undefined, "Bake");
        b3.onClick = reapplyExpression;
        b4.onClick = bake;

        // --- 3D Beams (real geometry) ---
        var p3d = pal.add("panel", undefined, "3D Beams (real geometry)");
        p3d.orientation = "column";
        p3d.alignChildren = ["fill", "top"];
        p3d.margins = 10;
        p3d.spacing = 6;
        var r3 = p3d.add("group");
        r3.add("statictext", undefined, "Thickness:");
        var thick = r3.add("edittext", undefined, "6");
        thick.characters = 4;
        r3.add("statictext", undefined, "px");
        var closedCb = r3.add("checkbox", undefined, "Closed loop");

        var r3b = p3d.add("group");
        var curvedCb = r3b.add("checkbox", undefined, "Curved");
        r3b.add("statictext", undefined, "Segs/span:");
        var segs = r3b.add("edittext", undefined, "8");
        segs.characters = 3;
        r3b.add("statictext", undefined, "Tension:");
        var tens = r3b.add("edittext", undefined, "0.5");
        tens.characters = 4;

        var bBeam = p3d.add("button", undefined, "Create 3D Beams from Selection");
        function syncBeam() {
            var t = parseFloat(thick.text);   beam3D.thickness = isNaN(t) ? 6 : t;
            var r = parseFloat(segs.text);     beam3D.res = isNaN(r) ? 8 : r;
            var n = parseFloat(tens.text);     beam3D.tension = isNaN(n) ? 0.5 : n;
            beam3D.closed = closedCb.value;
            beam3D.curved = curvedCb.value;
        }
        thick.onChange = syncBeam;
        closedCb.onClick = syncBeam;
        curvedCb.onClick = syncBeam;
        segs.onChange = syncBeam;
        tens.onChange = syncBeam;
        bBeam.onClick = function () { syncBeam(); createBeams(); };

        var hint = pal.add("statictext", undefined,
            "Shape tracer = flat 2D path (best from one camera).\n" +
            "3D Beams = real geometry connecting layers in 3D space.\n" +
            "Preset: select a tracer's effects + Path expr, then\n" +
            "Animation > Save Animation Preset…",
            { multiline: true });
        hint.preferredSize.height = 64;

        pal.layout.layout(true);
        if (pal instanceof Window) { pal.center(); pal.show(); }
        return pal;
    }

    buildUI(thisObj);

})(this);
