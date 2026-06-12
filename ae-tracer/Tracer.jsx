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
"            // comp-space anchor of the source, mapped into this layer's space\n" +
"            pts.push(fromComp(L.toComp(L.transform.anchorPoint)));\n" +
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
    // Helpers
    // ----------------------------------------------------------------
    function getActiveComp() {
        var c = app.project ? app.project.activeItem : null;
        return (c && c instanceof CompItem) ? c : null;
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
        var e = fxParade(layer).addProperty("ADBE Dropdown Control");
        e.name = name;
        var menu = e.property("ADBE Dropdown Control-0001");
        menu = menu.setPropertyParameters(items); // must use returned ref
        try { menu.setValue(idx); } catch (err) {}
        return e;
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

        // Neutralize transform so comp/layer space line up for fromComp().
        layer.transform.position.setValue([0, 0]);
        layer.transform.anchorPoint.setValue([0, 0]);

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
            alert("Tracer error: " + e.toString(), SCRIPT_NAME);
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
            alert("Add Links error: " + e.toString(), SCRIPT_NAME);
        } finally { app.endUndoGroup(); }
    }

    function reapplyExpression() {
        var comp = getActiveComp();
        if (!comp) { alert("Open a composition first.", SCRIPT_NAME); return; }
        var tracer = findSelectedTracer(comp);
        if (!tracer) { alert("Select a Tracer layer.", SCRIPT_NAME); return; }
        app.beginUndoGroup(SCRIPT_NAME + ": Re-apply Expression");
        try { getTracerPathProp(tracer).expression = PATH_EXPRESSION; }
        catch (e) { alert("Error: " + e.toString(), SCRIPT_NAME); }
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
            alert("Bake error: " + e.toString(), SCRIPT_NAME);
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

        var hint = pal.add("statictext", undefined,
            "Create a tracer from 2+ selected layers, then tune it in the\n" +
            "Effect Controls panel (TRACER / SPLINE groups + Trace Link list).\n" +
            "To make a reusable preset: select its effects + Path expression,\n" +
            "then Animation > Save Animation Preset…",
            { multiline: true });
        hint.preferredSize.height = 64;

        pal.layout.layout(true);
        if (pal instanceof Window) { pal.center(); pal.show(); }
        return pal;
    }

    buildUI(thisObj);

})(this);
