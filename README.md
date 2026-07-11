# CuePoint

Teleprompter flotante para videollamadas. El guion se desliza en una mini ventana **siempre visible** que colocas justo debajo de tu webcam, para mantener el contacto visual en Zoom, Meet o grabaciones.

## Características

- **Ventana flotante siempre encima** de cualquier app (Zoom incluido), mediante la API Document Picture-in-Picture de Chrome y Edge. En navegadores sin soporte se abre un popup independiente.
- Desplazamiento suave con velocidad y tamaño de letra ajustables en vivo.
- Modo espejo para teleprompters físicos de cristal.
- El guion y los ajustes se guardan automáticamente en el navegador.
- Atajos de teclado: `Espacio` pausa · `↑ ↓` velocidad · `← →` saltar · `R` reiniciar · `Esc` salir.

## Uso

1. Abre el sitio y pega tu guion.
2. Pulsa **Flotar junto a la cámara**.
3. Arrastra la mini ventana hasta debajo de tu webcam y entra a tu llamada.

> La ventana flotante requiere Chrome o Edge 116+. El botón **Pantalla completa** funciona en cualquier navegador.

## Desarrollo local

Es un sitio estático sin dependencias ni paso de build:

```bash
npx serve .
# o simplemente abre index.html en el navegador
```

## Despliegue en Netlify desde GitHub

1. Crea un repositorio y sube el código:
   ```bash
   git init
   git add .
   git commit -m "CuePoint teleprompter"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/cuepoint.git
   git push -u origin main
   ```
2. En [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project → GitHub** y elige el repositorio.
3. Netlify detecta `netlify.toml`; deja el comando de build vacío y el directorio de publicación en `.`. Pulsa **Deploy**.

Cada `git push` a `main` publicará automáticamente una nueva versión.

## Estructura

```
├── index.html        # Interfaz: editor y franja del prompter
├── css/styles.css    # Estilos (Instrument Sans + Spline Sans Mono)
├── js/app.js         # Motor de scroll, ventana flotante y persistencia
└── netlify.toml      # Configuración del despliegue
```

## Licencia

MIT
