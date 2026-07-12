/* EasyPrompter — reloj para el modo flotante móvil.
   Los temporizadores de la página se estrangulan cuando la app queda en
   segundo plano; los de un worker no, así el guion sigue avanzando en la
   ventanita de video mientras usas otra app. */
setInterval(() => postMessage(0), 33);
