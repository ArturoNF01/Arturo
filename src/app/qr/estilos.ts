/**
 * Los estilos de la pantalla de recepción: una sola pantalla, con prefijo `rq-`, sin compartir nada con el resto del sitio.
 *
 * Está pensada para un monitor vertical 9:16 —como un celular, pero grande— y todo se mide en «u», que es el 1 % del
 * ancho de esa pantalla (`min(1vw, 0.5625dvh)`): la escena entera mide 100u por 177.78u y se escala sola a 1080×1920, a
 * 2160×3840 o a lo que sea, con las mismas proporciones. En un monitor más ancho la escena queda centrada y sobra video a
 * los lados; en uno más estrecho se ajusta al alto.
 *
 * Se escribe con la unidad `u` y se traduce a `calc(var(--u)*N)` al armar la hoja: así se lee y se ajusta sin
 * ensuciarse con cien `calc`.
 *
 * Los textos más chicos miden 2.2u (unos 24 px en 1080 de ancho, 2.5 cm en una pantalla de 55") porque se leen de pie y
 * a un par de metros: nada por debajo de eso, salvo el aviso técnico de «sin conexión», que lee quien atiende.
 */
const DORADO = '#c7ae6f';
const DORADO_CLARO = '#ecdca8';
const MARINO = '#001b57';

