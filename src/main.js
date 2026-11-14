// =============================================================================
// JAVASCRIPT PRINCIPAL DEL SITIO
// -----------------------------------------------------------------------------
// Aquí está todo lo que se MUEVE o REACCIONA: la carga, los videos atados al
// scroll, las animaciones, la calculadora, el envío por WhatsApp/correo y el
// menú del celular.
//
// Partes del archivo (buscar el título con Ctrl+F):
//   0. CARGA                      → pantalla de carga con porcentaje
//   1. ESCENAS DE VIDEO           → portada y policarbonato con scroll
//   2. PALABRAS QUE SE ENCIENDEN  → "Por qué cambiar de techo" y la cita
//   3. VIDEOS NORMALES            → los videos de Materiales
//   4. MATERIALES                 → miniaturas de PVC y entrada de tarjetas
//   5. COTIZAR                    → WhatsApp, correo y calculadora
//   5b. MENÚ EN CELULAR
//   6. PIE                        → TRUVEC de tejas 3D
//   7. LOGO CLARO SOBRE VIDEO
//   8. FIN DE LA CARGA
//
// Herramientas que se usan:
// - GSAP: librería de animación. gsap.to(elemento, {propiedad: valor}) anima
//   desde como está ahora HASTA ese valor; gsap.from(...) anima DESDE ese
//   valor hasta como está.
// - ScrollTrigger: complemento de GSAP que ata una animación al scroll.
//     trigger  → el elemento que vigila
//     start    → cuándo empieza: 'top 85%' = cuando el borde de arriba del
//                elemento llega al 85 % de la altura de la ventana
//     end      → cuándo termina
//     scrub    → la animación avanza y retrocede con el scroll (no sola)
//     pin      → deja el elemento fijo mientras dura el recorrido
// =============================================================================

// "import" trae código de otros archivos o librerías instaladas (node_modules).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cargarFotogramas, crearSecuencia } from './secuencia.js';  // fotogramas en canvas
import { crearPalabra } from './palabraTejas.js';                    // TRUVEC de tejas 3D del pie

gsap.registerPlugin(ScrollTrigger);

// Atajos para buscar elementos del HTML:
//   $('#cotizar')   → el PRIMER elemento que coincide (o null)
//   $$('.boton')    → TODOS los que coinciden, como lista (array)
// Los selectores son los mismos que en el CSS: '#id', '.clase', 'etiqueta'.
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// true si la persona pidió "reducir movimiento" en su sistema: entonces no se
// crean animaciones (se ve en cada "if (!quieto)").
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
// true si la ventana mide menos de 768 px de ancho (celular).
const celular = innerWidth < 768;
// Pone class="cargando" en <html>: el CSS bloquea el scroll mientras carga.
document.documentElement.classList.add('cargando');

// ---------------------------------------------------------------------------
// 0. CARGA — el porcentaje cuenta recursos terminados, no tiempo
// HTML: #carga, #cargaPct, #cargaBarra. CSS: sección 3.
// ---------------------------------------------------------------------------
// En celular se descarga 1 de cada 2 fotogramas (PASO 2) para cargar más rápido.
const PASO = celular ? 2 : 1;
// Todas las secciones con data-frames (las escenas de video con scroll).
const escenas = $$('[data-frames]');
// Todas las fotos y videos marcados con data-cargar en el HTML.
const medios = $$('[data-cargar]');
const PESO_MEDIO = 12; // un video o foto cuenta como varios fotogramas
// Total de "unidades" a cargar: fotogramas de cada escena + fotos/videos.
// reduce() recorre la lista sumando; Math.ceil redondea hacia arriba.
const totalCarga = escenas.reduce((n, e) => n + Math.ceil(e.dataset.total / PASO), 0)
  + medios.length * PESO_MEDIO;
