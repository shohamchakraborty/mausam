import * as THREE from "three";
import { beam } from "./helpers.js";

// ================= The "mood" of every kind of weather =================
// top = sky colour overhead, horizon = sky colour at the bottom (also the fog colour)
// sun = sunlight strength, light = soft sky-light strength, fog = [where fog starts, where it's solid]
// clouds = how many clouds, cloud = cloud colour, river = water colour
const DAY = {
  clear:  { top: "#3f7fcf", horizon: "#cfe3f1", sun: 2.6,  light: 1.4, fog: [110, 380], clouds: 4,  cloud: "#ffffff", river: "#2f6a9e" },
  cloudy: { top: "#6f93bd", horizon: "#d5dfe8", sun: 1.3,  light: 1.4, fog: [100, 360], clouds: 16, cloud: "#f2f4f7", river: "#36648c" },
  foggy:  { top: "#9aa9b6", horizon: "#d3d9de", sun: 0.5,  light: 1.5, fog: [6, 130],   clouds: 0,  cloud: "#e6e9ec", river: "#5b7485" },
  rainy:  { top: "#56677a", horizon: "#9aa8b5", sun: 0.35, light: 1.1, fog: [40, 260],  clouds: 24, cloud: "#8b95a1", river: "#334e66" },
  stormy: { top: "#2c3440", horizon: "#5d6772", sun: 0.2,  light: 0.8, fog: [30, 220],  clouds: 28, cloud: "#4d5560", river: "#25384b" },
};
const NIGHT = {
  clear:  { top: "#050914", horizon: "#16213d", sun: 0.35, light: 0.22, fog: [110, 380], clouds: 3,  cloud: "#1d2438", river: "#0f2238" },
  cloudy: { top: "#0b0f1c", horizon: "#1e2638", sun: 0.2,  light: 0.2,  fog: [100, 360], clouds: 16, cloud: "#2a3142", river: "#12202f" },
  foggy:  { top: "#1a1f28", horizon: "#2a3039", sun: 0.1,  light: 0.3,  fog: [6, 120],   clouds: 0,  cloud: "#2c323c", river: "#1a2530" },
  rainy:  { top: "#0a0e15", horizon: "#1b222c", sun: 0.1,  light: 0.18, fog: [40, 240],  clouds: 24, cloud: "#232a34", river: "#0f1a24" },
  stormy: { top: "#06080c", horizon: "#151a21", sun: 0.08, light: 0.15, fog: [30, 200],  clouds: 28, cloud: "#1b2029", river: "#0b141c" },
};
const RAIN = {
  rainy:  { drops: 4500, speed: 55, wind: 6 },
  stormy: { drops: 8000, speed: 75, wind: 16 },
};

function moodFor(name, isDay) {
  const base = (isDay ? DAY : NIGHT)[name] || DAY.clear;
  const rain = RAIN[name] || { drops: 0, speed: 55, wind: 0 };
  return {
    top: new THREE.Color(base.top),
    horizon: new THREE.Color(base.horizon),
    cloud: new THREE.Color(base.cloud),
    river: new THREE.Color(base.river),
    sun: base.sun,
    light: base.light,
    fogNear: base.fog[0],
    fogFar: base.fog[1],
    clouds: base.clouds,
    drops: rain.drops,
    speed: rain.speed,
    wind: rain.wind,
    lightning: name === "stormy",
    night: isDay ? 0 : 1,
    stars: isDay ? 0 : name === "clear" ? 1 : name === "cloudy" ? 0.35 : 0,
    moon: !isDay && (name === "clear" || name === "cloudy") ? 1 : 0,
    shine: isDay ? (name === "clear" || name === "cloudy" ? 1 : 0.5) : 0.12,
  };
}

