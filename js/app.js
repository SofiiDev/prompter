/* ============================================================
   CuePoint — teleprompter para videollamadas
   - Motor de desplazamiento con requestAnimationFrame
   - Ventana flotante siempre visible (Document Picture-in-Picture)
   - Fallback a popup para navegadores sin soporte
   - Persistencia del guion y ajustes en localStorage
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

  const DEMO =
    "Hola, gracias por acompañarme hoy.\n\n" +
    "Con este prompter puedes mantener el contacto visual y hablar con naturalidad, " +
    "porque el texto está justo debajo de tu cámara.\n\n" +
    "Úsalo para reuniones, presentaciones en vivo o grabaciones de video.\n\n" +
    "Ajusta la velocidad con las flechas y pausa con la barra espaciadora " +
    "cuando quieras improvisar.";

  const STORAGE_KEY = "cuepoint.v1";

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
  };

  // ---------- Persistencia ----------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        script: scriptEl.value,
        speed: speedIn.value,
        fontSize: fontIn.value,
        mirror: mirrorIn.checked,
      }));
    } catch { /* almacenamiento no disponible: se ignora */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.script === "string") scriptEl.value = data.script;
      if (data.speed)  speedIn.value = data.speed;
      if (data.fontSize) fontIn.value = data.fontSize;
      mirrorIn.checked = Boolean(data.mirror);
      syncOutputs();
    } catch { /* datos corruptos: se ignoran */ }
  }

  function syncOutputs() {
    speedOut.textContent = speedIn.value;
    fontOut.textContent = fontIn.value + "px";
    hudSpeed.textContent = speedIn.value;
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
  }

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
    state.countdownIv = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        cancelCountdown();
        fn();
      } else {
        countNum.textContent = n;
      }
    }, 800);
  }

  function cancelCountdown() {
    if (state.countdownIv !== null) {
      clearInterval(state.countdownIv);
      state.countdownIv = null;
    }
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
    save();

    if (!("documentPictureInPicture" in window)) {
      // Fallback: popup pequeño (no siempre visible, pero independiente)
      window.open(
        location.pathname + "?float=1",
        "cuepoint",
        "popup=yes,width=620,height=200,top=40,left=" + Math.round(screen.width / 2 - 310)
      );
      return;
    }

    const pipWin = await documentPictureInPicture.requestWindow({
      width: 620,
      height: 190,
    });
    state.pipWin = pipWin;

    // Copiar hojas de estilo y fuentes a la ventana PiP
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      pipWin.document.head.appendChild(node.cloneNode(true));
    });
    pipWin.document.title = "CuePoint";
    pipWin.document.body.classList.add("floating");

    // Mover la franja a la ventana flotante
    scrollEl.textContent = scriptEl.value.trim() || DEMO;
    pipWin.document.body.appendChild(strip);

    bindKeys(pipWin);
    pipWin.addEventListener("resize", layout);
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
  fontIn.addEventListener("input", () => { syncOutputs(); if (prompterActive()) layout(); save(); });
  mirrorIn.addEventListener("change", () => { applyTransform(); save(); });
  scriptEl.addEventListener("input", save);

  window.addEventListener("resize", () => { if (prompterActive()) layout(); });
  bindKeys(window);

  function prompterActive() {
    return prompter.classList.contains("active") || state.pipWin || state.floating;
  }

  // ---------- Arranque ----------
  load();

  // Fallback popup: ?float=1 abre directamente el prompter a pantalla completa
  if (new URLSearchParams(location.search).has("float")) {
    state.floating = true;
    document.body.classList.add("floating");
    startInTab();
  }
})();
