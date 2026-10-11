require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase, ServerValue } = require('firebase-admin/database');

const DEVICE_ID = 'MG-TEST01';
const PORT = Number(process.env.PORT || 3001);
const DEVICE_KEY = process.env.DEVICE_KEY || '';
const serviceAccountPath = path.resolve(__dirname, 'secrets', 'firebase-admin.json');

if (DEVICE_KEY.length < 32) {
  console.error('DEVICE_KEY debe contener al menos 32 caracteres aleatorios.');
  process.exit(1);
}
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Falta secrets/firebase-admin.json. Descargalo desde Firebase Console > Cuentas de servicio.');
  process.exit(1);
}
initializeApp({
  credential: cert(require(serviceAccountPath)),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({limit: '2kb'}));
app.use('/api/dispositivo', rateLimit({windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false}));

app.get('/health', (_req, res) => res.json({ok: true, servicio: 'MotoGuard API'}));

function keyMatches(received) {
  if (typeof received !== 'string' || received.length !== DEVICE_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(DEVICE_KEY));
}

app.post('/api/dispositivo', async (req, res) => {
  if (!keyMatches(req.get('x-device-key'))) return res.status(401).json({error: 'Dispositivo no autorizado'});
  const {vibracion, movimiento, lat, lng} = req.body || {};
  if (typeof vibracion !== 'boolean' || typeof movimiento !== 'boolean') {
    return res.status(400).json({error: 'vibracion y movimiento deben ser booleanos'});
  }
  const hasLat = lat !== undefined && lat !== null;
  const hasLng = lng !== undefined && lng !== null;
  if (hasLat !== hasLng || (hasLat && (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180))) {
    return res.status(400).json({error: 'Coordenadas invalidas'});
  }
  try {
    const ref = getDatabase().ref(`MotoGuard/dispositivos/${DEVICE_ID}`);
    const snap = await ref.once('value');
    if (!snap.exists()) return res.status(404).json({error: 'Dispositivo no encontrado'});
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
      await ref.child('historial').push({estado: 'ALERTA', timestamp: now});
    }
    res.json({ok: true, dispositivo: DEVICE_ID, estado, armado});
  } catch (error) {
    console.error('Error interno:', error.message);
    res.status(500).json({error: 'Error guardando en Firebase'});
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`MotoGuard API escuchando en puerto ${PORT}`));
