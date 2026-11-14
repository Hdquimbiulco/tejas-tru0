// =============================================================================
// PALABRA "TRUVEC" HECHA DE TEJAS 3D (pie de página)
// -----------------------------------------------------------------------------
// Las letras se arman con tejas 3D. Al pasar el mouse, las tejas bajo el
// cursor se levantan y, al irse, vuelven a caer con un pequeño rebote (el
// mismo movimiento que tenían las tejas de la sección Preguntas). Todas son
// tejas coloniales mate en tonos terracota.
//
// Cómo se arma: se escribe la palabra en un canvas 2D invisible (la
// "plantilla") y sólo se pone una teja donde ese punto cae dentro de una
// letra. El fondo de la escena es del color del pie, así que sólo se ven
// las letras y su sombra.
//
// Usa Three.js. Piezas básicas: renderer (dibuja en el <canvas>), scene (el
// "mundo"), camera (desde dónde se mira), luz y mesh (objeto = forma + material).
// HTML: <div class="palabra-tejas"> con <canvas id="palabraTejas">.
// Lo llama main.js, sección 6: crearPalabra(canvas).
// =============================================================================
import {
  WebGLRenderer, Scene, OrthographicCamera, PMREMGenerator, InstancedMesh, CylinderGeometry,
  MeshStandardMaterial, ShadowMaterial, Object3D, Color, DirectionalLight,
  Mesh, PlaneGeometry, Raycaster, Vector2, Vector3, Plane, PCFShadowMap, ACESFilmicToneMapping,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const PALABRA = 'TRUVEC';
const ANCHO = 30;         // ancho del campo en unidades 3D (no son píxeles)
const PROPORCION = 4.2;   // ancho / alto del canvas (igual que aspect-ratio en CSS)
const PASO = 0.27;        // distancia entre tejas de una misma fila
const FILA = 0.38;        // distancia entre filas
const ALTURA_MAX = 0.75;  // cuánto sube una teja justo bajo el cursor
const RADIO = 1.1;        // alcance del cursor
const FONDO = 0xfaf7f2;   // color del pie (var(--fondo) en CSS)

// Colores de las tejas: para cambiar los tonos, cambiar estos códigos.
const COLONIAL = ['#b5562f', '#c4683c', '#a94c2a', '#cf7a48', '#9e4a2c', '#bb6036'];

export function crearPalabra(canvas) {
  // --- Dibujante (calidad reducida para no hacer lento el sitio) -------------
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(FONDO);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  // --- Cámara ortográfica (sin perspectiva: las letras no se deforman),
  // inclinada 42° para que se vea el relieve de las tejas y cómo se levantan.
  const alto = ANCHO / PROPORCION;
  const camera = new OrthographicCamera(-ANCHO / 2, ANCHO / 2, alto / 2, -alto / 2, 0.1, 100);
  const inclinacion = (42 * Math.PI) / 180;
  camera.position.set(0, 20 * Math.cos(inclinacion), 20 * Math.sin(inclinacion));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  // --- Luz tipo sol (cálida) que proyecta sombras ----------------------------
  const sol = new DirectionalLight(0xffe7cc, 2.4);
  sol.position.set(-6, 10, 5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 1024);
  Object.assign(sol.shadow.camera, { left: -17, right: 17, top: 8, bottom: -8 });
  sol.shadow.normalBias = 0.02;
  scene.add(sol);

  // Piso invisible que sólo muestra las sombras de las tejas.
  const piso = new Mesh(new PlaneGeometry(ANCHO + 6, 20), new ShadowMaterial({ opacity: 0.18 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  scene.add(piso);

  // --- Plantilla: la palabra escrita en un canvas 2D invisible ---------------
  const plantilla = document.createElement('canvas');
  plantilla.width = 1680;
  plantilla.height = Math.round(1680 / PROPORCION);
  const p2d = plantilla.getContext('2d', { willReadFrequently: true });
  const fuente = (t) => `800 ${t}px "Helvetica Neue", Arial, sans-serif`;
  p2d.font = fuente(100);
  // Tamaño de letra para que la palabra ocupe el 96 % del ancho
  const tam = (100 * plantilla.width * 0.96) / p2d.measureText(PALABRA).width;
  p2d.font = fuente(tam);
  const medida = p2d.measureText(PALABRA);
  const izquierda = (plantilla.width - medida.width) / 2;
  const base = (plantilla.height + medida.actualBoundingBoxAscent) / 2;
  p2d.fillText(PALABRA, izquierda, base);
  const pixeles = p2d.getImageData(0, 0, plantilla.width, plantilla.height).data;

  // ¿El punto 3D (x, 0, z) cae dentro de una letra? Se proyecta a la
  // pantalla con la cámara y se mira ese píxel de la plantilla.
  const v = new Vector3();
  function enLetra(x, z) {
    v.set(x, 0, z).project(camera);   // da coordenadas de -1 a 1
    const px = Math.round(((v.x + 1) / 2) * plantilla.width);
    const py = Math.round(((1 - v.y) / 2) * plantilla.height);
    if (px < 0 || py < 0 || px >= plantilla.width || py >= plantilla.height) return false;
    return pixeles[(py * plantilla.width + px) * 4 + 3] >= 128;
  }

  // --- Colocar las tejas: filas que se traslapan, las impares corridas media teja
  const piezas = [];
  const filas = Math.ceil(alto / Math.cos(inclinacion) / FILA) + 4;
  for (let f = 0; f < filas; f += 1) {
    for (let c = 0; c * PASO < ANCHO; c += 1) {
      const x = -ANCHO / 2 + c * PASO + (f % 2) * PASO * 0.5 + PASO / 2;
      const z = -(filas * FILA) / 2 + f * FILA;
      if (!enLetra(x, z)) continue;
      // h = altura actual, v = velocidad (para el efecto de resorte)
      piezas.push({ x, z, h: 0, v: 0, color: new Color(COLONIAL[piezas.length % COLONIAL.length]) });
    }
  }

  // Teja colonial: medio cilindro abierto y mate.
  const geo = new CylinderGeometry(PASO / 2, PASO / 2, FILA * 1.3, 12, 1, true, Math.PI / 2, Math.PI);
  geo.rotateX(Math.PI / 2);
  // InstancedMesh: dibuja cientos de copias de la misma teja de una sola vez.
  const tejas = new InstancedMesh(geo, new MeshStandardMaterial({ roughness: 0.82, side: 2 }), piezas.length);
  tejas.castShadow = true;
  tejas.receiveShadow = true;
  piezas.forEach((p, i) => tejas.setColorAt(i, p.color));
  scene.add(tejas);

  // --- Mover las tejas según el cursor (resorte) -----------------------------
  const dummy = new Object3D();
  function actualizar(objetivo) {
    let movimiento = 0;
    piezas.forEach((p, i) => {
      let meta = 0;
      if (objetivo) {
        // Curva en forma de campana: cuanto más cerca del cursor, más sube
        const d2 = (p.x - objetivo.x) ** 2 + (p.z - objetivo.z) ** 2;
        meta = ALTURA_MAX * Math.exp(-d2 / (2 * (RADIO / 2) ** 2));
      }
      p.v += (meta - p.h) * 0.12;   // fuerza del resorte
      p.v *= 0.78;                  // freno (si se sube a 0.9, rebota más)
      p.h += p.v;
      movimiento += Math.abs(p.v) + Math.abs(meta - p.h);
      dummy.position.set(p.x, 0.05 + p.h, p.z);
      dummy.rotation.set(-0.16 - p.h * 0.9, 0, p.h * 0.6 * Math.sign(p.x - (objetivo ? objetivo.x : p.x)));
      dummy.updateMatrix();
      tejas.setMatrixAt(i, dummy.matrix);
    });
    tejas.instanceMatrix.needsUpdate = true;
    return movimiento;
  }
  // --- Cursor: posición del mouse convertida en un punto sobre el piso 3D ----
  const raycaster = new Raycaster();
  const plano = new Plane(new Vector3(0, 1, 0), 0);
  const punto = new Vector3();
  const raton = new Vector2();
  let objetivo = null;   // punto bajo el cursor (null = el cursor no está)
  let activo = false;    // la palabra está en pantalla
  let corriendo = false; // la animación está corriendo

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    raton.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(raton, camera);
    objetivo = raycaster.ray.intersectPlane(plano, punto) ? punto : null;
    arrancar();
  });
  canvas.addEventListener('pointerleave', () => { objetivo = null; arrancar(); });

  // Un cuadro de animación (unas 60 veces por segundo mientras haya movimiento).
  function cuadro() {
    const m = actualizar(objetivo);
    renderer.render(scene, camera);
    if (!activo || (!objetivo && m < 0.001)) {
      corriendo = false;
      return;
    }
    requestAnimationFrame(cuadro);
  }
  function arrancar() {
    if (corriendo || !activo) return;
    corriendo = true;
    requestAnimationFrame(cuadro);
  }

  // Ajusta el dibujo al tamaño del canvas en pantalla (la proporción la fija el CSS).
  // Si el tamaño no cambió (por ejemplo, la barra del navegador del celular
  // apareció o se escondió), no hace nada.
  let anchoPrevio = 0;
  function ajustarTamano() {
    if (canvas.clientWidth === anchoPrevio) return;
    anchoPrevio = canvas.clientWidth;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.render(scene, camera);
  }
  addEventListener('resize', ajustarTamano);
  actualizar(null);   // posición inicial: todas abajo
  ajustarTamano();

  // Sólo anima mientras la palabra está en pantalla (ahorra batería).
  new IntersectionObserver(([e]) => {
    activo = e.isIntersecting;
    arrancar();
  }).observe(canvas);
}
