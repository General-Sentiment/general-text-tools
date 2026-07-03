import { render } from "preact";
import { html } from "htm/preact";
import { TypesetEditor } from "./TypesetEditor.js";

const FONTS = ["Arial", "system-ui", "Georgia", "serif"];

// Self-hosted font files, embedded into the SVG when rasterizing to PNG —
// SVG-in-<img> can't see document web fonts. System fonts need no entry.
// e.g. "ABC Gramercy Variable Unlicensed Trial": "./fonts/ABCGramercyVariable-Trial.woff2"
const FONT_FILES = {};

const PRESETS = {
  Short: "Who is my greatest teacher?\n\nMyself 30 years from now.",
  "Glass-Over": `What is the goal? To calm one’s system so profoundly that we can see into our depths. Not to settle for the visibility of our normal choppy waters, or even for the ripples that we can relax into after weeks in the cave…but for that magical glass-over that happens on the ocean from time to time, when winds still for long enough for the surface to release all tension, smooth out, the water becoming like a sheet of glass, and what once had been obscured by turbulence not only becomes visible but is amplified in its radical clarity…\n\nThe scales on fish 20 feet deep seem magnified\n\nThe visibility is so profound\nthat it almost feels distorted in its intensity\nIt is strangely difficult to read\nwhat is 2 feet deep and 5 feet deep and 25 feet deep\nbecause what was in the way is gone`,
};

render(
  html`<${TypesetEditor} fonts=${FONTS} defaultFont=${FONTS[0]} presets=${PRESETS} fontFiles=${FONT_FILES} />`,
  document.getElementById("app"),
);