let cargado = 0;
// Se llama cada vez que termina de cargar algo: actualiza el número y la barra.
function sumar(n = 1) {
  cargado += n;
  const pct = Math.min(100, Math.round((cargado / totalCarga) * 100));
  $('#cargaPct').textContent = `${pct} %`;                       // texto "45 %"
  $('#cargaBarra').style.transform = `scaleX(${pct / 100})`;     // estira la línea naranja
}

// Devuelve una "promesa" que se cumple cuando la foto o el video están listos.
// (Una promesa es un aviso de "esto termina después"; await espera a que termine.)
function medioListo(el) {
  if (el.tagName === 'IMG') return el.decode().catch(() => {});
  if (el.readyState >= 4) return Promise.resolve();
  // Promise.race: lo que pase primero de estas tres cosas.
  return Promise.race([
    new Promise((listo) => { el.addEventListener('canplaythrough', listo, { once: true }); }),
    new Promise((listo) => { el.addEventListener('error', listo, { once: true }); }),
    // Algunos celulares no precargan video hasta reproducirlo: la carga no se queda detenida
    new Promise((listo) => { setTimeout(listo, 8000); }),   // 8000 ms = 8 segundos máximo
  ]);
}

// Espera a que TODO cargue: los fotogramas de las escenas y los medios.
// "fotogramas" queda con la lista de fotogramas de cada escena.
const [fotogramas] = await Promise.all([
  Promise.all(escenas.map((e) => cargarFotogramas(e.dataset.frames, +e.dataset.total, PASO, sumar))),
  ...medios.map((m) => medioListo(m).then(() => sumar(PESO_MEDIO))),
]);

// ---------------------------------------------------------------------------
// 1. ESCENAS DE VIDEO ATADAS AL SCROLL (portada y policarbonato)
// HTML: <section class="escena" data-frames data-total data-pantallas>.
// Cada escena se queda fija (pin) mientras se baja; el avance del scroll
// (de 0 a 1) decide qué fotograma se dibuja y qué textos se ven.
// ---------------------------------------------------------------------------
// Prepara un dibujante (secuencia.js) para el <canvas> de cada escena.
const secuencias = await Promise.all(
  escenas.map((e, i) => crearSecuencia(e.querySelector('canvas'), fotogramas[i])),
);
escenas.forEach((escena, i) => {
  const secuencia = secuencias[i];
  secuencia.liberar();
  if (quieto) return;
  // Línea de tiempo (timeline): agrupa varias animaciones en un recorrido de
  // 0 a 1. Su avance lo maneja el scroll.
  const tl = gsap.timeline({
    defaults: { ease: 'none', duration: 0.04 },
    // En cada cambio de avance, dibuja el fotograma que corresponde.
    onUpdate: () => secuencia.mostrar(tl.progress()),
    scrollTrigger: {
      trigger: escena,
      start: 'top top',                                   // cuando la escena toca el borde superior
      // dura data-pantallas pantallas de scroll (data-pantallas-movil en celular)
      end: `+=${(celular ? escena.dataset.pantallasMovil : escena.dataset.pantallas) * 100}%`,
      pin: true,                                          // la escena queda fija mientras tanto
      // computadora: sigue al scroll con 0.35 s de suavizado; celular: sigue al dedo sin retraso
      scrub: celular ? true : 0.35,
      onToggle: ({ isActive }) => { if (!isActive) secuencia.liberar(); },  // libera memoria al salir
    },
  });
  // Textos que aparecen y desaparecen según data-tramo="inicio,fin".
  escena.querySelectorAll('[data-tramo]').forEach((el) => {
    const [a, b] = el.dataset.tramo.split(',').map(Number);
    // autoAlpha = opacidad + visibilidad. y: 36 = 36 px más abajo.
    if (a > 0) tl.fromTo(el, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0 }, a);   // aparece en "a"
    if (b < 1) tl.to(el, { autoAlpha: 0, y: -36 }, b - 0.04);                       // se va en "b"
  });
  tl.set({}, {}, 1);   // asegura que la línea de tiempo dure exactamente hasta 1
});

