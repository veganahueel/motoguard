// Única puerta de entrada a Firebase: el resto de la app importa de acá.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import * as rtdb from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { firebaseConfig, DB_ROOT } from "./config.js";

export const db = rtdb.getDatabase(initializeApp(firebaseConfig));
export const { get, set, update, onValue, query, orderByChild, limitToLast } = rtdb;

/** Referencia dentro de MotoGuard/: dbRef(`dispositivos/${codigo}/activo`) */
export const dbRef = (path) => rtdb.ref(db, `${DB_ROOT}/${path}`);
