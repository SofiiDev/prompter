/* Ritmo — almacenamiento local
   Todo vive en localStorage del dispositivo. Al leer se valida y
   acota cada campo para que datos corruptos no rompan la app. */

const KEY = "ritmo:v1";

export const DEFAULT_GOALS = { kcal: 2200, p: 140, c: 250, f: 70, sleep: 8, km: 30 };

const num = (v, min = 0, max = 1e6) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};
const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v) => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
const id = (v) => (typeof v === "string" && v.length <= 40 ? v : uid());

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const clean = {
  run: (r) => isDate(r?.date) && {
    id: id(r.id), date: r.date,
    km: num(r.km, 0, 1000), sec: num(r.sec, 0, 360000),
    type: str(r.type, 20) || "suave", notes: str(r.notes, 500),
  },
  meal: (m) => isDate(m?.date) && {
    id: id(m.id), date: m.date, time: isTime(m.time) ? m.time : "12:00",
    slot: str(m.slot, 20) || "comida", name: str(m.name, 120) || "Comida",
    kcal: num(m.kcal, 0, 20000), p: num(m.p, 0, 2000), c: num(m.c, 0, 2000), f: num(m.f, 0, 2000),
    recipeId: str(m.recipeId, 40), servings: num(m.servings, 0, 100),
    items: cleanItems(m.items), note: str(m.note, 500), desc: str(m.desc, 3000),
  },
  recipe: (r) => r && typeof r === "object" && {
    id: id(r.id), name: str(r.name, 120) || "Receta",
    servings: num(r.servings, 1, 100) || 1, ingredients: str(r.ingredients, 4000),
    kcal: num(r.kcal, 0, 100000), p: num(r.p, 0, 10000), c: num(r.c, 0, 10000), f: num(r.f, 0, 10000),
    items: cleanItems(r.items), note: str(r.note, 500),
  },
  sleep: (s) => isDate(s?.date) && {
    id: id(s.id), date: s.date,
    bed: isTime(s.bed) ? s.bed : "23:00", wake: isTime(s.wake) ? s.wake : "07:00",
    hours: num(s.hours, 0, 24), quality: num(s.quality, 1, 5) || 3, notes: str(s.notes, 500),
  },
};

function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 60).map((i) => ({
    name: str(i?.name, 120), quantity: str(i?.quantity, 60),
    kcal: num(i?.kcal, 0, 20000), p: num(i?.p, 0, 2000), c: num(i?.c, 0, 2000), f: num(i?.f, 0, 2000),
  }));
}

function cleanAll(raw) {
  const list = (arr, fn) => (Array.isArray(arr) ? arr.map(fn).filter(Boolean) : []);
  const g = raw?.goals || {};
  return {
    runs: list(raw?.runs, clean.run),
    meals: list(raw?.meals, clean.meal),
    recipes: list(raw?.recipes, clean.recipe),
    sleep: list(raw?.sleep, clean.sleep),
    goals: {
      kcal: num(g.kcal, 500, 10000) || DEFAULT_GOALS.kcal,
      p: num(g.p, 0, 1000) || DEFAULT_GOALS.p,
      c: num(g.c, 0, 2000) || DEFAULT_GOALS.c,
      f: num(g.f, 0, 1000) || DEFAULT_GOALS.f,
      sleep: num(g.sleep, 1, 14) || DEFAULT_GOALS.sleep,
      km: num(g.km, 0, 1000) || DEFAULT_GOALS.km,
    },
  };
}

function load() {
  try {
    return cleanAll(JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    return cleanAll({});
  }
}

export const db = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

/** Inserta o reemplaza un registro (por id) en una colección. */
export function upsert(collection, record) {
  const fn = clean[{ runs: "run", meals: "meal", recipes: "recipe", sleep: "sleep" }[collection]];
  const rec = fn(record);
  if (!rec) return null;
  const list = db[collection];
  const i = list.findIndex((x) => x.id === rec.id);
  if (i >= 0) list[i] = rec; else list.push(rec);
  save();
  return rec;
}

export function remove(collection, recId) {
  db[collection] = db[collection].filter((x) => x.id !== recId);
  save();
}

export function setGoals(goals) {
  db.goals = cleanAll({ goals }).goals;
  save();
}

export function exportJSON() {
  return JSON.stringify({ app: "ritmo", version: 1, exported: new Date().toISOString(), ...db }, null, 2);
}

export function importJSON(text) {
  const next = cleanAll(JSON.parse(text));
  Object.assign(db, next);
  save();
}

export function wipe() {
  Object.assign(db, cleanAll({}));
  save();
}
