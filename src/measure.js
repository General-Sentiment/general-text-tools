import { useState, useEffect } from "preact/hooks";

const ctx = document.createElement("canvas").getContext("2d");

// Generic keywords (serif, system-ui) must stay unquoted — quoting makes
// CSS treat them as literal family names.
const cssFamily = (font) => (font.includes(" ") ? `"${font}"` : font);

export function measureText(text, font, fontSize, fontWeight, letterSpacing) {
  if (!ctx) return 0;
  ctx.font = `${fontWeight} ${fontSize}px ${cssFamily(font)}`;
  ctx.letterSpacing = `${letterSpacing}px`;
  return ctx.measureText(text).width;
}

// Canvas measurement only sees web fonts that are already loaded, so
// preload every family in the picker before the first layout pass.
export function useFontsReady(fonts) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      fonts.map((f) => document.fonts.load(`300 16px ${cssFamily(f)}`).catch(() => {})),
    ).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}
