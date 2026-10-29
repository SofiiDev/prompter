# EasyPrompter

Teleprompter flotante para videollamadas. El guion se desliza en una mini ventana **siempre visible** que colocas justo debajo de tu webcam, para mantener el contacto visual en Zoom, Meet o grabaciones.

## Características

- **Ventana flotante siempre encima** de cualquier app (Zoom incluido), mediante la API Document Picture-in-Picture de Chrome y Edge. En navegadores de escritorio sin soporte se abre un popup independiente.
- **Flotante también en el móvil**: el guion se dibuja en un canvas y se emite como video en Picture-in-Picture, así la ventanita queda **sobre TikTok, Instagram, la cámara o cualquier app**. Un worker mantiene el desplazamiento aunque el navegador quede en segundo plano, y puedes pausar/reanudar desde los controles de la propia ventanita. Si el dispositivo no soporta PiP de video, se usa pantalla completa.
- **Tres temas de lectura**: negro, lectura (sepia) y blanco.
- **Ventana adaptable**: estira la mini ventana al tamaño que quieras; EasyPrompter lo recuerda para la próxima vez.
- **Instalable como app (PWA)**: ancla EasyPrompter a la barra de tareas o a la pantalla de inicio del móvil, con su propia ventana y funcionamiento sin conexión.
- **Uso en móvil**: interfaz táctil adaptada y pantalla siempre encendida mientras lees (Wake Lock).
- Desplazamiento suave con velocidad y tamaño de letra ajustables en vivo.
- Modo espejo para teleprompters físicos de cristal.
- El guion y los ajustes se guardan automáticamente en el navegador.
- Atajos de teclado: `Espacio` pausa · `↑ ↓` velocidad · `← →` saltar · `R` reiniciar · `Esc` salir.

## Uso

1. Abre el sitio y pega tu guion.
2. Pulsa **Flotar junto a la cámara**.
3. Arrastra la mini ventana hasta debajo de tu webcam y entra a tu llamada.

> La ventana flotante requiere Chrome o Edge 116+. El botón **Pantalla completa** funciona en cualquier navegador y es el modo que se usa en móvil.

### Anclar a la barra de tareas

1. En Chrome o Edge, abre el sitio y pulsa el icono de **instalar** en la barra de direcciones (o menú ⋮ → **Instalar EasyPrompter**).
2. La app se abre en su propia ventana. Haz clic derecho sobre su icono en la barra de tareas → **Anclar a la barra de tareas**.
3. En el móvil: menú del navegador → **Añadir a pantalla de inicio**.

## Seguridad

- **Content Security Policy** estricta (meta + cabeceras de Netlify): solo se permiten recursos del propio sitio y las fuentes de Google; nada de scripts inline, iframes ni envíos de formularios.
- `frame-ancestors 'none'` y `X-Frame-Options: DENY` impiden embeber la app en iframes (clickjacking).
- `Permissions-Policy` niega cámara, micrófono, geolocalización y sensores: la app no los necesita.
- HSTS fuerza HTTPS en Netlify.
- Todo lo leído de `localStorage` se valida y acota antes de usarse, y el guion se inserta siempre como texto plano (`textContent`), nunca como HTML.
- El service worker solo cachea peticiones GET del propio origen.

## Desarrollo local

Es un sitio estático sin dependencias ni paso de build:

```bash
npx serve .
# o simplemente abre index.html en el navegador
```

## Despliegue en Netlify desde GitHub

