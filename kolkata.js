import * as THREE from "three";
import { BANK_TOP, RIVER_EDGE, mat, box, cyl, dome, pyramid, beam, seededRandom, paintTexture } from "./helpers.js";
import { building, tree, traffic, nightLights } from "./city-kit.js";

// Left bank (x < 0) is Howrah, right bank (x > 0) is Kolkata.
// Everything Kolkata-specific lives in this file. Another city = another file like this one.

// ================= Night lights =================
// Every material that should glow after dark is registered here with how strongly it glows.
let lights = nightLights();
const glowAtNight = (material, colour, strength) => lights.glow(material, colour, strength);

let bridgeSteel;

// Streaks of lamp light reflected on the river
// Bright near the bridge, fading out toward us, with soft sides
const reflectionTexture = paintTexture((g) => {
  const fade = g.createLinearGradient(0, 0, 0, 64);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, 64, 64);
  const sides = g.createLinearGradient(0, 0, 64, 0);
  sides.addColorStop(0, "rgba(0,0,0,1)");
  sides.addColorStop(0.5, "rgba(0,0,0,0)");
  sides.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = sides;
  g.fillRect(0, 0, 64, 64);
});
const reflectionMat = new THREE.MeshBasicMaterial({
  color: "#ffc56b", map: reflectionTexture, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
});
const reflections = [];

// ================= Howrah Bridge =================
function buildHowrahBridge() {
  const bridge = new THREE.Group();
  bridgeSteel = mat("#8d97aa", { metalness: 0.35, roughness: 0.55 });
  glowAtNight(bridgeSteel, "#5d6bff", 0.45);   // the bridge's colour-changing LED lighting
  const steel = bridgeSteel;
  const asphalt = mat("#4a4a4f");
  const DECK = 3.2;
  const HALF_WIDTH = 2.6;
  const TOWER_X = 20;
  const END_X = 36;
  const TOP_TOWER = 16;
  const TOP_MIDDLE = 9;

  // Height of the top steel line at any x (the famous "dip" in the middle)
  function topY(x) {
    const ax = Math.abs(x);
    if (ax <= TOWER_X) return TOP_MIDDLE + (TOP_TOWER - TOP_MIDDLE) * (ax / TOWER_X) ** 2;
    return TOP_TOWER - ((ax - TOWER_X) / (END_X - TOWER_X)) * (TOP_TOWER - DECK);
  }

  bridge.add(box(END_X * 2, 0.4, HALF_WIDTH * 2 + 0.6, asphalt, 0, DECK - 0.2, 0));

  // Two identical truss walls, one on each side of the road
  for (const z of [-HALF_WIDTH, HALF_WIDTH]) {
    for (let x = -END_X; x < END_X; x += 4) {
      const x2 = x + 4;
      const bottomA = new THREE.Vector3(x, DECK, z);
      const bottomB = new THREE.Vector3(x2, DECK, z);
      const topA = new THREE.Vector3(x, topY(x), z);
      const topB = new THREE.Vector3(x2, topY(x2), z);

      bridge.add(beam(bottomA, bottomB, 0.35, steel));
      bridge.add(beam(topA, topB, 0.45, steel));
      if (topY(x2) - DECK > 0.6) bridge.add(beam(bottomB, topB, 0.25, steel));
      bridge.add(beam(bottomA, topB, 0.18, steel));
      bridge.add(beam(topA, bottomB, 0.18, steel));
    }
  }

  // Cross beams joining the two walls at the top
  for (let x = -END_X + 4; x < END_X; x += 4) {
    const y = topY(x);
    if (y - DECK > 1.5) {
      bridge.add(beam(new THREE.Vector3(x, y, -HALF_WIDTH), new THREE.Vector3(x, y, HALF_WIDTH), 0.25, steel));
    }
  }

  // Towers and their stone piers
  const pier = mat("#9c9383");
  for (const x of [-TOWER_X, TOWER_X]) {
    bridge.add(box(3.2, 3.2, HALF_WIDTH * 2 + 3, pier, x, 1.2, 0));
    for (const z of [-HALF_WIDTH, HALF_WIDTH]) {
      bridge.add(box(1.1, TOP_TOWER + 1.5 - 2.8, 1.1, steel, x, (TOP_TOWER + 1.5 + 2.8) / 2, z));
    }
    bridge.add(beam(new THREE.Vector3(x, TOP_TOWER + 1, -HALF_WIDTH), new THREE.Vector3(x, TOP_TOWER + 1, HALF_WIDTH), 0.5, steel));
  }

  // Street lamps along the deck, red warning lights on the towers
  const lamp = mat("#4d3a1c");
  glowAtNight(lamp, "#ffc86b", 3);
  const warning = mat("#4a1a1a");
  glowAtNight(warning, "#ff3b3b", 3);
  for (let x = -32; x <= 32; x += 8) {
    for (const z of [-HALF_WIDTH - 0.3, HALF_WIDTH + 0.3]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lamp);
      bulb.position.set(x, DECK + 0.9, z);
      bridge.add(bulb);
    }
    if (Math.abs(x) < 28) {  // only lamps above water get a reflection
      const streak = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 26), reflectionMat);
      streak.rotation.x = -Math.PI / 2;
      streak.position.set(x, 1.15, HALF_WIDTH + 14);
      bridge.add(streak);
      reflections.push(streak);
    }
  }
  for (const x of [-TOWER_X, TOWER_X]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), warning);
    light.position.set(x, TOP_TOWER + 1.8, 0);
    bridge.add(light);
  }
  return bridge;
}

