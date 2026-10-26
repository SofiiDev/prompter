# Barrio Nexia · Comercios Amigos (prototipo)

Prototipo de app móvil para la red de comercios amigos de Team Nexia. Un solo archivo (`index.html`), sin build.

- **Vecino**: inicio con bienvenida personalizada, mapa por cuadras, beneficios cercanos, cupón con QR y Pase Vecino.
- **Comercio**: alta en 4 pasos (el paso 3 presenta a su agente y pide agendarlo y poner el cartel de caja), cartel de caja con el QR del agente (soporte A6 o calco 10×10), calco de vitrina, panel con niveles Amigo / Socio / Embajador y formulario para referir.
- **Team Nexia**: catálogo con aprobación de altas, agentes con su QR personal y armador de carteles de caja, invitación a comercios, link + QR + mensaje para cada vecino nuevo, tarjeta para el llavero y ranking de referidos.

La página también incluye el memo de estrategia de referidos para los locales.

Datos de ejemplo: comercios, direcciones y teléfonos son ficticios. Los links `barrio.teamnexia.com` son ilustrativos.

Nota: usa un script inline y `qrcode-generator` desde jsDelivr, así que la CSP de `netlify.toml` de este repo lo bloquea. Para publicarlo, abrilo como archivo local o subilo a un sitio aparte.