// Línea de avance de arriba (#avance): crece de 0 a 1 desde el inicio
// ('start: 0') hasta el final de la página ('end: max').
if (!quieto) {
  gsap.to('#avance', {
    scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true },
  });
}

// ---------------------------------------------------------------------------
// 2. PALABRAS QUE SE ENCIENDEN (#ventajas y la cita #propuesta)
// HTML: <p class="encendido" data-calientes="pvc,|pp|policarbonato">.
// Envuelve cada palabra en un <span> y las anima de casi transparente
// (opacity 0.14) a visible, una tras otra, mientras se baja.
// ---------------------------------------------------------------------------
$$('.encendido').forEach((texto) => {
  // Lista de palabras a resaltar en naranja (vacía si no hay data-calientes).
  const calientes = (texto.dataset.calientes || '').split('|').filter(Boolean);
  // split(/\s+/) parte el texto en palabras; map arma un <span> por palabra.
  texto.innerHTML = texto.textContent.trim().split(/\s+/).map((w) => {
    const caliente = calientes.some((c) => w.toLowerCase().startsWith(c));
    return `<span${caliente ? ' class="caliente"' : ''}>${w}</span>`;
  }).join(' ');
  if (!quieto) {
    gsap.from(texto.querySelectorAll('span'), {
      opacity: 0.14, stagger: 0.05, ease: 'none',   // stagger: cada palabra empieza un poco después
      scrollTrigger: { trigger: texto, start: 'top 75%', end: 'bottom 45%', scrub: true },
    });
  }
});

// ---------------------------------------------------------------------------
// 3. VIDEOS NORMALES — se reproducen sólo a la vista
// IntersectionObserver avisa cuando un elemento entra o sale de la pantalla.
// threshold: 0.5 → cuando se ve al menos la mitad del video.
// ---------------------------------------------------------------------------
const reproducir = new IntersectionObserver((entradas) => {
  entradas.forEach(({ target, isIntersecting }) => {
    if (isIntersecting) target.play().catch(() => {});   // se ve: reproducir
    else target.pause();                                  // no se ve: pausar
  });
}, { threshold: 0.5 });
$$('video').forEach((v) => reproducir.observe(v));

// ---------------------------------------------------------------------------
// 4. MATERIALES — la tarjeta entra creciendo; las miniaturas cambian la foto
// HTML: .mat-miniaturas button[data-src], .mat-foto, .mat-tarjeta.
// ---------------------------------------------------------------------------
// Al hacer clic en una miniatura: pone su data-src en la foto grande y le da
// la clase "activo" sólo a esa miniatura (borde negro, CSS sección 6).
// data-src no lleva "/" inicial: BASE_URL le antepone la carpeta del sitio
// ("/" en local, "/<repositorio>/" en GitHub Pages). Vite no reescribe data-src.
$$('.mat-miniaturas button').forEach((boton) => boton.addEventListener('click', () => {
  const imagen = boton.closest('.mat-imagen');   // closest = el contenedor más cercano hacia arriba
  imagen.querySelector('.mat-foto').src = import.meta.env.BASE_URL + boton.dataset.src;
  imagen.querySelectorAll('button').forEach((b) => b.classList.toggle('activo', b === boton));
}));
if (!quieto) {
  $$('.mat-tarjeta').forEach((tarjeta) => {
    // La tarjeta entra desde 90 px más abajo, al 92 % de tamaño e invisible.
    // duration: 0.9 segundos. Sin scrub: se dispara una vez al llegar.
    gsap.from(tarjeta, {
      y: 90, scale: 0.92, autoAlpha: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: tarjeta, start: 'top 85%' },
    });
    // Después entran los 3 rasgos, uno tras otro (stagger 0.1 s).
    gsap.from(tarjeta.querySelectorAll('.mat-rasgos li'), {
      y: 24, autoAlpha: 0, stagger: 0.1, duration: 0.6, ease: 'power2.out',
      scrollTrigger: { trigger: tarjeta, start: 'top 70%' },
    });
  });
}

