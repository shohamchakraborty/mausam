import * as THREE from "three";
import { BANK_TOP, RIVER_EDGE, mat, box } from "./helpers.js";
import { buildKolkata } from "./kolkata.js";
import { buildGenericCity } from "./generic.js";
import { createWeather } from "./weather.js";

// ---------- 1. The basics: renderer, scene, camera ----------
const canvas = document.getElementById("bg");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#cfe3f1", 110, 380);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const CAMERA_HOME = new THREE.Vector3(0, 12, 88);
const LOOK_AT = new THREE.Vector3(0, 10, 0);
camera.position.copy(CAMERA_HOME);

// ---------- 2. Sky: a giant ball around us, coloured by a tiny shader ----------
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(500, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color("#3f7fcf") },
      bottomColor: { value: new THREE.Color("#cfe3f1") },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorld;
      void main() {
        float h = max(normalize(vWorld).y, 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.6)), 1.0);
      }`,
  })
);
sky.renderOrder = -1;  // always draw the sky first, behind everything
scene.add(sky);

// Let shiny things (water, steel) reflect the sky
const pmrem = new THREE.PMREMGenerator(renderer);
const skyOnly = new THREE.Scene();
skyOnly.add(sky.clone());
scene.environment = pmrem.fromScene(skyOnly).texture;

// ---------- 3. Lights ----------
const hemi = new THREE.HemisphereLight("#dbeeff", "#8a7a60", 1.4);
scene.add(hemi);

const sun = new THREE.DirectionalLight("#fff4e0", 2.6);
sun.position.set(-60, 90, 50);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 80, bottom: -80, far: 350 });
scene.add(sun);

// ---------- 4. Ground: two riverbanks + roads ----------
const stone = mat("#b3a58c");
const asphalt = mat("#4a4a4f");
const bankWidth = 160;
for (const side of [-1, 1]) {
  scene.add(box(bankWidth, BANK_TOP, 600, stone, side * (RIVER_EDGE + bankWidth / 2), BANK_TOP / 2, 0));
  scene.add(box(bankWidth, 0.4, 6, asphalt, side * (RIVER_EDGE + bankWidth / 2), BANK_TOP, 0));
}

// ---------- 5. The river: a bumpy plane we animate every frame ----------
const waterGeo = new THREE.PlaneGeometry(64, 500, 40, 200);
waterGeo.rotateX(-Math.PI / 2);
const water = new THREE.Mesh(
  waterGeo,
  new THREE.MeshStandardMaterial({ color: "#2f6a9e", flatShading: true, roughness: 0.12, metalness: 0.3 })
);
water.position.set(0, 0.6, 0);
water.receiveShadow = true;
scene.add(water);
const waterBase = waterGeo.attributes.position.array.slice();

function animateWater(t) {
  const pos = waterGeo.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    const x = waterBase[i];
    const z = waterBase[i + 2];
    pos[i + 1] = Math.sin(x * 0.5 + t * 1.2) * 0.18 + Math.cos(z * 0.35 + t * 0.9) * 0.25;
  }
  waterGeo.attributes.position.needsUpdate = true;
  waterGeo.computeVertexNormals();
}

// ---------- 6. The city: Kolkata is hand-built, everywhere else is generated ----------
function isKolkata(place) {
  return Math.abs(place.lat - 22.57) < 0.35 && Math.abs(place.lon - 88.36) < 0.35;
}

let city = buildKolkata();
let cityKey = "kolkata";
scene.add(city.group);

let lift = 0;        // how far the camera has risen into the clouds
let liftTarget = 0;
const curtain = document.getElementById("curtain");

function changeCity(place) {
  const key = isKolkata(place) ? "kolkata" : place.name;
  if (key === cityKey) return;
  cityKey = key;

  // 1. Rise up and fade the screen to the colour of the sky
  liftTarget = 30;
  curtain.style.background = "#" + scene.fog.color.getHexString();
  curtain.classList.add("show");

  // 2. While hidden, swap the old city for the new one
  setTimeout(() => {
    scene.remove(city.group);
    city.group.traverse((obj) => obj.geometry && obj.geometry.dispose());  // free the memory
    city = key === "kolkata" ? buildKolkata() : buildGenericCity(place);
    city.setNight(weather.night);
    scene.add(city.group);

    // 3. Drop back down and fade the screen back in
    liftTarget = 0;
    curtain.classList.remove("show");
  }, 800);
}

// ---------- 7. Weather: rain, clouds, lightning, fog, night ----------
const weather = createWeather({ scene, sky, sun, hemi, water });

// app.js fetches the real weather and announces it; we listen here
function applyWeather(w) {
  weather.set(w.scene, w.isDay);
  if (w.place) changeCity(w.place);
}
if (window.currentWeather) applyWeather(window.currentWeather);  // in case it arrived before us
window.addEventListener("weather", (e) => applyWeather(e.detail));

// ---------- 8. Mouse parallax + animation loop ----------
const mouse = { x: 0, y: 0 };
window.addEventListener("pointermove", (e) => {
  mouse.x = e.clientX / window.innerWidth - 0.5;
  mouse.y = e.clientY / window.innerHeight - 0.5;
});

function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  // On tall phone screens, widen the lens instead of backing away
  camera.fov = aspect < 1 ? 45 + (1 - aspect) * 30 : 45;
  camera.position.z = CAMERA_HOME.z;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", fitCamera);
fitCamera();

// ---------- 9. Quality: if this device struggles, quietly lower the detail ----------
let measuring = { start: null, frames: 0, done: false };

function lowerQuality(reason) {
  renderer.setPixelRatio(1);               // fewer pixels to draw
  renderer.shadowMap.enabled = false;      // shadows are expensive
  scene.traverse((obj) => obj.material && (obj.material.needsUpdate = true));
  weather.setDetail(0.5);                  // half the raindrops
  console.log(`Mausam: ${reason}, switched to lighter graphics`);
}

// Test switch in the web address: ?quality=high or ?quality=low
const forcedQuality = new URLSearchParams(window.location.search).get("quality");
if (forcedQuality === "high") measuring.done = true;
if (forcedQuality === "low") {
  measuring.done = true;
  lowerQuality("low quality requested");
}

function checkSpeed(t) {
  if (measuring.done) return;
  if (measuring.start === null) {
    if (t > 1.5) measuring.start = t;   // skip the first moments (loading hiccups)
    return;
  }
  measuring.frames++;
  const elapsed = t - measuring.start;
  if (elapsed < 3) return;
  measuring.done = true;
  const fps = measuring.frames / elapsed;
  if (fps < 40) lowerQuality(`running at ${fps.toFixed(0)} fps`);
}

// People who turn on "reduce motion" in their system settings get a still camera
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clock = new THREE.Clock();
const lookTarget = LOOK_AT.clone();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);  // seconds since the last frame
  const t = clock.elapsedTime;                 // seconds since the page opened

  checkSpeed(t);
  animateWater(t);
  weather.update(dt, t);
  city.setNight(weather.night);
  city.update(t);

  // On phones the screen is narrow, so the camera slowly pans along the riverfront
  const portrait = camera.aspect < 1;
  const sweep = calm ? 0 : portrait ? Math.sin(t * 0.07) * 32 : Math.sin(t * 0.1) * 2;

  // Camera gently drifts toward the mouse (and rises during a city change)
  lift += (liftTarget - lift) * 0.05;
  const targetX = CAMERA_HOME.x + sweep + mouse.x * 8;
  const targetY = CAMERA_HOME.y - mouse.y * 4 + lift;
  camera.position.x += (targetX - camera.position.x) * 0.03;
  camera.position.y += (targetY - camera.position.y) * 0.03;
  lookTarget.x = portrait ? sweep * 0.8 : 0;
  lookTarget.y = LOOK_AT.y + lift * 1.2;
  camera.lookAt(lookTarget);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
