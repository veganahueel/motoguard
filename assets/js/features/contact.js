import { $ } from "../core/utils.js";
import { CONTACT_EMAIL } from "../core/config.js";

// El formulario se envía con FormSubmit (sin servidor propio): reenvía el mensaje al correo del equipo.
const ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;

export function initContact() {
    const form = $("form-contact");
    const button = $("contact-submit");
    const status = $("contact-status");

    const show = (kind, message) => {
        status.textContent = message;
        status.className = `contact-status ${kind ? `is-${kind}` : ""}`;
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;

        button.disabled = true;
        button.textContent = "Enviando...";
        show("", "");

        try {
            const response = await fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    ...Object.fromEntries(new FormData(form)),
                    _subject: "Nuevo mensaje desde la web de MotoGuard",
                    _template: "table",
                    _captcha: "false"
                })
            });
            const data = await response.json();
            if (!response.ok || String(data.success) !== "true") throw new Error(data.message);

            form.reset();
            show("ok", "Mensaje enviado. Te respondemos al correo que indicaste.");
        } catch {
            show("error", `No pudimos enviar el mensaje. Probá de nuevo o escribinos a ${CONTACT_EMAIL}.`);
        } finally {
            button.disabled = false;
            button.textContent = "Enviar mensaje";
        }
    });
}
