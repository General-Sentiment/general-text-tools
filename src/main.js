import { render } from "preact";
import { html } from "htm/preact";
import { TypesetEditor } from "./TypesetEditor.js";

const FONTS = ["sans-serif", "Arial", "serif", "Times New Roman"];

// Self-hosted font files, embedded into the SVG when rasterizing to PNG —
// SVG-in-<img> can't see document web fonts. System fonts need no entry.
// e.g. "My Web Font": "./fonts/MyWebFont.woff2"
const FONT_FILES = {};

const DEFAULT_TEXT = `If, as they say, poetry is a sign of something
among people, then let this be prearranged now,
between us, while we are still peoples: that
at the end of time, which is also the end of poetry
(and wheat and evil and insects and love),
when the entire human race gathers in the flesh,
reconstituted down to the infant’s tiniest fold
and littlest nail, I will be standing at the edge
of that fathomless crowd with an orange for you,
reconstituted down to its innermost seed protected
by white thread, in case you are thirsty, which
does not at this time seem like such a wild guess,
and though there will be no poetry between us then,
at the end of time, the geese all gone with the seas,
I hope you will take it, and remember on earth
I did not know how to touch it it was all so raw,
and if by chance there is no edge to the crowd
or anything else so that I am of it,
I will take the orange and toss it as high as I can.`;

render(
  html`<${TypesetEditor} fonts=${FONTS} defaultFont="Times New Roman" defaultText=${DEFAULT_TEXT} fontFiles=${FONT_FILES} />`,
  document.getElementById("app"),
);
