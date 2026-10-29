/* FlorLovesRunning — app principal
   Vistas: Hoy · Correr · Comidas · Recetas · Sueño (+ Ajustes).
   Todo el contenido del usuario se inserta como texto (nunca HTML). */

import { sb, db, account, loadAll, upsert, remove, setGoals, setHeight, exportJSON, importJSON, wipe, uid, flush, onWriteError } from "./store.js";
import { barChart, lineChart } from "./charts.js";

/* ============ utilidades ============ */

// Solo para iconos constantes del propio código: nunca datos del usuario.
const ICON = {
  today: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  runs: '<circle cx="13.5" cy="4.5" r="1.8"/><path d="M7 21l3.5-6 3 2.5V22M6.5 11.5 9 8l4 1 2.5 3.5H19M13 9l-2.5 6"/>',
  meals: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M5 3v8M17 21V3c-2 1.5-3 4-3 7v4h3"/>',
  recipes: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
  sleep: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  body: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 9.5a5 5 0 0 1 8 0M12 12l1.6-2.6"/>',
  summary: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  strava: '<path d="M10 3 4 15h4l2-4 2 4h4L10 3Z"/><path d="m15 15-2 4h3l1.5-3 1.5 3h3l-4-8"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
  google: '<path d="M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5Z"/><path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.5c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21Z"/><path d="M7 13.7a5.4 5.4 0 0 1 0-3.4V8H4a9 9 0 0 0 0 8l3-2.3Z"/><path d="M12 6.6c1.3 0 2.5.5 3.4 1.3L18 5.4A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7Z"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    // vía CSSOM: la CSP bloquea los atributos style escritos con setAttribute
    else if (k === "style") el.style.cssText = v;
    else if (k === "icon") el.insertAdjacentHTML("afterbegin", icon(v));
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : String(kid));
  }
  return el;
}

const nf1 = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });
const fmt1 = (n) => nf1.format(n || 0);
const fmt0 = (n) => nf0.format(n || 0);
const round1 = (n) => Math.round((n || 0) * 10) / 10;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const todayISO = () => iso(new Date());
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return iso(d); };
const weekStart = (s) => { const d = parseDate(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };

function dayLabel(s) {
  const t = todayISO();
  if (s === t) return "Hoy";
  if (s === addDays(t, -1)) return "Ayer";
  return parseDate(s).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" });
}
const shortDate = (s) => parseDate(s).toLocaleDateString("es", { day: "numeric", month: "short" });

function fmtDur(sec) {
  sec = Math.round(sec);
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}
const fmtPace = (sec, km) => (km > 0 && sec > 0 ? `${fmtDur(sec / km)} /km` : "—");
const fmtHours = (hrs) => { const m = Math.round(hrs * 60); return `${Math.floor(m / 60)} h ${pad(m % 60)} min`; };

const kcalFromMacros = (p, c, f) => Math.round(p * 4 + c * 4 + f * 9);
const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
const byDateDesc = (a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""));

/* ============ toast + hoja inferior ============ */

const toastEl = document.getElementById("toast");
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

const sheet = document.getElementById("sheet");
const sheetTitle = document.getElementById("sheetTitle");
const sheetBody = document.getElementById("sheetBody");
document.getElementById("sheetClose").insertAdjacentHTML("afterbegin", icon("close"));
document.getElementById("sheetClose").addEventListener("click", () => closeSheet());
sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
sheet.addEventListener("close", () => sheetBody.replaceChildren());

function openSheet(title, content) {
  sheetTitle.textContent = title;
  sheetBody.replaceChildren(content);
  sheet.showModal();
  sheetBody.scrollTop = 0;
}
function closeSheet() { if (sheet.open) sheet.close(); }

/* ============ piezas de formulario ============ */

function field(label, input, hint) {
  const idv = input.id || (input.id = "f" + uid().slice(0, 8));
  return h("div", { class: "field" }, h("label", { for: idv }, label), input, hint && h("span", { class: "hint" }, hint));
}

const numInput = (name, value, opts = {}) => h("input", {
  name, type: "text", inputmode: opts.int ? "numeric" : "decimal", autocomplete: "off",
  value: value || value === 0 ? String(value).replace(".", ",") : "", placeholder: opts.placeholder || "0",
  "aria-label": opts.label,
});

// Acepta "5,2" o "5.2"
const readNum = (input) => {
  const n = parseFloat(String(input.value).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function segmented(name, options, value, label) {
  return h("div", { class: "seg", role: "radiogroup", "aria-label": label },
    options.map(([val, text]) => h("label", {},
      h("input", { type: "radio", name, value: val, checked: val === value }),
      h("span", {}, text),
    )),
  );
}

/* ============ IA: estimación de macros ============ */

async function authHeader() {
  const { data } = await sb.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body || {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* respuesta no JSON */ }
  if (!res.ok) throw new Error(data?.error || "No se pudo conectar. Revisa tu conexión.");
  return data;
}

async function estimateMacros(text, servings) {
  const res = await fetch("/api/macros", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ text, servings }),
  });
  let data = null;
  try { data = await res.json(); } catch { /* respuesta no JSON */ }
  if (!res.ok) throw new Error(data?.error || "No se pudo conectar con la IA. Revisa tu conexión.");
  return data;
}

/** Caja "Calcular con IA": textarea + botón + tabla de resultados.
    onResult recibe { items, total, notes }. */
function aiBox({ label, placeholder, text = "", items = [], getServings, onResult, hint }) {
  const ta = h("textarea", { placeholder, rows: 4 });
  ta.value = text;
  const out = h("div", { class: "ai-result" });
  const btn = h("button", { type: "button", class: "btn ai block", icon: "spark" }, "Calcular macros con IA");

  const render = (data) => {
    out.replaceChildren();
    if (!data?.items?.length) return;
    out.append(
      h("table", {},
        h("thead", {}, h("tr", {},
          h("th", {}, "Ingrediente"), h("th", { class: "n" }, "kcal"),
          h("th", { class: "n" }, "P"), h("th", { class: "n" }, "C"), h("th", { class: "n" }, "G"))),
        h("tbody", {}, data.items.map((i) => h("tr", {},
          h("td", {}, i.name, i.quantity && h("div", { class: "hint" }, i.quantity)),
          h("td", { class: "n" }, fmt0(i.kcal)), h("td", { class: "n" }, fmt1(i.p)),
          h("td", { class: "n" }, fmt1(i.c)), h("td", { class: "n" }, fmt1(i.f))))),
        h("tfoot", {}, h("tr", {},
          h("td", {}, "Total"), h("td", { class: "n" }, fmt0(sum(data.items, "kcal"))),
          h("td", { class: "n" }, fmt1(sum(data.items, "p"))), h("td", { class: "n" }, fmt1(sum(data.items, "c"))),
          h("td", { class: "n" }, fmt1(sum(data.items, "f"))))),
      ),
      data.notes && h("p", { class: "ai-note" }, data.notes),
    );
  };

  btn.addEventListener("click", async () => {
    const q = ta.value.trim();
    if (!q) { ta.focus(); toast("Describe primero los alimentos o ingredientes"); return; }
    btn.disabled = true;
    btn.lastChild.textContent = "Calculando…";
    out.replaceChildren();
    try {
      const data = await estimateMacros(q, getServings?.());
      render(data);
      onResult({ ...data, text: q });
    } catch (err) {
      out.replaceChildren(h("p", { class: "error", role: "alert" }, err.message));
    } finally {
      btn.disabled = false;
      btn.lastChild.textContent = "Calcular macros con IA";
    }
  });

  render({ items });
  return h("div", { class: "ai-box" },
    field(label, ta, hint),
    btn, out,
  );
}

/** Bloque de 4 campos kcal/P/C/G. Las kcal se autocalculan desde los macros
    mientras el usuario no las escriba a mano. */
function macroFields(values = {}) {
  const kcal = numInput("kcal", values.kcal ? Math.round(values.kcal) : "", { int: true });
  const p = numInput("p", values.p ? round1(values.p) : "");
  const c = numInput("c", values.c ? round1(values.c) : "");
  const f = numInput("f", values.f ? round1(values.f) : "");
  let kcalTouched = Boolean(values.kcal);
  kcal.addEventListener("input", () => { kcalTouched = kcal.value.trim() !== ""; });
  const auto = () => { if (!kcalTouched) kcal.value = kcalFromMacros(readNum(p), readNum(c), readNum(f)) || ""; };
  [p, c, f].forEach((i) => i.addEventListener("input", auto));

  const el = h("div", {},
    h("div", { class: "row" },
      field("Proteína (g)", p), field("Carbos (g)", c), field("Grasas (g)", f)),
    field("Calorías (kcal)", kcal, "Se calculan solas a partir de los macros (4/4/9 kcal por gramo) si no las escribes."),
  );
  return {
    el,
    read: () => ({ kcal: readNum(kcal), p: readNum(p), c: readNum(c), f: readNum(f) }),
    set: (v) => {
      p.value = v.p ? String(round1(v.p)).replace(".", ",") : "";
      c.value = v.c ? String(round1(v.c)).replace(".", ",") : "";
      f.value = v.f ? String(round1(v.f)).replace(".", ",") : "";
      kcal.value = v.kcal ? Math.round(v.kcal) : "";
      kcalTouched = Boolean(v.kcal);
      if (!kcalTouched) auto();
    },
  };
}