const HOJA = `
@property --rq-ang { syntax: '<angle>'; inherits: false; initial-value: 0deg; }

.rq { --u: min(1vw, 0.5625dvh); position: relative; isolation: isolate; overflow: hidden; display: grid; place-items: center;
  min-height: 100dvh; width: 100%; background: #000; color: #fff; text-align: center; cursor: none; user-select: none;
  font-family: 'Work Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; }
.rq h1, .rq h2, .rq p, .rq ul { margin: 0; font-family: inherit; }
.rq ul { padding: 0; list-style: none; }

/* El video a toda luz, bajo un velo azul como el de la portada; más cerrado abajo, donde van los QR. */
.rq-velo { position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(180deg, rgba(11,37,112,.8) 0%, rgba(11,37,112,.52) 30%, rgba(11,37,112,.62) 62%, rgba(0,27,87,.92) 100%); }

/* Tres manchas de luz a la deriva sobre el video: lo que le da vida a lo quieto. */
.rq-orbes { position: absolute; inset: 0; z-index: 1; pointer-events: none; mix-blend-mode: screen; }
.rq-orbes i { position: absolute; border-radius: 50%; will-change: transform; }
.rq-orbes i:nth-child(1) { width: 90u; height: 90u; left: -25%; top: 4%;
  background: radial-gradient(circle, rgba(60,110,255,.45), transparent 65%); animation: rq-deriva-1 19s ease-in-out infinite alternate; }
.rq-orbes i:nth-child(2) { width: 80u; height: 80u; right: -28%; top: 38%;
  background: radial-gradient(circle, rgba(199,174,111,.38), transparent 65%); animation: rq-deriva-2 23s ease-in-out infinite alternate; }
.rq-orbes i:nth-child(3) { width: 85u; height: 85u; left: -10%; bottom: -8%;
  background: radial-gradient(circle, rgba(70,140,255,.35), transparent 65%); animation: rq-deriva-3 27s ease-in-out infinite alternate; }
@keyframes rq-deriva-1 { to { transform: translate(30u, 22u) scale(1.18); } }
@keyframes rq-deriva-2 { to { transform: translate(-26u, -28u) scale(.88); } }
@keyframes rq-deriva-3 { to { transform: translate(24u, -20u) scale(1.12); } }

.rq-escena { position: relative; z-index: 2; box-sizing: border-box; width: 100u; height: 177.78u;
  padding: 3.2u 5u 3.4u; display: flex; flex-direction: column; gap: 1.8u; }
.rq-escena > * { flex: none; }

/* Cada bloque entra desde abajo, uno tras otro. */
.rq-entrada { animation: rq-entra 1s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--retraso, 0s); }
@keyframes rq-entra { from { opacity: 0; transform: translateY(5u); } to { opacity: 1; transform: none; } }

/* Cabecera */
.rq-fila { display: flex; align-items: center; justify-content: space-between; }
.rq-logo { height: 5.4u; }
.rq-reloj { display: flex; align-items: baseline; gap: 1.2u; font-variant-numeric: tabular-nums; }
.rq-hora { font-size: 5.2u; font-weight: 600; letter-spacing: .02em; color: ${DORADO_CLARO}; text-shadow: 0 0 2u rgba(199,174,111,.55); }
.rq-huso { font-size: 2.2u; font-weight: 600; letter-spacing: .18em; opacity: .8; }
.rq-nombre { margin-top: 1.1u; font-size: 2.7u; font-weight: 700; line-height: 1.15; color: ${DORADO_CLARO};
  text-shadow: 0 .2u 1.6u rgba(0,10,40,.6); }

/* El aviso del comité: una cinta dorada que no se puede pasar por alto. */
.rq-aviso { position: relative; display: flex; align-items: center; gap: 2.4u; padding: 1.8u 3u; border-radius: 3u; text-align: left;
  color: ${MARINO}; background: linear-gradient(135deg, #f6e9bd, ${DORADO}); box-shadow: 0 1u 4u rgba(0,8,40,.5); }
.rq-aviso::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; animation: rq-aviso-anillo 3s ease-out infinite; }
@keyframes rq-aviso-anillo { 0% { box-shadow: 0 0 0 0 rgba(246,233,189,.7); } 80%, 100% { box-shadow: 0 0 0 2.6u rgba(246,233,189,0); } }
.rq-aviso-icono { display: grid; place-items: center; flex: none; width: 5.6u; height: 5.6u; border-radius: 50%; color: #fff; background: ${MARINO}; }
.rq-aviso-icono svg { width: 58%; height: 58%; }
.rq-aviso-etq { font-size: 2.1u; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; opacity: .75; }
.rq-aviso-texto { margin-top: .2u; font-size: 3u; font-weight: 700; line-height: 1.18; }

/* En vivo ahora */
.rq-vivo { position: relative; overflow: hidden; box-sizing: border-box; text-align: left; border-radius: 3u; padding: 2.2u 3u 2.2u 4.2u;
  background: linear-gradient(180deg, rgba(10,28,92,.66), rgba(4,14,52,.78)); border: 1px solid rgba(255,255,255,.2);
  box-shadow: 0 1.5u 6u rgba(0,8,40,.5), inset 0 1px 0 rgba(255,255,255,.12);
  backdrop-filter: blur(1.1u); -webkit-backdrop-filter: blur(1.1u); }
.rq-vivo::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: .9u; background: linear-gradient(180deg, #a9bcff, #5a78e0); }
.rq-vivo-en-vivo::before { background: linear-gradient(180deg, #ff4d6a, #ff9a5e); animation: rq-luz 1.8s ease-in-out infinite; }
@keyframes rq-luz { 50% { opacity: .4; } }
.rq-vivo-cabecera { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.4u; }
.rq-tag { display: inline-flex; align-items: center; gap: 1.1u; padding: .6u 1.8u; border-radius: 999px; font-size: 2.3u; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.rq-tag-vivo { color: #fff; background: linear-gradient(135deg, #ff3b57, #d9143a); box-shadow: 0 0 2.4u rgba(255,59,87,.6); }
.rq-tag-neutra { color: ${MARINO}; background: linear-gradient(135deg, #f6e9bd, ${DORADO}); }
.rq-tag-neutra .rq-punto { background: ${MARINO}; }
.rq-barras { display: inline-flex; align-items: flex-end; gap: .35u; height: 2.2u; }
.rq-barras i { width: .5u; height: 100%; border-radius: .2u; background: #fff; transform-origin: bottom; animation: rq-barra 1.1s ease-in-out infinite alternate; }
.rq-barras i:nth-child(2) { animation-duration: .8s; animation-delay: -.3s; }
.rq-barras i:nth-child(3) { animation-duration: 1.3s; animation-delay: -.6s; }
.rq-barras i:nth-child(4) { animation-duration: .9s; animation-delay: -.2s; }
@keyframes rq-barra { from { transform: scaleY(.25); } to { transform: scaleY(1); } }

.rq-cambio { animation: rq-cambia .7s ease-out both; }
@keyframes rq-cambia { from { opacity: 0; transform: translateY(1.6u); } to { opacity: 1; transform: none; } }
.rq-sesiones { display: flex; flex-direction: column; gap: 1.6u; }
.rq-sesiones-dos .rq-sesion + .rq-sesion { padding-top: 1.5u; border-top: 1px solid rgba(255,255,255,.2); }
.rq-sesion-linea { display: flex; align-items: center; justify-content: space-between; gap: 2u; }
.rq-sala { display: inline-flex; align-items: center; gap: .9u; font-size: 2.5u; font-weight: 700; color: ${DORADO_CLARO}; }
.rq-sala svg { width: 2.6u; height: 2.6u; flex: none; }
.rq-horas { font-size: 2.5u; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; opacity: .92; }
.rq-sesion-etq { margin-top: .8u; font-size: 2.2u; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${DORADO}; }
.rq-sesion-titulo { margin-top: .4u; font-size: 3.3u; font-weight: 700; line-height: 1.15; }
.rq-sesiones-dos .rq-sesion-titulo { font-size: 2.8u; }
.rq-ponente { margin-top: .6u; font-size: 2.4u; font-weight: 500; }
.rq-ponente-etq { margin-right: 1.2u; font-size: 2u; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: ${DORADO}; }
.rq-avance { display: flex; align-items: center; gap: 2u; margin-top: 1.2u; }
.rq-barra { flex: 1; height: 1u; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.22); }
.rq-barra i { position: relative; display: block; height: 100%; overflow: hidden; border-radius: inherit; transition: width 1s linear;
  background: linear-gradient(90deg, ${DORADO}, #fff3c9); }
.rq-barra i::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent); animation: rq-brillo 2.6s ease-in-out infinite; }
@keyframes rq-brillo { to { transform: translateX(100%); } }
.rq-quedan { font-size: 2.2u; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; opacity: .92; }
.rq-mensaje { padding: 1.2u 0 .4u; font-size: 4u; font-weight: 700; line-height: 1.15; }

.rq-sig { margin-top: 1.5u; padding-top: 1.3u; border-top: 1px solid rgba(255,255,255,.2); }
.rq-sig-cab { display: flex; align-items: baseline; gap: 1.4u; }
.rq-sig-etq { font-size: 2.2u; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: ${DORADO_CLARO}; }
.rq-sig-hora { font-size: 2.7u; font-weight: 700; font-variant-numeric: tabular-nums; }
.rq-sig-cuenta { font-size: 2.2u; font-weight: 500; opacity: .88; }
.rq-sig-lista { margin-top: .5u; font-size: 2.5u; font-weight: 600; line-height: 1.2; }
.rq-sig-lista li + li { margin-top: .3u; }

/* Tarjetas */
.rq-tarjeta { position: relative; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1.4u; padding: 2.6u 3u; border-radius: 3.2u;
  background: linear-gradient(180deg, rgba(10,28,92,.62), rgba(4,14,52,.74)); border: 1px solid rgba(199,174,111,.45);
  box-shadow: 0 1.5u 6u rgba(0,8,40,.5), inset 0 1px 0 rgba(255,255,255,.12);
  backdrop-filter: blur(1.1u); -webkit-backdrop-filter: blur(1.1u); }
.rq-tarjeta-asistencia { flex: 1 1 0; min-height: 0; border-color: rgba(236,220,168,.7); }
.rq-encabezado { display: flex; flex-direction: column; align-items: center; gap: .8u; }
.rq-icono { display: grid; place-items: center; flex: none; width: 5.4u; height: 5.4u; border-radius: 50%; color: ${MARINO};
  background: linear-gradient(135deg, ${DORADO_CLARO}, ${DORADO}); box-shadow: 0 0 2.4u rgba(199,174,111,.65); }
.rq-icono svg { width: 58%; height: 58%; }
.rq-titulo { font-size: 5u; font-weight: 700; line-height: 1.1; }
.rq-titulo-fila { display: flex; align-items: center; justify-content: center; gap: 1.6u; }
/* El texto pegado a su icono, en el idioma que sea: el más largo manda el ancho y los demás no se despegan. */
.rq-titulo-fila .rq-triple { text-align: left; }
.rq-sub { font-size: 2.6u; font-weight: 500; opacity: .92; }
.rq-dia { font-size: 2.7u; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${DORADO_CLARO}; }
.rq-constancia { max-width: 80u; font-size: 2.2u; font-weight: 500; line-height: 1.25; opacity: .88; }
.rq-sin-constancia .rq-constancia, .rq-sin-constancia .rq-nombre { display: none; }
.rq-compacta .rq-tarjeta-agenda .rq-icono { display: none; }
.rq-sin-sig .rq-sig { display: none; }

/* La tarjeta de la agenda: el texto a la izquierda y el QR a la derecha, para dejar el lugar al QR de asistencia. */
.rq-tarjeta-agenda { flex-direction: row; justify-content: space-between; gap: 3u; padding: 2.4u 3.6u 2.4u 3.8u; text-align: left; }
.rq-agenda-texto { display: flex; flex-direction: column; align-items: flex-start; gap: .9u; min-width: 0; }
.rq-titulo-agenda { font-size: 4.8u; }
.rq-nota { margin-top: .4u; font-size: 2.2u; font-weight: 500; color: ${DORADO_CLARO}; }

/* El QR: blanco, con un anillo dorado que gira, esquinas de visor y, el de asistencia, una línea que lo barre. */
.rq-caja { position: relative; flex: none; }
.rq-caja-agenda { width: 22u; height: 22u; }
.rq-compacta .rq-caja-agenda { width: 19u; height: 19u; }
/* El de asistencia se queda con todo el lugar que sobra (entre 28u y 46u): es el que más importa. */
.rq-zona-qr { display: flex; flex: 1 1 0; align-items: center; justify-content: center; box-sizing: border-box; width: 100%; min-height: 28u; padding: 2.4u 0; }
.rq-caja-asistencia { height: 100%; max-height: 46u; aspect-ratio: 1 / 1; }
.rq-panel { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; overflow: hidden; border-radius: 2u; background: #fff; }
.rq-qr, .rq-qr svg { display: block; width: 100%; height: 100%; }
.rq-vacio { padding: 3u; color: ${MARINO}; font-size: 3u; font-weight: 600; }
.rq-anillo { position: absolute; z-index: 1; inset: -.9u; border-radius: 2.8u;
  background: conic-gradient(from var(--rq-ang), rgba(199,174,111,.12) 0 55%, ${DORADO} 78%, #fff 92%, rgba(199,174,111,.12) 100%);
  animation: rq-giro 5s linear infinite; }
@keyframes rq-giro { to { --rq-ang: 360deg; } }
.rq-pulso { animation: rq-latido 2.4s ease-in-out infinite; }
@keyframes rq-latido { 0% { box-shadow: 0 0 0 0 rgba(236,220,168,.6); } 70%, 100% { box-shadow: 0 0 0 3.4u rgba(236,220,168,0); } }
/* La línea de escaneo se funde por multiplicación: tiñe de ámbar lo blanco y deja intacto lo negro, así el QR se sigue
   leyendo en cualquier cuadro de la animación. */
.rq-escaneo { position: absolute; left: 0; right: 0; top: 0; height: 9%; pointer-events: none; mix-blend-mode: multiply;
  background: linear-gradient(180deg, rgba(255,190,70,0), rgba(255,190,70,.85) 60%, rgba(255,255,255,0)); animation: rq-barrido 3.2s ease-in-out infinite; }
@keyframes rq-barrido { 0% { top: -9%; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
.rq-esquina { position: absolute; z-index: 3; width: 4.2u; height: 4.2u; border: .55u solid ${DORADO_CLARO}; pointer-events: none;
  filter: drop-shadow(0 0 .7u rgba(236,220,168,.9)); animation: rq-visor 2.4s ease-in-out infinite; }
.rq-e1 { left: -2.2u; top: -2.2u; border-right: 0; border-bottom: 0; border-top-left-radius: 1.6u; transform-origin: top left; }
.rq-e2 { right: -2.2u; top: -2.2u; border-left: 0; border-bottom: 0; border-top-right-radius: 1.6u; transform-origin: top right; }
.rq-e3 { left: -2.2u; bottom: -2.2u; border-right: 0; border-top: 0; border-bottom-left-radius: 1.6u; transform-origin: bottom left; }
.rq-e4 { right: -2.2u; bottom: -2.2u; border-left: 0; border-top: 0; border-bottom-right-radius: 1.6u; transform-origin: bottom right; }
@keyframes rq-visor { 0%, 100% { transform: scale(1); opacity: .95; } 50% { transform: scale(1.22); opacity: .55; } }

/* El estado del registro de asistencia */
.rq-chip { display: inline-flex; align-items: center; gap: 1.2u; padding: 1u 2.6u; border-radius: 999px; font-size: 2.6u; font-weight: 600;
  background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.28); }
.rq-chip .rq-triple { text-align: left; }
.rq-chip .rq-triple, .rq-chip .rq-fijo { color: #fff; }
.rq-punto { display: inline-block; flex: none; width: 1.5u; height: 1.5u; border-radius: 50%; background: currentColor; }
.rq-chip-abierto { color: #54e6a4; border-color: rgba(84,230,164,.6); background: rgba(40,160,110,.22); }
.rq-chip-abierto .rq-punto { animation: rq-vivo 1.4s ease-out infinite; }
@keyframes rq-vivo { 0% { box-shadow: 0 0 0 0 rgba(84,230,164,.75); } 100% { box-shadow: 0 0 0 1.8u rgba(84,230,164,0); } }
.rq-chip-antes { color: ${DORADO_CLARO}; border-color: rgba(236,220,168,.55); }
.rq-chip-cerrado { color: #ffd08a; border-color: rgba(255,208,138,.5); }
.rq-previa { position: absolute; z-index: 5; bottom: .9u; left: 50%; transform: translateX(-50%); padding: .4u 1.6u; border-radius: 999px;
  font-size: 1.8u; font-weight: 700; letter-spacing: .08em; white-space: nowrap; background: ${DORADO}; color: ${MARINO}; }

/* Para quien atiende la pantalla, no para el público. */
.rq-sin-conexion { position: absolute; z-index: 5; top: 1u; left: 50%; transform: translateX(-50%); padding: .5u 2u; border-radius: 999px;
  font-size: 1.8u; font-weight: 700; white-space: nowrap; color: #2a1700; background: rgba(255,176,64,.96); }

/* Reconectando */
.rq-espera { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4u; height: 100%; font-size: 4u; font-weight: 600; }

/* Los tres idiomas, uno sobre otro, de los que se ve uno a la vez: el que toca marca el reloj de idioma (triple.tsx).
   rq-i-0 es el que está a la vista, rq-i-1 el que sigue (espera abajo) y rq-i-2 el que acaba de salir (arriba).
   El que sale se va primero (0.35 s) y el que entra espera a que se haya ido (otros 0.35 s) y aparece en medio segundo:
   así nunca se ven dos idiomas encimados, que es lo que más estorba al leer. La transición se toma del estado al que
   se llega, por eso el retraso va en el que entra (rq-i-0). */
.rq-triple { display: inline-grid; }
.rq-triple > span { grid-area: 1 / 1; }
.rq-triple > .rq-i-0 { opacity: 1; transform: none; transition: opacity .5s ease .35s, transform .5s ease .35s; }
.rq-triple > .rq-i-1 { opacity: 0; transform: translateY(35%); transition: opacity .35s ease, transform .35s ease; }
.rq-triple > .rq-i-2 { opacity: 0; transform: translateY(-35%); transition: opacity .35s ease, transform .35s ease; }
/* Con \`lineas\`, cada idioma se corta en ese número de renglones: la altura máxima de un título es conocida. */
.rq-fijo.rq-corta, .rq-triple.rq-corta > span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--lineas); overflow: hidden; }

/* Una pantalla que no puede con tanto efecto: /qr?ligero=1 quita el video, el desenfoque y las luces. */
.rq-ligero .rq-tarjeta, .rq-ligero .rq-vivo { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(6,18,70,.92); }
.rq-ligero .rq-orbes { display: none; }
.rq-ligero .rq-anillo { animation: none; }

/* Quien pidió menos movimiento: sin animaciones, y en un solo idioma. */
@media (prefers-reduced-motion: reduce) {
  .rq *, .rq *::before, .rq *::after { animation: none !important; transition: none !important; }
  .rq-triple > span:first-child { opacity: 1 !important; transform: none !important; }
  .rq-triple > span:not(:first-child) { display: none; }
  .rq-escaneo { display: none; }
}
@media print { .rq { display: none; } }
`;

/** `3.2u` → `calc(var(--u)*3.2)`. */
export const ESTILOS = HOJA.replace(/(-?\d*\.?\d+)u\b/g, 'calc(var(--u)*$1)');
