/* FlorLovesRunning — trae las carreras nuevas de Strava
   POST /api/strava/sync (Bearer)            → { added, total }
   POST /api/strava/sync { disconnect: true } → desvincula Strava
   Las actividades de Garmin llegan a Strava solas; aquí se importan
   solo las de tipo carrera y nunca se pisan las ya importadas. */

import { json, getUser, sameOrigin, supabaseAdmin, stravaAccessToken, ConfigError } from "../lib/server.mjs";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
// workout_type de Strava para carreras: 1 carrera, 2 tirada larga, 3 entrenamiento
const TYPE = { 1: "carrera", 2: "largo", 3: "series" };
const MAX_PAGES = 10; // hasta 1000 actividades por sincronización

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Inicia sesión primero" }, 401);
    const db = supabaseAdmin();
    const body = await req.json().catch(() => ({}));

    if (body.disconnect) {
      await db.from("strava_tokens").delete().eq("user_id", user.id);
      await db.from("profiles").update({ strava_athlete_id: null, strava_synced_at: null }).eq("id", user.id);
      return json({ ok: true });
    }

    const token = await stravaAccessToken(user.id);
    if (!token) return json({ error: "Conecta Strava primero" }, 409);

    // desde la última carrera importada (con 1 día de margen), o todo el historial
    const { data: last } = await db.from("runs").select("date")
      .eq("user_id", user.id).eq("source", "strava").order("date", { ascending: false }).limit(1).maybeSingle();
    const after = last ? Math.floor(new Date(last.date).getTime() / 1000) - 86400 : 0;

    const rows = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 429) return json({ error: "Strava limita las peticiones. Prueba en 15 minutos." }, 429);
      if (!res.ok) return json({ error: "Strava no respondió. Inténtalo más tarde." }, 502);
      const list = await res.json();
      for (const a of list) {
        if (!RUN_TYPES.has(a.sport_type || a.type)) continue;
        rows.push({
          user_id: user.id,
          date: a.start_date_local.slice(0, 10),
          km: Math.round(a.distance / 10) / 100,
          sec: a.moving_time,
          type: TYPE[a.workout_type] || (a.sport_type === "TrailRun" ? "largo" : "suave"),
          notes: a.name || "",
          source: "strava",
          strava_id: a.id,
          elevation: a.total_elevation_gain ?? null,
          avg_hr: a.average_heartrate ?? null,
        });
      }
      if (list.length < 100) break;
    }

    let added = 0;
    if (rows.length) {
      const { data, error } = await db.from("runs")
        .upsert(rows, { onConflict: "strava_id", ignoreDuplicates: true }).select("id");
      if (error) throw error;
      added = data.length;
    }
    await db.from("profiles").update({ strava_synced_at: new Date().toISOString() }).eq("id", user.id);
    return json({ added, total: rows.length });
  } catch (err) {
    if (err instanceof ConfigError) return json({ error: "Strava no está configurado en el servidor" }, 503);
    console.error(err);
    return json({ error: "No se pudo sincronizar con Strava" }, 500);
  }
};

export const config = { path: "/api/strava/sync" };