/** Botón destructivo en dos toques: el primero pide confirmación en el
    propio botón (sin diálogos del navegador), el segundo ejecuta. */
function confirmButton(label, confirmLabel, onConfirm, cls = "btn danger") {
  let armed = false, timer;
  const btn = h("button", { type: "button", class: cls }, label);
  btn.addEventListener("click", () => {
    if (armed) { clearTimeout(timer); onConfirm(); return; }
    armed = true;
    btn.textContent = confirmLabel;
    btn.classList.add("armed");
    timer = setTimeout(() => { armed = false; btn.textContent = label; btn.classList.remove("armed"); }, 4000);
  });
  return btn;
}

function formActions(onDelete, saveLabel = "Guardar") {
  return h("div", { class: "actions" },
    onDelete && confirmButton("Eliminar", "¿Seguro? Toca otra vez", onDelete),
    h("button", { type: "submit", class: "btn primary" }, saveLabel),
  );
}

function sheetForm(onSubmit, ...kids) {
  const form = h("form", { novalidate: true }, kids);
  form.addEventListener("submit", (e) => { e.preventDefault(); onSubmit(form); });
  return form;
}

const checked = (form, name) => form.querySelector(`input[name="${name}"]:checked`)?.value;

/* ============ formularios ============ */

const RUN_TYPES = [["suave", "Suave"], ["tempo", "Tempo"], ["series", "Series"], ["largo", "Largo"], ["carrera", "Carrera"]];

function runForm(rec) {
  const r = rec || { date: todayISO(), km: "", sec: 0, type: "suave", notes: "" };
  const date = h("input", { type: "date", name: "date", value: r.date, max: todayISO(), required: true });
  const km = numInput("km", r.km, { placeholder: "5,0" });
  const hh = numInput("hh", r.sec ? Math.floor(r.sec / 3600) : "", { int: true, label: "Horas" });
  const mm = numInput("mm", r.sec ? Math.floor((r.sec % 3600) / 60) : "", { int: true, label: "Minutos" });
  const ss = numInput("ss", r.sec ? Math.round(r.sec % 60) : "", { int: true, label: "Segundos" });
  const notes = h("textarea", { name: "notes", rows: 2, placeholder: "Sensaciones, ruta, zapatillas…" });
  notes.value = r.notes || "";

  const pace = h("b", { class: "num" }, "—");
  const speed = h("span", { class: "num" }, "");
  const secs = () => readNum(hh) * 3600 + readNum(mm) * 60 + readNum(ss);
  const update = () => {
    const d = readNum(km), s = secs();
    pace.textContent = fmtPace(s, d);
    speed.textContent = d && s ? `${fmt1(d / (s / 3600))} km/h` : "";
  };
  [km, hh, mm, ss].forEach((i) => i.addEventListener("input", update));
  update();

  const form = sheetForm((f) => {
    const d = readNum(km), s = secs();
    km.setAttribute("aria-invalid", d > 0 ? "false" : "true");
    if (!d) { km.focus(); toast("Indica los kilómetros"); return; }
    upsert("runs", { id: r.id || uid(), date: date.value || todayISO(), km: d, sec: s, type: checked(f, "type"), notes: notes.value.trim() });
    closeSheet(); toast(rec ? "Carrera actualizada" : "Carrera guardada"); render();
  },
    field("Fecha", date),
    field("Distancia (km)", km),
    h("div", { class: "field" },
      h("span", { class: "label" }, "Tiempo (h : min : s)"),
      h("div", { class: "row" }, hh, mm, ss)),
    h("div", { class: "live", "aria-live": "polite" }, h("span", {}, "Ritmo medio ", pace), speed),
    h("div", { class: "field" }, h("span", { class: "label" }, "Tipo"), segmented("type", RUN_TYPES, r.type, "Tipo de carrera")),
    field("Notas", notes),
    formActions(rec && (() => { remove("runs", r.id); closeSheet(); toast("Carrera eliminada"); render(); })),
  );
  openSheet(rec ? "Editar carrera" : "Nueva carrera", form);
}

const SLOTS = [["desayuno", "Desayuno"], ["comida", "Comida"], ["merienda", "Merienda"], ["cena", "Cena"], ["snack", "Snack"]];
function guessSlot() {
  const hr = new Date().getHours();
  return hr < 11 ? "desayuno" : hr < 16 ? "comida" : hr < 19 ? "merienda" : hr < 23 ? "cena" : "snack";
}

function mealForm(rec, preset = {}) {
  const m = rec || { date: preset.date || todayISO(), time: nowTime(), slot: guessSlot(), name: "", recipeId: preset.recipeId || "", servings: 1, items: [], desc: "" };
  const name = h("input", { type: "text", name: "name", value: m.name, placeholder: "Ej. Avena con plátano", autocomplete: "off" });
  const date = h("input", { type: "date", name: "date", value: m.date, required: true });
  const time = h("input", { type: "time", name: "time", value: m.time });
  const macros = macroFields(m);
  let items = m.items || [];
  let desc = m.desc || "";

  // --- desde receta ---
  const recipes = [...db.recipes].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const recipeSel = h("select", { name: "recipe" },
    h("option", { value: "" }, "— Ninguna —"),
    recipes.map((r) => h("option", { value: r.id, selected: r.id === m.recipeId }, r.name)));
  const servings = numInput("servings", m.servings || 1, { placeholder: "1" });
  const applyRecipe = () => {
    const r = db.recipes.find((x) => x.id === recipeSel.value);
    if (!r) return;
    const k = readNum(servings) / r.servings;
    macros.set({ kcal: r.kcal * k, p: r.p * k, c: r.c * k, f: r.f * k });
    if (!name.value.trim() || recipes.some((x) => x.name === name.value)) name.value = r.name;
    items = [];
  };
  recipeSel.addEventListener("change", applyRecipe);
  servings.addEventListener("input", applyRecipe);
  if (!rec && preset.recipeId) applyRecipe();

  const recipeBlock = recipes.length
    ? h("div", { class: "ai-box" },
        h("div", { class: "row" }, field("Desde una receta", recipeSel), field("Porciones", servings)))
    : null;

  const ai = aiBox({
    label: "Describe lo que comiste",
    placeholder: "Ej. 2 huevos revueltos, 1 tostada integral con aguacate y un café con leche",
    hint: "Incluye cantidades si las sabes (gramos, unidades, tazas). La IA estima el resto.",
    text: desc, items,
    onResult: (data) => {
      items = data.items; desc = data.text;
      macros.set(data.total);
      recipeSel.value = "";
      if (!name.value.trim()) name.value = data.items.length === 1 ? data.items[0].name : capitalize(data.text).slice(0, 60);
    },
  });

  const form = sheetForm((f) => {
    const v = macros.read();
    if (!v.kcal && !v.p && !v.c && !v.f) { toast("Añade macros: a mano, desde una receta o con IA"); return; }
    upsert("meals", {
      id: m.id || uid(), date: date.value || todayISO(), time: time.value || nowTime(),
      slot: checked(f, "slot"), name: name.value.trim() || "Comida",
      ...v, kcal: v.kcal || kcalFromMacros(v.p, v.c, v.f),
      recipeId: recipeSel.value, servings: recipeSel.value ? readNum(servings) : 0,
      items, desc,
    });
    closeSheet(); toast(rec ? "Comida actualizada" : "Comida guardada");
    state.mealDate = date.value || state.mealDate; render();
  },
    h("div", { class: "field" }, h("span", { class: "label" }, "Momento"), segmented("slot", SLOTS, m.slot, "Momento del día")),
    h("div", { class: "row" }, field("Fecha", date), field("Hora", time)),
    recipeBlock,
    ai,
    field("Nombre", name),
    macros.el,
    formActions(rec && (() => { remove("meals", m.id); closeSheet(); toast("Comida eliminada"); render(); })),
  );
  openSheet(rec ? "Editar comida" : "Nueva comida", form);
}


