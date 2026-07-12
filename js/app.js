/* ============================================================
   EasyPrompter — teleprompter para videollamadas
   - Motor de desplazamiento con requestAnimationFrame
   - Ventana flotante siempre visible (Document Picture-in-Picture)
   - Fallback a popup en escritorio y a pantalla completa en móvil
   - Temas: negro / lectura / blanco
   - Persistencia del guion y ajustes en localStorage (validada)
   ============================================================ */

(() => {
  "use strict";

  // ---------- Referencias al DOM ----------
  const $ = (id) => document.getElementById(id);

  const editor    = $("editor");
  const prompter  = $("prompter");
  const strip     = $("strip");
  const scriptEl  = $("script");
  const scrollEl  = $("scroll");
  const viewport  = $("viewport");
  const speedIn   = $("speed");
  const fontIn    = $("fontSize");
  const speedOut  = $("speedOut");
  const fontOut   = $("fontOut");
  const mirrorIn  = $("mirror");
  const hudSpeed  = $("hudSpeed");
  const hudTime   = $("hudTime");
  const playBtn   = $("playBtn");
  const progressFill = $("progressFill");
  const countdown = $("countdown");
  const countNum  = $("countNum");
  const themeSeg  = $("themeSeg");
  const floatBtn  = $("floatBtn");
  const pipCanvas = $("pipCanvas");
  const pipVideo  = $("pipVideo");

  const FLOAT_LABEL = "⇱ Flotar junto a la cámara";

  const DEMO =
    "Hola, gracias por acompañarme hoy.\n\n" +
    "Con este prompter puedes mantener el contacto visual y hablar con naturalidad, " +
    "porque el texto está justo debajo de tu cámara.\n\n" +
    "Úsalo para reuniones, presentaciones en vivo o grabaciones de video.\n\n" +
    "Ajusta la velocidad con las flechas y pausa con la barra espaciadora " +
    "cuando quieras improvisar.";

  const STORAGE_KEY = "easyprompter.v1";
  const THEMES = ["dark", "reading", "light"];

  // ---------- Estado ----------
  const state = {
    playing: false,
    offset: 0,
    lastT: 0,
    rafId: null,
    countdownIv: null,
    maxOffset: 0,
    pipWin: null,     // ventana Document Picture-in-Picture
    floating: false,  // esta página corre en modo flotante (popup fallback)
    theme: "dark",
    pipSize: { w: 620, h: 190 },  // último tamaño de la ventana flotante
    wakeLock: null,   // mantiene la pantalla encendida en móvil
  };

  // valores externos (localStorage) siempre validados antes de usarse
  function clampNum(v, min, max, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  // ---------- Persistencia ----------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        script: scriptEl.value,
        speed: speedIn.value,
        fontSize: fontIn.value,
        mirror: mirrorIn.checked,
        theme: state.theme,
        pipSize: state.pipSize,
      }));
    } catch { /* almacenamiento no disponible: se ignora */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.script === "string") scriptEl.value = data.script;
      speedIn.value = clampNum(data.speed, 10, 120, 45);
      fontIn.value  = clampNum(data.fontSize, 16, 40, 24);
      mirrorIn.checked = Boolean(data.mirror);
      if (THEMES.includes(data.theme)) applyTheme(data.theme);
      if (data.pipSize && typeof data.pipSize === "object") {
        state.pipSize = {
          w: clampNum(data.pipSize.w, 280, 1400, 620),
          h: clampNum(data.pipSize.h, 120, 700, 190),
        };
      }
      syncOutputs();
    } catch { /* datos corruptos: se ignoran */ }
  }

  function syncOutputs() {
    speedOut.textContent = speedIn.value;
    fontOut.textContent = fontIn.value + "px";
    hudSpeed.textContent = speedIn.value;
  }

  // ---------- Temas ----------
  function applyTheme(t) {
    if (!THEMES.includes(t)) return;
    state.theme = t;
    document.documentElement.dataset.theme = t;
    if (state.pipWin && !state.pipWin.closed) {
      state.pipWin.document.documentElement.dataset.theme = t;
    }
    if (overlay.active) { refreshOverlayColors(); drawOverlay(); }
    themeSeg.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.theme === t;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
    });
  }

  themeSeg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-theme]");
    if (b) { applyTheme(b.dataset.theme); save(); }
  });

  // ---------- Pantalla siempre encendida (móvil) ----------
  async function updateWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      if (state.playing && !state.wakeLock) {
        state.wakeLock = await navigator.wakeLock.request("screen");
        state.wakeLock.addEventListener("release", () => { state.wakeLock = null; });
      } else if (!state.playing && state.wakeLock) {
        const wl = state.wakeLock;
        state.wakeLock = null;
        await wl.release();
      }
    } catch { /* sin permiso o pestaña oculta: se ignora */ }
  }

  // ---------- Ventana anfitriona del bucle de animación ----------
  // Cuando la franja vive en la ventana PiP, el rAF debe correr allí:
  // la pestaña principal se detiene al perder el foco, la PiP no.
  function host() {
    return state.pipWin && !state.pipWin.closed ? state.pipWin : window;
  }

  // ---------- Maquetado del prompter ----------
  function pxPerSec() {
    return Number(speedIn.value);
  }

  function layout() {
    const fs = Number(fontIn.value);
    const lh = Math.round(fs * 1.65);
    scrollEl.style.fontSize = fs + "px";
    scrollEl.style.lineHeight = lh + "px";

    let viewH;
    if (state.pipWin || state.floating) {
      // en modo flotante la franja llena la ventana
      viewport.style.height = "";
      viewH = viewport.clientHeight || lh * 3 + 20;
    } else {
      viewH = lh * 3 + 20;
      viewport.style.height = viewH + "px";
    }

    scrollEl.style.paddingTop = viewH * 0.42 + "px";
    scrollEl.style.paddingBottom = viewH * 0.6 + "px";
    state.maxOffset = Math.max(0, scrollEl.scrollHeight - viewH);
    applyTransform();
  }

  function applyTransform() {
    const mir = mirrorIn.checked ? " scaleX(-1)" : "";
    scrollEl.style.transform = `translateY(${-state.offset}px)` + mir;

    const pct = state.maxOffset ? (state.offset / state.maxOffset) * 100 : 0;
    progressFill.style.width = pct + "%";

    const remain = state.maxOffset
      ? Math.max(0, (state.maxOffset - state.offset) / pxPerSec())
      : 0;
    const m = Math.floor(remain / 60);
    const s = Math.round(remain % 60);
    hudTime.textContent = `${m}:${String(s).padStart(2, "0")}`;
  }

  // ---------- Bucle de reproducción ----------
  function tick(t) {
    if (state.playing) {
      // el timestamp del rAF puede ser anterior al performance.now() de un
      // reinicio reciente: nunca retroceder
      const dt = Math.min(0.05, Math.max(0, (t - state.lastT) / 1000));
      state.lastT = t;
      state.offset += pxPerSec() * dt;
      if (state.offset >= state.maxOffset) {
        state.offset = state.maxOffset;
        setPlaying(false);
      }
      applyTransform();
    } else {
      state.lastT = t;
    }
    state.rafId = host().requestAnimationFrame(tick);
  }

  function startLoop() {
    stopLoop();
    state.lastT = host().performance.now();
    state.rafId = host().requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (state.rafId !== null) {
      window.cancelAnimationFrame(state.rafId);
      if (state.pipWin && !state.pipWin.closed) {
        state.pipWin.cancelAnimationFrame(state.rafId);
      }
      state.rafId = null;
    }
  }

  function setPlaying(v) {
    state.playing = v;
    playBtn.textContent = v ? "❚❚" : "▶";
    playBtn.className = v ? "playing" : "paused";
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = v ? "playing" : "paused";
    }
    updateWakeLock();
  }

  // ---------- Overlay móvil: canvas → video Picture-in-Picture ----------
  // En Android/iOS no hay ventanas flotantes de documento, pero un video en
  // PiP sí queda encima de cualquier app (TikTok, Instagram, la cámara…).
  // El guion se dibuja en un canvas que se emite como stream de video.
  const overlay = {
    active: false,
    ctx: pipCanvas.getContext("2d"),
    stream: null,
    ticker: null,     // worker: sus timers no se estrangulan en segundo plano
    lines: [],
    fontPx: 48,
    lineH: 72,
    padTop: 0,
    maxOffset: 0,
    offset: 0,
    lastT: 0,
    scale: 2,         // px de canvas por px "de pantalla" (nitidez)
    count: 0,         // número de la cuenta regresiva dibujado en el canvas
    colors: { bg: "#0D0C0A", text: "#F3EFE7", line: "#2B2620", led: "#57D9A3", dim: "#97917F" },
  };

  function refreshOverlayColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fb) => (cs.getPropertyValue(name).trim() || fb);
    overlay.colors = {
      bg:   v("--strip-bg", "#0D0C0A"),
      text: v("--text", "#F3EFE7"),
      line: v("--line", "#2B2620"),
      led:  v("--led", "#57D9A3"),
      dim:  v("--dim", "#97917F"),
    };
  }

  function buildOverlayLines() {
    const c = overlay.ctx;
    const W = pipCanvas.width, H = pipCanvas.height;
    overlay.fontPx = clampNum(fontIn.value, 16, 40, 24) * overlay.scale;
    overlay.lineH = Math.round(overlay.fontPx * 1.5);
    c.font = `${overlay.fontPx}px "Spline Sans Mono", ui-monospace, monospace`;

    const maxW = W - 64;
    const lines = [];
    for (const para of (scriptEl.value.trim() || DEMO).split("\n")) {
      if (!para.trim()) { lines.push(""); continue; }
      let cur = "";
      for (const word of para.split(/\s+/)) {
        const probe = cur ? cur + " " + word : word;
        if (c.measureText(probe).width <= maxW || !cur) cur = probe;
        else { lines.push(cur); cur = word; }
      }
      if (cur) lines.push(cur);
    }
    overlay.lines = lines;
    overlay.padTop = H * 0.42;
    overlay.maxOffset = Math.max(0, overlay.padTop + lines.length * overlay.lineH + H * 0.6 - H);
  }

  function drawOverlay() {
    const c = overlay.ctx;
    const W = pipCanvas.width, H = pipCanvas.height;
    const col = overlay.colors;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = col.bg;
    c.fillRect(0, 0, W, H);

    if (mirrorIn.checked) { c.translate(W, 0); c.scale(-1, 1); }
    c.fillStyle = col.text;
    c.font = `${overlay.fontPx}px "Spline Sans Mono", ui-monospace, monospace`;
    c.textBaseline = "top";
    c.textAlign = "left";
    const startY = overlay.padTop - overlay.offset;
    overlay.lines.forEach((ln, i) => {
      const y = startY + i * overlay.lineH;
      if (y > -overlay.lineH && y < H && ln) c.fillText(ln, 32, y);
    });

    // desvanecidos arriba y abajo (hex de 8 dígitos: bg transparente)
    c.setTransform(1, 0, 0, 1, 0, 0);
    const fadeH = H * 0.3;
    const gt = c.createLinearGradient(0, 0, 0, fadeH);
    gt.addColorStop(0, col.bg); gt.addColorStop(1, col.bg + "00");
    c.fillStyle = gt; c.fillRect(0, 0, W, fadeH);
    const gb = c.createLinearGradient(0, H - fadeH, 0, H);
    gb.addColorStop(0, col.bg + "00"); gb.addColorStop(1, col.bg);
    c.fillStyle = gb; c.fillRect(0, H - fadeH, W, fadeH);

    // punto de la cámara y barra de progreso
    c.fillStyle = col.led;
    c.beginPath(); c.arc(W / 2, 12, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.line; c.fillRect(0, H - 6, W, 6);
    c.fillStyle = col.led;
    c.fillRect(0, H - 6, W * (overlay.maxOffset ? overlay.offset / overlay.maxOffset : 0), 6);

    // cuenta regresiva o indicador de pausa
    if (overlay.count > 0) {
      c.fillStyle = col.bg + "D9";
      c.fillRect(0, 0, W, H);
      c.fillStyle = col.text;
      c.font = `${H * 0.5}px "Spline Sans Mono", ui-monospace, monospace`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(overlay.count), W / 2, H / 2);
    } else if (!state.playing) {
      c.fillStyle = col.dim;
      c.font = `28px "Spline Sans Mono", ui-monospace, monospace`;
      c.textAlign = "right"; c.textBaseline = "top";
      c.fillText("❚❚", W - 20, 12);
    }
  }

  function overlayStep() {
    const now = performance.now();
    if (state.playing) {
      const dt = Math.min(0.05, Math.max(0, (now - overlay.lastT) / 1000));
      overlay.offset += pxPerSec() * overlay.scale * dt;
      if (overlay.offset >= overlay.maxOffset) {
        overlay.offset = overlay.maxOffset;
        setPlaying(false);
      }
    }
    overlay.lastT = now;
    drawOverlay();
  }

  function overlayLoop() {
    if (!overlay.active) return;
    overlayStep();
    requestAnimationFrame(overlayLoop);
  }

  async function startMobileOverlay() {
    buildOverlayLines();
    refreshOverlayColors();
    overlay.offset = 0;
    overlay.count = 0;
    drawOverlay();

    try {
      if (!overlay.stream) {
        overlay.stream = pipCanvas.captureStream(30);
        pipVideo.srcObject = overlay.stream;
      }
      pipVideo.muted = true;
      await pipVideo.play();
      if (pipVideo.requestPictureInPicture) {
        await pipVideo.requestPictureInPicture();
      } else if (pipVideo.webkitSupportsPresentationMode &&
                 pipVideo.webkitSupportsPresentationMode("picture-in-picture")) {
        pipVideo.webkitSetPresentationMode("picture-in-picture");
      } else {
        throw new Error("PiP de video no disponible");
      }
    } catch {
      // sin PiP de video: al menos pantalla completa en la pestaña
      startInTab();
      return;
    }

    overlay.active = true;
    floatBtn.textContent = "✕ Cerrar ventana flotante";

    if (!overlay.ticker) {
      try {
        overlay.ticker = new Worker("js/ticker.js");
        overlay.ticker.onmessage = () => {
          if (overlay.active && document.hidden) overlayStep();
        };
      } catch { /* sin worker: el rAF cubre el primer plano */ }
    }

    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: "EasyPrompter" });
        navigator.mediaSession.setActionHandler("play", () => setPlaying(true));
        navigator.mediaSession.setActionHandler("pause", () => setPlaying(false));
      } catch { /* metadatos opcionales */ }
    }

    overlay.lastT = performance.now();
    overlayLoop();
    countdownThen(() => setPlaying(true));
  }

  function stopOverlay() {
    if (!overlay.active) return;
    overlay.active = false;
    cancelCountdown();
    setPlaying(false);
    pipVideo.pause();
    floatBtn.textContent = FLOAT_LABEL;
  }

  pipVideo.addEventListener("leavepictureinpicture", stopOverlay);
  pipVideo.addEventListener("webkitpresentationmodechanged", () => {
    if (pipVideo.webkitPresentationMode === "inline") stopOverlay();
  });

  // ---------- Cuenta regresiva ----------
  // Se muestra en la ventana donde vive el prompter: si hay ventana
  // flotante, el elemento se traslada allí, que es donde mira el usuario.
  function countdownThen(fn) {
    cancelCountdown();
    const doc = host().document;
    if (countdown.ownerDocument !== doc) doc.body.appendChild(countdown);
    let n = 3;
    countNum.textContent = n;
    countdown.classList.add("show");
    if (overlay.active) { overlay.count = n; drawOverlay(); }
    state.countdownIv = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        cancelCountdown();
        fn();
      } else {
        countNum.textContent = n;
        if (overlay.active) { overlay.count = n; drawOverlay(); }
      }
    }, 800);
  }

  function cancelCountdown() {
    if (state.countdownIv !== null) {
      clearInterval(state.countdownIv);
      state.countdownIv = null;
    }
    overlay.count = 0;
    countdown.classList.remove("show");
  }

  // ---------- Modo pantalla completa (en la pestaña) ----------
  function startInTab() {
    // si hay una ventana flotante abierta, recuperar la franja antes de empezar
    if (state.pipWin) {
      const w = state.pipWin;
      teardownFloating();
      if (!w.closed) w.close();
    }
    scrollEl.textContent = scriptEl.value.trim() || DEMO;
    editor.classList.add("hidden");
    prompter.classList.add("active");
    state.offset = 0;
    syncOutputs();
    layout();
    countdownThen(() => {
      setPlaying(true);
      startLoop();
    });
  }

  function exitPrompter() {
    prompter.classList.remove("active");
    editor.classList.remove("hidden");
    cancelCountdown();
    setPlaying(false);
    stopLoop();
    if (state.floating && window.opener) window.close();
  }

  // ---------- Modo flotante (Document Picture-in-Picture) ----------
  async function startFloating() {
    // segundo toque en el móvil: cerrar la ventanita flotante
    if (overlay.active) {
      try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else if (pipVideo.webkitSetPresentationMode) pipVideo.webkitSetPresentationMode("inline");
      } catch { /* ya cerrada */ }
      stopOverlay();
      return;
    }
    save();

    if (!("documentPictureInPicture" in window)) {
      // En móvil no hay ventanas de documento, pero el PiP de video
      // sí flota sobre cualquier app (TikTok, Instagram, la cámara…)
      if (matchMedia("(pointer: coarse)").matches) {
        startMobileOverlay();
        return;
      }
      // Fallback de escritorio: popup pequeño (no siempre visible, pero independiente)
      window.open(
        location.pathname + "?float=1",
        "easyprompter",
        "popup=yes,width=" + state.pipSize.w + ",height=" + state.pipSize.h +
          ",top=40,left=" + Math.round(screen.width / 2 - state.pipSize.w / 2)
      );
      return;
    }

    const pipWin = await documentPictureInPicture.requestWindow({
      width: state.pipSize.w,
      height: state.pipSize.h,
    });
    state.pipWin = pipWin;

    // Copiar hojas de estilo y fuentes a la ventana PiP
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      pipWin.document.head.appendChild(node.cloneNode(true));
    });
    pipWin.document.title = "EasyPrompter";
    pipWin.document.documentElement.dataset.theme = state.theme;
    pipWin.document.body.classList.add("floating");

    // Mover la franja a la ventana flotante
    scrollEl.textContent = scriptEl.value.trim() || DEMO;
    pipWin.document.body.appendChild(strip);

    bindKeys(pipWin);
    // el usuario puede estirar la mini ventana: readaptar y recordar el tamaño
    pipWin.addEventListener("resize", () => {
      state.pipSize = { w: pipWin.innerWidth, h: pipWin.innerHeight };
      save();
      layout();
    });
    pipWin.addEventListener("pagehide", teardownFloating);

    state.offset = 0;
    syncOutputs();

    // Esperar a que carguen las fuentes para medir bien
    try { await pipWin.document.fonts.ready; } catch { /* opcional */ }
    layout();

    countdownThen(() => {
      setPlaying(true);
      startLoop();
    });
  }

  function teardownFloating() {
    // el pagehide de la ventana PiP puede llegar después de un desmontaje
    // manual (p. ej. al pasar a pantalla completa): no desmontar dos veces
    if (!state.pipWin) return;
    cancelCountdown();
    stopLoop();
    setPlaying(false);
    // devolver a la página principal lo que vivía en la ventana flotante
    prompter.appendChild(strip);
    if (countdown.ownerDocument !== document) document.body.appendChild(countdown);
    state.pipWin = null;
    layout();
  }

  // ---------- Controles ----------
  function bumpSpeed(d) {
    speedIn.value = Math.min(120, Math.max(10, Number(speedIn.value) + d));
    syncOutputs();
    applyTransform();
    save();
  }

  function jump(px) {
    state.offset = Math.min(state.maxOffset, Math.max(0, state.offset + px));
    applyTransform();
  }

  function restart() {
    state.offset = 0;
    applyTransform();
    setPlaying(true);
    state.lastT = host().performance.now();
  }

  function bindKeys(win) {
    win.addEventListener("keydown", (e) => {
      const active = state.pipWin || prompter.classList.contains("active") || state.floating;
      if (!active || e.target === scriptEl) return;
      switch (e.key) {
        case " ":          e.preventDefault(); setPlaying(!state.playing); break;
        case "ArrowUp":    e.preventDefault(); bumpSpeed(5);  break;
        case "ArrowDown":  e.preventDefault(); bumpSpeed(-5); break;
        case "ArrowLeft":  e.preventDefault(); jump(-80); break;
        case "ArrowRight": e.preventDefault(); jump(80);  break;
        case "r": case "R": restart(); break;
        case "Escape":
          if (state.pipWin) state.pipWin.close();
          else exitPrompter();
          break;
      }
    });
  }

  // ---------- Eventos ----------
  $("startBtn").addEventListener("click", startInTab);
  $("floatBtn").addEventListener("click", startFloating);
  $("exitBtn").addEventListener("click", () => {
    if (state.pipWin) state.pipWin.close();
    else exitPrompter();
  });
  $("restartBtn").addEventListener("click", restart);
  $("playBtn").addEventListener("click", () => setPlaying(!state.playing));
  $("slowBtn").addEventListener("click", () => bumpSpeed(-5));
  $("fastBtn").addEventListener("click", () => bumpSpeed(5));
  viewport.addEventListener("click", () => setPlaying(!state.playing));

  speedIn.addEventListener("input", () => { syncOutputs(); save(); });
  fontIn.addEventListener("input", () => {
    syncOutputs();
    if (prompterActive()) layout();
    if (overlay.active) {
      const ratio = overlay.maxOffset ? overlay.offset / overlay.maxOffset : 0;
      buildOverlayLines();
      overlay.offset = ratio * overlay.maxOffset;
      drawOverlay();
    }
    save();
  });
  mirrorIn.addEventListener("change", () => {
    applyTransform();
    if (overlay.active) drawOverlay();
    save();
  });
  scriptEl.addEventListener("input", save);

  window.addEventListener("resize", () => { if (prompterActive()) layout(); });
  bindKeys(window);

  function prompterActive() {
    return prompter.classList.contains("active") || state.pipWin || state.floating;
  }

  // ---------- Arranque ----------
  load();

  // reintentar el wake lock al volver a la app (el sistema lo libera al ocultarla)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateWakeLock();
  });

  // PWA instalable (permite anclar EasyPrompter a la barra de tareas)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => { /* opcional */ });
    });
  }

  // Fallback popup: ?float=1 abre directamente el prompter a pantalla completa
  if (new URLSearchParams(location.search).has("float")) {
    state.floating = true;
    document.body.classList.add("floating");
    startInTab();
  }
})();
