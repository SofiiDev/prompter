/* FlorLovesRunning — estimación de macros con Claude
   POST /api/macros  { text: "2 huevos y una tostada", servings?: 4 }
   → { items: [{ name, quantity, kcal, p, c, f }], total: { kcal, p, c, f }, notes }
   Requiere sesión de Supabase. La API key vive solo en el servidor (ANTHROPIC_API_KEY). */

import Anthropic from "@anthropic-ai/sdk";
import { getUser, sameOrigin, ConfigError } from "../lib/server.mjs";

const MAX_CHARS = 3000;

const SYSTEM = `Eres un nutricionista que estima la información nutricional de comidas y recetas.
Desglosa el texto del usuario en alimentos o ingredientes y estima para cada uno las kcal y los gramos de proteína, carbohidratos y grasas de la cantidad indicada.
- Usa valores de referencia habituales (USDA, BEDCA) para el alimento tal como se describe: crudo o cocinado, con o sin piel, etc.
- Si falta la cantidad, asume una ración estándar y escríbela en "quantity" (por ejemplo "1 unidad (~120 g)").
- Interpreta medidas caseras de España y Latinoamérica (cda, cdta, taza, puñado, rebanada).
- "name" en español y breve. "notes": una o dos frases con las suposiciones importantes, o cadena vacía.
- Si el texto no describe alimentos, devuelve items vacío y explícalo en "notes".`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
        },
        required: ["name", "quantity", "kcal", "protein_g", "carbs_g", "fat_g"],
        additionalProperties: false,
      },
    },
    notes: { type: "string" },
  },
  required: ["items", "notes"],
  additionalProperties: false,
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const num = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);

  // solo Sofi y Flor: la IA cuesta dinero
  try {
    if (!(await getUser(req))) return json({ error: "Inicia sesión para usar la IA" }, 401);
  } catch (err) {
    if (err instanceof ConfigError) return json({ error: "La base de datos no está configurada en el servidor" }, 503);
    throw err;
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Petición no válida" }, 400);
  }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "Describe los alimentos o ingredientes" }, 400);
  if (text.length > MAX_CHARS) return json({ error: `El texto es demasiado largo (máx. ${MAX_CHARS} caracteres)` }, 400);
  const servings = Number.isFinite(body?.servings) && body.servings > 1 ? Math.min(100, body.servings) : 0;

  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "La IA no está configurada en el servidor. Introduce los macros a mano." }, 503);
  }
  const client = new Anthropic();

  const prompt = servings
    ? `Receta completa para ${servings} porciones. Estima los valores de la cantidad TOTAL de cada ingrediente (no por porción):\n\n${text}`
    : `Comida:\n\n${text}`;

  let res;
  try {
    res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: "Demasiadas peticiones a la IA. Prueba de nuevo en un minuto." }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return json({ error: "La IA no está disponible ahora mismo. Inténtalo más tarde." }, 502);
    }
    throw err;
  }

  if (res.stop_reason === "refusal") {
    return json({ error: "La IA no pudo procesar ese texto. Prueba a describirlo de otra forma." }, 422);
  }

  const out = res.content.find((b) => b.type === "text");
  let data;
  try {
    data = JSON.parse(out?.text ?? "");
  } catch {
    return json({ error: "La IA devolvió una respuesta incompleta. Inténtalo de nuevo." }, 502);
  }

  const items = (Array.isArray(data.items) ? data.items : []).slice(0, 60).map((i) => ({
    name: String(i.name || "").slice(0, 120),
    quantity: String(i.quantity || "").slice(0, 60),
    kcal: num(i.kcal),
    p: num(i.protein_g),
    c: num(i.carbs_g),
    f: num(i.fat_g),
  }));
  const total = ["kcal", "p", "c", "f"].reduce(
    (acc, k) => ({ ...acc, [k]: num(items.reduce((a, i) => a + i[k], 0)) }),
    {}
  );
  const notes = String(data.notes || "").slice(0, 500);

  if (!items.length) return json({ error: notes || "No encontré alimentos en ese texto." }, 422);
  return json({ items, total, notes });
};

export const config = { path: "/api/macros" };
