-- ============================================================
-- FlorLovesRunning — esquema de Supabase
-- Ejecuta este archivo completo en Supabase → SQL Editor → New query.
-- Es idempotente: puedes volver a ejecutarlo tras cambios.
-- ============================================================

-- ---------- Usuarias permitidas ----------
-- Solo estos emails pueden crear cuenta. Cambia los dos emails de abajo
-- por los de Sofi y Flor (en minúsculas) antes de ejecutar.
create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  name  text not null
);

insert into public.allowed_emails (email, name) values
  ('sofi@example.com', 'Sofi'),
  ('flor@example.com', 'Flor')
on conflict (email) do update set name = excluded.name;

alter table public.allowed_emails enable row level security;
-- sin políticas: nadie la lee desde el navegador

create or replace function public.is_allowed()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Perfiles ----------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  name              text not null,
  goals             jsonb not null default '{"kcal":2200,"p":140,"c":250,"f":70,"sleep":8,"km":30}',
  strava_athlete_id bigint unique,
  strava_synced_at  timestamptz,
  created_at        timestamptz not null default now()
);
-- altura para calcular el IMC (añadida después: idempotente)
alter table public.profiles add column if not exists height_cm numeric(5,1)
  check (height_cm is null or height_cm between 100 and 250);

-- Al crear una cuenta: rechazar emails no permitidos y crear su perfil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  allowed_name text;
begin
  select name into allowed_name from public.allowed_emails where email = lower(new.email);
  if allowed_name is null then
    raise exception 'FlorLovesRunning es privada: este email no tiene acceso';
  end if;
  insert into public.profiles (id, email, name)
  values (new.id, lower(new.email), allowed_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- AFTER INSERT: si el email no está permitido, la excepción deshace el alta.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Carreras ----------
create table if not exists public.runs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  km         numeric(7,2) not null check (km >= 0),
  sec        integer not null default 0 check (sec >= 0),
  type       text not null default 'suave',
  notes      text not null default '',
  source     text not null default 'manual' check (source in ('manual', 'strava')),
  strava_id  bigint unique,
  elevation  numeric(7,1),
  avg_hr     numeric(5,1),
  created_at timestamptz not null default now()
);
create index if not exists runs_user_date on public.runs (user_id, date desc);

-- ---------- Recetas (compartidas entre Sofi y Flor) ----------
create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  servings    numeric(5,1) not null default 1 check (servings > 0),
  ingredients text not null default '',
  kcal        numeric(8,1) not null default 0,
  p           numeric(7,1) not null default 0,
  c           numeric(7,1) not null default 0,
  f           numeric(7,1) not null default 0,
  items       jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);

-- ---------- Comidas ----------
create table if not exists public.meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  time        time not null default '12:00',
  slot        text not null default 'comida',
  name        text not null,
  kcal        numeric(8,1) not null default 0,
  p           numeric(7,1) not null default 0,
  c           numeric(7,1) not null default 0,
  f           numeric(7,1) not null default 0,
  recipe_id   uuid references public.recipes (id) on delete set null,
  servings    numeric(5,2) not null default 0,
  items       jsonb not null default '[]',
  description text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists meals_user_date on public.meals (user_id, date desc);

-- ---------- Sueño ----------
create table if not exists public.sleep (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  bed        time not null,
  wake       time not null,
  hours      numeric(4,2) not null check (hours between 0 and 24),
  quality    smallint not null default 3 check (quality between 1 and 5),
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists sleep_user_date on public.sleep (user_id, date desc);

-- ---------- Peso y composición corporal ----------
create table if not exists public.body_metrics (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date         date not null,
  weight_kg    numeric(5,2) not null check (weight_kg between 20 and 400),
  body_fat_pct numeric(4,1) check (body_fat_pct is null or body_fat_pct between 2 and 75),
  notes        text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists body_metrics_user_date on public.body_metrics (user_id, date desc);

-- ---------- Tokens de Strava (solo el servidor) ----------
create table if not exists public.strava_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  athlete_id    bigint not null unique,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- Seguridad a nivel de fila: cada una ve y edita solo lo suyo;
-- las recetas son compartidas entre las usuarias permitidas.
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.runs          enable row level security;
alter table public.recipes       enable row level security;
alter table public.meals         enable row level security;
alter table public.sleep         enable row level security;
alter table public.body_metrics  enable row level security;
alter table public.strava_tokens enable row level security;  -- sin políticas: solo service role

drop policy if exists "perfil propio: leer" on public.profiles;
create policy "perfil propio: leer" on public.profiles
  for select using (id = auth.uid());
drop policy if exists "perfil propio: editar" on public.profiles;
create policy "perfil propio: editar" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Las usuarias no pueden cambiar su email, nombre ni vínculo de Strava desde el navegador.
revoke update on public.profiles from anon, authenticated;
grant update (goals, height_cm) on public.profiles to authenticated;

do $$
declare t text;
begin
  foreach t in array array['runs', 'meals', 'sleep', 'body_metrics'] loop
    execute format('drop policy if exists "filas propias" on public.%I', t);
    execute format(
      'create policy "filas propias" on public.%I for all
         using (user_id = auth.uid() and public.is_allowed())
         with check (user_id = auth.uid() and public.is_allowed())', t);
  end loop;
end $$;

drop policy if exists "recetas compartidas" on public.recipes;
create policy "recetas compartidas" on public.recipes
  for all using (public.is_allowed()) with check (public.is_allowed());