// ================= Dakshineswar Kali Temple =================
// A "nava-ratna" temple: nine spires on two levels, plus a central tall one.
function spire(size, height, material, tipMaterial) {
  // A curved temple tower made by spinning a profile line (like a pot on a wheel)
  const profile = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const radius = size * (1 - t ** 1.6) + 0.05;
    profile.push(new THREE.Vector2(radius, t * height));
  }
  const tower = new THREE.Mesh(new THREE.LatheGeometry(profile, 8), material);
  tower.castShadow = true;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(size * 0.18, 8, 6), tipMaterial);
  tip.position.y = height + size * 0.1;
  const group = new THREE.Group();
  group.add(tower, tip);
  return group;
}

function buildDakshineswar() {
  const temple = new THREE.Group();
  const cream = mat("#f0e4c8");
  const red = mat("#b8483a");
  const plinth = mat("#d4c3a3");
  const gold = mat("#d9a441", { metalness: 0.6, roughness: 0.4 });
  glowAtNight(cream, "#ffdca8", 0.35);   // floodlit at night
  glowAtNight(red, "#ff7a4d", 0.25);
  glowAtNight(gold, "#ffd27a", 0.6);

  temple.add(box(13, 2, 13, plinth, 0, 1, 0));   // raised platform
  temple.add(box(10, 4, 10, cream, 0, 4, 0));    // first storey
  temple.add(box(10.4, 0.4, 10.4, red, 0, 6.2, 0));
  temple.add(box(6, 3.5, 6, cream, 0, 8.15, 0)); // second storey
  temple.add(box(6.4, 0.4, 6.4, red, 0, 10.1, 0));

  // 4 spires on the first roof, 4 on the second, 1 big one in the middle
  const levels = [
    { y: 6.4, spread: 4, size: 1.1, height: 3 },
    { y: 10.3, spread: 2.4, size: 0.9, height: 2.6 },
  ];
  for (const lvl of levels) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const s = spire(lvl.size, lvl.height, red, gold);
      s.position.set(sx * lvl.spread, lvl.y, sz * lvl.spread);
      temple.add(s);
    }
  }
  temple.add(box(2.6, 1.6, 2.6, cream, 0, 11.1, 0));
  const top = spire(1.6, 5, red, gold);
  top.position.set(0, 11.9, 0);
  temple.add(top);

  return temple;
}

// The row of 12 small Shiva temples along the ghat, with steps into the river
function buildGhat() {
  const ghat = new THREE.Group();
  const cream = mat("#efe2c6");
  const roof = mat("#b8483a");
  const step = mat("#c9bda6");
  glowAtNight(cream, "#ffd9a0", 0.3);

  for (let i = 0; i < 12; i++) {
    const z = -11 + i * 2 + (i >= 6 ? 3 : 0);  // gap in the middle for the steps
    ghat.add(box(1.7, 1.8, 1.7, cream, 0, 0.9, z));
    ghat.add(pyramid(1.45, 1.4, roof, 0, 2.5, z));
  }
  // Steps going down into the water
  for (let s = 0; s < 5; s++) {
    ghat.add(box(1.2, 0.5, 4.5, step, -1.8 - s * 1.2, -0.25 - s * 0.5, 1));
  }
  return ghat;
}

// ================= Victoria Memorial =================
function buildVictoriaMemorial() {
  const vm = new THREE.Group();
  const marble = mat("#f3efe6", { roughness: 0.45 });
  glowAtNight(marble, "#ffe2b8", 0.35);
  const bronze = mat("#3d3a33", { metalness: 0.6, roughness: 0.4 });
  const lawn = mat("#7aa35f");

  vm.add(box(56, 0.1, 44, lawn, 0, 0.05, 0));  // garden
  vm.add(box(36, 1, 24, marble, 0, 0.5, 0));   // platform
  vm.add(box(30, 7, 16, marble, 0, 4.5, 0));   // main hall
  vm.add(box(12, 8, 20, marble, 0, 5, 0));     // centre block

  // Four corner towers with small domes
  for (const [x, z] of [[-13, -6], [13, -6], [-13, 6], [13, 6]]) {
    vm.add(cyl(1.6, 1.6, 3, marble, x, 9.5, z));
    vm.add(dome(1.7, marble, x, 11, z));
  }

  // The big central dome and the Angel of Victory on top
  vm.add(cyl(5.5, 5.5, 3, marble, 0, 10.5, 0, 24));
  const bigDome = dome(5.8, marble, 0, 12, 0);
  bigDome.scale.y = 1.25;
  vm.add(bigDome);
  vm.add(cyl(0.8, 1, 1.6, marble, 0, 19.9, 0));
  vm.add(cyl(0.15, 0.5, 1.8, bronze, 0, 21.6, 0, 8));
  const wings = cyl(0.05, 0.05, 2.2, bronze, 0, 22.2, 0, 4);
  wings.rotation.z = Math.PI / 2;
  vm.add(wings);

  return vm;
}

