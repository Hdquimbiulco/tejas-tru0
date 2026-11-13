// =============================================================================
// TEJAS 3D DE LA SECCIÓN PREGUNTAS
// -----------------------------------------------------------------------------
// Campo de tejas que se levantan bajo el cursor y vuelven a bajar con rebote.
// Teja colonial mate en filas que se traslapan (referencia aw.png).
//
// Usa Three.js, una librería de 3D. Las piezas básicas son:
//   - renderer: dibuja la escena 3D dentro del <canvas id="tejasCampo">.
//   - scene:    el "mundo" donde se ponen objetos y luces.
//   - camera:   desde dónde se mira.
//   - luz:      ilumina y proyecta sombras.
//   - mesh:     un objeto visible = forma (geometry) + material (color, brillo).
//
// Lo llama main.js, sección 6: crearCampo(canvas, sección de preguntas).
// =============================================================================
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, InstancedMesh, CylinderGeometry,
  MeshStandardMaterial, Object3D, Color, DirectionalLight, Mesh,
  PlaneGeometry, Raycaster, Vector2, Vector3, Plane, PCFShadowMap, ACESFilmicToneMapping,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Medidas del campo en unidades 3D (no son píxeles).
const ANCHO = 18; // campo más ancho que la pantalla
const FONDO = 10; // profundidad del campo
const ALTURA_MAX = 0.55; // cuánto sube una teja justo bajo el cursor
const RADIO = 1.25; // alcance del cursor

// Arma la lista de tejas con su posición y su color (los colores se repiten
// en orden desde "palette").
function colocar(lista, palette, generar) {
  const piezas = [];
  generar((x, z, rotY, rotX) => {
    // h = altura actual, v = velocidad (para el efecto de resorte)
    piezas.push({ x, z, rotY, rotX, h: 0, v: 0, color: new Color(palette[piezas.length % palette.length]) });
  });
  return piezas;
}

