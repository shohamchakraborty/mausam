import * as THREE from "three";
import { BANK_TOP, RIVER_EDGE, mat, box, beam, seededRandom } from "./helpers.js";
import { building, tree, traffic, nightLights } from "./city-kit.js";

// Any city that isn't hand-built gets a skyline generated from its name.
// Same name -> same seed -> same city on every visit.

// Turn text into a number (the same text always gives the same number)
function hashName(text) {
  let h = 2166136261;
  for (const ch of text.toLowerCase()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Bigger population -> denser, taller city. Returns 0.05 (village) ... 1 (megacity)
function densityFor(population) {
  if (!population) return 0.3;
  return Math.min(1, Math.max(0.05, (Math.log10(population) - 3) / 4));
}

const PALETTES = [
  ["#e8d5a9", "#e2b8a0", "#d6a760", "#f0dcc0", "#c9786a"],   // warm
  ["#dfe6ea", "#c3cfd8", "#aab8c2", "#e9ecef", "#8fa1ae"],   // cool
  ["#f4f1ea", "#ece4d4", "#e7dccb", "#f7f3ec", "#d9cdb8"],   // whitewashed
  ["#b4533c", "#a8664f", "#c98a6b", "#8f4a3a", "#d3b8a0"],   // brick
];
const CAR_COLOURS = ["#c0392b", "#2c3e50", "#ecf0f1", "#7f8c8d", "#2980b9", "#16a085", "#f39c12"];

// ----- Two kinds of bridge, chosen by the seed -----
function archBridge(glow) {
  const bridge = new THREE.Group();
  const steel = mat("#d7dde4", { metalness: 0.4, roughness: 0.4 });
  glow(steel, "#bcd4ff", 0.4);
  const DECK = 3.2;
  bridge.add(box(72, 0.5, 5.8, mat("#4a4a4f"), 0, DECK - 0.25, 0));
  for (const z of [-2.6, 2.6]) {
    let prev = null;
    for (let x = -26; x <= 26; x += 2) {
      const y = DECK + 16 * (1 - (x / 26) ** 2);   // a parabola: the arch shape
      const point = new THREE.Vector3(x, y, z);
      if (prev) bridge.add(beam(prev, point, 0.7, steel));
      if (x % 4 === 0 && Math.abs(x) < 26) bridge.add(beam(point, new THREE.Vector3(x, DECK, z), 0.12, steel));
      prev = point;
    }
  }
  for (const x of [-26, 26]) bridge.add(box(3, 3, 7, mat("#9c9383"), x, 1.2, 0));
  return bridge;
}

function cableBridge(glow) {
  const bridge = new THREE.Group();
  const white = mat("#eef1f4", { roughness: 0.5 });
  glow(white, "#ffffff", 0.35);
  const DECK = 3.2;
  bridge.add(box(72, 0.5, 5.8, mat("#4a4a4f"), 0, DECK - 0.25, 0));
  for (const tx of [-14, 14]) {
    bridge.add(box(3, 3, 7, mat("#9c9383"), tx, 1.2, 0));
    for (const z of [-2.8, 2.8]) bridge.add(beam(new THREE.Vector3(tx, 0, z), new THREE.Vector3(tx, 24, z * 0.2), 1, white));
    // Cables fanning out from the top of the tower down to the road
    for (let i = 1; i <= 6; i++) {
      for (const dir of [-1, 1]) {
        for (const z of [-2.6, 2.6]) {
          bridge.add(beam(new THREE.Vector3(tx, 23 - i * 0.8, z * 0.3), new THREE.Vector3(tx + dir * i * 3.2, DECK, z), 0.1, white));
        }
      }
    }
  }
  return bridge;
}

// ----- Mountains in the distance for high places -----
function mountains(rand, elevation) {
  const group = new THREE.Group();
  const rock = mat("#6f7f6a");
  const snow = mat("#f3f5f7");
  const scale = Math.min(1.4, elevation / 1500);
  for (let i = 0; i < 16; i++) {
    const h = (25 + rand() * 30) * scale;
    const r = h * (1 + rand() * 0.6);
    const x = -300 + i * 40 + rand() * 20;
    const z = -230 - rand() * 60;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rock);
    peak.position.set(x, h / 2, z);
    group.add(peak);
    if (elevation > 1800) {   // snow caps
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, h * 0.3, 7), snow);
      cap.position.set(x, h * 0.86, z);
      group.add(cap);
    }
  }
  return group;
}

