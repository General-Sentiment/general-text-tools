import { html } from "htm/preact";
import { Panel } from "./controls.js";

export function Sidebar({ content, onContentChange, presets, panels }) {
  return html`<div class="sidebar">
    <div class="sidebar-head">
      <div class="row">
        <span class="title">Text Input</span>
        <select
          value=""
          onChange=${(e) => {
            const preset = presets[e.currentTarget.value];
            if (preset) onContentChange(preset);
            e.currentTarget.value = "";
          }}
        >
          <option value="" disabled>Presets</option>
          ${Object.keys(presets).map((name) => html`<option key=${name} value=${name}>${name}</option>`)}
        </select>
      </div>
      <textarea
        value=${content}
        onInput=${(e) => onContentChange(e.currentTarget.value)}
        placeholder="Type or paste text..."
      ></textarea>
    </div>
    <div class="panels">
      ${panels.map((p) => html`<${Panel} key=${p.title} ...${p} />`)}
    </div>
  </div>`;
}
