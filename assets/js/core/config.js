// Configuración central de la app. Cambiar valores acá, no en los módulos.
export const firebaseConfig = {
    apiKey: "AIzaSyAFZZ4jWRt9_Bz6at_IDdYXhbQdk2X-_S0",
    authDomain: "motoguard-45eeb.firebaseapp.com",
    databaseURL: "https://motoguard-45eeb-default-rtdb.firebaseio.com",
    projectId: "motoguard-45eeb",
    storageBucket: "motoguard-45eeb.firebasestorage.app",
    messagingSenderId: "299538184708",
    appId: "1:299538184708:web:a84aa4b1f66d2184155351"
};

export const DB_ROOT = "MotoGuard";
export const DEVICE_CODE_RE = /^MG-\d{4}$/;
export const DEVICE_CODE_HELP = "Formato: MG- seguido de 4 números (ej: MG-0007). Es el código impreso en tu dispositivo.";
export const DEFAULT_COORDS = [-27.4606, -58.9869];
export const TELEGRAM_BOT = "motoguard_alert_bot";

// Correo que recibe los mensajes del formulario de contacto.
export const CONTACT_EMAIL = "motoguard2030@gmail.com";
