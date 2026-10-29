/* Ritmo — gráficos SVG sin dependencias
   Barras y líneas de una sola serie (cada gráfico mide una cosa: sin
   doble eje), con rejilla discreta, línea de objetivo opcional y
   tooltip al pasar el dedo o el ratón. Los colores salen de tokens CSS. */

const NS = "http://www.w3.org/2000/svg";
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

function svgEl(tag, attrs = {}, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}

/** Máximo "redondo" y paso para 3-4 líneas de rejilla. */
function niceScale(min, max, ticks = 3) {
  if (max === min) { max += 1; min = Math.max(0, min - 1); }
  const raw = (max - min) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
}

function frame(width, height, ariaLabel) {
  const wrap = document.createElement("div");
  wrap.className = "chart";
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", role: "img", "aria-label": ariaLabel });
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  wrap.append(svg, tip);
  return { wrap, svg, tip };
}

function showTip(wrap, tip, svg, x, y, text) {
  tip.textContent = text;
  tip.hidden = false;
  const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width || 1;
  const left = Math.min(Math.max(x * scale, tip.offsetWidth / 2), wrap.clientWidth - tip.offsetWidth / 2);
  tip.style.left = `${left}px`;
  tip.style.top = `${y * scale}px`;
}

function grid(svg, scale, y, width, fmt) {
  const g = svgEl("g", { class: "chart-grid" });
  for (let v = scale.min; v <= scale.max + 1e-9; v += scale.step) {
    const yy = y(v);
    g.append(svgEl("line", { x1: PAD.left, x2: width - PAD.right, y1: yy, y2: yy }));
    g.append(svgEl("text", { x: PAD.left - 6, y: yy + 4, "text-anchor": "end" }, fmt(v)));
  }
  svg.append(g);
}

function goalLine(svg, y, width, goal, label) {
  const yy = y(goal);
  svg.append(svgEl("line", { class: "chart-goal", x1: PAD.left, x2: width - PAD.right, y1: yy, y2: yy }));
  svg.append(svgEl("text", { class: "chart-goal-label", x: width - PAD.right, y: yy - 4, "text-anchor": "end" }, label));
}

/** Barras verticales. data: [{ label, value, tip }] */
export function barChart({ data, color, width, height = 168, goal, goalLabel, fmt = String, ariaLabel }) {
  const { wrap, svg, tip } = frame(width, height, ariaLabel);
  const max = Math.max(goal || 0, ...data.map((d) => d.value));
  const scale = niceScale(0, max || 1);
  const innerH = height - PAD.top - PAD.bottom;
  const y = (v) => PAD.top + innerH * (1 - (v - scale.min) / (scale.max - scale.min));
  grid(svg, scale, y, width, fmt);

  const innerW = width - PAD.left - PAD.right;
  const slot = innerW / data.length;
  const gap = Math.max(2, slot * 0.28);
  const bw = Math.max(2, slot - gap);
  const every = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 44)));   // etiquetas que caben

  data.forEach((d, i) => {
    const x = PAD.left + i * slot + gap / 2;
    const top = y(d.value), base = y(0), r = Math.min(4, bw / 2, base - top);
    if (d.value > 0) {
      // extremo de datos redondeado, anclado a la línea base
      svg.append(svgEl("path", {
        class: "chart-bar", fill: color,
        d: `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${base}Z`,
      }));
    }
    if (i % every === 0 || i === data.length - 1) {
      svg.append(svgEl("text", { class: "chart-x", x: x + bw / 2, y: height - 6, "text-anchor": "middle" }, d.label));
    }
    const hit = svgEl("rect", { class: "chart-hit", x: PAD.left + i * slot, y: PAD.top, width: slot, height: innerH });
    const on = () => showTip(wrap, tip, svg, x + bw / 2, Math.min(top, base - 2), d.tip);
    hit.addEventListener("pointerenter", on);
    hit.addEventListener("pointerdown", on);
    svg.append(hit);
  });

  if (goal) goalLine(svg, y, width, goal, goalLabel);
  svg.addEventListener("pointerleave", () => { tip.hidden = true; });
  return wrap;
}

/** Línea temporal. data: [{ t (ms), v, tip }] ordenada por t; domain: [t0, t1] */
export function lineChart({ data, color, width, height = 176, domain, goal, goalLabel, fmt = String, xFmt, ariaLabel }) {
  const { wrap, svg, tip } = frame(width, height, ariaLabel);
  const vals = data.map((d) => d.v).concat(goal ? [goal] : []);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.15, 0.5);
  const scale = niceScale(lo - pad, hi + pad);
  const innerH = height - PAD.top - PAD.bottom;
  const innerW = width - PAD.left - PAD.right;
  const [t0, t1] = domain[1] > domain[0] ? domain : [domain[0] - 864e5, domain[0] + 864e5];
  const x = (t) => PAD.left + innerW * ((t - t0) / (t1 - t0));
  const y = (v) => PAD.top + innerH * (1 - (v - scale.min) / (scale.max - scale.min));
  grid(svg, scale, y, width, fmt);
  if (goal) goalLine(svg, y, width, goal, goalLabel);

  // fechas del eje: inicio, mitad y fin
  [t0, (t0 + t1) / 2, t1].forEach((t, i) => {
    svg.append(svgEl("text", { class: "chart-x", x: x(t), y: height - 6, "text-anchor": ["start", "middle", "end"][i] }, xFmt(t)));
  });

  const pts = data.map((d) => [x(d.t), y(d.v)]);
  if (pts.length > 1) {
    const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
    svg.append(svgEl("path", { class: "chart-area", fill: color, d: `${line}L${pts.at(-1)[0]},${y(scale.min)}L${pts[0][0]},${y(scale.min)}Z` }));
    svg.append(svgEl("path", { class: "chart-line", stroke: color, d: line }));
  }
  // último valor destacado
  const [lx, ly] = pts.at(-1);
  svg.append(svgEl("circle", { class: "chart-end", cx: lx, cy: ly, r: 4.5, fill: color }));

  const cross = svgEl("line", { class: "chart-cross", y1: PAD.top, y2: PAD.top + innerH, visibility: "hidden" });
  const dot = svgEl("circle", { class: "chart-end", r: 4.5, fill: color, visibility: "hidden" });
  const hit = svgEl("rect", { class: "chart-hit", x: PAD.left, y: PAD.top, width: innerW, height: innerH });
  svg.append(cross, dot, hit);

  const move = (e) => {
    const box = svg.getBoundingClientRect();
    const sx = (e.clientX - box.left) * (width / box.width);
    let best = 0;
    pts.forEach(([px], i) => { if (Math.abs(px - sx) < Math.abs(pts[best][0] - sx)) best = i; });
    const [px, py] = pts[best];
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", px); dot.setAttribute("cy", py); dot.setAttribute("visibility", "visible");
    showTip(wrap, tip, svg, px, py, data[best].tip);
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", () => {
    tip.hidden = true;
    cross.setAttribute("visibility", "hidden");
    dot.setAttribute("visibility", "hidden");
  });
  return wrap;
}
