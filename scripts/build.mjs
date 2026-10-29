/* Ritmo — paso de build de Netlify (npm run build)
   1. Copia el cliente de Supabase a ritmo/vendor (la CSP solo permite scripts propios).
   2. Escribe ritmo/js/config.js con la configuración PÚBLICA de Supabase
      (URL y anon key; la seguridad la dan las políticas RLS).
   Nunca escribe aquí claves secretas. */

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = join(dirname(new URL(import.meta.url).pathname), "..");

const umd = join(dirname(require.resolve("@supabase/supabase-js/package.json")), "dist/umd/supabase.js");
mkdirSync(join(root, "ritmo/vendor"), { recursive: true });
copyFileSync(umd, join(root, "ritmo/vendor/supabase.js"));

const url = process.env.SUPABASE_URL || "";
const anon = process.env.SUPABASE_ANON_KEY || "";
if (!url || !anon) console.warn("⚠️  Faltan SUPABASE_URL o SUPABASE_ANON_KEY: la app mostrará un aviso de configuración.");
if (/service_role/.test(Buffer.from(anon.split(".")[1] || "", "base64url").toString())) {
  throw new Error("SUPABASE_ANON_KEY contiene la service role key: usa la anon (public) key.");
}

writeFileSync(join(root, "ritmo/js/config.js"),
  `/* generado por scripts/build.mjs */\nwindow.RITMO_CONFIG = ${JSON.stringify({ supabaseUrl: url, supabaseAnonKey: anon })};\n`);
console.log("Ritmo: vendor/supabase.js y js/config.js listos");
