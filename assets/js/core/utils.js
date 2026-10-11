export const $ = (id) => document.getElementById(id);

// App Inventor no permite puntos en las claves de Firebase RTDB.
export const sanitizeEmail = (email) => email.replace(/\./g, "_");

export const setText = (id, text) => { $(id).textContent = text; };
