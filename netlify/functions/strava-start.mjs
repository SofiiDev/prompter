/* Ritmo — inicio del flujo OAuth de Strava
   GET  /api/strava/start            → redirige a Strava para iniciar sesión
   POST /api/strava/start (Bearer)   → { url } para conectar Strava a la cuenta actual */

import { json, redirect, env, getUser, makeState, sameOrigin, ConfigError } from "../lib/server.mjs";

function authorizeUrl(req, state) {
  const u = new URL("https://www.strava.com/oauth/authorize");
  u.search = new URLSearchParams({
    client_id: env("STRAVA_CLIENT_ID"),
    redirect_uri: new URL("/api/strava/callback", req.url).href,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  }).toString();
  return u.href;
}

export default async (req) => {
  try {
    if (req.method === "GET") {
      return redirect(authorizeUrl(req, makeState({ mode: "login" })));
    }
    if (req.method === "POST") {
      if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
      const user = await getUser(req);
      if (!user) return json({ error: "Inicia sesión primero" }, 401);
      return json({ url: authorizeUrl(req, makeState({ mode: "connect", uid: user.id })) });
    }
    return json({ error: "Método no permitido" }, 405);
  } catch (err) {
    if (err instanceof ConfigError) return json({ error: "Strava no está configurado en el servidor" }, 503);
    throw err;
  }
};

export const config = { path: "/api/strava/start" };