1. Sube el código a un repositorio de GitHub.
2. En [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project → GitHub** y elige el repositorio.
3. Netlify detecta `netlify.toml`; deja el comando de build vacío y el directorio de publicación en `.`. Pulsa **Deploy**.

Cada `git push` a la rama publicada desplegará automáticamente una nueva versión.

## Estructura

```
├── index.html            # Interfaz: editor y franja del prompter
├── css/styles.css        # Estilos y temas (Instrument Sans + Spline Sans Mono)
├── js/app.js             # Motor de scroll, ventanas flotantes, temas y persistencia
├── js/ticker.js          # Worker: mantiene el scroll móvil en segundo plano
├── sw.js                 # Service worker (PWA, caché del propio origen)
├── manifest.webmanifest  # Manifiesto de instalación
├── icons/                # Icono de la app (SVG + PNG)
└── netlify.toml          # Despliegue y cabeceras de seguridad
```

## Licencia

MIT

---

# Ritmo (`/ritmo/`)

App móvil privada (PWA instalable) para **Sofi y Flor**: carreras, comidas, recetas y sueño, con datos en **Supabase**, acceso con **Google** o **Strava**, importación automática de carreras de **Garmin** (vía Strava) y cálculo de macros con **IA**.

## Qué hace

- **Correr**: km, tiempo y tipo. Ritmo por km, km semanales frente al objetivo, ritmo medio del mes y gráfico de 7 días. Las carreras de Strava llegan solas, con desnivel y pulso medio.
- **Comidas**: macros a mano, desde una receta o estimados por IA a partir de una descripción («2 huevos y una tostada con aguacate»).
- **Recetas**: ingredientes con cantidades; la IA calcula los macros totales y por porción. **Las recetas son compartidas** entre Sofi y Flor.
- **Sueño**: horas, calidad, media de 7 días y déficit frente al objetivo.
- **Ajustes**: objetivos, conexión con Strava, exportar/importar copia, borrar registros y cerrar sesión.

Carreras, comidas, sueño y objetivos son **privados** de cada una (políticas RLS en Supabase).

## Cómo funciona

| Pieza | Dónde |
|---|---|
| App (HTML/CSS/JS sin framework) | `ritmo/` |
| Base de datos, login y seguridad | Supabase — esquema en `supabase/schema.sql` |
| IA de macros (Claude) | `netlify/functions/macros.mjs` → `POST /api/macros` |
| Strava: login, conexión y sincronización | `netlify/functions/strava-*.mjs` → `/api/strava/*` |
| Build (cliente de Supabase + configuración pública) | `scripts/build.mjs` (`npm run build`) |

- Solo los dos emails de la tabla `allowed_emails` pueden crear cuenta: lo impide un trigger en la base de datos, no solo la app.
- **Strava como login**: Strava no da el email, así que la primera vez se entra con Google y se conecta Strava en Ajustes; desde entonces el botón «Continuar con Strava» abre la sesión de esa cuenta.
- **Garmin**: el reloj sincroniza con Garmin Connect, Garmin Connect envía cada actividad a Strava, y Ritmo importa las carreras nuevas al abrirla (cada 3 h) o con «Sincronizar».
- Las claves secretas (service role de Supabase, Strava, Anthropic) solo existen en las funciones de Netlify.

## Puesta en marcha (una sola vez)

### 1. Supabase

1. Crea un proyecto en <https://supabase.com>.
2. Abre `supabase/schema.sql`, **cambia los dos emails** (`sofi@example.com`, `flor@example.com`) por los Gmail reales de Sofi y Flor, y ejecútalo en **SQL Editor → New query → Run**.
3. En **Project Settings → API** copia: *Project URL*, la clave pública (*anon* o *publishable*) y la *service_role* (o *secret*).

### 2. Google (inicio de sesión con Gmail)

1. En <https://console.cloud.google.com> → *APIs y servicios → Credenciales* → **Crear ID de cliente OAuth** (tipo *Aplicación web*).
2. *URI de redireccionamiento autorizados*: `https://<tu-proyecto>.supabase.co/auth/v1/callback` (aparece en Supabase al activar Google).
3. En la *pantalla de consentimiento* añade los emails de Sofi y Flor como usuarias de prueba (o publícala).
4. En Supabase → **Authentication → Sign In / Providers → Google**: actívalo y pega el *Client ID* y el *Client secret*.
5. En Supabase → **Authentication → URL Configuration**:
   - *Site URL*: `https://<tu-sitio>.netlify.app/ritmo/`
   - *Redirect URLs*: `https://<tu-sitio>.netlify.app/ritmo/`
6. Deja activado el proveedor **Email** (lo usa el acceso con Strava por dentro; no se envían correos).

### 3. Strava

1. En <https://www.strava.com/settings/api> crea una aplicación.
2. *Authorization Callback Domain*: `<tu-sitio>.netlify.app` (solo el dominio).
3. Copia *Client ID* y *Client Secret*.
4. Sofi y Flor: en **Garmin Connect → Ajustes → Aplicaciones conectadas → Strava**, activad la sincronización.

> Una app nueva de Strava admite pocas atletas conectadas; para dos personas sobra.

### 4. Netlify

1. **Add new site → Import an existing project → GitHub** y elige este repositorio. Netlify lee `netlify.toml` (build `npm run build`, publica la raíz).
2. **Site configuration → Environment variables**:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_ANON_KEY` | clave pública (*anon* / *publishable*) |
| `SUPABASE_SERVICE_ROLE_KEY` | clave *service_role* / *secret* (marca *Functions* como único alcance si puedes) |
| `STRAVA_CLIENT_ID` | de Strava |
| `STRAVA_CLIENT_SECRET` | de Strava |
| `STATE_SECRET` | una cadena aleatoria larga (p. ej. `openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | de <https://platform.claude.com> (para la IA de macros) |

3. **Deploys → Trigger deploy**. Abre `https://<tu-sitio>.netlify.app/ritmo/`, entra con Google y conecta Strava en Ajustes.
4. En el móvil: menú del navegador → **Añadir a pantalla de inicio**.

Cada `git push` a la rama conectada vuelve a desplegar.

### Pasar los datos de la versión de prueba

Si usaste la versión local o la vista previa: **Ajustes → Exportar** allí, y **Ajustes → Importar** en la app desplegada.

## Diseño UX/UI

- Tipografía **Inter**: diseñada para pantallas, muy legible en tamaños pequeños, con **cifras tabulares** para que los números se alineen y no «bailen».
- Escala tipográfica 1.25 sobre base 16 px (evita el zoom de iOS en los campos), rejilla de 8 px y objetivos táctiles ≥ 44 px.
- Tema claro y oscuro automáticos con contraste WCAG AA; color con significado constante (naranja = correr, violeta = sueño, un color por macro).
- Pestañas abajo (alcance del pulgar), formularios en hojas inferiores, teclado numérico, coma decimal y cálculos en vivo.
- Accesible: etiquetas en todos los campos, foco visible, `aria-current`, roles ARIA en barras de progreso y `prefers-reduced-motion`.

## Desarrollo local

```bash
npm install
npx netlify dev        # con las variables de entorno de arriba en un .env
# abre http://localhost:8888/ritmo/
```