function recipeForm(rec) {
  const r = rec || { name: "", servings: 4, ingredients: "", items: [], note: "" };
  const name = h("input", { type: "text", name: "name", value: r.name, placeholder: "Ej. Lentejas con verduras", autocomplete: "off" });
  const servings = numInput("servings", r.servings, { int: true, placeholder: "4" });
  const macros = macroFields(r);
  let items = r.items || [];
  let ingredients = r.ingredients || "";

  const perServing = h("b", { class: "num" }, "—");
  const perMacros = h("span", { class: "num" }, "");
  const updatePer = () => {
    const v = macros.read(), n = readNum(servings) || 1;
    perServing.textContent = v.kcal ? `${fmt0(v.kcal / n)} kcal` : "—";
    perMacros.textContent = v.kcal ? `P ${fmt0(v.p / n)} · C ${fmt0(v.c / n)} · G ${fmt0(v.f / n)}` : "";
  };
  macros.el.addEventListener("input", updatePer);
  servings.addEventListener("input", updatePer);

  const ai = aiBox({
    label: "Ingredientes (uno por línea)",
    placeholder: "400 g lentejas secas\n1 cebolla\n2 zanahorias\n1 pimiento rojo\n2 cdas aceite de oliva\n1 chorizo (100 g)",
    hint: "Pon la cantidad de la receta completa. Luego se divide entre las porciones.",
    text: ingredients, items,
    getServings: () => readNum(servings) || 1,
    onResult: (data) => { items = data.items; ingredients = data.text; macros.set(data.total); updatePer(); },
  });

  const form = sheetForm(() => {
    const v = macros.read();
    if (!name.value.trim()) { name.focus(); toast("Ponle nombre a la receta"); return; }
    const saved = upsert("recipes", {
      id: r.id || uid(), name: name.value.trim(), servings: readNum(servings) || 1,
      ingredients: ai.querySelector("textarea").value.trim() || ingredients, items,
      ...v, kcal: v.kcal || kcalFromMacros(v.p, v.c, v.f),
    });
    closeSheet(); toast(rec ? "Receta actualizada" : "Receta guardada"); render();
    return saved;
  },
    field("Nombre", name),
    field("Porciones", servings),
    ai,
    h("p", { class: "eyebrow", style: "margin-bottom:8px" }, "Total de la receta"),
    macros.el,
    h("div", { class: "live", "aria-live": "polite" }, h("span", {}, "Por porción ", perServing), perMacros),
    rec && h("button", {
      type: "button", class: "btn ghost block", style: "margin-bottom:12px",
      onclick: () => { closeSheet(); mealForm(null, { recipeId: r.id }); },
    }, "Registrar una porción hoy"),
    formActions(rec && (() => { remove("recipes", r.id); closeSheet(); toast("Receta eliminada"); render(); })),
  );
  updatePer();
  openSheet(rec ? "Editar receta" : "Nueva receta", form);
}

function sleepHours(bed, wake) {
  const [bh, bm] = bed.split(":").map(Number), [wh, wm] = wake.split(":").map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

const QUALITY = [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]];

function sleepForm(rec) {
  const s = rec || { date: todayISO(), bed: "23:00", wake: "07:00", quality: 3, notes: "" };
  const date = h("input", { type: "date", name: "date", value: s.date, max: todayISO(), required: true });
  const bed = h("input", { type: "time", name: "bed", value: s.bed });
  const wake = h("input", { type: "time", name: "wake", value: s.wake });
  const notes = h("textarea", { name: "notes", rows: 2, placeholder: "Despertares, siesta, cafeína…" });
  notes.value = s.notes || "";
  const total = h("b", { class: "num" }, "");
  const update = () => { total.textContent = bed.value && wake.value ? fmtHours(sleepHours(bed.value, wake.value)) : "—"; };
  bed.addEventListener("input", update); wake.addEventListener("input", update); update();

  const form = sheetForm((f) => {
    if (!bed.value || !wake.value) { toast("Indica a qué hora te acostaste y te levantaste"); return; }
    upsert("sleep", {
      id: s.id || uid(), date: date.value || todayISO(), bed: bed.value, wake: wake.value,
      hours: sleepHours(bed.value, wake.value), quality: Number(checked(f, "quality")) || 3, notes: notes.value.trim(),
    });
    closeSheet(); toast(rec ? "Sueño actualizado" : "Sueño guardado"); render();
  },
    field("Fecha (día en que te despertaste)", date),
    h("div", { class: "row" }, field("Me acosté", bed), field("Me levanté", wake)),
    h("div", { class: "live", "aria-live": "polite" }, h("span", {}, "Dormiste "), total),
    h("div", { class: "field" },
      h("span", { class: "label" }, "Calidad (1 mala · 5 excelente)"),
      segmented("quality", QUALITY, String(s.quality), "Calidad del sueño")),
    field("Notas", notes),
    formActions(rec && (() => { remove("sleep", s.id); closeSheet(); toast("Registro eliminado"); render(); })),
  );
  openSheet(rec ? "Editar sueño" : "Registrar sueño", form);
}

/* IMC = peso (kg) / altura (m)²; categorías de la OMS para adultos */
const bmiOf = (kg) => {
  const cm = account.profile?.height_cm;
  return cm && kg ? kg / (cm / 100) ** 2 : 0;
};
function bmiLabel(bmi) {
  if (!bmi) return "";
  return bmi < 18.5 ? "bajo peso" : bmi < 25 ? "normal" : bmi < 30 ? "sobrepeso" : "obesidad";
}
const fmtDelta = (v, unit) => (Math.abs(v) < 0.05 ? `= ${unit}`.trim() : `${v > 0 ? "+" : "−"}${fmt1(Math.abs(v))} ${unit}`);
const byDateAsc = (a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "");

function heightInput() {
  return numInput("height", account.profile?.height_cm || "", { int: true, placeholder: "165" });
}

function bodyForm(rec) {
  const b = rec || { date: todayISO(), weight: "", fat: null, notes: "" };
  const last = [...db.body].sort(byDateAsc).at(-1);
  const date = h("input", { type: "date", name: "date", value: b.date, max: todayISO(), required: true });
  const weight = numInput("weight", b.weight, { placeholder: last ? String(last.weight).replace(".", ",") : "60,0" });
  const fat = numInput("fat", b.fat ?? "", { placeholder: "Opcional" });
  const height = account.profile?.height_cm ? null : heightInput();
  const notes = h("textarea", { name: "notes", rows: 2, placeholder: "En ayunas, después de entrenar…" });
  notes.value = b.notes || "";

  const bmiOut = h("b", { class: "num" }, "—");
  const bmiCat = h("span", {}, "");
  const update = () => {
    const kg = readNum(weight);
    const cm = height ? readNum(height) : account.profile?.height_cm;
    const bmi = cm && kg ? kg / (cm / 100) ** 2 : 0;
    bmiOut.textContent = bmi ? fmt1(bmi) : "—";
    bmiCat.textContent = bmi ? bmiLabel(bmi) : height ? "Indica tu altura" : "";
  };
  [weight, height].filter(Boolean).forEach((i) => i.addEventListener("input", update));
  update();

  const form = sheetForm(() => {
    const kg = readNum(weight);
    weight.setAttribute("aria-invalid", kg >= 20 ? "false" : "true");
    if (kg < 20 || kg > 400) { weight.focus(); toast("Indica tu peso en kg"); return; }
    const pct = readNum(fat);
    if (pct && (pct < 2 || pct > 75)) { fat.focus(); toast("La grasa corporal va entre 2 y 75 %"); return; }
    if (height && readNum(height)) setHeight(readNum(height));
    upsert("body", { id: b.id || uid(), date: date.value || todayISO(), weight: kg, fat: pct || null, notes: notes.value.trim() });
    closeSheet(); toast(rec ? "Medición actualizada" : "Medición guardada"); render();
  },
    field("Fecha", date),
    h("div", { class: "row" }, field("Peso (kg)", weight), field("Grasa corporal (%)", fat)),
    height && field("Altura (cm)", height, "Solo hace falta una vez, para calcular tu IMC."),
    h("div", { class: "live", "aria-live": "polite" }, h("span", {}, "IMC ", bmiOut), bmiCat),
    field("Notas", notes),
    h("p", { class: "hint", style: "margin:-8px 0 16px" },
      "La grasa corporal la da una báscula de bioimpedancia o una medición con plicómetro. El IMC no distingue músculo de grasa."),
    formActions(rec && (() => { remove("body", b.id); closeSheet(); toast("Medición eliminada"); render(); })),
  );
  openSheet(rec ? "Editar medición" : "Registrar peso", form);
}

