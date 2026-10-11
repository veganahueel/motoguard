// Estado compartido y manejo de suscripciones en tiempo real.
import { onValue } from "./firebase.js";

export const state = { user: null };
let unsubscribers = [];

/** Escucha una referencia y recuerda cómo cancelarla al cerrar sesión. */
export function listen(target, callback) {
    unsubscribers.push(onValue(target, callback));
}

export function stopListening() {
    unsubscribers.forEach((off) => off());
    unsubscribers = [];
}
