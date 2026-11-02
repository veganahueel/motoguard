// Auditoria de SOLO LECTURA. No modifica Firebase ni muestra secretos.
// Requisitos: ejecutar desde backend (npm ci; node scripts/auditar-seguridad-motoguard.js)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const localSecret = path.join(__dirname, '..', 'secrets', 'firebase-admin.json');
const serviceAccountPath = process.env.FIREBASE_ADMIN_PATH ||
  (fs.existsSync('/etc/secrets/firebase-admin.json') ? '/etc/secrets/firebase-admin.json' : localSecret);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

async function main() {
  if (!databaseURL || !databaseURL.startsWith('https://')) {
    throw new Error('Falta FIREBASE_DATABASE_URL en backend/.env');
  }
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error('Falta backend/secrets/firebase-admin.json o FIREBASE_ADMIN_PATH');
  }
  const key = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(key), databaseURL });
  const root = getDatabase().ref('MotoGuard');
  const [usersSnap, devicesSnap, catalogSnap] = await Promise.all([
    root.child('usuarios').once('value'),
    root.child('dispositivos').once('value'),
    root.child('catalogo_dispositivos').once('value'),
  ]);
  // NO mostrar datos personales: ni emails, ni contrasenas, ni PIN,
  // ni tokens/chatId, ni IDs completos de dispositivos.
  const usuarios = usersSnap.val() || {};
  const dispositivos = devicesSnap.val() || {};
  const catalogo = catalogSnap.val() || {};
  const totalUsuarios = Object.keys(usuarios).length;
  const passwordsEnClaro = Object.values(usuarios).filter(
    u => u && typeof u === 'object' && typeof u.password === 'string',
  ).length;
  const totalDispositivos = Object.keys(dispositivos).length;
  const conDuenoLegacy = Object.values(dispositivos).filter(
    d => d && typeof d === 'object' && Boolean(d['dueño']),
  ).length;
  const conOwnerUid = Object.values(dispositivos).filter(
    d => d && typeof d === 'object' && Boolean(d.ownerUid),
  ).length;
  const rangoFueraHX711 = Object.values(dispositivos).filter(d => {
    if (!d || typeof d !== 'object') return false;
    if (d.peso_min == null || d.peso_max == null) return false;
    const min = Number(d.peso_min), max = Number(d.peso_max);
    return !Number.isFinite(min) || !Number.isFinite(max) ||
      min < 0 || max <= min || max > 20;
  }).length;
  const resultado = {
    tipo: 'AUDITORIA_SIN_CAMBIOS',
    usuariosLegacy: totalUsuarios,
    usuariosConPasswordEnClaro: passwordsEnClaro,
    dispositivos: totalDispositivos,
    dispositivosConDuenoLegacy: conDuenoLegacy,
    dispositivosConOwnerUid: conOwnerUid,
    catalogoConPines: Object.keys(catalogo).length,
    dispositivosConRangoIncompatibleHX711_20kg: rangoFueraHX711,
    advertencia: 'El script NO comprueba las reglas de Firebase ni modifica datos.',
  };
  console.log(JSON.stringify(resultado, null, 2));
}
main().catch(err => {
  console.error('No se pudo completar la auditoria:', err.message);
  process.exitCode = 1;
});