function settingsSheet() {
  const g = db.goals;
  const prof = account.profile;
  const inputs = {
    kcal: numInput("kcal", g.kcal, { int: true }), p: numInput("p", g.p, { int: true }),
    c: numInput("c", g.c, { int: true }), f: numInput("f", g.f, { int: true }),
    sleep: numInput("sleep", g.sleep), km: numInput("km", g.km),
    weight: numInput("weight", g.weight || "", { placeholder: "Opcional" }),
  };
  const height = heightInput();
  const fileIn = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  fileIn.addEventListener("change", async () => {
    const file = fileIn.files[0];
    if (!file) return;
    toast("Importando…");
    try {
      await importJSON(await file.text());
      closeSheet(); toast("Datos importados"); render();
    } catch (err) {
      console.error(err);
      toast(err instanceof SyntaxError ? "El archivo no es una copia válida de FlorLovesRunning" : "No se pudo importar. Inténtalo de nuevo.");
    }
  });

  const linked = Boolean(prof?.strava_athlete_id);
  const strava = h("div", { class: "strava-box" },
    h("div", { class: "strava-head" },
      h("span", { class: "badge strava", icon: "strava" }),
      h("div", { class: "item-main" },
        h("strong", {}, linked ? "Strava conectado" : "Strava"),
        h("p", { class: "muted" }, linked
          ? (prof.strava_synced_at ? `Última sincronización: ${new Date(prof.strava_synced_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}` : "Aún sin sincronizar")
          : "Conéctalo para importar las carreras de tu Garmin y entrar con Strava."))),
    linked
      ? h("div", { class: "actions" },
          h("button", { type: "button", class: "btn ghost", onclick: (e) => syncStrava({ button: e.currentTarget }) }, "Sincronizar"),
          confirmButton("Desconectar", "¿Seguro? Toca otra vez", disconnectStrava, "btn danger"))
      : h("button", { type: "button", class: "btn strava-btn block", icon: "strava", onclick: connectStrava }, "Conectar con Strava"),
  );

  const form = sheetForm(() => {
    setGoals(Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, readNum(i)])));
    if (readNum(height) !== Number(account.profile?.height_cm || 0)) setHeight(readNum(height));
    closeSheet(); toast("Objetivos guardados"); render();
  },
    h("div", { class: "account" },
      h("span", { class: "avatar", "aria-hidden": "true" }, (prof?.name || "?").charAt(0)),
      h("div", { class: "item-main" }, h("strong", {}, prof?.name || ""), h("p", { class: "muted" }, prof?.email || "")),
      h("button", { type: "button", class: "btn ghost", icon: "logout", onclick: signOut }, "Salir")),

    h("h3", { class: "section-title" }, "Garmin y Strava"),
    strava,

    h("h3", { class: "section-title" }, "Objetivos diarios"),
    field("Calorías (kcal)", inputs.kcal),
    h("div", { class: "row" }, field("Proteína (g)", inputs.p), field("Carbos (g)", inputs.c), field("Grasas (g)", inputs.f)),
    h("div", { class: "row" }, field("Sueño (h/noche)", inputs.sleep), field("Km por semana", inputs.km)),
    h("div", { class: "row" }, field("Peso objetivo (kg)", inputs.weight), field("Altura (cm)", height)),
    h("button", { type: "submit", class: "btn primary block" }, "Guardar objetivos"),

    h("h3", { class: "section-title" }, "Tus datos"),
    h("p", { class: "muted", style: "margin-bottom:12px" },
      "Se guardan en la nube y los ves en cualquier dispositivo con tu cuenta. Las recetas son compartidas entre Sofi y Flor; el resto es privado."),
    h("div", { class: "actions" },
      h("button", { type: "button", class: "btn ghost", onclick: downloadBackup }, "Exportar"),
      h("button", { type: "button", class: "btn ghost", onclick: () => fileIn.click() }, "Importar")),
    fileIn,
    confirmButton("Borrar mis registros", "Se borrarán carreras, comidas y sueño. Toca otra vez", async () => {
      try { await wipe(); closeSheet(); toast("Registros borrados"); render(); }
      catch { toast("No se pudieron borrar. Inténtalo de nuevo."); }
    }, "btn danger block wipe"),
    h("p", { class: "hint", style: "margin-top:24px" },
      "Las estimaciones de la IA son aproximadas: revísalas y ajústalas si conoces los valores exactos de la etiqueta."),
  );
  openSheet("Ajustes", form);
}