export function crearCampo(canvas, zona) {
  // --- Dibujante -------------------------------------------------------------
  // CALIDAD REDUCIDA para que el sitio no se ponga lento al mover el cursor:
  // - antialias: false → sin suavizado de bordes (es de lo que más cuesta).
  // - setPixelRatio(1) → dibuja 1 punto por píxel aunque la pantalla sea
  //   "retina" (antes hasta 1,75 × 1,75 = 3 veces más puntos).
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.toneMapping = ACESFilmicToneMapping;    // colores con aspecto de cine
  renderer.shadowMap.enabled = true;               // activa las sombras
  renderer.shadowMap.type = PCFShadowMap;

  // --- Escena ----------------------------------------------------------------
  const scene = new Scene();
  scene.background = new Color(0xf1ebe2);   // color de fondo (0x + código hex, igual que #f1ebe2)
  // Luz ambiente suave, como de una habitación, para que las tejas no se vean planas.
  scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  // --- Cámara ----------------------------------------------------------------
  // PerspectiveCamera(ángulo de visión, proporción, distancia mínima, distancia máxima)
  const camera = new PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 9.5, 6.2);   // x (lado), y (altura), z (hacia la persona)
  camera.lookAt(0, 0, 0.4);           // hacia dónde mira

  // --- Luz tipo sol (cálida) que proyecta sombras ----------------------------
  const sol = new DirectionalLight(0xffe7cc, 2.4);   // color, intensidad
  sol.position.set(-5, 9, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);                // calidad de la sombra (antes 2048: 4 veces más trabajo)
  Object.assign(sol.shadow.camera, { left: -10, right: 10, top: 7, bottom: -7 });
  sol.shadow.normalBias = 0.03;
  scene.add(sol);

  // --- Piso debajo de las tejas (recibe las sombras) -------------------------
  const base = new Mesh(new PlaneGeometry(ANCHO + 4, FONDO + 4), new MeshStandardMaterial({ color: 0xe9dfd2, roughness: 1 }));
  base.rotation.x = -Math.PI / 2;   // gira el plano para que quede acostado (Math.PI = 180°)
  base.position.y = -0.02;
  base.receiveShadow = true;
  scene.add(base);

  // Medias cañas convexas en filas que se traslapan, cada fila un poco más alta
  const PASO_A = 0.5;   // distancia entre tejas de una misma fila
  const FILA_A = 0.72;  // distancia entre filas
  // Lista de colores de teja: para cambiar los tonos, cambiar estos códigos.
  const piezasA = colocar([], ['#b5562f', '#c4683c', '#a94c2a', '#cf7a48', '#9e4a2c', '#bb6036'], (agregar) => {
    for (let f = 0; f * FILA_A < FONDO; f += 1) {        // f = número de fila
      for (let c = 0; c * PASO_A < ANCHO; c += 1) {      // c = número de columna
        // Las filas impares se corren media teja, como en un techo real.
        const x = -ANCHO / 2 + c * PASO_A + (f % 2) * PASO_A * 0.5 + PASO_A / 2;
        agregar(x, -FONDO / 2 + f * FILA_A, 0, -0.16);
      }
    }
  });
  // Forma de una teja: medio cilindro abierto (radio 0.25, largo 0.95).
  // 12 = cantidad de caras de la curva (antes 24; a esta distancia no se nota).
  const geoA = new CylinderGeometry(0.25, 0.25, 0.95, 12, 1, true, Math.PI / 2, Math.PI);
  geoA.rotateX(Math.PI / 2);
  // InstancedMesh: dibuja cientos de copias de la misma teja de una sola vez
  // (mucho más rápido que crear un objeto por teja).
  const tejasA = new InstancedMesh(geoA, new MeshStandardMaterial({ roughness: 0.82, side: 2 }), piezasA.length);

  for (const [malla, piezas] of [[tejasA, piezasA]]) {
    malla.castShadow = true;
    malla.receiveShadow = true;
    piezas.forEach((p, i) => malla.setColorAt(i, p.color));
    scene.add(malla);
  }

  // Calcula la altura de cada teja según la distancia al cursor y la coloca.
  // Devuelve cuánto se están moviendo todas (para saber si ya se quedaron quietas).
  const dummy = new Object3D();
  function actualizar(malla, piezas, altoBase, objetivo) {
    let movimiento = 0;
    piezas.forEach((p, i) => {
      let meta = 0;
      if (objetivo) {
        // d2 = distancia al cursor (al cuadrado). Cuanto más cerca, más sube
        // (curva en forma de campana: Math.exp).
        const d2 = (p.x - objetivo.x) ** 2 + (p.z - objetivo.z) ** 2;
        meta = ALTURA_MAX * Math.exp(-d2 / (2 * (RADIO / 2) ** 2));
      }
      // Resorte: sube hacia la meta y, al irse el cursor, cae con un pequeño rebote
      p.v += (meta - p.h) * 0.12;   // fuerza del resorte
      p.v *= 0.78;                  // freno (si se sube a 0.9, rebota más)
      p.h += p.v;
      movimiento += Math.abs(p.v) + Math.abs(meta - p.h);
      dummy.position.set(p.x, altoBase + p.h, p.z);
      dummy.rotation.set(p.rotX - p.h * 0.5, p.rotY, p.h * 0.35 * Math.sign(p.x - (objetivo ? objetivo.x : p.x)));
      dummy.updateMatrix();
      malla.setMatrixAt(i, dummy.matrix);
    });
    malla.instanceMatrix.needsUpdate = true;
    return movimiento;
  }

  // --- Cursor: convierte la posición del mouse en un punto sobre el piso 3D --
  const raycaster = new Raycaster();               // "rayo" desde la cámara hacia el mouse
  const plano = new Plane(new Vector3(0, 1, 0), 0);
  const punto = new Vector3();
  const raton = new Vector2();
  let objetivo = null;   // punto bajo el cursor (null = el cursor no está)
  let activo = false;    // la sección está en pantalla
  let corriendo = false; // la animación está corriendo

  // pointermove: el mouse (o el dedo) se mueve sobre la sección de preguntas.
  zona.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    // Pasa la posición del mouse a coordenadas de -1 a 1.
    raton.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(raton, camera);
    objetivo = raycaster.ray.intersectPlane(plano, punto) ? punto : null;
    arrancar();
  });
  // pointerleave: el mouse sale de la sección → las tejas bajan.
  zona.addEventListener('pointerleave', () => { objetivo = null; arrancar(); });

  // Un cuadro de animación: mueve las tejas y dibuja. requestAnimationFrame
  // pide al navegador llamar otra vez en el siguiente cuadro (unas 60 veces
  // por segundo).
  function cuadro() {
    const m = actualizar(tejasA, piezasA, 0.06, objetivo);
    renderer.render(scene, camera);
    // Sin cursor y con todas las tejas quietas, deja de dibujar
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

  // Ajusta el dibujo al tamaño del canvas en pantalla.
  function ajustarTamano() {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // En pantallas angostas la cámara se aleja para cubrir más ancho
    const lejos = Math.max(1, 1.5 / camera.aspect);
    camera.position.set(0, 9.5 * lejos, 6.2 * lejos);
    camera.lookAt(0, 0, 0.4);
    camera.updateProjectionMatrix();
    if (activo) arrancar();
    else renderer.render(scene, camera);
  }
  addEventListener('resize', ajustarTamano);
  actualizar(tejasA, piezasA, 0.06, null);   // posición inicial: todas abajo
  ajustarTamano();

  // Sólo anima mientras la sección de preguntas está en pantalla (ahorra batería).
  new IntersectionObserver(([e]) => {
    activo = e.isIntersecting;
    arrancar();
  }).observe(zona);
}
