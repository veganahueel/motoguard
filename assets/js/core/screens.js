// Navegación entre pantallas: una sola función en vez de classList repartido.
import { $ } from "./utils.js";

const SCREENS = ["landing", "login", "register", "dashboard"];

export function showScreen(name) {
    SCREENS.forEach((s) => $(`screen-${s}`).classList.toggle("hidden", s !== name));
    window.scrollTo(0, 0);
}
