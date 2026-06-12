# Tracer for After Effects

A dockable ScriptUI panel that connects null (or any) layers with a **live,
expression-driven shape-layer path** — inspired by the **Tracer** object in
Cinema 4D. The generated path reads each source layer's position every frame,
so the connection follows the nulls as they move and animate.

## Features

- **Live connection** — path is driven by an expression; move a null and the
  line follows. No re-running needed.
- **Order control** — connect in the order you selected the layers, or in
  timeline (stacking) order.
- **Open or closed** path, with optional **fill** for closed shapes.
- **Smooth / curved** mode (Catmull-Rom-style tangents) with adjustable
  **tension**, or straight segments.
- **Stroke width + color** controls.
- **Update** an existing Tracer in place (re-select it, optionally with new
  source layers).
- **Bake** the live result into keyframes when you want it static / faster.

## Install

Copy `Tracer.jsx` into the **ScriptUI Panels** folder:

- **Windows:**
  `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`
- **macOS:**
  `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`

Restart After Effects. The panel appears under the **Window** menu as
`Tracer.jsx` and can be docked like any panel.

> First run: enable **Preferences → Scripting & Expressions → Allow Scripts to
> Write Files and Access Network** if AE prompts about scripting permissions.

You can also run it ad-hoc via **File → Scripts → Run Script File…**, in which
case it opens as a floating window instead of a dockable panel.

## Usage

1. Open a composition and create/select your null layers.
2. **Select 2 or more layers** in the order you want them joined
   (or enable *Use timeline order*).
3. Set options (close, smooth, tension, stroke), then click **Connect Selected**.
4. A `Tracer (N)` shape layer is created and stays linked to the sources.

### Updating

- Select the **Tracer layer + any new source layers** and click **Update** to
  rebuild the connection with the new set.
- Select **only the Tracer layer** and click **Update / Connect** to refresh
  styling/options using its stored sources.

### Baking

Select the Tracer layer and click **Bake** to convert the live expression into
per-frame keyframes (removes the expression). Useful for handoff or heavy comps.

## How it works

The path property gets an expression that, for each source layer name, computes
its comp-space anchor position and maps it into the shape layer's space:

```js
pts.push(fromComp(L.toComp(L.transform.anchorPoint)));
```

then feeds the points to `createPath(pts, inTangents, outTangents, closed)`.
Smooth mode derives tangents from neighboring points scaled by `tension`.

Source layers are referenced **by name**, so avoid duplicate layer names in the
same comp. The names are stored inside the expression, which is also how
*Update* recovers them.

## Notes / limits

- 3D nulls are projected to 2D (screen position) — intended for 2D line work.
- Renaming a source layer breaks the reference; re-select and **Update**.
- Tested conceptually against the AE ExtendScript API (AE 2020+). The shape
  property match-names used are standard across modern versions.
