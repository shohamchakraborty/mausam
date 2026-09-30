const DEFAULT_PLACE = { name: "Kolkata", lat: 22.57, lon: 88.36, population: 4500000 };

// Test switches in the web address, e.g.  index.html?weather=stormy&night=1
const params = new URLSearchParams(window.location.search);
const FORCE_SCENE = params.get("weather");  // clear, cloudy, foggy, rainy, stormy
const FORCE_NIGHT = params.get("night");    // 1 = night, 0 = day

function getScene(code) {
  if (code === 0) return "clear";
  if ([1, 2, 3].includes(code)) return "cloudy";
  if ([45, 48].includes(code)) return "foggy";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rainy";
  if (code >= 95) return "stormy";
  return "cloudy";
}

function getIcon(scene, isDay) {
  const icons = {
    clear:  isDay ? "☀️" : "🌙",
    cloudy: isDay ? "⛅" : "☁️",
    foggy:  "🌫️",
    rainy:  "🌧️",
    stormy: "⛈️",
  };
  return icons[scene];
}

// ----- Units: °C or °F, remembered on this device -----
let unit = "C";
try {
  unit = localStorage.getItem("mausam-unit") || "C";
} catch {}

function temp(celsius) {
  return Math.round(unit === "F" ? celsius * 9 / 5 + 32 : celsius);
}

function wind(kmh) {
  return unit === "F" ? `${Math.round(kmh * 0.621)} mph` : `${Math.round(kmh)} km/h`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function showCurrent(current, scene) {
  document.getElementById("temp").textContent = `${temp(current.temperature_2m)}°${unit}`;
  document.getElementById("condition").textContent = capitalize(scene);
  document.getElementById("feels").textContent = `${temp(current.apparent_temperature)}°${unit}`;
  document.getElementById("humidity").textContent = `${current.relative_humidity_2m}%`;
  document.getElementById("wind").textContent = wind(current.wind_speed_10m);
}

function showHourly(hourly, nowTime) {
  const nowHour = nowTime.slice(0, 13) + ":00";
  const start = hourly.time.indexOf(nowHour);

  let html = "";
  for (let i = start; i < start + 24; i++) {
    const scene = getScene(hourly.weather_code[i]);
    const isDay = hourly.is_day[i] === 1;
    const label = i === start ? "Now" : hourly.time[i].slice(11, 16);

    html += `
      <div class="hour">
        <div class="time">${label}</div>
        <div class="emoji">${getIcon(scene, isDay)}</div>
        <div class="t">${temp(hourly.temperature_2m[i])}°</div>
      </div>`;
  }
  document.getElementById("hourly").innerHTML = html;
}

function showDaily(daily) {
  let html = "";
  for (let i = 0; i < daily.time.length; i++) {
    const date = new Date(daily.time[i] + "T00:00");
    const name = i === 0 ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short" });
    const scene = getScene(daily.weather_code[i]);

    html += `
      <div class="day">
        <span>${name}</span>
        <span>${getIcon(scene, true)}</span>
        <span class="range">
          ${temp(daily.temperature_2m_max[i])}°<span class="min">${temp(daily.temperature_2m_min[i])}°</span>
        </span>
      </div>`;
  }
  document.getElementById("daily").innerHTML = html;
}

// Remember the last weather so switching °C/°F can redraw without fetching again
let lastShown = null;

function showEverything() {
  document.getElementById("unit").textContent = `°${unit}`;
  if (!lastShown) return;
  const { data, scene } = lastShown;
  showCurrent(data.current, scene);
  showHourly(data.hourly, data.current.time);
  showDaily(data.daily);
}

document.getElementById("unit").addEventListener("click", () => {
  unit = unit === "C" ? "F" : "C";
  try {
    localStorage.setItem("mausam-unit", unit);
  } catch {}
  showEverything();
});

async function loadWeather(place) {
  document.getElementById("place").textContent = place.name;
  document.getElementById("condition").textContent = "Loading…";

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${place.lat}&longitude=${place.lon}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day" +
    "&hourly=temperature_2m,weather_code,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&forecast_days=7&timezone=auto";

  let data;
  try {
    const response = await fetch(url);
    data = await response.json();
  } catch (error) {
    document.getElementById("condition").textContent = "Couldn't reach the weather service";
    return;
  }

  const scene = FORCE_SCENE || getScene(data.current.weather_code);
  const isDay = FORCE_NIGHT !== null ? FORCE_NIGHT !== "1" : data.current.is_day === 1;

  lastShown = { data, scene };
  showEverything();

  // Tell the 3D scene (scene.js) what the weather is
  window.currentWeather = { scene, isDay, place: { ...place, elevation: data.elevation } };
  window.dispatchEvent(new CustomEvent("weather", { detail: window.currentWeather }));
}

// (search.js decides which place to load first)
