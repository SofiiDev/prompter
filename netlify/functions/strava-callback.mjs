/* Ritmo — vuelta de Strava tras autorizar
   - mode "connect": guarda los tokens y vincula la atleta a la cuenta.
   - mode "login":   busca la cuenta vinculada a esa atleta y crea un
                     enlace de acceso de un solo uso que la app canjea. */

import { redirect, readState, supabaseAdmin, stravaTokenRequest, APP_PATH } from "../lib/server.mjs";

const back = (req, params) => {
  const u = new URL(APP_PATH, req.url);
  u.search = new URLSearchParams(params).toString();
  return redirect(u.href);
};

export default async (req) => {
  const url = new URL(req.url);
  const state = readState(url.searchParams.get("state"));
  if (!state) return back(req, { error: "strava_state" });
  if (url.searchParams.get("error")) return back(req, { error: "strava_denied" });

  const scope = url.searchParams.get("scope") || "";
  if (!scope.includes("activity:read")) return back(req, { error: "strava_scope" });

  let tok;
  try {
    tok = await stravaTokenRequest({ grant_type: "authorization_code", code: url.searchParams.get("code") });
  } catch (err) {
    console.error(err);
    return back(req, { error: "strava_token" });
  }

  const db = supabaseAdmin();
  const athleteId = tok.athlete?.id;
  const tokenRow = {
    athlete_id: athleteId,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: new Date(tok.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (state.mode === "connect") {
    // si esta atleta estaba vinculada a la otra cuenta, se desvincula de ella
    await db.from("strava_tokens").delete().eq("athlete_id", athleteId).neq("user_id", state.uid);
    await db.from("profiles").update({ strava_athlete_id: null }).eq("strava_athlete_id", athleteId).neq("id", state.uid);

    const { error: e1 } = await db.from("strava_tokens").upsert({ user_id: state.uid, ...tokenRow });
    const { error: e2 } = await db.from("profiles").update({ strava_athlete_id: athleteId }).eq("id", state.uid);
    if (e1 || e2) {
      console.error(e1 || e2);
      return back(req, { error: "strava_save" });
    }
    return back(req, { strava: "connected" });
  }

  // login
  const { data: profile } = await db.from("profiles").select("id, email").eq("strava_athlete_id", athleteId).maybeSingle();
  if (!profile) return back(req, { error: "strava_unlinked" });

  await db.from("strava_tokens").upsert({ user_id: profile.id, ...tokenRow });
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: profile.email });
  if (error) {
    console.error(error);
    return back(req, { error: "strava_login" });
  }
  return back(req, { login: data.properties.hashed_token });
};

export const config = { path: "/api/strava/callback" };
