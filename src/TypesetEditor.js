import { useState, useEffect, useRef, useMemo, useCallback } from "preact/hooks";
import { html } from "htm/preact";
import { perlin2d } from "./perlin.js";
import { measureText, useFontsReady } from "./measure.js";
import { useUndoRedo } from "./useUndoRedo.js";
import { SVG_W, SVG_H } from "./constants.js";
import { Toolbar } from "./Toolbar.js";
import { Sidebar } from "./Sidebar.js";

const PAGE_SEPARATOR = "----";

function emptyPageToolState() {
  return { ripples: [], kernStrokes: [], ragPoints: [] };
}

export function TypesetEditor({ fonts, defaultFont, defaultText = "", fontFiles = {} }) {
  const ready = useFontsReady(fonts);

  const [activeTool, setActiveTool] = useState("none");
  const [focusedPage, setFocusedPage] = useState(0);
  const [selectedRagIndex, setSelectedRagIndex] = useState(null);
  const [brushCursor, setBrushCursor] = useState(null);

  // --- Control panel state (was leva) ---
  const [settings, setSettings] = useState({
    fontSize: 16,
    lineHeight: 32,
    font: defaultFont,
    fontWeight: 300,
    letterSpacing: 0,
  });

  const [layout, setLayout] = useState({
    marginX: 114,
    marginTop: 60,
    marginBottom: 60,
    verticalAlign: "center",
    textAlign: "left",
    showGuides: false,
  });

  const [displacement, setDisplacement] = useState({
    enabled: false,
    offsetX: true,
    offsetY: true,
    granularity: "word",
    intensity: 8,
    scale: 0.02,
    seed: 0,
    showNoise: false,
  });

  const [rippleSettings, setRippleSettings] = useState({
    enabled: false,
    granularity: "letter",
    intensity: 10,
    wavelength: 60,
    decay: 0.003,
    invert: false,
    showPoints: true,
  });

  const [kernSettings, setKernSettings] = useState({
    enabled: false,
    showBrush: true,
    intensity: 5,
    intensityY: 0,
    radius: 60,
  });

  const [ragSettings, setRagSettings] = useState({
    enabled: false,
    showGuides: true,
  });

  // --- Content & per-page tool state ---
  const [content, setContent] = useState(defaultText);
  const [pagesToolState, setPagesToolState] = useState([emptyPageToolState()]);

  // Split content into pages
  const pageTexts = useMemo(() => content.split(PAGE_SEPARATOR), [content]);

  // Ensure pagesToolState array matches page count
  const prevPageCount = useRef(pageTexts.length);
  if (pageTexts.length !== prevPageCount.current) {
    const diff = pageTexts.length - prevPageCount.current;
    if (diff > 0) {
      setPagesToolState((prev) => [...prev, ...Array.from({ length: diff }, emptyPageToolState)]);
    } else if (diff < 0) {
      setPagesToolState((prev) => prev.slice(0, pageTexts.length));
    }
    prevPageCount.current = pageTexts.length;
    if (focusedPage >= pageTexts.length) setFocusedPage(Math.max(0, pageTexts.length - 1));
  }

  // Accessors for focused page
  const setFpState = useCallback(
    (fn) => {
      setPagesToolState((prev) => prev.map((p, i) => (i === focusedPage ? fn(p) : p)));
    },
    [focusedPage],
  );

  const setRipples = useCallback((fn) => setFpState((p) => ({ ...p, ripples: fn(p.ripples) })), [setFpState]);
  const setKernStrokes = useCallback((fn) => setFpState((p) => ({ ...p, kernStrokes: fn(p.kernStrokes) })), [setFpState]);
  const setRagPoints = useCallback((fn) => setFpState((p) => ({ ...p, ragPoints: fn(p.ragPoints) })), [setFpState]);

  // --- Undo/Redo ---
  const contentRef = useRef(content);
  const pagesRef = useRef(pagesToolState);
  contentRef.current = content;
  pagesRef.current = pagesToolState;

  const getSnapshot = () => ({ content: contentRef.current, pages: pagesRef.current });
  const restore = (snap) => {
    setContent(snap.content);
    setPagesToolState(snap.pages);
  };
  const { pushUndo, undo, redo, canUndo, canRedo } = useUndoRedo(getSnapshot, restore);

  const setContentWithUndo = (val) => { pushUndo(getSnapshot()); setContent(val); };
  const setRipplesWithUndo = (fn) => { pushUndo(getSnapshot()); setRipples(fn); };
  const setKernStrokesWithUndo = (fn) => { pushUndo(getSnapshot()); setKernStrokes(fn); };
  const setRagPointsWithUndo = (fn) => { pushUndo(getSnapshot()); setRagPoints(fn); };

  // Auto-select tool on enable
  const prevRipple = useRef(rippleSettings.enabled);
  const prevKern = useRef(kernSettings.enabled);
  const prevRag = useRef(ragSettings.enabled);
  useEffect(() => { if (rippleSettings.enabled && !prevRipple.current) setActiveTool("ripple"); prevRipple.current = rippleSettings.enabled; }, [rippleSettings.enabled]);
  useEffect(() => { if (kernSettings.enabled && !prevKern.current) setActiveTool("kern"); prevKern.current = kernSettings.enabled; }, [kernSettings.enabled]);
  useEffect(() => { if (ragSettings.enabled && !prevRag.current) setActiveTool("rag"); prevRag.current = ragSettings.enabled; }, [ragSettings.enabled]);

  // Switching away from a tool that was never used (no data on any page)
  // puts it back to disabled so its panel collapses again.
  useEffect(() => {
    const total = (key) => pagesRef.current.reduce((n, p) => n + p[key].length, 0);
    if (activeTool !== "ripple" && rippleSettings.enabled && total("ripples") === 0)
      setRippleSettings((s) => ({ ...s, enabled: false }));
    if (activeTool !== "kern" && kernSettings.enabled && total("kernStrokes") === 0)
      setKernSettings((s) => ({ ...s, enabled: false }));
    if (activeTool !== "rag" && ragSettings.enabled && total("ragPoints") === 0)
      setRagSettings((s) => ({ ...s, enabled: false }));
  }, [activeTool]);

  // --- Clipboard for page tool state (Cmd+C/V) ---
  const copiedPageState = useRef(null);

  // Keyboard shortcuts
  const selectedRagIndexRef = useRef(selectedRagIndex);
  const focusedPageRef = useRef(focusedPage);
  selectedRagIndexRef.current = selectedRagIndex;
  focusedPageRef.current = focusedPage;

  useEffect(() => {
    const handler = (e) => {
      const inTextField =
        document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT";
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      // Cmd+C: copy focused page tool state
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && !e.shiftKey) {
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return; // don't intercept text selection copy
        copiedPageState.current = structuredClone(pagesRef.current[focusedPageRef.current]);
        return;
      }
      // Cmd+V: paste tool state onto focused page
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && !e.shiftKey) {
        if (!copiedPageState.current) return;
        if (inTextField) return;
        e.preventDefault();
        pushUndo(getSnapshot());
        const copied = structuredClone(copiedPageState.current);
        setPagesToolState((prev) => prev.map((p, i) => (i === focusedPageRef.current ? copied : p)));
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedRagIndexRef.current !== null && !inTextField) {
        e.preventDefault();
        const idx = selectedRagIndexRef.current;
        pushUndo(getSnapshot());
        setPagesToolState((prev) =>
          prev.map((p, i) =>
            i === focusedPageRef.current
              ? { ...p, ragPoints: p.ragPoints.filter((_, j) => j !== idx) }
              : p,
          ),
        );
        setSelectedRagIndex(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // --- Measurement helpers ---
  const measure = (text) =>
    measureText(text, settings.font, settings.fontSize, settings.fontWeight, settings.letterSpacing);

  const kernExtraSpacingAt = (kernStrokes, px, py) => {
    if (!kernSettings.enabled || kernStrokes.length === 0) return 0;
    let total = 0;
    for (const stroke of kernStrokes) {
      const dist = Math.hypot(stroke.x - px, stroke.y - py);
      if (dist < stroke.radius) {
        const t = 1 - dist / stroke.radius;
        total += t * t * kernSettings.intensity * 0.0625 * stroke.strength;
      }
    }
    return Math.max(0, total);
  };

  // Vertical analog of kernExtraSpacingAt: a signed visual baseline shift, no effect on layout.
  // Each stroke carries its own intensityY (baked at paint time), so one page can mix directions.
  const kernOffsetYAt = (kernStrokes, px, py) => {
    if (!kernSettings.enabled || kernStrokes.length === 0) return 0;
    let total = 0;
    for (const stroke of kernStrokes) {
      const intensityY = stroke.intensityY ?? 0;
      if (intensityY === 0) continue;
      const dist = Math.hypot(stroke.x - px, stroke.y - py);
      if (dist < stroke.radius) {
        const t = 1 - dist / stroke.radius;
        total += t * t * intensityY * 0.0625 * stroke.strength;
      }
    }
    return total;
  };

  const measureWordWithKern = (kernStrokes, word, startX, baseY) => {
    if (!kernSettings.enabled || kernStrokes.length === 0) return measure(word);
    let x = startX;
    for (const ch of word) {
      x += measure(ch) + kernExtraSpacingAt(kernStrokes, x, baseY);
    }
    return x - startX;
  };

  const getRagMargins = (ragPoints, svgY) => {
    const defaultLeft = layout.marginX;
    const defaultRight = SVG_W - layout.marginX;
    if (!ragSettings.enabled || ragPoints.length === 0)
      return { left: defaultLeft, right: defaultRight };
    const interpolate = (pts, defaultX) => {
      if (pts.length === 0) return defaultX;
      if (pts.length === 1) return pts[0].x;
      if (svgY <= pts[0].y) return pts[0].x;
      if (svgY >= pts[pts.length - 1].y) return pts[pts.length - 1].x;
      for (let i = 0; i < pts.length - 1; i++) {
        if (svgY >= pts[i].y && svgY <= pts[i + 1].y) {
          const t = (svgY - pts[i].y) / (pts[i + 1].y - pts[i].y);
          return pts[i].x + t * (pts[i + 1].x - pts[i].x);
        }
      }
      return defaultX;
    };
    const leftPts = ragPoints.filter((p) => p.side === "left").sort((a, b) => a.y - b.y);
    const rightPts = ragPoints.filter((p) => p.side === "right").sort((a, b) => a.y - b.y);
    return { left: interpolate(leftPts, defaultLeft), right: interpolate(rightPts, defaultRight) };
  };

  // --- Per-page layout ---
  const doPageLayout = (text, pageState) => {
    if (!ready || !text.trim()) return { words: [], startY: 0 };

    const { kernStrokes, ragPoints } = pageState;
    const hasKern = kernSettings.enabled && kernStrokes.length > 0;
    const hasRag = ragSettings.enabled && ragPoints.length > 0;
    const spaceWidth = measure(" ");
    const paragraphs = text.split("\n").map((line) =>
      line.trim() === "" ? null : (line.match(/\S+/g) ?? []),
    );

    const doLayout = (offsetY) => {
      const result = [];
      let lineIndex = 0;
      for (const para of paragraphs) {
        if (para === null) { lineIndex++; continue; }
        const getLineMargins = (li) => {
          const svgY = offsetY + settings.fontSize + li * settings.lineHeight;
          if (hasRag) return getRagMargins(ragPoints, svgY);
          return { left: layout.marginX, right: SVG_W - layout.marginX };
        };
        let margins = getLineMargins(lineIndex);
        let cursorX = margins.left;
        for (const word of para) {
          let svgY = offsetY + settings.fontSize + lineIndex * settings.lineHeight;
          let wordWidth = hasKern ? measureWordWithKern(kernStrokes, word, cursorX, svgY) : measure(word);
          if (cursorX > margins.left && cursorX + wordWidth > margins.right) {
            lineIndex++;
            margins = getLineMargins(lineIndex);
            cursorX = margins.left;
            svgY = offsetY + settings.fontSize + lineIndex * settings.lineHeight;
            wordWidth = hasKern ? measureWordWithKern(kernStrokes, word, cursorX, svgY) : measure(word);
          }
          result.push({ text: word, x: cursorX, y: lineIndex });
          if (hasKern) {
            let x = cursorX;
            for (const ch of word) { x += measure(ch) + kernExtraSpacingAt(kernStrokes, x, svgY); }
            cursorX = x + spaceWidth + kernExtraSpacingAt(kernStrokes, x, svgY);
          } else {
            cursorX += wordWidth + spaceWidth;
          }
        }
        lineIndex++;
      }
      return { words: result, lineCount: lineIndex };
    };

    const computeStartY = (h) => {
      const available = SVG_H - layout.marginTop - layout.marginBottom;
      if (layout.verticalAlign === "top") return layout.marginTop;
      if (layout.verticalAlign === "bottom") return Math.max(layout.marginTop, SVG_H - layout.marginBottom - h);
      return Math.max(layout.marginTop, layout.marginTop + (available - h) / 2);
    };

    const pass1 = doLayout(0);
    const h1 = pass1.lineCount * settings.lineHeight;
    const sy1 = computeStartY(h1);
    if (!hasKern && !hasRag) return { words: pass1.words, startY: sy1 };
    const pass2 = doLayout(sy1);
    return { words: pass2.words, startY: computeStartY(pass2.lineCount * settings.lineHeight) };
  };

  // --- Displacement ---
  const rippleDisplace = (ripples, px, py) => {
    if (!rippleSettings.enabled || ripples.length === 0) return { dx: 0, dy: 0 };
    let dx = 0, dy = 0;
    for (const origin of ripples) {
      const distX = px - origin.x, distY = py - origin.y;
      const dist = Math.sqrt(distX * distX + distY * distY);
      if (dist < 1) continue;
      const amplitude = rippleSettings.intensity * Math.exp(-dist * rippleSettings.decay);
      const polarity = rippleSettings.invert ? -1 : 1;
      const wave = polarity * Math.sin((dist / rippleSettings.wavelength) * Math.PI * 2);
      dx += (distX / dist) * wave * amplitude;
      dy += (distY / dist) * wave * amplitude;
    }
    return { dx, dy };
  };

  // --- Noise overlay (shared) ---
  const noiseDataUrl = useMemo(() => {
    if (!displacement.showNoise) return null;
    const res = 4;
    const w = Math.ceil(SVG_W / res), h = Math.ceil(SVG_H / res);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = (perlin2d(x * res * displacement.scale * 0.25 + displacement.seed * 10, y * res * displacement.scale * 0.25 + displacement.seed * 10) + 1) * 0.5;
      const idx = (y * w + x) * 4;
      img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = v * 255;
      img.data[idx + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }, [displacement.showNoise, displacement.scale, displacement.seed]);

  // --- Render text elements for a page ---
  const renderTextElements = (words, startY, pageState) => {
    const { ripples, kernStrokes, ragPoints } = pageState;
    const hasKern = kernSettings.enabled && kernStrokes.length > 0;
    const useLetters =
      (displacement.enabled && displacement.granularity === "letter") ||
      (rippleSettings.enabled && rippleSettings.granularity === "letter" && ripples.length > 0) ||
      hasKern;

    const lines = new Map();
    words.forEach((word, wi) => {
      const line = lines.get(word.y) ?? [];
      line.push({ word, wi });
      lines.set(word.y, line);
    });
    const elements = [];

    const textEl = (key, x, y, str) => html`<text
      key=${key}
      x=${x}
      y=${y}
      font-family=${settings.font}
      font-size=${settings.fontSize}
      font-weight=${settings.fontWeight}
      font-style="normal"
      letter-spacing=${settings.letterSpacing}
      fill="black"
    >${str}</text>`;

    for (const [lineIdx, lineWords] of lines) {
      const baseY = startY + settings.fontSize + lineIdx * settings.lineHeight;
      let kernAccum = 0;
      const margins = getRagMargins(ragPoints, baseY);
      const availableWidth = margins.right - margins.left;
      let lineWidth = 0;
      if (lineWords.length > 0) {
        const last = lineWords[lineWords.length - 1].word;
        lineWidth = last.x + measure(last.text) - margins.left;
      }
      let alignOffset = 0;
      if (layout.textAlign === "center") alignOffset = (availableWidth - lineWidth) / 2;
      else if (layout.textAlign === "right") alignOffset = availableWidth - lineWidth;

      for (const { word, wi } of lineWords) {
        const wordX = word.x + kernAccum + alignOffset;
        if (useLetters) {
          let letterX = wordX;
          for (let li = 0; li < word.text.length; li++) {
            const ch = word.text[li];
            const x = letterX;
            let dy = 0, dx = 0;
            if (displacement.enabled) {
              const n = perlin2d(x * displacement.scale * 0.25 + displacement.seed * 10, baseY * displacement.scale * 0.25 + displacement.seed * 10) * displacement.intensity;
              if (displacement.offsetX) dx += n;
              if (displacement.offsetY) dy += n;
            }
            if (rippleSettings.enabled && ripples.length > 0) {
              const r = rippleDisplace(ripples, x, baseY);
              dx += r.dx;
              dy += r.dy;
            }
            const extraKern = hasKern ? kernExtraSpacingAt(kernStrokes, x, baseY) : 0;
            if (hasKern) dy += kernOffsetYAt(kernStrokes, x, baseY);
            letterX += measure(ch) + extraKern;
            kernAccum += extraKern;
            elements.push(textEl(`${wi}-${li}`, x + dx, baseY + dy, ch));
          }
          if (hasKern) kernAccum += kernExtraSpacingAt(kernStrokes, letterX, baseY);
        } else {
          let dy = 0, dx = 0;
          if (displacement.enabled) {
            const n = perlin2d(wordX * displacement.scale * 0.25 + displacement.seed * 10, baseY * displacement.scale * 0.25 + displacement.seed * 10) * displacement.intensity;
            if (displacement.offsetX) dx += n;
            if (displacement.offsetY) dy += n;
          }
          if (rippleSettings.enabled && ripples.length > 0) {
            const r = rippleDisplace(ripples, wordX, baseY);
            dx += r.dx;
            dy += r.dy;
          }
          elements.push(textEl(wi, wordX + dx, baseY + dy, word.text));
        }
      }
    }
    return elements;
  };

  // --- SVG Interaction (operates on focused page) ---
  const draggingRipple = useRef(null);
  const draggingRag = useRef(null);
  const isPaintingKern = useRef(false);
  const lastKernX = useRef(0);

  const svgPoint = (svg, clientX, clientY) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  const handlePointerDown = (pageIdx, e) => {
    setFocusedPage(pageIdx);
    const svg = e.currentTarget;
    const p = svgPoint(svg, e.clientX, e.clientY);
    const ps = pagesToolState[pageIdx] ?? emptyPageToolState();

    if (activeTool === "ripple" && rippleSettings.enabled) {
      const hit = ps.ripples.findIndex((r) => Math.hypot(r.x - p.x, r.y - p.y) < 12);
      if (hit >= 0) { pushUndo(getSnapshot()); draggingRipple.current = { index: hit }; svg.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    }
    if (activeTool === "rag" && ragSettings.enabled) {
      const hit = ps.ragPoints.findIndex((r) => Math.hypot(r.x - p.x, r.y - p.y) < 12);
      if (hit >= 0) { pushUndo(getSnapshot()); setSelectedRagIndex(hit); draggingRag.current = { index: hit }; svg.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    }
    if (activeTool === "kern" && kernSettings.enabled) {
      pushUndo(getSnapshot());
      isPaintingKern.current = true;
      lastKernX.current = p.x;
      svg.setPointerCapture(e.pointerId);
      setKernStrokes((prev) => [...prev, { x: p.x, y: p.y, radius: kernSettings.radius, strength: 1, intensityY: kernSettings.intensityY }]);
      e.preventDefault();
    }
  };

  const handlePointerMove = (e) => {
    const svg = e.currentTarget;
    const p = svgPoint(svg, e.clientX, e.clientY);
    const pageIdx = Number(svg.dataset.pageIndex ?? 0);
    if (activeTool === "kern" && kernSettings.enabled) {
      setBrushCursor({ x: p.x, y: p.y, pageIdx });
    }
    if (draggingRipple.current) { const idx = draggingRipple.current.index; setRipples((prev) => prev.map((r, i) => (i === idx ? { x: p.x, y: p.y } : r))); return; }
    if (draggingRag.current) { const idx = draggingRag.current.index; setRagPoints((prev) => prev.map((r, i) => (i === idx ? { ...r, x: p.x, y: p.y } : r))); return; }
    if (isPaintingKern.current) {
      const dx = p.x - lastKernX.current;
      lastKernX.current = p.x;
      if (dx < 0) {
        const r = kernSettings.radius;
        setKernStrokes((prev) => prev.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) > r * 0.5));
      } else {
        setKernStrokes((prev) => {
          const last = prev[prev.length - 1];
          if (last && Math.hypot(last.x - p.x, last.y - p.y) < 4) return prev;
          return [...prev, { x: p.x, y: p.y, radius: kernSettings.radius, strength: 1, intensityY: kernSettings.intensityY }];
        });
      }
    }
  };

  const handlePointerUp = (e) => {
    if (draggingRipple.current) { e.currentTarget.releasePointerCapture(e.pointerId); draggingRipple.current = null; return; }
    if (draggingRag.current) { e.currentTarget.releasePointerCapture(e.pointerId); draggingRag.current = null; return; }
    if (isPaintingKern.current) { isPaintingKern.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }
  };

  const handleClick = (pageIdx, e) => {
    setFocusedPage(pageIdx);
    const svg = e.currentTarget;
    const p = svgPoint(svg, e.clientX, e.clientY);
    const ps = pagesToolState[pageIdx] ?? emptyPageToolState();

    if (activeTool === "ripple" && rippleSettings.enabled) {
      if (ps.ripples.some((r) => Math.hypot(r.x - p.x, r.y - p.y) < 12)) return;
      setRipplesWithUndo((prev) => [...prev, { x: p.x, y: p.y }]);
      return;
    }
    if (activeTool === "rag" && ragSettings.enabled) {
      const hitIdx = ps.ragPoints.findIndex((r) => Math.hypot(r.x - p.x, r.y - p.y) < 12);
      if (hitIdx >= 0) { setSelectedRagIndex(hitIdx); return; }
      setSelectedRagIndex(null);
      const side = p.x < SVG_W / 2 ? "left" : "right";
      setRagPointsWithUndo((prev) => { setSelectedRagIndex(prev.length); return [...prev, { x: p.x, y: p.y, side }]; });
    }
  };

  const handleSelectTool = (tool) => {
    setActiveTool(tool);
    if (tool === "ripple" && !rippleSettings.enabled) setRippleSettings((s) => ({ ...s, enabled: true }));
    if (tool === "kern" && !kernSettings.enabled) setKernSettings((s) => ({ ...s, enabled: true }));
    if (tool === "rag" && !ragSettings.enabled) setRagSettings((s) => ({ ...s, enabled: true }));
  };

  const cursor = activeTool !== "none" ? "crosshair" : undefined;

  // --- Export actions ---
  // Editor chrome (ripple points, brush circles, guides, cursors) is tagged
  // with data-overlay in renderPage; exports strip it from a clone.
  const exportClone = () => {
    const svg = document.querySelector(`[data-page-index="${focusedPage}"]`);
    if (!svg) return null;
    const clone = svg.cloneNode(true);
    clone.querySelectorAll("[data-overlay]").forEach((n) => n.remove());
    return clone;
  };

  const copySvg = () => {
    const clone = exportClone();
    if (clone) navigator.clipboard.writeText(new XMLSerializer().serializeToString(clone));
  };

  const svgToPngBlob = async () => {
    const clone = exportClone();
    if (!clone) throw new Error("no focused page");
    // Rasterization happens in an isolated <img> document that can't see the
    // page's web fonts, so embed the active font as a data URI.
    const fontFile = fontFiles[settings.font];
    if (fontFile) {
      const buf = await fetch(fontFile).then((r) => r.arrayBuffer());
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000)
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = `@font-face{font-family:"${settings.font}";src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2");font-weight:100 900;}`;
      clone.insertBefore(style, clone.firstChild);
    }
    clone.setAttribute("width", SVG_W);
    clone.setAttribute("height", SVG_H);
    const svgText = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("SVG rasterize failed"));
        img.src = url;
      });
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = SVG_W * scale;
      canvas.height = SVG_H * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png"),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const copyPng = () => {
    // Pass the promise into ClipboardItem so the write stays inside the
    // user-gesture window (Safari requirement).
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": svgToPngBlob() })])
      .catch((err) => alert(`Copy PNG failed: ${err.message}`));
  };

  const downloadPng = async () => {
    try {
      const blob = await svgToPngBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "typeset.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download PNG failed: ${err.message}`);
    }
  };

  const exportState = () => {
    navigator.clipboard.writeText(JSON.stringify({
      content, typography: settings, displacement,
      ripples: rippleSettings, kern: kernSettings, rag: ragSettings,
      pages: pagesToolState,
    }, null, 2));
  };

  const importState = () => {
    navigator.clipboard.readText().then((json) => {
      try {
        const state = JSON.parse(json);
        pushUndo(getSnapshot());
        if (state.content) setContent(state.content);
        if (state.pages) setPagesToolState(state.pages);
      } catch {
        alert("Invalid state JSON in clipboard");
      }
    });
  };

  // --- Control panel schemas (rendered by Sidebar) ---
  const panels = [
    {
      title: "Typography", state: settings, set: setSettings,
      fields: {
        fontSize: { type: "range", label: "Font Size", min: 8, max: 48, step: 1 },
        lineHeight: { type: "range", label: "Line Height", min: 12, max: 96, step: 1 },
        font: { type: "select", label: "Font", options: fonts },
        fontWeight: { type: "range", label: "Font Weight", min: 100, max: 900, step: 100 },
        letterSpacing: { type: "range", label: "Letter Spacing", min: -5, max: 6, step: 0.1 },
      },
    },
    {
      title: "Layout", state: layout, set: setLayout,
      fields: {
        marginX: { type: "range", label: "Margin X", min: 0, max: 300, step: 1 },
        marginTop: { type: "range", label: "Margin Top", min: 0, max: 400, step: 1 },
        marginBottom: { type: "range", label: "Margin Bottom", min: 0, max: 400, step: 1 },
        verticalAlign: { type: "select", label: "Vertical Align", options: ["top", "center", "bottom"] },
        textAlign: { type: "select", label: "Text Align", options: ["left", "center", "right"] },
        showGuides: { type: "checkbox", label: "Show Guides" },
      },
    },
    {
      title: "Displacement", state: displacement, set: setDisplacement, gate: "enabled",
      fields: {
        enabled: { type: "checkbox", label: "Enable" },
        offsetX: { type: "checkbox", label: "Offset X" },
        offsetY: { type: "checkbox", label: "Offset Y" },
        granularity: { type: "select", label: "Granularity", options: ["word", "letter"] },
        intensity: { type: "range", label: "Intensity", min: 0, max: 60, step: 1 },
        scale: { type: "range", label: "Scale", min: 0.001, max: 0.2, step: 0.001 },
        seed: { type: "range", label: "Seed Offset", min: 0, max: 100, step: 1 },
        showNoise: { type: "checkbox", label: "Show Noise" },
      },
    },
    {
      title: "Ripples", state: rippleSettings, set: setRippleSettings, gate: "enabled",
      fields: {
        enabled: { type: "checkbox", label: "Enable" },
        granularity: { type: "select", label: "Granularity", options: ["word", "letter"] },
        intensity: { type: "range", label: "Intensity", min: 0, max: 100, step: 1 },
        wavelength: { type: "range", label: "Wavelength", min: 10, max: 600, step: 5 },
        decay: { type: "range", label: "Decay", min: 0.0005, max: 0.02, step: 0.0005 },
        invert: { type: "checkbox", label: "Invert" },
        showPoints: { type: "checkbox", label: "Show Points" },
      },
      actions: [{ label: "Clear Ripples", onClick: () => setRipplesWithUndo(() => []) }],
    },
    {
      title: "Kern Brush", state: kernSettings, set: setKernSettings, gate: "enabled",
      fields: {
        enabled: { type: "checkbox", label: "Enable" },
        showBrush: { type: "checkbox", label: "Show Brush" },
        intensity: { type: "range", label: "Intensity X", min: 0, max: 40, step: 0.5 },
        intensityY: { type: "range", label: "Intensity Y", min: -40, max: 40, step: 0.5 },
        radius: { type: "range", label: "Radius", min: 10, max: 200, step: 5 },
      },
      actions: [{ label: "Clear Strokes", onClick: () => setKernStrokesWithUndo(() => []) }],
    },
    {
      title: "Rag", state: ragSettings, set: setRagSettings, gate: "enabled",
      fields: {
        enabled: { type: "checkbox", label: "Enable" },
        showGuides: { type: "checkbox", label: "Show Guides" },
      },
      actions: [{ label: "Clear Points", onClick: () => setRagPointsWithUndo(() => []) }],
    },
    {
      title: "Export", state: {}, set: () => {}, fields: {},
      actions: [
        { label: "Copy SVG", onClick: copySvg },
        { label: "Copy PNG", onClick: copyPng },
        { label: "Download PNG", onClick: downloadPng },
        { label: "Export State", onClick: exportState },
        { label: "Import State", onClick: importState },
      ],
    },
  ];

  // --- Render each page ---
  const renderPage = (pageIdx) => {
    const text = pageTexts[pageIdx] ?? "";
    const ps = pagesToolState[pageIdx] ?? emptyPageToolState();
    const { words, startY } = doPageLayout(text, ps);
    const isFocused = pageIdx === focusedPage;

    const ragGuidePath = (() => {
      if (!ragSettings.enabled || !ragSettings.showGuides || ps.ragPoints.length === 0) return null;
      const toPath = (pts) => {
        if (pts.length === 0) return null;
        if (pts.length === 1) return `M${pts[0].x},0 L${pts[0].x},${SVG_H}`;
        let d = `M${pts[0].x},0 L${pts[0].x},${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x},${pts[i].y}`;
        d += ` L${pts[pts.length - 1].x},${SVG_H}`;
        return d;
      };
      const leftPts = ps.ragPoints.filter((p) => p.side === "left").sort((a, b) => a.y - b.y);
      const rightPts = ps.ragPoints.filter((p) => p.side === "right").sort((a, b) => a.y - b.y);
      return { left: toPath(leftPts), right: toPath(rightPts) };
    })();

    return html`<div key=${pageIdx} class="page" onClick=${() => setFocusedPage(pageIdx)}>
      <svg
        data-page-index=${pageIdx}
        viewBox=${`0 0 ${SVG_W} ${SVG_H}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        onClick=${(e) => handleClick(pageIdx, e)}
        onPointerDown=${(e) => handlePointerDown(pageIdx, e)}
        onPointerMove=${handlePointerMove}
        onPointerUp=${handlePointerUp}
        onPointerLeave=${() => setBrushCursor(null)}
        style=${{
          aspectRatio: `${SVG_W}/${SVG_H}`,
          maxHeight: "calc(100vh - 120px)",
          cursor: activeTool === "kern" ? "none" : cursor,
          userSelect: "none",
        }}
      >
        <rect width=${SVG_W} height=${SVG_H} fill="white" />
        ${layout.showGuides && html`<g data-overlay pointer-events="none">
          <line x1=${layout.marginX} y1="0" x2=${layout.marginX} y2=${SVG_H} stroke="#ccc" stroke-width="0.5" stroke-dasharray="4 3" />
          <line x1=${SVG_W - layout.marginX} y1="0" x2=${SVG_W - layout.marginX} y2=${SVG_H} stroke="#ccc" stroke-width="0.5" stroke-dasharray="4 3" />
          <line x1="0" y1=${layout.marginTop} x2=${SVG_W} y2=${layout.marginTop} stroke="#ccc" stroke-width="0.5" stroke-dasharray="4 3" />
          <line x1="0" y1=${SVG_H - layout.marginBottom} x2=${SVG_W} y2=${SVG_H - layout.marginBottom} stroke="#ccc" stroke-width="0.5" stroke-dasharray="4 3" />
        </g>`}
        ${noiseDataUrl && html`<image data-overlay href=${noiseDataUrl} x="0" y="0" width=${SVG_W} height=${SVG_H} opacity="0.25" style=${{ imageRendering: "pixelated" }} />`}
        ${renderTextElements(words, startY, ps)}
        ${rippleSettings.enabled && rippleSettings.showPoints && ps.ripples.map((r, i) => html`<circle data-overlay key=${`ripple-${i}`} cx=${r.x} cy=${r.y} r="6" fill="#E74C3C" style=${{ cursor: "grab" }} />`)}
        ${kernSettings.enabled && kernSettings.showBrush && ps.kernStrokes.map((s, i) => html`<circle data-overlay key=${`kern-${i}`} cx=${s.x} cy=${s.y} r=${s.radius} fill="rgba(100, 140, 255, 0.04)" stroke="none" pointer-events="none" />`)}
        ${ragGuidePath?.left && html`<path data-overlay d=${ragGuidePath.left} stroke="#E74C3C" stroke-width="1" stroke-dasharray="4 3" fill="none" opacity="0.5" pointer-events="none" />`}
        ${ragGuidePath?.right && html`<path data-overlay d=${ragGuidePath.right} stroke="#E74C3C" stroke-width="1" stroke-dasharray="4 3" fill="none" opacity="0.5" pointer-events="none" />`}
        ${isFocused && ragSettings.enabled && ragSettings.showGuides && activeTool === "rag" && ps.ragPoints.map((r, i) => html`<g data-overlay key=${`rag-${i}`}>
          ${selectedRagIndex === i && html`<rect x=${r.x - 7} y=${r.y - 7} width="14" height="14" fill="none" stroke="#E74C3C" stroke-width="1" rx="1" pointer-events="none" />`}
          <rect
            x=${r.x - 4} y=${r.y - 4} width="8" height="8"
            fill=${selectedRagIndex === i ? "#fff" : "#E74C3C"}
            stroke=${selectedRagIndex === i ? "#E74C3C" : "none"}
            stroke-width="1.5"
            style=${{ cursor: "grab" }}
            onPointerDown=${() => setSelectedRagIndex(i)}
          />
        </g>`)}
        ${activeTool === "kern" && brushCursor && brushCursor.pageIdx === pageIdx && html`<circle
          data-overlay
          cx=${brushCursor.x}
          cy=${brushCursor.y}
          r=${kernSettings.radius}
          fill="none"
          stroke="black"
          stroke-width="1"
          opacity="0.15"
          pointer-events="none"
        />`}
      </svg>
    </div>`;
  };

  return html`<div class="app">
    <div class="main">
      <${Toolbar}
        activeTool=${activeTool}
        onSelectTool=${handleSelectTool}
        canUndo=${canUndo}
        canRedo=${canRedo}
        onUndo=${undo}
        onRedo=${redo}
      />
      <div class="pages">
        <div class="page-stack">${pageTexts.map((_, i) => renderPage(i))}</div>
      </div>
    </div>
    <${Sidebar}
      content=${content}
      onContentChange=${setContentWithUndo}
      panels=${panels}
    />
  </div>`;
}
