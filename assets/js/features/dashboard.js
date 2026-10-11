import { dbRef, set, update } from "../core/firebase.js";
import { state, listen, stopListening } from "../core/state.js";
import { TELEGRAM_BOT, DEVICE_CODE_RE } from "../core/config.js";
import { $, setText } from "../core/utils.js";
import { initMap, updateMapPosition } from "./map.js";
import { loadHistory } from "./history.js";
import { checkDevice, claimDevice, releaseDevice, setUserDevice } from "./devices.js";

let lastStatus = null;
const device = (field = "") => dbRef(`dispositivos/${state.user.dispositivo}${field && "/" + field}`);

// ---------- Estado de la alarma ----------
const STATUS_VIEW = {
    MOVIMIENTO_CONFIRMADO: { badge: ["¡Alerta!", "badge-red"], banner: ["Alerta: se confirmó movimiento sospechoso en tu moto.", "nivel-rojo"] },
    ALERTA: { badge: ["Movimiento detectado", "badge-amber"], banner: ["Se detectó movimiento en tu moto. Estamos confirmando.", "nivel-amarillo"] }
};
const STATUS_NORMAL = { badge: ["Todo normal", "badge-green"], banner: null };

function notifyMovement() {
    const title = "¡Alerta MotoGuard!";
    const body = "Se detectó movimiento sospechoso en tu moto. Revisá el mapa.";
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
    else alert(`${title}\n${body}`);
}

function renderStatus(status) {
    if (!status) return;
    const view = STATUS_VIEW[status] ?? STATUS_NORMAL;
    const badge = $("status-badge");
    const banner = $("alert-banner");
    badge.textContent = view.badge[0];
    badge.className = `badge ${view.badge[1]}`;
    banner.textContent = view.banner?.[0] ?? "";
    banner.className = view.banner ? `alert-banner ${view.banner[1]}` : "alert-banner hidden";
    if (status === "MOVIMIENTO_CONFIRMADO" && lastStatus !== status) notifyMovement();
    lastStatus = status;
}

// ---------- Biometría ----------
function renderBiometrics(weight, tolerance) {
    setText("lbl-weight", weight);
    setText("lbl-tolerance", tolerance);
    setText("bio-min", (weight - tolerance).toFixed(1));
    setText("bio-max", (weight + tolerance).toFixed(1));
}

function syncBiometrics() {
    const weight = parseFloat($("slider-weight").value);
    const tolerance = parseFloat($("slider-tolerance").value);
    renderBiometrics(weight, tolerance);
    update(device(), { peso_min: weight - tolerance, peso_max: weight + tolerance });
}

// ---------- Dispositivo ----------
function renderDevice(code) {
    setText("device-badge", code || "");
    setText("device-code-display", code || "Sin vincular");
}

async function relinkDevice() {
    const oldCode = state.user.dispositivo;
    if (!confirm(`¿Seguro que querés desvincular ${oldCode}? Vas a tener que cargar un código nuevo.`)) return;

    await releaseDevice(oldCode);
    stopListening();

    const code = prompt("Ingresá el código del nuevo dispositivo a vincular (ej: MG-0005):")?.trim().toUpperCase();
    if (!code) {
        await setUserDevice(state.user.email, "");
        state.user.dispositivo = "";
        renderDevice("");
        return alert("No se vinculó ningún dispositivo nuevo. Tu cuenta quedó sin dispositivo por ahora.");
    }
    if (!DEVICE_CODE_RE.test(code)) return alert("Formato incorrecto. Tiene que ser MG- seguido de 4 números (ej: MG-0007). No se vinculó nada.");

    const pin = prompt("Ingresá el PIN de activación de ese dispositivo (viene en la etiqueta interna):")?.trim();
    if (!pin) return alert("No se vinculó nada: hace falta el PIN de activación.");

    const error = await checkDevice(code, pin);
    if (error) return alert(`${error} No se vinculó nada.`);

    await setUserDevice(state.user.email, code);
    await claimDevice(code, state.user.email);
    state.user.dispositivo = code;
    startDashboard();
    alert(`¡Listo! Ahora estás vinculado a ${code}.`);
}

// ---------- Ciclo de vida ----------
function bindControls() {
    const guard = (fn) => () => state.user?.dispositivo && fn();
    $("slider-weight").oninput = $("slider-tolerance").oninput = guard(syncBiometrics);
    $("btn-lock").onclick = guard(() => set(device("activo"), false));
    $("btn-unlock").onclick = guard(() => set(device("activo"), true));
    $("btn-calibrar").onclick = guard(() => {
        set(device("comando"), "CALIBRAR");
        alert("Comando enviado. La moto va a recalibrar su posición en los próximos segundos.");
    });
    $("btn-vincular-telegram").onclick = guard(() => {
        // Telegram no admite guiones en el parámetro start; n8n los restaura.
        const param = state.user.dispositivo.replace(/-/g, "_");
        window.open(`https://t.me/${TELEGRAM_BOT}?start=${param}`, "_blank");
    });
    $("btn-desvincular").onclick = guard(relinkDevice);
}

export function startDashboard() {
    stopListening();
    lastStatus = null;
    const { nombre, email, dispositivo } = state.user;
    setText("user-display-name", nombre || email);
    renderDevice(dispositivo);
    bindControls();
    if (!dispositivo) return;

    initMap();

    listen(device("estado"), (snap) => renderStatus(snap.val()));
    listen(device("activo"), (snap) => {
        const active = snap.val() !== false; // sin campo = activo (igual que el firmware)
        setText("relay-status-text", active ? "Activado" : "Desactivado");
        $("relay-status-text").className = active ? "text-green" : "text-red";
    });
    listen(device(), (snap) => {
        const d = snap.val();
        if (!d) return;
        if (typeof d.lat === "number" && typeof d.lng === "number") updateMapPosition(d.lat, d.lng);
        if (typeof d.peso_min === "number" && typeof d.peso_max === "number") {
            const weight = (d.peso_min + d.peso_max) / 2;
            const tolerance = (d.peso_max - d.peso_min) / 2;
            $("slider-weight").value = weight;
            $("slider-tolerance").value = tolerance;
            renderBiometrics(weight, tolerance);
        }
    });
    loadHistory();
}

export const stopDashboard = stopListening;
