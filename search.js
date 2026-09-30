// ================= Picking a place: search box, "my location", and the map =================

const searchInput = document.getElementById("search");
const resultsList = document.getElementById("results");
const mapModal = document.getElementById("map-modal");

// ----- Switch the whole page to a new place -----
function choosePlace(place) {
  resultsList.hidden = true;
  searchInput.value = "";
  searchInput.blur();
  mapModal.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Put the place in the web address, so the link can be shared
  const params = new URLSearchParams(window.location.search);
  params.set("name", place.name);
  params.set("lat", place.lat.toFixed(3));
  params.set("lon", place.lon.toFixed(3));
  params.set("pop", Math.round(place.population || 0));
  history.replaceState(null, "", "?" + params.toString());

  loadWeather(place);
}

// ----- 1. Search box -----
function describe(result) {
  // "Pune, Maharashtra, India"
  return [result.name, result.admin1, result.country].filter(Boolean).join(", ");
}

async function searchPlaces(text) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=6&language=en&format=json`;
  try {
    const data = await (await fetch(url)).json();
    showResults(data.results || []);
  } catch {
    showResults([]);
  }
}

function showResults(results) {
  resultsList.innerHTML = "";
  if (results.length === 0) {
    resultsList.innerHTML = `<li class="empty">No places found</li>`;
  }
  for (const r of results) {
    const item = document.createElement("li");
    item.textContent = describe(r);   // textContent, not innerHTML: place names are outside data
    item.addEventListener("click", () => {
      choosePlace({ name: r.name, lat: r.latitude, lon: r.longitude, population: r.population });
    });
    resultsList.appendChild(item);
  }
  resultsList.hidden = false;
}

// Wait until the person stops typing for 300 ms before searching (saves lots of requests)
let typingTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(typingTimer);
  const text = searchInput.value.trim();
  if (text.length < 2) {
    resultsList.hidden = true;
    return;
  }
  typingTimer = setTimeout(() => searchPlaces(text), 300);
});

// Enter picks the first suggestion
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const first = resultsList.querySelector("li:not(.empty)");
    if (first) first.click();
  }
  if (e.key === "Escape") resultsList.hidden = true;
});

// Clicking anywhere else closes the suggestions
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) resultsList.hidden = true;
});

// ----- Turn a spot on the map into a name ("reverse geocoding") -----
async function nameForSpot(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&accept-language=en`;
    const data = await (await fetch(url)).json();
    const a = data.address || {};
    const name = a.city || a.town || a.village || a.county || a.state || a.country;
    // Rough size guess so the 3D city gets the right density
    const population = a.city ? 1000000 : a.town ? 50000 : a.village ? 2000 : 0;
    if (name) return { name, population };
  } catch {}
  return { name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, population: 0 };
}

// ----- 2. "Use my location" -----
document.getElementById("locate").addEventListener("click", () => {
  if (!navigator.geolocation) return;
  document.getElementById("condition").textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude: lat, longitude: lon } = position.coords;
      const spot = await nameForSpot(lat, lon);
      choosePlace({ ...spot, lat, lon });
    },
    () => {
      document.getElementById("condition").textContent = "Location permission was denied";
    }
  );
});

// ----- 3. The map (Leaflet) -----
let map = null;
let marker = null;

function openMap() {
  mapModal.hidden = false;
  if (!map) {
    // Created the first time only. L is the Leaflet library, loaded in index.html
    map = L.map("map", { worldCopyJump: true }).setView([22.57, 88.36], 4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxZoom: 18,
    }).addTo(map);

    map.on("click", async (e) => {
      const lat = e.latlng.lat;
      const lon = ((e.latlng.lng + 540) % 360) - 180;   // keep longitude between -180 and 180
      if (marker) marker.setLatLng(e.latlng);
      else marker = L.marker(e.latlng).addTo(map);
      const spot = await nameForSpot(lat, lon);
      choosePlace({ ...spot, lat, lon });
    });
  }
  setTimeout(() => map.invalidateSize(), 50);  // the map measures its box once it's visible
}

document.getElementById("open-map").addEventListener("click", openMap);
document.getElementById("close-map").addEventListener("click", () => (mapModal.hidden = true));
mapModal.addEventListener("click", (e) => {
  if (e.target === mapModal) mapModal.hidden = true;   // click the dark background to close
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") mapModal.hidden = true;
});

// ----- Start: a shared link's place, or Kolkata -----
const startParams = new URLSearchParams(window.location.search);
if (startParams.get("lat") && startParams.get("lon")) {
  loadWeather({
    name: startParams.get("name") || "Somewhere",
    lat: Number(startParams.get("lat")),
    lon: Number(startParams.get("lon")),
    population: Number(startParams.get("pop")) || 0,
  });
} else {
  loadWeather(DEFAULT_PLACE);
}
