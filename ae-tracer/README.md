# Tracer for After Effects

A Cinema 4D **Tracer**-style rig for After Effects. It builds a shape layer
whose path is driven by a single **live expression** that reads **Expression
Controls** in the Effect Controls panel — so you configure it just like C4D's
Tracer object, with a **Trace Link** list and a **SPLINE** group.

The path follows the linked layers every frame, like C4D's Tracer.

## The Effect Controls UI (matches the C4D panel)

Once you create a tracer, its Effect Controls panel shows:

**TRACER**
- **Tracing Mode** — dropdown (currently `Connect All Objects`)
- **Trace Active** — checkbox; off = empty path
- **Reverse Sequence** — checkbox; reverses link order

**SPLINE**
- **Type** — `Linear` / `Cubic` / `B-Spline`
- **Close Spline** — checkbox
- **Interpolation** — `None / Natural / Uniform / Automatic / Subdivided`
- **Points** — B-Spline resolution (samples per span)
- **Tension** — curvature for `Cubic`
- **Angle**, **Max Length** — parity controls (see *Status* below)

**Trace Link**
- **Trace Link 1 … N** — one **Layer Control** per source. This is the AE
  equivalent of C4D's Trace Link list. Pick a layer in each, set extras to
  *None*. Add/remove rows freely — the expression auto-discovers any effect
  named `Trace Link …`.

### What's fully wired vs. parity-only

| Control | Status |
|---|---|
| Trace Link list, Trace Active, Reverse Sequence | ✅ functional |
| Type (Linear / Cubic / B-Spline), Close Spline | ✅ functional |
| Points (B-Spline resolution), Tension | ✅ functional |
| Tracing Mode, Interpolation, Angle, Max Length | ⚪ present for C4D parity, not yet driving the path |

The parity controls exist so the panel matches the C4D layout and so a saved
preset is forward-compatible. Wiring them up (adaptive subdivision via
Angle/Max Length, true Bezier/Akima types) is a straightforward next step.

> C4D-only options (Sample Step, Trace Vertices, Use TP Subgroups, Handle
> Cloners, Include Cloner) are omitted — they depend on Thinking Particles /
> Cloners / MoGraph, which have no After Effects equivalent.

## Preview window (`preview.html`)

Open `ae-tracer/preview.html` in any browser — no install, no dependencies. It's
an interactive **3D preview** of the tracer:

- A set of nulls floating in 3D (animated by default). **Drag** to orbit,
  **wheel** to zoom, **shift-drag** to pan.
- The connecting spline uses the **same math as the AE path expression**
  (Linear / Cubic / B-Spline, Close, Points, Tension, Reverse) and is computed
  in screen space from the camera-projected null positions — i.e. exactly how
  the AE tool behaves.
- Controls on the right mirror the TRACER / SPLINE groups so you can dial in a
  look before building it in After Effects.

Orbit the camera and watch the line stay locked to the nulls — that's the 3D
linking, demonstrated outside of AE.

## Use it as a builder (script)

Install: copy `Tracer.jsx` into the **ScriptUI Panels** folder…

- **Windows:** `…\Adobe After Effects <ver>\Support Files\Scripts\ScriptUI Panels\`
- **macOS:** `/Applications/Adobe After Effects <ver>/Scripts/ScriptUI Panels/`

…restart AE, open it from the **Window** menu (or run via **File → Scripts →
Run Script File…** for a floating window). Then:

- **Create Tracer from Selection** — select 2+ layers (in join order) → builds
  the tracer + control rig + Trace Link rows.
- **Add Selected as Links** — select a tracer + new layers → appends Trace Link rows.
- **Re-apply Expr** — restore the path expression if it was edited/removed.
- **Bake** — convert the live path to per-frame keyframes (removes expression).

## Use it as an Effect & Preset (`.ffx`)

After Effects has **no scripting API to write `.ffx` files**, so the rig is
packaged as a preset with one manual save (done once):

1. Build a tracer with the script.
2. In the **Effect Controls** panel, select all of its effects.
3. In the **Timeline**, also select the **Path** property (it carries the
   expression) — and the stroke if you want styling included.
4. **Animation → Save Animation Preset…** and save into your
   *User Presets* / *Effects & Presets* folder.

It now appears in the **Effects & Presets** panel and can be dropped onto any
shape layer. (You still pick the source layers per Trace Link after applying,
since layer references can't be baked into a generic preset.)

## How it works

Each frame the expression collects every `Trace Link` Layer Control, reads the
linked layer's comp-space anchor, maps it into the tracer's space, and builds
the path:

```js
pts.push(fromComp(L.toComp(L.transform.anchorPoint)));
// …then per Type: Linear (polyline), Cubic (Catmull-Rom tangents),
// or B-Spline (uniform cubic, resampled to `Points` per span)…
createPath(V, inTangents, outTangents, isClosed);
```

## 3D layers

The tracer **does link 3D nulls/layers**. Each frame it takes every source's
position and asks AE for its **active-camera screen projection**
(`L.toComp(L.transform.anchorPoint)`), so the connecting line passes through the
3D nulls exactly as they appear through the camera — and updates as the camera
orbits, dollies, or the nulls move in depth.

Things to know:

- The tracer shape layer itself stays **2D on purpose**. A shape-layer path is a
  flat 2D contour, so the line is drawn in screen space, not as true 3D
  geometry. It looks correct from the **active camera**; it is not independent
  3D geometry you can view from a second camera simultaneously or have other 3D
  layers occlude in depth.
- It tracks the **active camera** (or the default comp view if there's no
  camera). Switching cameras re-projects automatically.
- Works with a mix of 2D and 3D sources in the same tracer.

### 3D Beams mode — real 3D geometry

For a connection that lives in **actual 3D space** (correct from any camera,
depth-sorted, not a flat screen line), use **Create 3D Beams from Selection**.

Instead of one 2D shape path, it builds **one thin 3D solid per segment**. Each
beam is anchored at its left edge and driven by expressions:

```js
// Position — start at the "From" layer's world position
effect("From")("ADBE Layer Control-0001").toWorld([0,0,0]);

// Orientation — aim local +X at the "To" layer
var d = B - A;                                  // world delta
[0, -radiansToDegrees(atan2(d[2],d[0])),
    radiansToDegrees(atan2(d[1], length(d.xz)))];

// Scale — stretch X to the world distance
[ length(B - A) / thisLayer.width * 100, 100, 100 ];
```

Each beam carries **From** / **To** Layer Controls (editable in Effect Controls),
so you can repoint segments without rebuilding. Options in the panel:

- **Thickness** — solid height in px (the beam's cross-section).
- **Closed loop** — adds a final beam from the last layer back to the first.

Trade-offs vs. the shape path: real 3D, but it's flat-plane geometry (a thin
solid), so a beam viewed exactly edge-on gets thin/invisible. For thick tube-like
3D lines you'd extrude shapes in the CINEMA 4D renderer or use a plugin (Plexus,
Stardust); say the word and I can add an extruded-shape variant.

## Notes / limits

- Layer Controls reference layers **by index**, so reordering layers can shift a
  link; renaming is safe.
- Open B-Spline needs **4+ points** for a true curve; fewer falls back to a
  polyline. It approximates (doesn't pass through) control points, by design.
- Built against the AE ExtendScript API (AE 2020+; Dropdown Menu Control
  requires AE 17.0.1+). Not live-tested inside AE in this environment.
