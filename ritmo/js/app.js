/* Ritmo — app principal
   Vistas: Hoy · Correr · Comidas · Recetas · Sueño (+ Ajustes).
   Todo el contenido del usuario se inserta como texto (nunca HTML). */

import { db, upsert, remove, setGoals, exportJSON, importJSON, wipe, uid } from "./store.js";

/* ============ utilidades ============ */

// Solo para iconos constantes del propio código: nunca datos del usuario.
const ICON = {
  today: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  runs: '<circle cx="13.5" cy="4.5" r="1.8"/><path d="M7 21l3.5-6 3 2.5V22M6.5 11.5 9 8l4 1 2.5 3.5H19M13 9l-2.5 6"/>',
  meals: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M5 3v8M17 21V3c-2 1.5-3 4-3 7v4h3"/>',
  recipes: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
  sleep: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
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
  const idv = input.id || (input.id = "f" + uid());
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

async function estimateMacros(text, servings) {
  const res = await fetch("/api/macros", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

function formActions(onDelete, saveLabel = "Guardar") {
  return h("div", { class: "actions" },
    onDelete && h("button", {
      type: "button", class: "btn danger",
      onclick: () => { if (confirm("¿Eliminar este registro? No se puede deshacer.")) onDelete(); },
    }, "Eliminar"),
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

function settingsSheet() {
  const g = db.goals;
  const inputs = {
    kcal: numInput("kcal", g.kcal, { int: true }), p: numInput("p", g.p, { int: true }),
    c: numInput("c", g.c, { int: true }), f: numInput("f", g.f, { int: true }),
    sleep: numInput("sleep", g.sleep), km: numInput("km", g.km),
  };
  const fileIn = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  fileIn.addEventListener("change", async () => {
    const file = fileIn.files[0];
    if (!file) return;
    try {
      importJSON(await file.text());
      closeSheet(); toast("Datos importados"); render();
    } catch {
      toast("El archivo no es una copia válida de Ritmo");
    }
  });

  const form = sheetForm(() => {
    setGoals(Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, readNum(i)])));
    closeSheet(); toast("Objetivos guardados"); render();
  },
    h("h3", { style: "margin-bottom:12px" }, "Objetivos diarios"),
    field("Calorías (kcal)", inputs.kcal),
    h("div", { class: "row" }, field("Proteína (g)", inputs.p), field("Carbos (g)", inputs.c), field("Grasas (g)", inputs.f)),
    h("div", { class: "row" }, field("Sueño (h/noche)", inputs.sleep), field("Km por semana", inputs.km)),
    h("button", { type: "submit", class: "btn primary block" }, "Guardar objetivos"),

    h("h3", { style: "margin:32px 0 8px" }, "Tus datos"),
    h("p", { class: "muted", style: "margin-bottom:12px" },
      "Todo se guarda solo en este dispositivo. Haz una copia de seguridad para no perderlo o pasarlo a otro móvil."),
    h("div", { class: "actions" },
      h("button", { type: "button", class: "btn ghost", onclick: downloadBackup }, "Exportar"),
      h("button", { type: "button", class: "btn ghost", onclick: () => fileIn.click() }, "Importar")),
    fileIn,
    h("button", {
      type: "button", class: "btn danger block", style: "margin-top:12px",
      onclick: () => {
        if (confirm("¿Borrar todos tus registros, recetas y objetivos? No se puede deshacer.")) {
          wipe(); closeSheet(); toast("Datos borrados"); render();
        }
      },
    }, "Borrar todos los datos"),
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
        h("span", { class: "item-sub", style: "display:block" }, dayLabel(r.date), r.notes && ` · ${r.notes}`)),
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

const state = { view: "today", mealDate: todayISO() };

const VIEWS = {
  today: { title: "Hoy", render: viewToday },
  runs: { title: "Correr", render: viewRuns },
  meals: { title: "Comidas", render: viewMeals },
  recipes: { title: "Recetas", render: viewRecipes },
  sleep: { title: "Sueño", render: viewSleep },
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

  return [
    h("p", { class: "muted", style: "margin:-4px 0 16px" },
      capitalize(new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }))),
    nutritionCard(meals, "Nutrición"),
    h("section", { class: "card", "aria-label": "Resumen de la semana" },
      h("div", { class: "card-head" }, h("h2", {}, "Esta semana")),
      h("div", { class: "stats" },
        stat(fmt1(weekKm), `/ ${fmt0(g.km)} km`, `${weekRuns.length} ${weekRuns.length === 1 ? "carrera" : "carreras"}`),
        stat(lastSleep ? fmt1(lastSleep.hours) : "—", "h", lastSleep ? `Último sueño (${dayLabel(lastSleep.date).toLowerCase()})` : "Sin registros de sueño"),
        stat(avgSleep ? fmt1(avgSleep) : "—", `/ ${fmt1(g.sleep)} h`, "Media de sueño 7 días")),
      h("div", { class: "bar", style: "margin-top:16px", role: "progressbar", "aria-label": "Kilómetros de la semana", "aria-valuemin": 0, "aria-valuemax": g.km, "aria-valuenow": round1(weekKm) },
        h("i", { style: `width:${g.km ? Math.min(100, (weekKm / g.km) * 100) : 0}%;background:var(--run)` }))),
    h("section", { class: "card", "aria-label": "Registro rápido" },
      h("div", { class: "card-head" }, h("h2", {}, "Registrar")),
      h("div", { class: "actions", style: "margin:0;flex-wrap:wrap" },
        h("button", { type: "button", class: "btn ghost", icon: "runs", onclick: () => runForm() }, "Carrera"),
        h("button", { type: "button", class: "btn ghost", icon: "meals", onclick: () => mealForm() }, "Comida"),
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
    h("p", { class: "muted", style: "margin-bottom:16px" },
      "Guarda tus recetas con sus ingredientes: la IA calcula los macros y luego registras porciones en un toque."),
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
  document.title = `${v.title} · Ritmo`;
  tabs.forEach((b) => {
    if (b.dataset.view === state.view) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  viewEl.replaceChildren(...[v.render()].flat(Infinity).filter(Boolean));
}

window.addEventListener("hashchange", () => go(location.hash.slice(1)));
go(location.hash.slice(1) || "today");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => { /* opcional */ });
  });
}
