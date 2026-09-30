import * as THREE from "three";

// ---------- World measurements shared by every file ----------
export const BANK_TOP = 3;     // height of the ground on both riverbanks
export const RIVER_EDGE = 30;  // the river runs between x = -30 and x = 30

// A material with the faceted low-poly look
export function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });
}

// Turn on shadows for a mesh and place it
function ready(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function box(w, h, d, material, x, y, z) {
  return ready(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), x, y, z);
}

export function cyl(rTop, rBottom, h, material, x, y, z, sides = 12) {
  return ready(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, sides), material), x, y, z);
}

// Half a sphere, sitting flat on y
export function dome(r, material, x, y, z, sides = 24) {
  const geo = new THREE.SphereGeometry(r, sides, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  return ready(new THREE.Mesh(geo, material), x, y, z);
}

// A square pyramid roof
export function pyramid(r, h, material, x, y, z) {
  const mesh = ready(new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), material), x, y, z);
  mesh.rotation.y = Math.PI / 4;
  return mesh;
}

// A steel beam between any two points
export function beam(a, b, thickness, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, thickness), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

// Seeded random numbers: same seed -> same "random" city every time
export function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draw a small picture with code and use it as a repeating texture
export function paintTexture(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  draw(canvas.getContext("2d"));
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
