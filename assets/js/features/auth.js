import { dbRef, get, set } from "../core/firebase.js";
import { state } from "../core/state.js";
import { DEVICE_CODE_RE, DEVICE_CODE_HELP } from "../core/config.js";
import { $, sanitizeEmail } from "../core/utils.js";
import { showScreen } from "../core/screens.js";
import { checkDevice, claimDevice } from "./devices.js";

const WEIGHT_TOLERANCE = 3;

// Validación en vivo del código: formato al instante, disponibilidad con demora.
function initCodeValidation() {
    const input = $("reg-codigo");
    const hint = $("reg-codigo-hint");
    let timer = null;

    const paint = (kind, message) => {
        input.classList.toggle("input-error", kind === "error");
        input.classList.toggle("input-ok", kind === "ok");
        hint.classList.toggle("hint-error", kind === "error");
        hint.classList.toggle("hint-ok", kind === "ok");
        hint.textContent = message;
    };

    input.addEventListener("input", () => {
        const code = input.value.trim().toUpperCase();
        clearTimeout(timer);
        if (!code) return paint(null, DEVICE_CODE_HELP);
        if (!DEVICE_CODE_RE.test(code)) return paint("error", "Formato incorrecto. Tiene que ser MG- seguido de 4 números (ej: MG-0007).");

        paint(null, "Verificando disponibilidad...");
        timer = setTimeout(async () => {
            try {
                const error = await checkDevice(code);
                error ? paint("error", error) : paint("ok", "Código disponible.");
            } catch {
                paint(null, DEVICE_CODE_HELP); // el chequeo definitivo ocurre al enviar
            }
        }, 500);
    });
}

async function handleRegister(e) {
    e.preventDefault();
    const name = $("reg-name").value;
    const email = $("reg-email").value;
    const password = $("reg-password").value;
    const weight = parseFloat($("reg-weight").value);
    const code = $("reg-codigo").value.trim().toUpperCase();
    const pin = $("reg-pin").value.trim();

    if (!code) return alert("Debes ingresar un código de dispositivo para vincular la moto.");
    if (!pin) return alert("Debes ingresar el PIN de activación que viene en la etiqueta de tu dispositivo.");
    if (!DEVICE_CODE_RE.test(code)) return alert("El código tiene que tener el formato MG-0000 (las letras 'MG', un guion, y 4 números). Revisá el que viene impreso en tu dispositivo.");

    try {
        const error = await checkDevice(code, pin);
        if (error) return alert(error);

        await set(dbRef(`usuarios/${sanitizeEmail(email)}`), {
            nombre: name,
            email,
            password, // Texto plano por compatibilidad con App Inventor (ver nota en la entrega)
            dispositivo: code,
            fechaCreacion: new Date().toISOString()
        });
        await claimDevice(code, email, { peso_min: weight - WEIGHT_TOLERANCE, peso_max: weight + WEIGHT_TOLERANCE });

        alert("¡Usuario y dispositivo vinculados con éxito! Ahora puedes iniciar sesión.");
        showScreen("login");
    } catch (err) {
        alert("Error al registrar: " + err.message);
    }
}

async function handleLogin(e, onLogin) {
    e.preventDefault();
    const email = $("login-email").value;
    const password = $("login-password").value;

    try {
        const snapshot = await get(dbRef(`usuarios/${sanitizeEmail(email)}`));
        if (!snapshot.exists()) return alert("Usuario no encontrado. ¿Te registraste correctamente?");
        const user = snapshot.val();
        if (user.password !== password) return alert("Contraseña incorrecta");

        state.user = user;
        showScreen("dashboard");
        onLogin();
    } catch (err) {
        alert("Error al iniciar sesión: " + err.message);
    }
}

export function initAuth({ onLogin, onLogout }) {
    initCodeValidation();
    $("form-register").addEventListener("submit", handleRegister);
    $("form-login").addEventListener("submit", (e) => handleLogin(e, onLogin));
    $("btn-logout").addEventListener("click", () => {
        state.user = null;
        onLogout();
        showScreen("landing");
    });
}
