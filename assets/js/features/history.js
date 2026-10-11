import { dbRef, query, orderByChild, limitToLast } from "../core/firebase.js";
import { listen, state } from "../core/state.js";
import { $ } from "../core/utils.js";

function emptyItem() {
    const li = document.createElement("li");
    li.className = "alert-item alert-item-empty";
    li.textContent = "Todavía no hay eventos registrados.";
    return li;
}

function eventItem(event) {
    const date = event.timestamp ? new Date(event.timestamp).toLocaleString("es-AR") : "Fecha desconocida";
    const li = document.createElement("li");
    li.className = "alert-item";
    const title = document.createElement("strong");
    title.textContent = "Movimiento sospechoso confirmado";
    const when = document.createElement("time");
    when.textContent = date;
    li.append(title, when);
    return li;
}

// Últimos 10 eventos del ESP32, el más reciente arriba.
export function loadHistory() {
    const list = $("lista-historial");
    const source = query(
        dbRef(`dispositivos/${state.user.dispositivo}/historial`),
        orderByChild("timestamp"),
        limitToLast(10)
    );
    listen(source, (snapshot) => {
        const data = snapshot.val();
        list.replaceChildren(...(data ? Object.values(data).reverse().map(eventItem) : [emptyItem()]));
    });
}
