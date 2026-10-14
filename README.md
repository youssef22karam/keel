# KEEL / The Procedural Shipyard

Turn a budget and a seed into a unique, fully modeled fishing vessel (Three.js), then step inside its bridge.

This project was split from a single 218 KB `index.html` into small files. **Every file is under 30 KB** so it can be read in one piece. Behavior is unchanged.

## Run

ES modules do not load from `file://`, so use any static server:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Or enable GitHub Pages for the repo. An internet connection is needed (Three.js from unpkg, Tailwind CDN, Google Fonts).

## File map

| File | Size | What it holds |
| --- | --- | --- |
| `index.html` | 18.5 KB | Page shell: head, import map (Three.js via unpkg), inline SVG icon sprite, all markup and dialogs, tiny boot/timeout script. |
| `css/styles.css` | 22.6 KB | All styling: layout, sidebar, viewport overlays, dialogs, responsive rules. |
| `js/main.js` | 0.6 KB | Entry point. Exposes `window.keel` (debug API) and calls `start()`. |
| `js/utils.js` | 1.2 KB | `$`, math shortcuts, number formatters, `hash`, seeded `Random`. |
| `js/dna.js` | 10.3 KB | Palettes, price tiers, part registry data, `VesselDNA` (seed + budget → vessel parameters). |
| `js/materials.js` | 9.9 KB | `MaterialFactory`: shared materials and procedural textures. |
| `js/geometry.js` | 8.9 KB | `Parts`, `HullSculptor`, `DeckPlanner`, `batchStatics`, `disposeVessel`. |
| `js/builder.js` | 0.3 KB | Import this to get a complete `VesselBuilder` (core class + all mixins). |
| `js/builder-core.js` | 18.0 KB | `VesselBuilder` class: constructor, part registry, `build()`, hull-level pieces, superstructure. |
| `js/builder-bridge.js` | 23.4 KB | Mixin: `cabin`, wheelhouse interior, helm, cozy bridge. |
| `js/builder-topside.js` | 11.9 KB | Mixin: mast, radar, lights, exhaust, propulsion, propeller, outboard. |
| `js/builder-rig.js` | 12.4 KB | Mixin: deck equipment and fishing rigs (winch, gantry, derrick, crane, net winch). |
| `js/builder-outfit.js` | 15.4 KB | Mixin: hatches, crates, safety gear, fenders, industrial/apex equipment, bridge displays. |
| `js/state.js` | 0.5 KB | Shared `state` object, `viewport`, `raycaster`, `pointer`. |
| `js/stage.js` | 14.9 KB | Renderer, scene, camera, lights, camera views, bridge walk camera, environment, `toast`, `fatal`. |
| `js/generate.js` | 6.9 KB | `parseBrief`, `generate()`, HUD updates, budget field helpers. Owns `vessel` and `generation`. |
| `js/parts.js` | 7.2 KB | Parts list, showroom dialog, upgrade/restore part. |
| `js/viewtools.js` | 4.2 KB | Wireframe, roof, fishing rig toggle, dimension overlay, scale indicator. |
| `js/fleet.js` | 3.2 KB | "My fleet": localStorage persistence, save, fleet dialog. |
| `js/export.js` | 4.2 KB | GLB / PNG / JSON blueprint downloads. |
| `js/ui.js` | 8.6 KB | `bindUI()` with every event handler, menus, mobile panel, click inspection. |
| `js/loop.js` | 6.0 KB | `animate()` render loop, `start()`, visibility and pagehide cleanup. |
| `js/selftest.js` | 2.8 KB | `validateDNA`, `validateGeometry`, `runSelfTests`. |

## How it fits together

`index.html` loads `js/main.js`, which imports the rest. Data flows roughly: `utils` → `dna` → `materials`/`geometry` → `builder` → app modules (`stage`, `generate`, `parts`, `viewtools`, `fleet`, `export`, `ui`, `loop`).

**VesselBuilder is split across five files.** `builder-core.js` defines the class; each `builder-*.js` mixin adds methods with `Object.assign(VesselBuilder.prototype, { ... })`. Method bodies still use `this.` exactly as before. Always import `VesselBuilder` from `./builder.js` so every mixin is attached.

**Shared mutable state lives in the module that writes it.** Other modules import these as read-only live bindings:

| Variable(s) | Owner |
| --- | --- |
| `renderer, scene, camera, controls, ground, grid, contactShadow, water, sun, fillLight, ambient, environmentTarget, resizeObserver, toastTimer` | `stage.js` |
| `vessel, generation` | `generate.js` |
| `dimensions` | `viewtools.js` |
| `fleet` | `fleet.js` |
| `debounceTimer` | `ui.js` |
| `disposed, lastTime, lastDisplays, lastMetrics, metricFrames, lastScale` | `loop.js` |

An imported binding cannot be reassigned from another module. To change one, add a small setter function in the owner module and call it. `state` (in `state.js`) is a plain object and can be mutated from anywhere.

The app modules import each other in a cycle, which is fine because they only call each other's functions at runtime, never during load.

## Debug API

`window.keel` exposes `validateDNA()`, `runSelfTests()`, `inspect()`, `getBlueprint()` and `generate(cost, seed)`. URL params `?cost=5000000&seed=42819` open a specific vessel.
