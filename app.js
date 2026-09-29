const LAT = 22.57;
const LON = 88.36;

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

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function showCurrent(current) {
  const scene = getScene(current.weather_code);
  const isDay = current.is_day === 1;

  document.getElementById("icon").textContent = getIcon(scene, isDay);
  document.getElementById("temp").textContent = `${Math.round(current.temperature_2m)}°C`;
  document.getElementById("condition").textContent = capitalize(scene);
  document.getElementById("feels").textContent = `${Math.round(current.apparent_temperature)}°C`;
  document.getElementById("humidity").textContent = `${current.relative_humidity_2m}%`;
  document.getElementById("wind").textContent = `${current.wind_speed_10m} km/h`;
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
        <div class="t">${Math.round(hourly.temperature_2m[i])}°</div>
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
          ${Math.round(daily.temperature_2m_max[i])}°<span class="min">${Math.round(daily.temperature_2m_min[i])}°</span>
        </span>
      </div>`;
  }
  document.getElementById("daily").innerHTML = html;
}

async function loadWeather() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${LAT}&longitude=${LON}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day" +
    "&hourly=temperature_2m,weather_code,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&forecast_days=7&timezone=auto";

  const response = await fetch(url);
  const data = await response.json();

  showCurrent(data.current);
  showHourly(data.hourly, data.current.time);
  showDaily(data.daily);
}

loadWeather();