// ================= Build a city from a place =================
export function buildGenericCity(place) {
  const lights = nightLights();
  const glow = lights.glow;
  const rand = seededRandom(hashName(place.name));
  const density = densityFor(place.population);
  const palette = PALETTES[Math.floor(rand() * PALETTES.length)];
  const hasRiver = rand() < 0.65;
  const hillTown = place.elevation > 1500;
  // Glass towers only in big cities (and never in hill towns)
  const towerChance = hillTown ? 0 : Math.max(0, density - 0.55) * 1.2;
  const root = new THREE.Group();

  if (hasRiver) {
    root.add(rand() < 0.5 ? archBridge(glow) : cableBridge(glow));
  } else {
    // No river here: fill the channel in and carry the road straight across
    root.add(box(RIVER_EDGE * 2 + 1, BANK_TOP, 600, mat("#a39a8b"), 0, BANK_TOP / 2, 0));
    root.add(box(RIVER_EDGE * 2 + 1, 0.4, 6, mat("#4a4a4f"), 0, BANK_TOP, 0));
  }

  // Buildings: more and taller for bigger cities
  const count = Math.round(20 + density * 180);
  let placed = 0;
  while (placed < count) {
    const x = -150 + rand() * 300;
    const z = 10 - rand() * 210;
    if (Math.abs(z) < 9) continue;                                  // keep the road clear
    if (hasRiver && Math.abs(x) < RIVER_EDGE + 6) continue;         // not in the river
    if (!hasRiver && Math.abs(x) < 10 && z > -60) continue;         // keep a clear view down the avenue
    const modern = z < -50 && rand() < towerChance;   // towers stay in the background
    root.add(building(rand, x, z, { palette, modern, tall: 0.7 + density * 0.8 }, glow));
    placed++;
  }

  // One signature tower for big cities
  if (density > 0.7 && !hillTown) {
    const h = 45 + density * 35;
    const tower = new THREE.Group();
    const glass = mat("#9fb3c6", { metalness: 0.5, roughness: 0.3 });
    glow(glass, "#cfe3ff", 0.35);
    tower.add(box(8, h, 8, glass, 0, h / 2, 0));
    tower.add(box(5, h * 0.2, 5, glass, 0, h * 1.1, 0));
    tower.add(beam(new THREE.Vector3(0, h * 1.2, 0), new THREE.Vector3(0, h * 1.2 + 12, 0), 0.3, mat("#dddddd")));
    tower.position.set((rand() < 0.5 ? -1 : 1) * (55 + rand() * 20), BANK_TOP, -110 - rand() * 30);
    root.add(tower);
  }

  // Trees: villages get more greenery than megacities
  const treeCount = Math.round(30 + (1 - density) * 80);
  for (let i = 0; i < treeCount; i++) {
    const x = -140 + rand() * 280;
    const z = 30 - rand() * 220;
    if (Math.abs(z) < 5 || (hasRiver && Math.abs(x) < RIVER_EDGE + 1)) continue;
    root.add(tree(rand, x, z));
  }

  if (place.elevation > 700) root.add(mountains(rand, place.elevation));

  const colours = [0, 1, 2].map(() => CAR_COLOURS[Math.floor(rand() * CAR_COLOURS.length)]);
  const moveCars = traffic(root, colours, 3.2, glow);

  return {
    group: root,
    update(time) {
      moveCars(time);
    },
    setNight(night) {
      lights.set(night);
    },
  };
}
