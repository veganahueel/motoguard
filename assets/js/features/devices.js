// Reglas de negocio de los dispositivos: validar código/PIN y vincular/desvincular.
import { dbRef, get, update } from "../core/firebase.js";
import { sanitizeEmail } from "../core/utils.js";

/** Devuelve null si el dispositivo se puede vincular, o el mensaje de error. */
export async function checkDevice(code, pin = null) {
    const catalog = await get(dbRef(`catalogo_dispositivos/${code}`));
    if (!catalog.exists()) return "Código de dispositivo inválido. Verificá el número de serie de tu MotoGuard.";
    if (pin !== null && catalog.val() !== pin) return "El PIN de activación no coincide con ese código. Revisá la etiqueta de tu dispositivo.";
    const owner = await get(dbRef(`dispositivos/${code}/dueño`));
    if (owner.exists() && owner.val()) return "Este dispositivo ya está vinculado a otra cuenta.";
    return null;
}

export const claimDevice = (code, email, extra = {}) =>
    update(dbRef(`dispositivos/${code}`), { dueño: sanitizeEmail(email), vinculado: true, ...extra });

export const releaseDevice = (code) =>
    update(dbRef(`dispositivos/${code}`), { dueño: "", vinculado: false });

export const setUserDevice = (email, code) =>
    update(dbRef(`usuarios/${sanitizeEmail(email)}`), { dispositivo: code });
