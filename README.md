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

App móvil (PWA instalable) para registrar entrenamiento, alimentación y descanso:

- **Correr**: kilómetros, tiempo (h:min:s) y tipo de entrenamiento. Calcula ritmo por km y velocidad, km de la semana frente a tu objetivo, ritmo medio del mes y gráfico de los últimos 7 días.
- **Comidas**: registra por momento del día (desayuno, comida, merienda, cena, snack) con proteína, carbohidratos, grasas y calorías. Tres formas de rellenar los macros:
  1. **Con IA**: describe lo que comiste («2 huevos y una tostada con aguacate») y Claude desglosa cada alimento con sus macros.
  2. **Desde una receta**: elige la receta y las porciones.
  3. **A mano**: las calorías se calculan solas desde los macros (4/4/9 kcal/g).
- **Recetas**: ingredientes uno por línea con cantidades para la receta completa; la IA calcula los macros de cada ingrediente y el total, y la app los divide por porción. Desde la receta registras una porción en un toque.
- **Sueño**: hora de acostarte y levantarte (cruza medianoche), calidad 1–5, media de 7 días y déficit frente a tu objetivo.
- **Hoy**: anillo de calorías restantes, barras de macros, resumen semanal y registro rápido.
- **Ajustes**: objetivos diarios, exportar/importar copia de seguridad en JSON y borrar datos.

Los datos se guardan solo en el dispositivo (`localStorage`) y la app funciona sin conexión (salvo el cálculo con IA).

## Diseño UX/UI

- Tipografía **Inter**: diseñada para pantallas, muy legible en tamaños pequeños, con **cifras tabulares** (`tabular-nums`) para que los números se alineen en tablas y no «bailen» al cambiar.
- Escala tipográfica 1.25 sobre base 16 px (evita el zoom automático de iOS en los campos), rejilla de 8 px y objetivos táctiles de al menos 44 px.
- Tema claro y oscuro automáticos, con contraste WCAG AA. Color con significado constante: naranja = correr, violeta = sueño, y un color fijo por macro.
- Barra de pestañas inferior (alcance del pulgar), formularios en hojas inferiores, botón flotante para la acción principal, teclado numérico/decimal, aceptación de coma decimal y cálculos en vivo (ritmo, horas dormidas, kcal por porción).
- Accesible: etiquetas en todos los campos, foco visible, `aria-current` en la navegación, barras de progreso con roles ARIA y respeto de `prefers-reduced-motion`.

## IA (Claude)

`POST /api/macros` es una función de Netlify (`netlify/functions/macros.mjs`) que llama a la API de Claude con salida estructurada (JSON Schema). La API key **nunca llega al navegador**.

1. Crea una API key en <https://platform.claude.com>.
2. En Netlify: *Site configuration → Environment variables* → `ANTHROPIC_API_KEY`.
3. Netlify instala `@anthropic-ai/sdk` desde `package.json` en el despliegue.

Si la variable no está configurada, la app sigue funcionando y pide los macros a mano.

Desarrollo local con la función: `npx netlify dev` (con `ANTHROPIC_API_KEY` en el entorno) y abre `/ritmo/`.
