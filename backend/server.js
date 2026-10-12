// MotoGuard API — compatible con desarrollo local y Render.
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase, ServerValue } = require('firebase-admin/database');

const PORT = Number(process.env.PORT || 3001);
const DEVICE_ID = process.env.DEVICE_ID || 'MG-TEST01';
const DEVICE_KEY = process.env.DEVICE_KEY || '';
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || '';

// En la PC usamos backend/secrets/firebase-admin.json.
// En Render, el Secret File se monta en /etc/secrets/firebase-admin.json.
const localSecret = path.join(__dirname, 'secrets', 'firebase-admin.json');
const renderSecret = '/etc/secrets/firebase-admin.json';
const serviceAccountPath = process.env.FIREBASE_ADMIN_PATH ||
  (fs.existsSync(renderSecret) ? renderSecret : localSecret);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('PORT debe ser un numero de puerto valido.');
  process.exit(1);
}
if (!/^[a-zA-Z0-9_-]{1,50}$/.test(DEVICE_ID)) {
  console.error('DEVICE_ID tiene caracteres no permitidos.');
  process.exit(1);
}
if (Buffer.byteLength(DEVICE_KEY, 'utf8') < 32) {
  console.error('DEVICE_KEY debe contener al menos 32 caracteres aleatorios.');
  process.exit(1);
}
if (!FIREBASE_DATABASE_URL.startsWith('https://')) {
  console.error('Falta FIREBASE_DATABASE_URL o no comienza con https://');
  process.exit(1);
}
if (!fs.existsSync(serviceAccountPath)) {
  console.error('No se encontro el archivo secreto firebase-admin.json.');
  console.error('PC: backend/secrets/firebase-admin.json | Render: Secret File firebase-admin.json');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
    throw new Error('Faltan campos del service account');
  }
} catch (_error) {
  console.error('firebase-admin.json no es un archivo JSON de cuenta de servicio valido.');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: FIREBASE_DATABASE_URL,
});

const app = express();
app.disable('x-powered-by');
// Render pone Express detras de su proxy HTTPS. No confiamos en cabeceras
// X-Forwarded-For en desarrollo local, donde los clientes llegan directamente.
if (process.env.RENDER === 'true') app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '2kb', strict: true }));
app.use('/api/dispositivo', rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}));

app.get('/health', (_req, res) => res.json({ ok: true, servicio: 'MotoGuard API' }));

function keyMatches(received) {
  if (typeof received !== 'string') return false;
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(DEVICE_KEY, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post('/api/dispositivo', async (req, res) => {
  if (!keyMatches(req.get('x-device-key'))) {
    return res.status(401).json({ error: 'Dispositivo no autorizado' });
  }
  const { vibracion, movimiento, lat, lng } = req.body || {};
  if (typeof vibracion !== 'boolean' || typeof movimiento !== 'boolean') {
    return res.status(400).json({ error: 'vibracion y movimiento deben ser booleanos' });
  }
  const hasLat = lat !== undefined && lat !== null;
  const hasLng = lng !== undefined && lng !== null;
  if (hasLat !== hasLng ||
      (hasLat && (!Number.isFinite(lat) || !Number.isFinite(lng) ||
       lat < -90 || lat > 90 || lng < -180 || lng > 180))) {
    return res.status(400).json({ error: 'Coordenadas invalidas' });
  }

  try {
    const ref = getDatabase().ref(`MotoGuard/dispositivos/${DEVICE_ID}`);
    const snap = await ref.once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Dispositivo no encontrado' });

    const anterior = snap.val() || {};
    const armado = anterior.activo === true;
    const alerta = armado && vibracion && movimiento;
    const estado = alerta ? 'ALERTA' : 'REPOSO';
    const now = ServerValue.TIMESTAMP;

    const updates = {
      estado,
      ultimaConexion: now,
      'sensores/vibracion': vibracion,
      'sensores/movimiento': movimiento,
    };
    if (hasLat && hasLng) {
      updates.lat = lat;
      updates.lng = lng;
      updates.ultimaUbicacion = now;
    }
    await ref.update(updates);
    if (alerta && anterior.estado !== 'ALERTA') {
      await ref.child('historial').push({ estado: 'ALERTA', timestamp: now });
    }
    return res.json({ ok: true, dispositivo: DEVICE_ID, estado, armado });
  } catch (error) {
    console.error('Error guardando datos en Firebase:', error.message);
    return res.status(500).json({ error: 'Error guardando en Firebase' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MotoGuard API escuchando en puerto ${PORT}`);
});
