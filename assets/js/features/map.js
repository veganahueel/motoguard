import { DEFAULT_COORDS } from "../core/config.js";
import { setText } from "../core/utils.js";

let map = null;
let marker = null;

export function initMap([lat, lng] = DEFAULT_COORDS) {
    if (map) return map.invalidateSize();

    map = L.map("map").setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    const icon = L.divIcon({
        className: "",
        html: '<div class="moto-marker"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup("<b>MotoGuard</b><br>GPS activo");
}

export function updateMapPosition(lat, lng) {
    if (!map || !marker) return;
    marker.setLatLng([lat, lng]);
    map.panTo([lat, lng]);
    setText("coords-display", `Lat: ${lat.toFixed(4)} | Lng: ${lng.toFixed(4)}`);
}