// ================= Build all the weather pieces once =================
export function createWeather({ scene, sky, sun, hemi, water }) {
  let target = moodFor("clear", true);
  const now = moodFor("clear", true);   // the values on screen right now, sliding toward target

  // ----- Clouds: bunches of low-poly balls -----
  const cloudMat = new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 1 });
  const clouds = [];
  for (let c = 0; c < 30; c++) {
    const cloud = new THREE.Group();
    const puffs = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < puffs; i++) {
      const r = 3 + Math.random() * 4;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cloudMat);
      puff.position.set((i - puffs / 2) * 3.4 + Math.random() * 2, Math.random() * 2, Math.random() * 4 - 2);
      puff.scale.y = 0.65;
      cloud.add(puff);
    }
    cloud.position.set(-220 + Math.random() * 440, 40 + Math.random() * 30, -60 - Math.random() * 200);
    cloud.scale.setScalar(0);
    cloud.userData.speed = 1 + Math.random() * 2;
    scene.add(cloud);
    clouds.push(cloud);
  }

  // ----- Stars: 1200 dots on the upper half of the sky -----
  const starPos = [];
  while (starPos.length < 1200 * 3) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).normalize();
    if (v.y > 0.12) starPos.push(v.x * 470, v.y * 470, v.z * 470);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: "#ffffff", size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  scene.add(new THREE.Points(starGeo, starMat));

  // ----- Moon, with a soft glow around it -----
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(10, 24, 16),
    new THREE.MeshBasicMaterial({ color: "#f4f1de", transparent: true, opacity: 0, fog: false })
  );
  moon.position.set(150, 150, -330);
  scene.add(moon);

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const g = glowCanvas.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,245,220,0.9)");
  grad.addColorStop(1, "rgba(255,245,220,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  moonGlow.position.copy(moon.position);
  moonGlow.scale.setScalar(90);
  scene.add(moonGlow);

  // ----- Rain: thousands of short lines falling -----
  const MAX_DROPS = 9000;
  const rainPos = new Float32Array(MAX_DROPS * 6);   // 2 points per drop, 3 numbers per point
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: "#c8d3df", transparent: true, opacity: 0.5 }));
  rain.frustumCulled = false;
  scene.add(rain);

  function resetDrop(i, anywhere) {
    const x = -100 + Math.random() * 200;
    const y = anywhere ? Math.random() * 75 : 65 + Math.random() * 15;
    const z = -140 + Math.random() * 225;
    rainPos.set([x, y, z, x, y - 2, z], i * 6);
  }
  for (let i = 0; i < MAX_DROPS; i++) resetDrop(i, true);

  // ----- Splashes: little rings that grow and fade on the river -----
  const splashes = [];
  for (let i = 0; i < 140; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.4, 16),
      new THREE.MeshBasicMaterial({ color: "#dfe8f2", transparent: true, opacity: 0, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1.1;
    ring.userData.age = Math.random();
    scene.add(ring);
    splashes.push(ring);
  }

  // ----- Lightning -----
  const boltMat = new THREE.MeshBasicMaterial({ color: "#eef3ff", fog: false });
  let bolt = null;
  let strikeAt = -10;
  let nextStrike = 2;

  function makeBolt() {
    const group = new THREE.Group();
    let p = new THREE.Vector3(-90 + Math.random() * 180, 62, -70 - Math.random() * 120);
    while (p.y > 3) {
      const next = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, -(4 + Math.random() * 5), (Math.random() - 0.5) * 4));
      next.y = Math.max(next.y, 3);
      group.add(beam(p, next, 0.6, boltMat));
      if (Math.random() < 0.25) {  // a small side branch
        const branch = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, -(5 + Math.random() * 6), 0));
        group.add(beam(p, branch, 0.3, boltMat));
      }
      p = next;
    }
    return group;
  }

  // How bright the flash is, a given time after the strike: flash, dip, flash again, fade
  function flashLevel(elapsed) {
    if (elapsed < 0.08) return 1;
    if (elapsed < 0.16) return 0.15;
    if (elapsed < 0.26) return 0.8;
    return Math.max(0, 0.8 - (elapsed - 0.26) * 2.5);
  }

  const warmSun = new THREE.Color("#fff4e0");
  const coolMoon = new THREE.Color("#9fb4ff");
  const flashSky = new THREE.Color("#c9d4ff");

  return {
    // app.js tells us the weather -> we pick a new target mood
    set(name, isDay) {
      target = moodFor(name, isDay);
    },

    // 0 = full day, 1 = full night (the city uses this to switch its lights on)
    get night() {
      return now.night;
    },

    update(dt, t) {
      // Slide every value a little toward the target each frame (smooth transitions)
      const k = 1 - Math.exp(-dt * 1.2);
      for (const key of ["top", "horizon", "cloud", "river"]) now[key].lerp(target[key], k);
      for (const key of ["sun", "light", "fogNear", "fogFar", "drops", "speed", "wind", "night", "stars", "moon", "shine"]) {
        now[key] += (target[key] - now[key]) * k;
      }

      // Lightning
      let flash = 0;
      if (target.lightning && t > nextStrike) {
        strikeAt = t;
        nextStrike = t + 3 + Math.random() * 6;
        if (bolt) scene.remove(bolt);
        bolt = makeBolt();
        scene.add(bolt);
      }
      const sinceStrike = t - strikeAt;
      if (sinceStrike < 1) flash = flashLevel(sinceStrike);
      if (bolt && sinceStrike > 0.35) {
        scene.remove(bolt);
        bolt = null;
      }

      // Sky, fog, lights, river
      sky.material.uniforms.topColor.value.copy(now.top).lerp(flashSky, flash * 0.5);
      sky.material.uniforms.bottomColor.value.copy(now.horizon).lerp(flashSky, flash * 0.4);
      scene.fog.color.copy(now.horizon);
      scene.fog.near = now.fogNear;
      scene.fog.far = now.fogFar;
      sun.intensity = now.sun;
      sun.color.lerpColors(warmSun, coolMoon, now.night);
      hemi.intensity = now.light + flash * 2.5;
      water.material.color.copy(now.river);
      water.material.emissive.copy(now.river).multiplyScalar(now.night * 0.8);  // keep the river visible at night
      scene.environmentIntensity = now.shine;

      // Stars twinkle a tiny bit, moon fades in and out
      starMat.opacity = now.stars * (0.85 + Math.sin(t * 3) * 0.15);
      moon.material.opacity = now.moon;
      moonGlow.material.opacity = now.moon * 0.6;

      // Clouds grow in / shrink away, and drift with the wind
      cloudMat.color.copy(now.cloud);
      clouds.forEach((cloud, i) => {
        const want = i < target.clouds ? 1 : 0;
        const s = cloud.scale.x + (want - cloud.scale.x) * k;
        cloud.scale.setScalar(s);
        cloud.visible = s > 0.01;
        cloud.position.x += (cloud.userData.speed + now.wind * 0.3) * dt;
        if (cloud.position.x > 230) cloud.position.x = -230;
      });

      // Rain
      const active = Math.round(now.drops);
      rain.visible = active > 10;
      const len = now.speed * 0.035;
      for (let i = 0; i < active; i++) {
        const o = i * 6;
        rainPos[o] += now.wind * dt;
        rainPos[o + 1] -= now.speed * dt;
        if (rainPos[o + 1] < 0.7) resetDrop(i, false);
        rainPos[o + 3] = rainPos[o] - now.wind * 0.035;
        rainPos[o + 4] = rainPos[o + 1] - len;
        rainPos[o + 5] = rainPos[o + 2];
      }
      rainGeo.setDrawRange(0, active * 2);
      rainGeo.attributes.position.needsUpdate = true;

      // Splashes
      const activeSplashes = Math.min(splashes.length, Math.round(now.drops / 50));
      splashes.forEach((ring, i) => {
        if (i >= activeSplashes) {
          ring.material.opacity = 0;
          return;
        }
        ring.userData.age += dt * 1.6;
        if (ring.userData.age > 1) {
          ring.userData.age = 0;
          ring.position.x = -28 + Math.random() * 56;
          ring.position.z = -60 + Math.random() * 140;
        }
        const age = ring.userData.age;
        ring.scale.setScalar(1 + age * 4);
        ring.material.opacity = (1 - age) * 0.6;
      });
    },
  };
}   