// ================= Howrah Station =================
function buildHowrahStation() {
  const station = new THREE.Group();
  const brick = mat("#b4533c");
  const trim = mat("#e8dcc3");
  const roof = mat("#6b3a2e");
  const dark = mat("#3b2a24");
  glowAtNight(brick, "#ff8c5a", 0.12);
  glowAtNight(dark, "#ffc070", 1.2);   // lit windows

  station.add(box(8, 6, 28, brick, 0, 3, 0));
  station.add(box(8.4, 0.5, 28.4, trim, 0, 6.2, 0));

  // Six towers along the front, facing the river
  [-12, -7, -2.5, 2.5, 7, 12].forEach((z, i) => {
    const h = i === 2 || i === 3 ? 12 : 10;
    station.add(box(2.4, h, 2.4, brick, 3.2, h / 2, z));
    station.add(box(2.7, 0.4, 2.7, trim, 3.2, h, z));
    station.add(pyramid(1.9, 2.4, roof, 3.2, h + 1.4, z));
  });
  // Row of windows
  for (let z = -13; z <= 13; z += 2) station.add(box(0.1, 1.8, 1, dark, 4.05, 3, z));

  return station;
}

// ================= Colours of old Kolkata =================
const OLD_KOLKATA = ["#e8d5a9", "#e2b8a0", "#e9e2d0", "#d6a760", "#cfd8c0", "#d9c7b0", "#c9786a", "#f0dcc0"];

// ================= Put it all together =================
export function buildKolkata() {
  lights = nightLights();          // a fresh light switch every time Kolkata is built
  reflections.length = 0;
  const root = new THREE.Group();  // everything goes in here, so the whole city can be removed in one go
  root.add(buildHowrahBridge());

  // Landmarks and the space each one needs kept clear
  const landmarks = [
    { make: buildHowrahStation,    x: -58, z: -22, clear: 20 },
    { make: buildDakshineswar,     x: 44,  z: 14,  clear: 14 },
    { make: buildGhat,             x: 34,  z: 14,  clear: 0 },
    { make: buildVictoriaMemorial, x: 58,  z: -92, clear: 32 },
  ];
  for (const lm of landmarks) {
    const obj = lm.make();
    obj.position.set(lm.x, BANK_TOP, lm.z);
    root.add(obj);
  }
  const isFree = (x, z) =>
    Math.abs(z) > 9 &&                                                  // keep the road clear
    !(x > RIVER_EDGE && x < 40 && z > -2 && z < 30) &&               // keep the ghat clear
    landmarks.every((lm) => Math.hypot(x - lm.x, z - lm.z) > lm.clear);

  const rand = seededRandom(1690); // Kolkata was founded in 1690

  // Buildings
  let placed = 0;
  while (placed < 150) {
    const side = rand() < 0.5 ? -1 : 1;
    const x = side * (RIVER_EDGE + 8 + rand() * 105);
    const z = 10 - rand() * 210;
    if (!isFree(x, z)) continue;
    const modern = z < -140 && Math.abs(x) > 60 && rand() < 0.25;   // a few modern towers far away
    root.add(building(rand, x, z, { palette: OLD_KOLKATA, modern, rooftops: true }, glowAtNight));
    placed++;
  }

  // Trees along the river, and a ring around Victoria Memorial
  for (let i = 0; i < 70; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const x = side * (RIVER_EDGE + 2 + rand() * 5);
    const z = 30 - rand() * 220;
    if (isFree(x, z)) root.add(tree(rand, x, z));
  }
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2;
    root.add(tree(rand, 58 + Math.cos(angle) * 27, -92 + Math.sin(angle) * 21));
  }

  // Yellow Ambassador taxis crossing the bridge
  const moveTaxis = traffic(root, ["#f2c230", "#f2c230", "#f2c230"], 3.2, glowAtNight);

  // scene.js calls this every frame so the city can animate itself
  return {
    group: root,

    update(time) {
      moveTaxis(time);
      // The bridge's LED lights slowly cycle through colours
      bridgeSteel.emissive.setHSL((time * 0.02) % 1, 0.8, 0.55);
      // Reflections shimmer on the water
      reflections.forEach((r, i) => (r.scale.x = 1 + Math.sin(time * 3 + i) * 0.35));
    },

    // night: 0 = day (lights off) ... 1 = night (lights fully on)
    setNight(night) {
      lights.set(night);
      reflectionMat.opacity = 0.9 * night;
    },
  };
}
