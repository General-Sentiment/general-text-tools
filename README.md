# Text Tools

A standalone, no-build port of the sandbox `pretext-demo` — a concrete poetry typesetting tool rendered to SVG.

Place text on a page and shape it with spatial tools — ripple displacement, kern brushes, custom rag edges, and perlin noise fields. Export clean SVG for use in Figma or print workflows, or download a PNG.

Built with [Preact](https://preactjs.com) + [htm](https://github.com/developit/htm) loaded from esm.sh via an import map. No bundler, no build step, no `node_modules`.

## Running

ES modules need a server (opening `index.html` from `file://` won't work):

```sh
cd text-tools
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL.

## Tools

- **Ripple** — click to place concentric wave distortion origins. Drag to reposition. Adjustable wavelength, decay, intensity, and polarity.
- **Kern Brush** — paint to push letters apart. Drag right to add spacing, drag left to erase. Per-stroke radius with smooth falloff. Intensity Y adds a baked-in vertical baseline shift.
- **Rag** — click to place control points that define custom left/right column edges. Text reflows in real time as points are added or moved.
- **Displacement** — perlin noise offset on X/Y axes with adjustable scale, intensity, and seed.

## Shortcuts

- `⌘Z` / `⌘⇧Z` — undo / redo
- `⌘C` / `⌘V` — copy / paste the focused page's tool state onto another page
- `Backspace` — delete the selected rag point

## Pages

Separate pages in the text input with a line containing `----`. Each page keeps its own ripples, kern strokes, and rag points.

## Architecture

```
text-tools/
├── index.html          # import map (preact, htm via esm.sh) + mount point
├── styles.css          # dark theme
└── src/
    ├── main.js           # fonts, presets, render()
    ├── TypesetEditor.js  # main editor (state, layout, SVG canvas)
    ├── Toolbar.js        # tool selector + undo/redo
    ├── Sidebar.js        # text input, presets, control panels
    ├── controls.js       # schema-driven panel (Slider/Select/Checkbox) — the leva replacement
    ├── constants.js      # SVG page dimensions
    ├── perlin.js         # 2D perlin noise
    ├── measure.js        # canvas text measurement + font preloading
    └── useUndoRedo.js    # generic undo/redo hook
```

## Differences from the original

- Preact + htm tagged templates instead of React/Next JSX; SVG attributes are hyphenated (`font-family`, `stroke-width`) since Preact sets them as-is.
- leva is replaced by a small schema-driven control panel (`controls.js`).
- Tailwind is replaced by plain CSS (`styles.css`).
- `@chenglou/pretext` is dropped entirely — the original loaded it but only used canvas `measureText`, which is kept. Readiness now comes from preloading the fonts via `document.fonts.load`.
- System fonts only (sans, Arial, serif, Times) — no self-hosted font files.
