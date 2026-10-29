/* Ritmo — utilidades compartidas por las funciones de Netlify.
   Las claves secretas (service role de Supabase, Strava, Anthropic)
   solo existen aquí, en el servidor. */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const APP_PATH = "/ritmo/";

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export const redirect = (url) =>
  new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });

export function env(name) {
  const v = process.env[name];
  if (!v) throw new ConfigError(name);
  return v;
}

export class ConfigError extends Error {
  constructor(name) {
    super(`Falta la variable de entorno ${name}`);
    this.variable = name;
  }
}

let admin;
/** Cliente de Supabase con service role: ignora RLS, usar con cuidado. */
export function supabaseAdmin() {
  admin ??= createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** Devuelve la usuaria del token `Authorization: Bearer …`, o null. */
export async function getUser(req) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}

/** Rechaza peticiones POST de otros sitios. */
export function sameOrigin(req) {
  const origin = req.headers.get("origin");
  return !origin || new URL(origin).host === new URL(req.url).host;
}

/* ---------- state firmado para OAuth (sin base de datos) ---------- */

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const sign = (payload) => b64(createHmac("sha256", env("STATE_SECRET")).update(payload).digest());

export function makeState(data, ttlSec = 600) {
  const payload = b64(JSON.stringify({ ...data, n: b64(randomBytes(9)), exp: Date.now() + ttlSec * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function readState(state) {
  const [payload, mac] = String(state || "").split(".");
  if (!payload || !mac) return null;
  const a = Buffer.from(mac), b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

/* ---------- Strava ---------- */

export async function stravaTokenRequest(params) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env("STRAVA_CLIENT_ID"),
      client_secret: env("STRAVA_CLIENT_SECRET"),
      ...params,
    }),
  });
  if (!res.ok) throw new Error(`Strava token ${res.status}`);
  return res.json();
}

/** Access token vigente de la usuaria; lo renueva si caducó. null si no conectó Strava. */
export async function stravaAccessToken(userId) {
  const db = supabaseAdmin();
  const { data: tok, error } = await db.from("strava_tokens").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!tok) return null;
  if (new Date(tok.expires_at).getTime() - Date.now() > 120_000) return tok.access_token;

  const fresh = await stravaTokenRequest({ grant_type: "refresh_token", refresh_token: tok.refresh_token });
  await db.from("strava_tokens").update({
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token,
    expires_at: new Date(fresh.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  return fresh.access_token;
}