// ---------------------------------------------------------------------------
// 5. COTIZAR
// HTML: #calculo (calculadora), #contacto (formulario), [data-wa], .datos-venta.
// ---------------------------------------------------------------------------
// Datos de contacto de PRUEBA: reemplazar por el número y el correo reales de ventas.
// WHATSAPP va con código de país y sin "+" ni espacios (593 = Ecuador).
const WHATSAPP = '593999999999';
const CORREO = 'ventas@truvec.example';
// Pone el enlace de WhatsApp en todo elemento con data-wa (el botón verde fijo).
$$('[data-wa]').forEach((a) => { a.href = `https://wa.me/${WHATSAPP}`; });
// Escribe el número con espacios para leerlo: +593 99 999 9999.
// slice(a, b) toma los caracteres desde la posición a hasta antes de b.
$('[data-wa-texto]').textContent = `+${WHATSAPP.slice(0, 3)} ${WHATSAPP.slice(3, 5)} ${WHATSAPP.slice(5, 8)} ${WHATSAPP.slice(8)}`;
$('[data-correo-texto]').textContent = CORREO;

// Ancho útil por lámina (m) y peso por m²: se llenan con la ficha técnica; sin dato no se estima.
// Ejemplo cuando llegue el dato: const ANCHO_UTIL = { pp: 0.88, pc: 0.96, pvc: 0.96 };
// (pp, pc y pvc son los value del <select id="material"> del HTML).
const ANCHO_UTIL = { pp: null, pc: null, pvc: null };
const PESO_M2 = { pp: null, pc: null, pvc: null };
const TRASLAPE = 0.05;   // 5 % extra por traslapes y cortes
let pedido = {};         // guarda el último cálculo para mandarlo en el mensaje
// Lee los campos, calcula y escribe el resultado en <output id="resultado">.
function calcular() {
  const material = $('#material').value;
  // El "+" convierte el texto del campo en número; "|| 0" usa 0 si está vacío.
  const area = (+$('#largo').value || 0) * (+$('#ancho').value || 0);
  const conTraslape = area * (1 + TRASLAPE);
  const lamina = +$('#lamina').value || 0;
  const ancho = ANCHO_UTIL[material];
  // condición ? valor si sí : valor si no
  const laminas = ancho && lamina ? `${Math.ceil(conTraslape / (ancho * lamina))} láminas de ${lamina} m` : `Láminas de ${lamina} m: pendiente del ancho útil`;
  const peso = PESO_M2[material] ? `${Math.round(conTraslape * PESO_M2[material])} kg aproximados` : 'Peso: pendiente de la ficha técnica';
  pedido = { material: $('#material').selectedOptions[0].text, medidas: `${$('#largo').value} × ${$('#ancho').value} m`, area: `${area.toFixed(1)} m² (${conTraslape.toFixed(1)} m² con traslapes)`, lamina: `${lamina} m` };
  // toFixed(1) = un decimal. Las etiquetas strong/em/span tienen su estilo en CSS sección 11.
  $('#resultado').innerHTML = `<strong>${area.toFixed(1)} m²</strong><em>${conTraslape.toFixed(1)} m² con 5 % de traslapes y cortes</em><span>${laminas}</span><span>${peso}</span>`;
}
// Recalcula cada vez que se escribe o se cambia algo en la calculadora.
$('#calculo').addEventListener('input', calcular);
// Evita que la página se recargue si se presiona Enter dentro de la calculadora.
$('#calculo').addEventListener('submit', (e) => e.preventDefault());
calcular();   // primer cálculo con los valores iniciales (8 × 6)
// Los enlaces "Cotizar ..." con data-material dejan elegido ese material.
$$('[data-material]').forEach((a) => a.addEventListener('click', () => {
  $('#material').value = a.dataset.material;
  calcular();
}));
// El pedido sale con los datos del formulario y el cálculo, por WhatsApp o por correo
$('#contacto').addEventListener('submit', (e) => {
  e.preventDefault();                       // no recargar la página
  const datos = new FormData(e.target);     // lee los campos por su name="..."
  // Arma el mensaje línea por línea. filter(Boolean) quita la línea de ciudad
  // si quedó vacía; join('\n') las une con saltos de línea.
  const texto = [
    'Hola, quiero una cotización.',
    `Nombre: ${datos.get('nombre')}`,
    `Teléfono: ${datos.get('telefono')}`,
    datos.get('ciudad') && `Ciudad: ${datos.get('ciudad')}`,
    `Material: ${pedido.material}`,
    `Techo: ${pedido.medidas}, ${pedido.area}`,
    `Largo de lámina: ${pedido.lamina}`,
  ].filter(Boolean).join('\n');
  const aviso = $('#contactoAviso');
  // e.submitter es el botón que se presionó; su value es "wa" o "correo".
  if (e.submitter?.value === 'correo') {
    // mailto: abre el programa de correo con destinatario, asunto y texto.
    // encodeURIComponent convierte espacios y tildes para que viajen en el enlace.
    location.href = `mailto:${CORREO}?subject=${encodeURIComponent('Cotización de techo')}&body=${encodeURIComponent(texto)}`;
    aviso.textContent = 'Se abrió el correo con el pedido listo para enviar.';
  } else {
    // wa.me/<número>?text=<mensaje> abre WhatsApp con el mensaje escrito.
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    aviso.textContent = 'Se abrió WhatsApp con el pedido listo para enviar.';
  }
  aviso.hidden = false;   // muestra el mensaje de confirmación
});

