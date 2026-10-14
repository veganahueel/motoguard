"use strict";
// Navegacion accesible; este sitio es informativo y NO implementa autenticacion.
const menu = document.getElementById("menu-toggle");
const links = document.getElementById("nav-links");
if (menu && links) {
  menu.addEventListener("click", () => {
    const visible = links.classList.toggle("is-open");
    menu.setAttribute("aria-expanded", String(visible));
    menu.setAttribute("aria-label", visible ? "Ocultar menú" : "Mostrar menú");
  });
  links.querySelectorAll("a").forEach((anchor) => anchor.addEventListener("click", () => {
    links.classList.remove("is-open");
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "Mostrar menú");
  }));
}
