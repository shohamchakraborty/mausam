import * as THREE from "three";
import { BANK_TOP, mat, box, cyl, paintTexture } from "./helpers.js";

// Reusable city parts. Every city (Kolkata or generated) builds from these.
// `glow(material, colour, strength)` is passed in by the city so it can switch lights on at night.

// ----- Window textures, drawn with code -----
const oldWindows = paintTexture((g) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#6d8f73"; g.fillRect(12, 14, 9, 30); g.fillRect(43, 14, 9, 30); // shutters
  g.fillStyle = "#2f3238"; g.fillRect(21, 14, 22, 30);                            // window
  g.fillStyle = "#d8d0c0"; g.fillRect(10, 44, 44, 4);                             // sill
});
const oldWindowsLit = paintTexture((g) => {
  g.fillStyle = "#000000"; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#ffd08a"; g.fillRect(21, 14, 22, 30);
});
const glassWindows = paintTexture((g) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#44566a"; g.fillRect(4, 6, 56, 22); g.fillRect(4, 38, 56, 22);
});
const glassWindowsLit = paintTexture((g) => {
  g.fillStyle = "#000000"; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#cfe3ff"; g.fillRect(4, 6, 56, 22); g.fillRect(4, 38, 56, 22);
});

function repeated(texture, w, h) {
  const t = texture.clone();
  t.repeat.set(Math.max(1, Math.round(w / 2.2)), Math.max(1, Math.round(h / 2.4)));
  t.needsUpdate = true;
  return t;
}

// ----- A building -----
// options: palette (list of colours), modern (glass tower?), tall (how tall towers can get), rooftops (water tanks etc.)
export function building(rand, x, z, options, glow) {
  const { palette, modern = false, tall = 1, rooftops = false } = options;
  const w = 4 + rand() * 5;
  const d = 4 + rand() * 5;
  const h = modern ? (14 + rand() * 22) * tall : 3 + rand() * 6 + (rand() < 0.2 ? 5 : 0);
  const colour = modern ? (rand() < 0.5 ? "#a9b8c6" : "#8fa3b5") : palette[Math.floor(rand() * palette.length)];

  const wallMat = mat(colour, {
    map: repeated(modern ? glassWindows : oldWindows, w, h),
    emissiveMap: repeated(modern ? glassWindowsLit : oldWindowsLit, w, h),
  });
  glow(wallMat, "#ffffff", Math.random() < 0.8 ? 0.5 + Math.random() * 0.9 : 0);  // some flats stay dark
  const roofMat = mat(colour);

  const group = new THREE.Group();
  group.add(box(w, h, d, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat], 0, h / 2, 0));

  if (!modern) {
    group.add(box(w + 0.3, 0.5, d + 0.3, roofMat, 0, h + 0.25, 0));  // parapet ledge
    if (rooftops && rand() < 0.6) {                                   // black water tank
      group.add(cyl(0.6, 0.6, 1.1, mat("#222222"), (rand() - 0.5) * w * 0.5, h + 1, (rand() - 0.5) * d * 0.5, 10));
    }
    if (rand() < 0.35) {                                              // stair room on the roof
      group.add(box(1.8, 1.6, 1.8, roofMat, (rand() - 0.5) * w * 0.4, h + 0.8, (rand() - 0.5) * d * 0.4));
    }
  } else if (rand() < 0.5) {
    group.add(cyl(0.08, 0.08, 4, mat("#666666"), 0, h + 2, 0, 4));   // antenna on top
  }
  group.position.set(x, BANK_TOP, z);
  return group;
}

// ----- A tree -----
export function tree(rand, x, z, greens = ["#4f7d3a", "#5c8c45", "#3f6b33", "#6a9a4c"]) {
  const group = new THREE.Group();
  group.add(cyl(0.2, 0.3, 1.8, mat("#6b4f35"), 0, 0.9, 0, 6));
  const r = 1.2 + rand() * 0.9;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(greens[Math.floor(rand() * greens.length)]));
  crown.position.y = 1.6 + r;
  crown.castShadow = true;
  group.add(crown);
  group.position.set(x, BANK_TOP, z);
  return group;
}

// ----- A car (the yellow Ambassador taxi in Kolkata, any colour elsewhere) -----
export function car(colour, glow) {
  const group = new THREE.Group();
  const paint = mat(colour, { roughness: 0.5 });
  const glass = mat("#bfe3f2", { roughness: 0.2 });
  const tyre = mat("#1b1b1b");
  const headlight = mat("#ddddcc");
  glow(headlight, "#fff3c4", 2.5);

  group.add(box(2.4, 0.6, 1.2, paint, 0, 0.55, 0));
  group.add(box(1.3, 0.5, 1.1, paint, -0.1, 1.1, 0));
  group.add(box(1.32, 0.34, 1.12, glass, -0.1, 1.1, 0));
  group.add(box(0.1, 0.2, 0.3, headlight, 1.21, 0.6, 0.35));
  group.add(box(0.1, 0.2, 0.3, headlight, 1.21, 0.6, -0.35));
  for (const [x, z] of [[-0.75, 0.6], [0.75, 0.6], [-0.75, -0.6], [0.75, -0.6]]) {
    const wheel = cyl(0.28, 0.28, 0.2, tyre, x, 0.28, z, 10);
    wheel.rotation.x = Math.PI / 2;
    group.add(wheel);
  }
  return group;
}

// ----- Cars driving back and forth across a road at height `deck` -----
export function traffic(parent, colours, deck, glow) {
  const cars = colours.map((colour, i) => {
    const mesh = car(colour, glow);
    const forward = i % 2 === 0;
    mesh.position.set(0, deck, forward ? 1.1 : -1.1);
    if (!forward) mesh.rotation.y = Math.PI;
    parent.add(mesh);
    return { mesh, speed: forward ? 7 : -6, offset: i * 37 };
  });
  return function move(time) {
    for (const c of cars) c.mesh.position.x = ((time * c.speed + c.offset) % 140 + 140) % 140 - 70;
  };
}

// ----- Night lights: a small "light switch" each city owns -----
export function nightLights() {
  const list = [];
  return {
    glow(material, colour, strength) {
      material.emissive = new THREE.Color(colour);
      material.emissiveIntensity = 0;
      list.push({ material, strength });
    },
    set(night) {
      for (const { material, strength } of list) material.emissiveIntensity = strength * night;
    },
  };
}
