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

## Notes / limits

- Layer Controls reference layers **by index**, so reordering layers can shift a
  link; renaming is safe.
- 3D nulls are projected to 2D (screen position) — intended for 2D line work.
- Open B-Spline needs **4+ points** for a true curve; fewer falls back to a
  polyline. It approximates (doesn't pass through) control points, by design.
- Built against the AE ExtendScript API (AE 2020+; Dropdown Menu Control
  requires AE 17.0.1+). Not live-tested inside AE in this environment.