function downloadBackup() {
  const blob = new Blob([exportJSON()], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `ritmo-${todayISO()}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ============ Strava ============ */

async function connectStrava() {
  try {
    const { url } = await api("/api/strava/start");
    location.href = url;
  } catch (err) {
    toast(err.message);
  }
}

async function disconnectStrava() {
  try {
    await api("/api/strava/sync", { disconnect: true });
    account.profile.strava_athlete_id = null;
    account.profile.strava_synced_at = null;
    closeSheet(); toast("Strava desconectado");
  } catch (err) {
    toast(err.message);
  }
}

let syncing = false;
async function syncStrava({ button, silent } = {}) {
  if (syncing) return;
  syncing = true;
  if (button) { button.disabled = true; button.textContent = "Sincronizando…"; }
  try {
    const { added } = await api("/api/strava/sync");
    await flush();
    await loadAll();
    if (button) closeSheet();
    if (added || !silent) toast(added ? `${added} ${added === 1 ? "carrera nueva" : "carreras nuevas"} de Strava` : "Todo al día con Strava");
    render();
  } catch (err) {
    if (!silent) toast(err.message);
  } finally {
    syncing = false;
    if (button) { button.disabled = false; button.textContent = "Sincronizar"; }
  }
}

/* ============ componentes de vista ============ */

function ring(value, goal, big, small) {
  const r = 54, circ = 2 * Math.PI * r;
  const pct = goal ? value / goal : 0;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 128 128");
  svg.setAttribute("aria-hidden", "true");
  const mk = (cls, offset) => {
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", 64); c.setAttribute("cy", 64); c.setAttribute("r", r);
    c.setAttribute("fill", "none"); c.setAttribute("stroke-width", 12);
    c.setAttribute("stroke-linecap", "round"); c.setAttribute("class", cls);
    if (offset != null) { c.setAttribute("stroke-dasharray", circ); c.setAttribute("stroke-dashoffset", offset); }
    return c;
  };
  svg.append(mk("track"));
  if (pct > 0) svg.append(mk(pct > 1.05 ? "fill over" : "fill", circ * (1 - Math.min(pct, 1))));
  return h("div", { class: "ring", role: "img", "aria-label": `${big} ${small}` },
    svg, h("div", { class: "ring-label" }, h("strong", { class: "num" }, big), h("span", {}, small)));
}

function macroBar(cls, label, value, goal) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return h("div", { class: "macro" },
    h("div", { class: "macro-row" },
      h("span", {}, h("span", { class: `dot ${cls}` }), " ", label),
      h("span", { class: "num" }, h("b", {}, fmt0(value)), ` / ${fmt0(goal)} g`)),
    h("div", { class: `bar ${cls}`, role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": goal, "aria-valuenow": Math.round(value) },
      h("i", { style: `width:${pct}%` })));
}

function nutritionCard(meals, title) {
  const g = db.goals;
  const t = { kcal: sum(meals, "kcal"), p: sum(meals, "p"), c: sum(meals, "c"), f: sum(meals, "f") };
  const left = g.kcal - t.kcal;
  return h("section", { class: "card", "aria-label": title },
    h("div", { class: "card-head" }, h("h2", {}, title), h("span", { class: "muted num" }, `${fmt0(t.kcal)} / ${fmt0(g.kcal)} kcal`)),
    h("div", { class: "hero" },
      ring(t.kcal, g.kcal, fmt0(Math.abs(left)), left >= 0 ? "kcal restantes" : "kcal de más"),
      h("div", { style: "flex:1;min-width:0" },
        macroBar("p", "Proteína", t.p, g.p),
        macroBar("c", "Carbos", t.c, g.c),
        macroBar("f", "Grasas", t.f, g.f))));
}

function weekChart(days, values, max, cls, fmtVal) {
  const t = todayISO();
  return h("div", { class: "week", role: "img", "aria-label": days.map((d, i) => `${shortDate(d)}: ${fmtVal(values[i])}`).join(", ") },
    days.map((d, i) => h("div", { class: `week-col${d === t ? " today" : ""}` },
      h("div", {
        class: `week-bar ${values[i] ? cls : "empty"}`,
        style: `height:${max ? Math.max(2, (values[i] / max) * 100) : 2}%`,
        title: fmtVal(values[i]),
      }),
      h("span", { "aria-hidden": "true" }, parseDate(d).toLocaleDateString("es", { weekday: "narrow" })))));
}

const last7 = () => Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i - 6));

function emptyState(iconName, title, text) {
  return h("div", { class: "empty" }, h("div", { icon: iconName }), h("p", {}, h("strong", {}, title)), h("p", {}, text));
}

function stat(value, unit, label) {
  return h("div", {},
    h("div", { class: "stat-value" }, value, unit && h("small", {}, unit)),
    h("div", { class: "stat-label" }, label));
}

const fab = (label, onclick) => h("button", { type: "button", class: "btn primary fab", icon: "plus", onclick }, label);

function runItem(r) {
  return h("li", { class: "item" },
    h("button", { type: "button", class: "item-btn", onclick: () => runForm(r) },
      h("span", { class: "badge run", icon: "runs" }),
      h("span", { class: "item-main" },
        h("span", { class: "item-title" }, `${fmt1(r.km)} km · ${capitalize(r.type)}`),
        h("span", { class: "item-sub", style: "display:block" },
          r.source === "strava" && h("span", { class: "tag" }, "Strava"),
          dayLabel(r.date),
          r.elevation ? ` · ↗ ${fmt0(r.elevation)} m` : "",
          r.avgHr ? ` · ♥ ${fmt0(r.avgHr)}` : "",
          r.notes && ` · ${r.notes}`)),
      h("span", { class: "item-end num" }, r.sec ? fmtDur(r.sec) : "—", h("small", {}, fmtPace(r.sec, r.km)))));
}

function mealItem(m) {
  return h("li", { class: "item" },
    h("button", { type: "button", class: "item-btn", onclick: () => mealForm(m) },
      h("span", { class: "badge", icon: "meals" }),
      h("span", { class: "item-main" },
        h("span", { class: "item-title", style: "display:block" }, m.name),
        h("span", { class: "item-sub num" }, `P ${fmt0(m.p)} · C ${fmt0(m.c)} · G ${fmt0(m.f)}`, m.servings ? ` · ${fmt1(m.servings)} porc.` : "")),
      h("span", { class: "item-end num" }, fmt0(m.kcal), h("small", {}, `kcal · ${m.time}`))));
}

function bodyItem(b, prev) {
  const bmi = bmiOf(b.weight);
  return h("li", { class: "item" },
    h("button", { type: "button", class: "item-btn", onclick: () => bodyForm(b) },
      h("span", { class: "badge body", icon: "body" }),
      h("span", { class: "item-main" },
        h("span", { class: "item-title num", style: "display:block" }, `${fmt1(b.weight)} kg`, b.fat ? ` · ${fmt1(b.fat)} % grasa` : ""),
        h("span", { class: "item-sub num" }, capitalize(dayLabel(b.date)), bmi ? ` · IMC ${fmt1(bmi)}` : "", b.notes && ` · ${b.notes}`)),
      h("span", { class: "item-end num" }, prev ? fmtDelta(b.weight - prev.weight, "kg") : "", h("small", {}, prev ? "vs anterior" : ""))));
}

/** Pestañas internas (Comidas/Recetas, Peso/Sueño). */
function subnav(items, current, label) {
  return h("div", { class: "seg subnav", role: "tablist", "aria-label": label },
    items.map(([view, text]) => h("button", {
      type: "button", role: "tab", class: view === current ? "on" : null,
      "aria-selected": view === current ? "true" : "false",
      onclick: () => go(view),
    }, text)));
}
const mealsNav = (v) => subnav([["meals", "Diario"], ["recipes", "Recetas"]], v, "Comidas");
const bodyNav = (v) => subnav([["body", "Peso y grasa"], ["sleep", "Sueño"]], v, "Cuerpo");

// ancho interior de una tarjeta, para dibujar los gráficos a su tamaño
const chartWidth = () => Math.max(260, Math.min(640, viewEl.clientWidth) - 32 - 34);
const xDate = (t) => new Date(t).toLocaleDateString("es", { day: "numeric", month: "short" });

function sleepItem(s) {
  return h("li", { class: "item" },
    h("button", { type: "button", class: "item-btn", onclick: () => sleepForm(s) },
      h("span", { class: "badge sleep", icon: "sleep" }),
      h("span", { class: "item-main" },
        h("span", { class: "item-title", style: "display:block" }, capitalize(dayLabel(s.date))),
        h("span", { class: "item-sub num" }, `${s.bed} → ${s.wake} · calidad ${s.quality}/5`)),
      h("span", { class: "item-end num" }, fmtHours(s.hours))));
}

/* ============ vistas ============ */

const state = { view: "today", mealDate: todayISO(), period: "3m" };

const VIEWS = {
  today: { title: "Hoy", tab: "today", render: viewToday },
  runs: { title: "Correr", tab: "runs", render: viewRuns },
  meals: { title: "Comidas", tab: "meals", render: viewMeals },
  recipes: { title: "Recetas", tab: "meals", render: viewRecipes },
  body: { title: "Cuerpo", tab: "body", render: viewBody },
  sleep: { title: "Sueño", tab: "body", render: viewSleep },
  summary: { title: "Resumen", tab: "summary", render: viewSummary },
};

function viewToday() {
  const t = todayISO(), g = db.goals;
  const meals = db.meals.filter((m) => m.date === t).sort(byDateDesc);
  const ws = weekStart(t);
  const weekRuns = db.runs.filter((r) => r.date >= ws && r.date <= t);
  const weekKm = sum(weekRuns, "km");
  const lastSleep = [...db.sleep].sort(byDateDesc)[0];
  const sleep7 = db.sleep.filter((s) => s.date > addDays(t, -7));
  const avgSleep = sleep7.length ? sum(sleep7, "hours") / sleep7.length : 0;
  const lastBody = [...db.body].sort(byDateAsc).at(-1);
  const lastBmi = lastBody ? bmiOf(lastBody.weight) : 0;

  return [
    h("p", { class: "muted", style: "margin:-4px 0 16px" },
      `Hola, ${account.profile?.name || ""} · `,
      new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })),
    nutritionCard(meals, "Nutrición"),
    h("section", { class: "card", "aria-label": "Resumen de la semana" },
      h("div", { class: "card-head" }, h("h2", {}, "Esta semana")),
      h("div", { class: "stats" },
        stat(fmt1(weekKm), `/ ${fmt0(g.km)} km`, `${weekRuns.length} ${weekRuns.length === 1 ? "carrera" : "carreras"}`),
        stat(lastSleep ? fmt1(lastSleep.hours) : "—", "h", lastSleep ? `Último sueño (${dayLabel(lastSleep.date).toLowerCase()})` : "Sin registros de sueño"),
        stat(avgSleep ? fmt1(avgSleep) : "—", `/ ${fmt1(g.sleep)} h`, "Media de sueño 7 días")),
      h("div", { class: "bar", style: "margin-top:16px", role: "progressbar", "aria-label": "Kilómetros de la semana", "aria-valuemin": 0, "aria-valuemax": g.km, "aria-valuenow": round1(weekKm) },
        h("i", { style: `width:${g.km ? Math.min(100, (weekKm / g.km) * 100) : 0}%;background:var(--run)` }))),
    h("section", { class: "card", "aria-label": "Cuerpo" },
      h("div", { class: "card-head" },
        h("h2", {}, "Cuerpo"),
        h("button", { type: "button", class: "link", onclick: () => go("body") }, "Ver evolución")),
      lastBody
        ? h("div", { class: "stats" },
            stat(fmt1(lastBody.weight), "kg", `Peso (${dayLabel(lastBody.date).toLowerCase()})`),
            stat(lastBmi ? fmt1(lastBmi) : "—", "", lastBmi ? `IMC · ${bmiLabel(lastBmi)}` : "IMC: falta tu altura"),
            stat(lastBody.fat ? fmt1(lastBody.fat) : "—", "%", "Grasa corporal"))
        : h("p", { class: "muted" }, "Registra tu peso para ver tu IMC y su evolución.")),
    h("section", { class: "card", "aria-label": "Registro rápido" },
      h("div", { class: "card-head" }, h("h2", {}, "Registrar")),
      h("div", { class: "quick" },
        h("button", { type: "button", class: "btn ghost", icon: "runs", onclick: () => runForm() }, "Carrera"),
        h("button", { type: "button", class: "btn ghost", icon: "meals", onclick: () => mealForm() }, "Comida"),
        h("button", { type: "button", class: "btn ghost", icon: "body", onclick: () => bodyForm() }, "Peso"),
        h("button", { type: "button", class: "btn ghost", icon: "sleep", onclick: () => sleepForm() }, "Sueño"))),
    h("section", { class: "card", "aria-label": "Comidas de hoy" },
      h("div", { class: "card-head" },
        h("h2", {}, "Comidas de hoy"),
        h("button", { type: "button", class: "link", onclick: () => go("meals") }, "Ver todo")),
      meals.length
        ? h("ul", { class: "list" }, meals.map(mealItem))
        : emptyState("meals", "Aún no has registrado comidas", "Describe lo que comiste y la IA calcula los macros.")),
  ];
}

function viewRuns() {
  const t = todayISO(), g = db.goals;
  const runs = [...db.runs].sort(byDateDesc);
  const ws = weekStart(t), ms = t.slice(0, 8) + "01";
  const week = runs.filter((r) => r.date >= ws);
  const month = runs.filter((r) => r.date >= ms);
  const monthTimed = month.filter((r) => r.sec && r.km);
  const days = last7();
  const kmByDay = days.map((d) => sum(runs.filter((r) => r.date === d), "km"));
  const longest = runs.reduce((a, r) => Math.max(a, r.km), 0);

  return [
    h("section", { class: "card", "aria-label": "Resumen de carreras" },
      h("div", { class: "stats" },
        stat(fmt1(sum(week, "km")), `/ ${fmt0(g.km)} km`, "Esta semana"),
        stat(fmt1(sum(month, "km")), "km", "Este mes"),
        stat(monthTimed.length ? fmtDur(sum(monthTimed, "sec") / sum(monthTimed, "km")) : "—", "/km", "Ritmo medio mes"),
        stat(fmt1(longest), "km", "Más larga"))),
    h("section", { class: "card", "aria-label": "Últimos 7 días" },
      h("div", { class: "card-head" }, h("h2", {}, "Últimos 7 días"), h("span", { class: "muted num" }, `${fmt1(kmByDay.reduce((a, b) => a + b, 0))} km`)),
      weekChart(days, kmByDay, Math.max(...kmByDay), "", (v) => `${fmt1(v)} km`)),
    h("section", { class: "card", "aria-label": "Historial" },
      h("div", { class: "card-head" }, h("h2", {}, "Historial")),
      runs.length
        ? h("ul", { class: "list" }, runs.slice(0, 100).map(runItem))
        : emptyState("runs", "Sin carreras todavía", "Registra kilómetros y tiempo: calculamos tu ritmo por km.")),
    fab("Carrera", () => runForm()),
  ];
}

function viewMeals() {
  const d = state.mealDate;
  const meals = db.meals.filter((m) => m.date === d).sort((a, b) => a.time.localeCompare(b.time));
  const groups = SLOTS.map(([k, label]) => [label, meals.filter((m) => m.slot === k)]).filter(([, l]) => l.length);
  const isToday = d === todayISO();

  return [
    mealsNav("meals"),
    h("div", { class: "datebar" },
      h("button", { type: "button", class: "icon-btn", icon: "left", "aria-label": "Día anterior", onclick: () => { state.mealDate = addDays(d, -1); render(); } }),
      h("strong", {}, capitalize(dayLabel(d))),
      h("button", { type: "button", class: "icon-btn", icon: "right", "aria-label": "Día siguiente", disabled: isToday, onclick: () => { state.mealDate = addDays(d, 1); render(); } })),
    nutritionCard(meals, "Total del día"),
    groups.length
      ? groups.map(([label, list]) => h("section", { class: "card", "aria-label": label },
          h("div", { class: "card-head" }, h("h2", {}, label), h("span", { class: "muted num" }, `${fmt0(sum(list, "kcal"))} kcal`)),
          h("ul", { class: "list" }, list.map(mealItem))))
      : h("section", { class: "card" }, emptyState("meals", "Nada registrado este día", "Pulsa «Comida» para añadir lo que comiste.")),
    fab("Comida", () => mealForm(null, { date: d })),
  ];
}

function viewRecipes() {
  const recipes = [...db.recipes].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return [
    mealsNav("recipes"),
    h("p", { class: "muted", style: "margin-bottom:16px" },
      "Compartidas entre Sofi y Flor. Guarda tus recetas con sus ingredientes: la IA calcula los macros y luego registras porciones en un toque."),
    h("section", { class: "card", "aria-label": "Mis recetas" },
      recipes.length
        ? h("ul", { class: "list" }, recipes.map((r) => h("li", { class: "item" },
            h("button", { type: "button", class: "item-btn", onclick: () => recipeForm(r) },
              h("span", { class: "badge", icon: "recipes" }),
              h("span", { class: "item-main" },
                h("span", { class: "item-title", style: "display:block" }, r.name),
                h("span", { class: "item-sub num" },
                  `${fmt0(r.servings)} porc. · P ${fmt0(r.p / r.servings)} · C ${fmt0(r.c / r.servings)} · G ${fmt0(r.f / r.servings)}`)),
              h("span", { class: "item-end num" }, fmt0(r.kcal / r.servings), h("small", {}, "kcal/porción"))))))
        : emptyState("recipes", "Aún no tienes recetas", "Añade una con sus ingredientes y cantidades.")),
    fab("Receta", () => recipeForm()),
  ];
}

function viewSleep() {
  const g = db.goals;
  const list = [...db.sleep].sort(byDateDesc);
  const days = last7();
  const hrsByDay = days.map((d) => sum(list.filter((s) => s.date === d), "hours"));
  const logged = hrsByDay.filter(Boolean);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
  const q7 = list.filter((s) => s.date >= days[0]);
  const avgQ = q7.length ? sum(q7, "quality") / q7.length : 0;
  const debt = logged.reduce((a, hrs) => a + Math.max(0, g.sleep - hrs), 0);

  return [
    bodyNav("sleep"),
    h("section", { class: "card", "aria-label": "Resumen de sueño" },
      h("div", { class: "stats" },
        stat(avg ? fmt1(avg) : "—", `/ ${fmt1(g.sleep)} h`, "Media 7 días"),
        stat(avgQ ? fmt1(avgQ) : "—", "/ 5", "Calidad media"),
        stat(fmt1(debt), "h", "Déficit semanal"))),
    h("section", { class: "card", "aria-label": "Últimas 7 noches" },
      h("div", { class: "card-head" }, h("h2", {}, "Últimas 7 noches")),
      weekChart(days, hrsByDay, Math.max(g.sleep, ...hrsByDay), "sleep", (v) => (v ? fmtHours(v) : "sin registro"))),
    h("section", { class: "card", "aria-label": "Historial de sueño" },
      h("div", { class: "card-head" }, h("h2", {}, "Historial")),
      list.length
        ? h("ul", { class: "list" }, list.slice(0, 100).map(sleepItem))
        : emptyState("sleep", "Sin registros de sueño", "Anota a qué hora te acostaste y te levantaste.")),
    fab("Sueño", () => sleepForm()),
  ];
}

function viewBody() {
  const g = db.goals;
  const list = [...db.body].sort(byDateAsc);
  const last = list.at(-1);
  const t = todayISO();
  const since = addDays(t, -90);
  const recent = list.filter((b) => b.date >= since);
  const month = list.filter((b) => b.date >= addDays(t, -30));
  const bmi = last ? bmiOf(last.weight) : 0;
  const fats = recent.filter((b) => b.fat);

  const heightCard = !account.profile?.height_cm && (() => {
    const input = heightInput();
    return h("section", { class: "card", "aria-label": "Altura" },
      h("h2", { style: "margin-bottom:8px" }, "¿Cuánto mides?"),
      h("p", { class: "muted", style: "margin-bottom:12px" }, "Con tu altura calculamos el IMC de cada medición."),
      h("div", { class: "inline-form" }, field("Altura (cm)", input),
        h("button", { type: "button", class: "btn primary", onclick: () => {
          const cm = readNum(input);
          if (cm < 100 || cm > 250) { input.focus(); toast("Indica tu altura en centímetros"); return; }
          setHeight(cm); toast("Altura guardada"); render();
        } }, "Guardar")));
  })();

  return [
    bodyNav("body"),
    heightCard,
    h("section", { class: "card", "aria-label": "Última medición" },
      last
        ? h("div", { class: "stats" },
            stat(fmt1(last.weight), "kg", month.length > 1 ? `${fmtDelta(last.weight - month[0].weight, "kg")} en 30 días` : `Peso · ${dayLabel(last.date).toLowerCase()}`),
            stat(bmi ? fmt1(bmi) : "—", "", bmi ? `IMC · ${bmiLabel(bmi)}` : "IMC"),
            stat(last.fat ? fmt1(last.fat) : "—", "%", "Grasa corporal"),
            g.weight ? stat(fmt1(Math.abs(last.weight - g.weight)), "kg", Math.abs(last.weight - g.weight) < 0.05 ? "¡Objetivo alcanzado!" : `para tu objetivo (${fmt1(g.weight)} kg)`) : null)
        : emptyState("body", "Sin mediciones todavía", "Registra tu peso y, si la tienes, tu grasa corporal.")),
    recent.length && h("section", { class: "card", "aria-label": "Peso últimos 90 días" },
      h("div", { class: "card-head" }, h("h2", {}, "Peso · 90 días")),
      lineChart({
        data: recent.map((b) => ({ t: parseDate(b.date).getTime(), v: b.weight, tip: `${shortDate(b.date)} · ${fmt1(b.weight)} kg` })),
        color: "var(--chart-body)", width: chartWidth(), domain: [parseDate(since).getTime(), parseDate(t).getTime()],
        goal: g.weight || null, goalLabel: `objetivo ${fmt1(g.weight)} kg`, fmt: (v) => fmt1(v), xFmt: xDate,
        ariaLabel: `Peso de los últimos 90 días: de ${fmt1(recent[0].weight)} a ${fmt1(last.weight)} kg`,
      })),
    fats.length > 0 && h("section", { class: "card", "aria-label": "Grasa corporal últimos 90 días" },
      h("div", { class: "card-head" }, h("h2", {}, "Grasa corporal · 90 días")),
      lineChart({
        data: fats.map((b) => ({ t: parseDate(b.date).getTime(), v: b.fat, tip: `${shortDate(b.date)} · ${fmt1(b.fat)} %` })),
        color: "var(--chart-fat)", width: chartWidth(), domain: [parseDate(since).getTime(), parseDate(t).getTime()],
        fmt: (v) => `${fmt0(v)} %`, xFmt: xDate,
        ariaLabel: `Grasa corporal de los últimos 90 días: de ${fmt1(fats[0].fat)} a ${fmt1(fats.at(-1).fat)} %`,
      })),
    h("section", { class: "card", "aria-label": "Historial de mediciones" },
      h("div", { class: "card-head" }, h("h2", {}, "Historial")),
      list.length
        ? h("ul", { class: "list" }, list.slice().reverse().slice(0, 100).map((b, i, arr) => bodyItem(b, arr[i + 1])))
        : h("p", { class: "muted" }, "Aquí aparecerán tus mediciones.")),
    fab("Peso", () => bodyForm()),
  ];
}

/* ============ resumen ============ */

const PERIODS = [["4s", "4 semanas"], ["3m", "3 meses"], ["12m", "12 meses"], ["todo", "Todo"]];

function periodRange(key) {
  const t = todayISO();
  if (key === "4s") return { start: addDays(weekStart(t), -21), unit: "week" };
  if (key === "3m") return { start: addDays(weekStart(t), -12 * 7), unit: "week" };
  const d = parseDate(t);
  if (key === "12m") {
    d.setMonth(d.getMonth() - 11, 1);
  } else {
    const first = [...db.runs, ...db.meals, ...db.sleep, ...db.body].map((x) => x.date).sort()[0] || t;
    d.setTime(parseDate(first).getTime());
    d.setDate(1);
  }
  return { start: iso(d), unit: "month" };
}

function bucketList(start, unit) {
  const t = todayISO(), out = [];
  const multiYear = unit === "month" && start.slice(0, 4) !== t.slice(0, 4);
  if (unit === "week") {
    for (let k = start; k <= t; k = addDays(k, 7)) out.push({ key: k, label: shortDate(k), long: `semana del ${shortDate(k)}` });
  } else {
    const d = parseDate(start);
    while (iso(d) <= t) {
      const key = iso(d).slice(0, 7);
      const mon = d.toLocaleDateString("es", { month: "short" }).replace(".", "");
      out.push({ key, label: multiYear ? `${mon} ${String(d.getFullYear()).slice(2)}` : mon, long: d.toLocaleDateString("es", { month: "long", year: "numeric" }) });
      d.setMonth(d.getMonth() + 1);
    }
  }
  return out;
}
const bucketOf = (date, unit) => (unit === "week" ? weekStart(date) : date.slice(0, 7));

/** Agrupa registros por cubo (semana o mes). */
function groupBy(list, unit) {
  const m = new Map();
  for (const x of list) {
    const k = bucketOf(x.date, unit);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

/** kcal medias por día con registros. */
function kcalPerDay(meals) {
  const days = new Set(meals.map((m) => m.date));
  return days.size ? sum(meals, "kcal") / days.size : 0;
}
const avgOf = (list, k) => (list.length ? sum(list, k) / list.length : 0);

function viewSummary() {
  const g = db.goals;
  const { start, unit } = periodRange(state.period);
  const inP = (x) => x.date >= start;
  const runs = db.runs.filter(inP), meals = db.meals.filter(inP), sleep = db.sleep.filter(inP);
  const body = db.body.filter(inP).sort(byDateAsc);
  const timed = runs.filter((r) => r.sec && r.km);
  const buckets = bucketList(start, unit);
  const W = chartWidth();
  const per = unit === "week" ? "semana" : "mes";

  const runsBy = groupBy(runs, unit), mealsBy = groupBy(meals, unit), sleepBy = groupBy(sleep, unit), bodyBy = groupBy(body, unit);
  const kmData = buckets.map((b) => {
    const v = sum(runsBy.get(b.key) || [], "km");
    return { label: b.label, value: v, tip: `${capitalize(b.long)} · ${fmt1(v)} km` };
  });
  const kcalData = buckets.map((b) => {
    const v = kcalPerDay(mealsBy.get(b.key) || []);
    return { label: b.label, value: v, tip: `${capitalize(b.long)} · ${v ? `${fmt0(v)} kcal/día` : "sin registros"}` };
  });
  const sleepData = buckets.map((b) => {
    const v = avgOf(sleepBy.get(b.key) || [], "hours");
    return { label: b.label, value: v, tip: `${capitalize(b.long)} · ${v ? fmtHours(v) : "sin registros"}` };
  });

  const firstW = body[0], lastW = body.at(-1);
  const fatList = body.filter((b) => b.fat);
  const bmi = lastW ? bmiOf(lastW.weight) : 0;
  const domain = [parseDate(start).getTime(), parseDate(todayISO()).getTime()];

  // récords de todo el historial
  const allRuns = db.runs;
  const longest = allRuns.reduce((a, r) => (!a || r.km > a.km ? r : a), null);
  const fastest = allRuns.filter((r) => r.km >= 5 && r.sec).reduce((a, r) => (!a || r.sec / r.km < a.sec / a.km ? r : a), null);
  const bestOf = (u) => [...groupBy(allRuns, u)].map(([k, l]) => [k, sum(l, "km")]).sort((a, b) => b[1] - a[1])[0];
  const bestWeek = bestOf("week"), bestMonth = bestOf("month");
  const monthName = (k) => parseDate(k + "-01").toLocaleDateString("es", { month: "long", year: "numeric" });

  const months = bucketList(unit === "month" ? start : start.slice(0, 8) + "01", "month").reverse();
  const mRuns = groupBy(db.runs, "month"), mMeals = groupBy(db.meals, "month"), mSleep = groupBy(db.sleep, "month"), mBody = groupBy([...db.body].sort(byDateAsc), "month");

  const empty = !runs.length && !meals.length && !sleep.length && !body.length;

  return [
    h("div", { class: "seg period", role: "radiogroup", "aria-label": "Periodo" },
      PERIODS.map(([k, label]) => h("label", {},
        h("input", { type: "radio", name: "period", value: k, checked: k === state.period, onchange: () => { state.period = k; render(); } }),
        h("span", {}, label)))),

    empty
      ? h("section", { class: "card" }, emptyState("summary", "Nada registrado en este periodo", "Cuando registres carreras, comidas, sueño o peso, aquí verás su evolución."))
      : [
    h("section", { class: "card", "aria-label": "Totales del periodo" },
      h("div", { class: "card-head" }, h("h2", {}, "En este periodo"), h("span", { class: "muted" }, `desde ${shortDate(start)}`)),
      h("div", { class: "stats" },
        stat(fmt1(sum(runs, "km")), "km", `${runs.length} ${runs.length === 1 ? "carrera" : "carreras"}`),
        stat(timed.length ? fmtDur(sum(timed, "sec") / sum(timed, "km")) : "—", "/km", "Ritmo medio"),
        stat(meals.length ? fmt0(kcalPerDay(meals)) : "—", "kcal", `Media diaria · objetivo ${fmt0(g.kcal)}`),
        stat(meals.length ? fmt0(sum(meals, "p") / new Set(meals.map((m) => m.date)).size) : "—", "g", `Proteína/día · objetivo ${fmt0(g.p)}`),
        stat(sleep.length ? fmt1(avgOf(sleep, "hours")) : "—", "h", `Sueño medio · objetivo ${fmt1(g.sleep)}`),
        stat(lastW ? fmt1(lastW.weight) : "—", "kg", body.length > 1 ? `Peso · ${fmtDelta(lastW.weight - firstW.weight, "kg")}` : "Peso"),
        stat(bmi ? fmt1(bmi) : "—", "", bmi ? `IMC · ${bmiLabel(bmi)}` : "IMC"),
        stat(fatList.length ? fmt1(fatList.at(-1).fat) : "—", "%", fatList.length > 1 ? `Grasa · ${fmtDelta(fatList.at(-1).fat - fatList[0].fat, "pts")}` : "Grasa corporal"))),

    h("section", { class: "card", "aria-label": `Kilómetros por ${per}` },
      h("div", { class: "card-head" }, h("h2", {}, `Kilómetros por ${per}`)),
      barChart({
        data: kmData, color: "var(--chart-run)", width: W, fmt: (v) => fmt0(v),
        goal: unit === "week" ? g.km : null, goalLabel: `objetivo ${fmt0(g.km)} km`,
        ariaLabel: `Kilómetros por ${per}: total ${fmt1(sum(runs, "km"))} km`,
      })),

    body.length > 0 && h("section", { class: "card", "aria-label": "Evolución del peso" },
      h("div", { class: "card-head" }, h("h2", {}, "Peso"), body.length > 1 ? h("span", { class: "muted num" }, fmtDelta(lastW.weight - firstW.weight, "kg")) : null),
      lineChart({
        data: body.map((b) => ({ t: parseDate(b.date).getTime(), v: b.weight, tip: `${shortDate(b.date)} · ${fmt1(b.weight)} kg` })),
        color: "var(--chart-body)", width: W, domain, goal: g.weight || null, goalLabel: `objetivo ${fmt1(g.weight)} kg`,
        fmt: (v) => fmt1(v), xFmt: xDate, ariaLabel: `Peso: de ${fmt1(firstW.weight)} a ${fmt1(lastW.weight)} kg`,
      })),

    fatList.length > 0 && h("section", { class: "card", "aria-label": "Evolución de la grasa corporal" },
      h("div", { class: "card-head" }, h("h2", {}, "Grasa corporal")),
      lineChart({
        data: fatList.map((b) => ({ t: parseDate(b.date).getTime(), v: b.fat, tip: `${shortDate(b.date)} · ${fmt1(b.fat)} %` })),
        color: "var(--chart-fat)", width: W, domain, fmt: (v) => `${fmt0(v)} %`, xFmt: xDate,
        ariaLabel: `Grasa corporal: de ${fmt1(fatList[0].fat)} a ${fmt1(fatList.at(-1).fat)} %`,
      })),

    meals.length > 0 && h("section", { class: "card", "aria-label": `Calorías medias por ${per}` },
      h("div", { class: "card-head" }, h("h2", {}, "Calorías por día"), h("span", { class: "muted" }, `media de cada ${per}`)),
      barChart({
        data: kcalData, color: "var(--chart-kcal)", width: W, fmt: (v) => fmt0(v),
        goal: g.kcal, goalLabel: `objetivo ${fmt0(g.kcal)}`, ariaLabel: `Calorías medias por día en cada ${per}`,
      })),

    sleep.length > 0 && h("section", { class: "card", "aria-label": `Sueño medio por ${per}` },
      h("div", { class: "card-head" }, h("h2", {}, "Horas de sueño"), h("span", { class: "muted" }, `media de cada ${per}`)),
      barChart({
        data: sleepData, color: "var(--chart-sleep)", width: W, fmt: (v) => fmt0(v),
        goal: g.sleep, goalLabel: `objetivo ${fmt1(g.sleep)} h`, ariaLabel: `Horas de sueño medias en cada ${per}`,
      })),
      ],

    allRuns.length > 0 && h("section", { class: "card", "aria-label": "Récords" },
      h("div", { class: "card-head" }, h("h2", {}, "Récords"), h("span", { class: "muted" }, "todo el historial")),
      h("ul", { class: "list records" },
        longest && h("li", { class: "item" }, h("span", { class: "item-main" }, h("span", { class: "item-title", style: "display:block" }, "Carrera más larga"), h("span", { class: "item-sub" }, capitalize(dayLabel(longest.date)))), h("span", { class: "item-end num" }, `${fmt1(longest.km)} km`)),
        fastest && h("li", { class: "item" }, h("span", { class: "item-main" }, h("span", { class: "item-title", style: "display:block" }, "Mejor ritmo (5 km o más)"), h("span", { class: "item-sub" }, `${capitalize(dayLabel(fastest.date))} · ${fmt1(fastest.km)} km`)), h("span", { class: "item-end num" }, fmtPace(fastest.sec, fastest.km))),
        bestWeek && h("li", { class: "item" }, h("span", { class: "item-main" }, h("span", { class: "item-title", style: "display:block" }, "Semana con más km"), h("span", { class: "item-sub" }, `Semana del ${shortDate(bestWeek[0])}`)), h("span", { class: "item-end num" }, `${fmt1(bestWeek[1])} km`)),
        bestMonth && h("li", { class: "item" }, h("span", { class: "item-main" }, h("span", { class: "item-title", style: "display:block" }, "Mes con más km"), h("span", { class: "item-sub" }, capitalize(monthName(bestMonth[0])))), h("span", { class: "item-end num" }, `${fmt1(bestMonth[1])} km`)))),

    !empty && h("section", { class: "card", "aria-label": "Mes a mes" },
      h("div", { class: "card-head" }, h("h2", {}, "Mes a mes")),
      h("div", { class: "table-wrap" },
        h("table", { class: "table" },
          h("thead", {}, h("tr", {},
            h("th", { scope: "col" }, "Mes"), h("th", { scope: "col", class: "n" }, "Km"), h("th", { scope: "col", class: "n" }, "Carreras"),
            h("th", { scope: "col", class: "n" }, "Kcal/día"), h("th", { scope: "col", class: "n" }, "Sueño"), h("th", { scope: "col", class: "n" }, "Peso"))),
          h("tbody", {}, months.map((m) => {
            const r = mRuns.get(m.key) || [], ml = mMeals.get(m.key) || [], sl = mSleep.get(m.key) || [], bd = mBody.get(m.key) || [];
            return h("tr", {},
              h("th", { scope: "row" }, capitalize(m.long)),
              h("td", { class: "n" }, r.length ? fmt1(sum(r, "km")) : "—"),
              h("td", { class: "n" }, r.length || "—"),
              h("td", { class: "n" }, ml.length ? fmt0(kcalPerDay(ml)) : "—"),
              h("td", { class: "n" }, sl.length ? `${fmt1(avgOf(sl, "hours"))} h` : "—"),
              h("td", { class: "n" }, bd.length ? `${fmt1(bd.at(-1).weight)} kg` : "—"));
          }))))),
  ];
}

/* ============ navegación ============ */

const viewEl = document.getElementById("view");
const titleEl = document.getElementById("viewTitle");
const tabs = [...document.querySelectorAll(".tabbar button")];

tabs.forEach((b) => {
  b.insertAdjacentHTML("afterbegin", icon(b.dataset.view));
  b.addEventListener("click", () => go(b.dataset.view));
});

const settingsBtn = document.getElementById("settingsBtn");
settingsBtn.insertAdjacentHTML("afterbegin", icon("settings"));
settingsBtn.addEventListener("click", settingsSheet);

function go(view) {
  if (!VIEWS[view]) view = "today";
  if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  if (view === "meals" && state.view !== "meals") state.mealDate = todayISO();
  state.view = view;
  render();
  window.scrollTo({ top: 0 });
}

function render() {
  const v = VIEWS[state.view];
  titleEl.textContent = v.title;
  document.title = `${v.title} · FlorLovesRunning`;
  tabs.forEach((b) => {
    if (b.dataset.view === v.tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  viewEl.replaceChildren(...[v.render()].flat(Infinity).filter(Boolean));
}

window.addEventListener("hashchange", () => { if (account.user) go(location.hash.slice(1)); });

// los gráficos se dibujan al ancho de la pantalla: redibujar al girar el móvil
let resizeTimer;
let lastWidth = window.innerWidth;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    if (account.user && ["summary", "body"].includes(state.view)) render();
  }, 200);
});

/* ============ sesión ============ */

const LOGIN_ERRORS = {
  strava_unlinked: "Esa cuenta de Strava no está vinculada. Entra con Google y conecta Strava en Ajustes; después podrás entrar con Strava.",
  strava_denied: "Cancelaste el acceso a Strava.",
  strava_scope: "Para importar tus carreras, Strava necesita permiso para leer tus actividades.",
  strava_state: "El enlace de Strava caducó. Inténtalo de nuevo.",
  strava_token: "Strava no respondió. Inténtalo de nuevo.",
  strava_save: "No se pudo guardar la conexión con Strava.",
  strava_login: "No se pudo iniciar sesión con Strava. Prueba con Google.",
  denied: "FlorLovesRunning es privada: ese email no tiene acceso.",
};

function setChrome(signedIn) {
  document.body.classList.toggle("signed-out", !signedIn);
}

function renderLogin(errorKey) {
  setChrome(false);
  document.title = "FlorLovesRunning";
  const status = h("p", { class: "error", role: "alert" }, errorKey ? LOGIN_ERRORS[errorKey] || "No se pudo iniciar sesión." : "");
  const google = h("button", { type: "button", class: "btn block google-btn", icon: "google" }, "Continuar con Google");
  google.addEventListener("click", async () => {
    google.disabled = true;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } },
    });
    if (error) { google.disabled = false; status.textContent = "No se pudo abrir Google. Inténtalo de nuevo."; }
  });
  viewEl.replaceChildren(h("section", { class: "login" },
    h("img", { src: "icons/icon.svg", alt: "", width: 72, height: 72 }),
    h("h1", {}, "FlorLovesRunning"),
    h("p", { class: "muted" }, "Kilómetros, comidas y sueño de Sofi y Flor."),
    h("div", { class: "login-actions" },
      google,
      h("a", { class: "btn block strava-btn", href: "/api/strava/start", icon: "strava" }, "Continuar con Strava")),
    status,
    h("p", { class: "hint" }, "Strava funciona como acceso cuando ya lo conectaste desde Ajustes.")));
}

function renderMessage(title, text) {
  setChrome(false);
  viewEl.replaceChildren(h("section", { class: "login" }, h("h1", {}, title), h("p", { class: "muted" }, text)));
}

let entering = null;
function enterApp(user) {
  if (account.user?.id === user.id && (account.loadedAt || entering)) return entering || Promise.resolve();
  entering = startApp(user).finally(() => { entering = null; });
  return entering;
}

async function startApp(user) {
  account.user = user;
  renderMessage("FlorLovesRunning", "Cargando tus datos…");
  try {
    await loadAll();
  } catch (err) {
    console.error(err);
    account.user = null;
    await sb.auth.signOut();
    renderLogin("denied");
    return;
  }
  setChrome(true);
  go(location.hash.slice(1) || "today");
  const prof = account.profile;
  if (prof.strava_athlete_id && (!prof.strava_synced_at || Date.now() - new Date(prof.strava_synced_at) > 3 * 3600e3)) {
    syncStrava({ silent: true });
  }
}

async function signOut() {
  await flush();
  await sb.auth.signOut();
  closeSheet();
}

/** Lee y limpia los parámetros con los que vuelve el login (Google o Strava). */
function takeUrlParams() {
  const q = new URLSearchParams(location.search);
  const out = {
    login: q.get("login"),
    error: q.get("error"),
    strava: q.get("strava"),
    // errores de Supabase/Google (p. ej. el trigger rechazó un email no permitido)
    authError: q.get("error_description") || new URLSearchParams(location.hash.slice(1)).get("error_description"),
  };
  if (location.search || out.authError) history.replaceState(null, "", location.pathname + (out.authError ? "" : location.hash));
  return out;
}

onWriteError(() => {
  toast("No se pudo guardar el último cambio. Revisa tu conexión.");
  if (account.user) loadAll().then(render).catch(() => {});
});

// al volver a la app, refresca (las recetas pueden haber cambiado)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && account.user && Date.now() - account.loadedAt > 60_000) {
    flush().then(loadAll).then(render).catch(() => {});
  }
});

async function boot() {
  if (!sb) {
    renderMessage("Falta configurar FlorLovesRunning", "No se encontró la configuración de Supabase (js/config.js). Revisa las variables SUPABASE_URL y SUPABASE_ANON_KEY en Netlify y vuelve a desplegar.");
    return;
  }
  // primero deja que Supabase lea la vuelta de Google (?code= o #access_token=) y luego limpia la URL
  await sb.auth.getSession();
  const params = takeUrlParams();
  if (params.login) {
    const { error } = await sb.auth.verifyOtp({ token_hash: params.login, type: "magiclink" });
    if (error) params.error = "strava_login";
  }
  let first = true;
  sb.auth.onAuthStateChange((event, session) => {
    // los callbacks de Supabase no deben esperar a otras llamadas suyas
    setTimeout(() => {
      if (session?.user) {
        enterApp(session.user).then(() => {
          if (first && params.strava === "connected") { toast("Strava conectado"); syncStrava(); }
          first = false;
        });
      } else {
        account.user = null;
        account.loadedAt = 0;
        renderLogin(params.authError ? "denied" : params.error);
        params.error = null;
        params.authError = null;
      }
    }, 0);
  });
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => { /* opcional */ });
  });
}
