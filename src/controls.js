import { html } from "htm/preact";

export function Section({ title, children }) {
  return html`<details class="section" open>
    <summary>${title}</summary>
    <div class="section-body">${children}</div>
  </details>`;
}

export function Slider({ label, value, min, max, step, onChange }) {
  const parse = (e) => {
    const v = parseFloat(e.currentTarget.value);
    if (!Number.isNaN(v)) onChange(v);
  };
  return html`<label class="control">
    <span class="control-label" title=${label}>${label}</span>
    <input type="range" min=${min} max=${max} step=${step} value=${value} onInput=${parse} />
    <input class="num" type="number" min=${min} max=${max} step=${step} value=${value} onInput=${parse} />
  </label>`;
}

export function Select({ label, value, options, onChange }) {
  return html`<label class="control">
    <span class="control-label" title=${label}>${label}</span>
    <select value=${value} onChange=${(e) => onChange(e.currentTarget.value)}>
      ${options.map((opt) => html`<option key=${opt} value=${opt}>${opt}</option>`)}
    </select>
  </label>`;
}

export function Checkbox({ label, value, onChange }) {
  return html`<label class="control">
    <span class="control-label" title=${label}>${label}</span>
    <input type="checkbox" checked=${value} onChange=${(e) => onChange(e.currentTarget.checked)} />
  </label>`;
}

// Schema-driven panel — the no-build replacement for a leva folder.
// fields: { key: { type: "range"|"select"|"checkbox", label, ...typeProps } }
// actions: [{ label, onClick }]
// gate: field key that must be truthy for the other fields/actions to show
export function Panel({ title, state, set, fields, actions, gate }) {
  const setField = (key) => (v) => set((s) => ({ ...s, [key]: v }));
  const gated = gate && !state[gate];
  return html`<${Section} title=${title}>
    ${Object.entries(fields ?? {}).map(([key, f]) => {
      if (gated && key !== gate) return null;
      const props = { key, label: f.label ?? key, value: state[key], onChange: setField(key) };
      if (f.type === "range")
        return html`<${Slider} ...${props} min=${f.min} max=${f.max} step=${f.step} />`;
      if (f.type === "select") return html`<${Select} ...${props} options=${f.options} />`;
      if (f.type === "checkbox") return html`<${Checkbox} ...${props} />`;
      return null;
    })}
    ${(gated ? [] : actions ?? []).map(
      (a) => html`<button key=${a.label} class="action-btn" onClick=${a.onClick}>${a.label}</button>`,
    )}
  <//>`;
}
