/**********************************************************************
 * Tracer for After Effects
 * --------------------------------------------------------------------
 * Connects null (or any) layers with a live, expression-driven shape
 * layer path -- inspired by the Tracer object in Cinema 4D.
 *
 * The generated path reads each source layer's comp-space position every
 * frame, so the connection follows the nulls as they move or animate.
 *
 * USAGE
 *   1. Place this file in:
 *        Win: Program Files\Adobe\Adobe After Effects <ver>\
 *             Support Files\Scripts\ScriptUI Panels\
 *        Mac: /Applications/Adobe After Effects <ver>/Scripts/
 *             ScriptUI Panels/
 *   2. Restart AE -> Window menu -> Tracer.jsx (dockable panel).
 *      (Or run via File > Scripts > Run Script File... as a window.)
 *   3. Select 2+ layers in a comp, set options, click "Connect".
 *
 * Re-running "Connect" with a Tracer layer selected updates it in place.
 **********************************************************************/

(function tracerMain(thisObj) {

    var SCRIPT_NAME = "Tracer";
    var MARKER_NAME = "tracerSources"; // marker on the generated layer

    // ----------------------------------------------------------------
    // Expression template (string). Tokens replaced at creation time:
    //   __NAMES__   -> JSON-ish array of source layer names
    //   __CLOSED__  -> "true" / "false"
    //   __SMOOTH__  -> "true" / "false"
    //   __TENSION__ -> number
    // ----------------------------------------------------------------
    function buildExpression(names, closed, smooth, tension) {
        var nameArr = "[";
        for (var i = 0; i < names.length; i++) {
            // escape quotes/backslashes in layer names
            var safe = names[i].replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            nameArr += '"' + safe + '"' + (i < names.length - 1 ? "," : "");
        }
        nameArr += "]";

        var expr =
"// Tracer -- live connection of source layers\n" +
"var names = " + nameArr + ";\n" +
"var closed = " + (closed ? "true" : "false") + ";\n" +
"var smooth = " + (smooth ? "true" : "false") + ";\n" +
"var tension = " + tension + ";\n" +
"var pts = [];\n" +
"for (var i = 0; i < names.length; i++) {\n" +
"    try {\n" +
"        var L = thisComp.layer(names[i]);\n" +
"        // comp-space position of the source's anchor, mapped into this\n" +
"        // layer's space so the path is correct under any transform.\n" +
"        pts.push(fromComp(L.toComp(L.transform.anchorPoint)));\n" +
"    } catch (e) { /* missing layer -> skip */ }\n" +
"}\n" +
"var n = pts.length;\n" +
"var inT = [], outT = [];\n" +
"if (smooth && n >= 2) {\n" +
"    for (var i = 0; i < n; i++) {\n" +
"        var prev = pts[(i - 1 + n) % n];\n" +
"        var next = pts[(i + 1) % n];\n" +
"        if (!closed) {\n" +
"            if (i === 0) prev = pts[0];\n" +
"            if (i === n - 1) next = pts[n - 1];\n" +
"        }\n" +
"        var tang = (next - prev) * (tension * 0.5);\n" +
"        outT.push(tang);\n" +
"        inT.push(-tang);\n" +
"    }\n" +
"} else {\n" +
"    for (var i = 0; i < n; i++) { inT.push([0, 0]); outT.push([0, 0]); }\n" +
"}\n" +
"if (n < 2) { createPath([[0,0]], [[0,0]], [[0,0]], false); }\n" +
"else { createPath(pts, inT, outT, closed); }\n";

        return expr;
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------
    function getActiveComp() {
        var c = app.project ? app.project.activeItem : null;
        if (!c || !(c instanceof CompItem)) return null;
        return c;
    }

    function isTracerLayer(layer) {
        if (!(layer instanceof ShapeLayer)) return false;
        try {
            var m = layer.property("ADBE Marker");
            for (var i = 1; i <= m.numKeys; i++) {
                if (m.keyValue(i).comment === MARKER_NAME) return true;
            }
        } catch (e) {}
        return layer.name.indexOf(SCRIPT_NAME) === 0;
    }

    // Find an existing Tracer layer in the current selection (for update).
    function findSelectedTracer(comp) {
        var sel = comp.selectedLayers;
        for (var i = 0; i < sel.length; i++) {
            if (isTracerLayer(sel[i])) return sel[i];
        }
        return null;
    }

    // Tag a layer so we can recognize it later.
    function tagTracer(layer, names) {
        try {
            var mProp = layer.property("ADBE Marker");
            var mv = new MarkerValue(MARKER_NAME);
            mProp.setValueAtTime(0, mv);
        } catch (e) {}
    }

    // ----------------------------------------------------------------
    // Core: create or update the tracer shape layer.
    // ----------------------------------------------------------------
    function connect(opts) {
        var comp = getActiveComp();
        if (!comp) {
            alert("Open a composition first.", SCRIPT_NAME);
            return;
        }

        var sel = comp.selectedLayers;
        // Sources = selected layers minus any existing tracer layers.
        var sources = [];
        var existingTracer = null;
        for (var i = 0; i < sel.length; i++) {
            if (isTracerLayer(sel[i])) { existingTracer = sel[i]; continue; }
            sources.push(sel[i]);
        }

        // If only a tracer was selected, refresh it using its stored names.
        var names = [];
        if (sources.length < 2) {
            if (existingTracer) {
                names = readStoredNames(existingTracer);
            }
            if (names.length < 2) {
                alert("Select at least 2 source layers to connect.\n" +
                      "(Tip: select your null layers in the order you want them joined.)",
                      SCRIPT_NAME);
                return;
            }
        } else {
            if (opts.useStackOrder) {
                // sort by index (top of timeline first)
                sources.sort(function (a, b) { return a.index - b.index; });
            }
            for (var j = 0; j < sources.length; j++) names.push(sources[j].name);
        }

        app.beginUndoGroup(SCRIPT_NAME + ": Connect");
        try {
            var layer = existingTracer;
            var pathProp;

            if (layer) {
                pathProp = getTracerPathProp(layer);
            } else {
                layer = createTracerLayer(comp, opts, names);
                pathProp = getTracerPathProp(layer);
                tagTracer(layer, names);
                storeNames(layer, names);
            }

            pathProp.expression =
                buildExpression(names, opts.closed, opts.smooth, opts.tension);

            // refresh stroke styling on update too
            applyStroke(layer, opts);

            layer.selected = true;
        } catch (e) {
            alert("Tracer error: " + e.toString(), SCRIPT_NAME);
        } finally {
            app.endUndoGroup();
        }
    }

    // Build a fresh shape layer with one path + stroke group.
    function createTracerLayer(comp, opts, names) {
        var layer = comp.layers.addShape();
        layer.name = SCRIPT_NAME + " (" + names.length + ")";

        // Neutralize transform so fromComp/comp space line up predictably.
        layer.transform.position.setValue([0, 0]);
        layer.transform.anchorPoint.setValue([0, 0]);

        var contents = layer.property("ADBE Root Vectors Group");
        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = "Tracer Path";
        var grpContents = grp.property("ADBE Vectors Group");

        // Path
        grpContents.addProperty("ADBE Vector Shape - Group");

        // Stroke
        grpContents.addProperty("ADBE Vector Graphic - Stroke");

        // Optional fill (only meaningful for closed paths)
        if (opts.closed && opts.fill) {
            grpContents.addProperty("ADBE Vector Graphic - Fill");
        }

        return layer;
    }

    function getTracerPathProp(layer) {
        var grp = layer.property("ADBE Root Vectors Group").property(1);
        var grpContents = grp.property("ADBE Vectors Group");
        var shape = grpContents.property("ADBE Vector Shape - Group");
        return shape.property("ADBE Vector Shape");
    }

    function applyStroke(layer, opts) {
        try {
            var grp = layer.property("ADBE Root Vectors Group").property(1);
            var grpContents = grp.property("ADBE Vectors Group");
            var stroke = grpContents.property("ADBE Vector Graphic - Stroke");
            if (stroke) {
                stroke.property("ADBE Vector Stroke Width").setValue(opts.width);
                stroke.property("ADBE Vector Stroke Color")
                      .setValue(opts.color);
            }
        } catch (e) {}
    }

    // Persist source names in a hidden comment marker so updates work even
    // after the source layers are deselected.
    function storeNames(layer, names) {
        try {
            var mProp = layer.property("ADBE Marker");
            var mv = new MarkerValue(MARKER_NAME);
            mv.comment = MARKER_NAME;
            // store as a duration-0 marker; names live in the expression too,
            // but we keep a copy for convenience.
            mProp.setValueAtTime(0, mv);
        } catch (e) {}
    }

    // Recover names from the layer's path expression.
    function readStoredNames(layer) {
        var names = [];
        try {
            var pathProp = getTracerPathProp(layer);
            var ex = pathProp.expression || "";
            var m = ex.match(/var names = \[(.*?)\];/);
            if (m && m[1].length) {
                var parts = m[1].split(",");
                for (var i = 0; i < parts.length; i++) {
                    var s = parts[i].replace(/^\s*"|"\s*$/g, "")
                                    .replace(/\\"/g, '"').replace(/\\\\/g, "\\");
                    if (s.length) names.push(s);
                }
            }
        } catch (e) {}
        return names;
    }

    // Convert the live expression into baked keyframes (detach).
    function bake() {
        var comp = getActiveComp();
        if (!comp) { alert("Open a composition first.", SCRIPT_NAME); return; }
        var layer = findSelectedTracer(comp);
        if (!layer) {
            alert("Select a Tracer layer to bake.", SCRIPT_NAME);
            return;
        }
        app.beginUndoGroup(SCRIPT_NAME + ": Bake");
        try {
            var pathProp = getTracerPathProp(layer);
            var step = comp.frameDuration;
            var t = 0;
            // sample across the work area / comp duration
            var start = 0, end = comp.duration;
            for (t = start; t <= end + 1e-6; t += step) {
                var v = pathProp.valueAtTime(t, false);
                pathProp.setValueAtTime(t, v);
            }
            pathProp.expression = "";
            pathProp.expressionEnabled = false;
        } catch (e) {
            alert("Bake error: " + e.toString(), SCRIPT_NAME);
        } finally {
            app.endUndoGroup();
        }
    }

    // ----------------------------------------------------------------
    // UI
    // ----------------------------------------------------------------
    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME, undefined,
                         { resizeable: true });

        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 8;
        pal.margins = 12;

        // --- Options panel ---
        var opt = pal.add("panel", undefined, "Options");
        opt.orientation = "column";
        opt.alignChildren = ["fill", "top"];
        opt.margins = 12;
        opt.spacing = 6;

        var cbClosed = opt.add("checkbox", undefined, "Close path");
        var cbSmooth = opt.add("checkbox", undefined, "Smooth (curved)");
        var cbFill   = opt.add("checkbox", undefined, "Fill (closed only)");
        var cbStack  = opt.add("checkbox", undefined,
                               "Use timeline order (else selection order)");

        // tension row
        var rowT = opt.add("group");
        rowT.add("statictext", undefined, "Tension:");
        var tension = rowT.add("edittext", undefined, "0.33");
        tension.characters = 5;

        // width row
        var rowW = opt.add("group");
        rowW.add("statictext", undefined, "Stroke:");
        var width = rowW.add("edittext", undefined, "4");
        width.characters = 5;
        rowW.add("statictext", undefined, "px");
        var colorBtn = rowW.add("button", undefined, "Color…");

        // current color state (default cyan)
        var colorState = [0.13, 0.85, 1.0];
        colorBtn.onClick = function () {
            var packed = $.colorPicker();
            if (packed >= 0) {
                var r = ((packed >> 16) & 0xFF) / 255;
                var g = ((packed >> 8) & 0xFF) / 255;
                var b = (packed & 0xFF) / 255;
                colorState = [r, g, b];
            }
        };

        cbClosed.value = false;
        cbSmooth.value = true;

        // --- Action buttons ---
        var connectBtn = pal.add("button", undefined, "Connect Selected");
        connectBtn.onClick = function () {
            connect(gatherOpts());
        };

        var rowB = pal.add("group");
        rowB.alignChildren = ["fill", "center"];
        var updateBtn = rowB.add("button", undefined, "Update");
        var bakeBtn   = rowB.add("button", undefined, "Bake");
        updateBtn.onClick = function () { connect(gatherOpts()); };
        bakeBtn.onClick = function () { bake(); };

        var hint = pal.add("statictext", undefined,
            "Select 2+ layers, then Connect. Re-select a Tracer + new\n" +
            "layers and Update, or select only the Tracer to refresh.",
            { multiline: true });
        hint.preferredSize.height = 40;

        function gatherOpts() {
            var t = parseFloat(tension.text);
            if (isNaN(t)) t = 0.33;
            var w = parseFloat(width.text);
            if (isNaN(w)) w = 4;
            return {
                closed: cbClosed.value,
                smooth: cbSmooth.value,
                fill: cbFill.value,
                useStackOrder: cbStack.value,
                tension: t,
                width: w,
                color: colorState
            };
        }

        pal.layout.layout(true);
        if (pal instanceof Window) {
            pal.center();
            pal.show();
        }
        return pal;
    }

    buildUI(thisObj);

})(this);
