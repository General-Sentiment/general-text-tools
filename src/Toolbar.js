import { html } from "htm/preact";

const TOOLS = [
  { tool: "ripple", label: "Ripple" },
  { tool: "kern", label: "Kern Brush" },
  { tool: "rag", label: "Rag" },
];

export function Toolbar({ activeTool, onSelectTool, canUndo, canRedo, onUndo, onRedo }) {
  return html`<div class="toolbar">
    ${TOOLS.map(
      ({ tool, label }) => html`<button
        key=${tool}
        class=${activeTool === tool ? "active" : ""}
        onClick=${() => onSelectTool(activeTool === tool ? "none" : tool)}
      >
        ${label}
      </button>`,
    )}
    <div class="spacer"></div>
    <button class="ghost" disabled=${!canUndo} title="Undo (⌘Z)" onClick=${onUndo}>Undo</button>
    <button class="ghost" disabled=${!canRedo} title="Redo (⌘⇧Z)" onClick=${onRedo}>Redo</button>
  </div>`;
}
