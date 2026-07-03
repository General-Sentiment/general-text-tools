import { html } from "htm/preact";
import { Panel } from "./controls.js";

export function Sidebar({ content, onContentChange, panels }) {
  return html`<div class="sidebar">
    <div class="sidebar-head">
      <div class="row">
        <span class="title">Text Input</span>
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