// ---------------------------------------------------------------------------
// 5b. MENÚ EN CELULAR: se abre con el botón y se cierra al elegir una sección
// HTML: .barra, .menu-boton, .menu a. CSS: sección 13 (.barra.abierta .menu).
// ---------------------------------------------------------------------------
const barra = $('.barra');
const menuBoton = $('.menu-boton');
menuBoton.addEventListener('click', () => {
  // toggle: si la clase está, la quita; si no está, la pone. Devuelve si quedó puesta.
  const abierto = barra.classList.toggle('abierta');
  menuBoton.setAttribute('aria-expanded', abierto);   // informa a lectores de pantalla
});
$$('.menu a').forEach((a) => a.addEventListener('click', () => {
  barra.classList.remove('abierta');
  menuBoton.setAttribute('aria-expanded', 'false');
}));

// ---------------------------------------------------------------------------
// 6. PIE — palabra TRUVEC hecha de tejas 3D que se levantan bajo el cursor
// ---------------------------------------------------------------------------
// Código en palabraTejas.js. Se dibuja también con "reducir movimiento": las
// tejas sólo se mueven cuando la persona pasa el mouse.
crearPalabra($('#palabraTejas'));


// ---------------------------------------------------------------------------
// 7. LOGO CLARO SOBRE VIDEO
// La barra lleva logo claro mientras está sobre los videos oscuros del inicio:
// desde el principio hasta que #materiales llega a 40 px del borde superior,
// la barra tiene la clase "sobre-oscuro" (CSS sección 4).
// ---------------------------------------------------------------------------
ScrollTrigger.create({
  start: -1, endTrigger: '#materiales', end: 'top 40px',
  toggleClass: { targets: '.barra', className: 'sobre-oscuro' },
});

// ---------------------------------------------------------------------------
// 8. FIN DE LA CARGA
// Recalcula las posiciones de todas las animaciones, desbloquea el scroll y
// desvanece la pantalla de carga en 0.6 segundos.
// ---------------------------------------------------------------------------
ScrollTrigger.refresh();
document.documentElement.classList.remove('cargando');
gsap.to('#carga', { autoAlpha: 0, duration: 0.6, delay: 0.15 });
