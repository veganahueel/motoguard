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
const { getAuth } = require('firebase-admin/auth');

const PORT = Number(process.env.PORT || 3001);
const DEVICE_ID = process.env.DEVICE_ID || 'MG-TEST01';
const DEVICE_KEY = process.env.DEVICE_KEY || '';
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_COOLDOWN_MS = 120000; // Un mensaje por evento y no mas de uno cada 2 minutos.

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
app.use(['/api/dispositivo', '/api/calibrar'], rateLimit({
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

// Alerta independiente del ciclo HTTPS del ESP32. Nunca mostramos tokens en logs.
async function notificarTelegramSiCorresponde(ref, motivo, grados, lat, lng) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  // Reserva persistida en Firebase: reduce duplicados incluso si Render reinicia.
  const ahora = Date.now();
  const ultimoRef = ref.child('notificaciones/telegramUltimoIntento');
  const reserva = await ultimoRef.transaction(anterior => {
    const previo = typeof anterior === 'number' ? anterior : 0;
    if (ahora - previo < TELEGRAM_COOLDOWN_MS) return; // Abort transaction.
    return ahora;
  }, undefined, false);
  if (!reserva.committed) return;

  let texto = `🚨 ALERTA MOTOGUARD\nDispositivo: ${DEVICE_ID}\n`;
  texto += `Motivo: ${motivo.replace(/_/g, ' ')}\nProteccion: ACTIVADA`;
  if (Number.isFinite(grados)) texto += `\nCambio de inclinacion: ${grados.toFixed(1)}°`;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    texto += `\nUbicacion: https://maps.google.com/?q=${lat},${lng}`;
  }

  // Node 18+ ofrece fetch nativo.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: texto, disable_web_page_preview: true }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log('Telegram: alerta enviada.');
  } finally {
    clearTimeout(timer);
  }
}

// La app llama este endpoint CON EL ID TOKEN de Firebase Auth.
// El admin SDK comprueba que el solicitante sea el propietario real.
app.post('/api/calibrar', async (req, res) => {
  const header = req.get('authorization') || '';
  const match = /^Bearer (\S+)$/.exec(header);
  if (!match) return res.status(401).json({ error: 'Falta iniciar sesion' });
  if (req.body?.dispositivo !== DEVICE_ID) return res.status(400).json({ error: 'Dispositivo incorrecto' });

  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    const ref = getDatabase().ref(`MotoGuard/dispositivos/${DEVICE_ID}`);
    const snap = await ref.once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Dispositivo inexistente' });
    const actual = snap.val() || {};
    if (!actual.ownerUid || actual.ownerUid !== decoded.uid) {
      return res.status(403).json({ error: 'No sos propietario de este dispositivo' });
    }
    const ahora = Date.now();
    if (!Number.isFinite(actual.ultimaConexion) || ahora - actual.ultimaConexion > 45000) {
      return res.status(409).json({ error: 'El ESP32 no esta conectado. Revisalo antes de calibrar.' });
    }
    const calib = actual.calibracion || {};
    if (calib.estado === 'PENDIENTE' && ahora - Number(calib.solicitadaEn || 0) < 120000) {
      return res.status(409).json({ error: 'Ya hay una calibracion en curso.' });
    }
    const solicitudId = crypto.randomUUID();
    await ref.update({
      activo: false, // Nunca armar hasta confirmar medicion real del MPU6050.
      estado: 'CALIBRANDO',
      'calibracion/estado': 'PENDIENTE',
      'calibracion/solicitudId': solicitudId,
      'calibracion/solicitadaEn': ahora,
      'calibracion/guardadaEn': null,
      'calibracion/vector': null,
      'calibracion/umbralGrados': 8,
    });
    return res.status(202).json({ ok: true, estado: 'PENDIENTE', mensaje: 'Deja la moto quieta. Esperando al ESP32.' });
  } catch (error) {
    if (error.code?.startsWith('auth/')) return res.status(401).json({ error: 'Sesion vencida' });
    console.error('No se pudo solicitar calibracion:', error.message);
    return res.status(500).json({ error: 'No se pudo iniciar la calibracion' });
  }
});

app.post('/api/dispositivo', async (req, res) => {
  if (!keyMatches(req.get('x-device-key'))) {
    return res.status(401).json({ error: 'Dispositivo no autorizado' });
  }
  const { vibracion, movimiento, lat, lng, calibracion, inclinacionGrados } = req.body || {};
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
  if (inclinacionGrados !== undefined &&
      (!Number.isFinite(inclinacionGrados) || inclinacionGrados < 0 || inclinacionGrados > 180)) {
    return res.status(400).json({ error: 'Inclinacion invalida' });
  }
  if (calibracion !== undefined &&
      (typeof calibracion !== 'object' || calibracion === null ||
       typeof calibracion.solicitudId !== 'string' ||
       !/^[0-9a-f-]{36}$/.test(calibracion.solicitudId) ||
       !['x', 'y', 'z'].every(k => Number.isFinite(calibracion[k]) && Math.abs(calibracion[k]) <= 2))) {
    return res.status(400).json({ error: 'Calibracion invalida' });
  }

  try {
    const ref = getDatabase().ref(`MotoGuard/dispositivos/${DEVICE_ID}`);
    const snap = await ref.once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Dispositivo no encontrado' });

    const anterior = snap.val() || {};
    let armado = anterior.activo === true;
    const pendiente = anterior.calibracion?.estado === 'PENDIENTE';
    let calibracionGuardada = false;
    let referencia = anterior.calibracion?.vector || null;
    const now = ServerValue.TIMESTAMP;
    const updates = {
      ultimaConexion: now,
      'sensores/vibracion': vibracion,
      'sensores/movimiento': movimiento,
    };
    if (inclinacionGrados !== undefined) updates['sensores/inclinacionGrados'] = inclinacionGrados;
    if (hasLat && hasLng) {
      updates.lat = lat;
      updates.lng = lng;
      updates.ultimaUbicacion = now;
    }

    if (pendiente && calibracion?.solicitudId === anterior.calibracion.solicitudId) {
      const vector = { x: calibracion.x, y: calibracion.y, z: calibracion.z };
      const norma = Math.hypot(vector.x, vector.y, vector.z);
      if (norma < 0.75 || norma > 1.25) {
        return res.status(422).json({ error: 'La moto debe estar quieta para calibrar.' });
      }
      updates['calibracion/vector'] = vector;
      updates['calibracion/guardadaEn'] = now;
      updates['calibracion/estado'] = 'GUARDADA';
      updates.activo = true;
      updates.estado = 'REPOSO';
      calibracionGuardada = true;
      armado = true;
      referencia = vector;
    } else if (pendiente) {
      // El sistema continua desarmado durante la calibracion.
      updates.estado = 'CALIBRANDO';
      armado = false;
    } else {
      updates.estado = armado && (vibracion || movimiento) ? 'ALERTA' : 'REPOSO';
    }

    await ref.update(updates);
    const alerta = !pendiente && armado && (vibracion || movimiento);
    const motivo = vibracion && movimiento ? 'AMBOS_SENSORES' :
                   vibracion ? 'VIBRACION' : 'MOVIMIENTO';
    if (alerta && anterior.estado !== 'ALERTA') {
      await ref.child('historial').push({ estado: 'ALERTA', motivo, timestamp: now });
      // Telegram es opcional y no puede romper el endpoint del ESP32.
      void notificarTelegramSiCorresponde(ref, motivo, inclinacionGrados, hasLat ? lat : null, hasLng ? lng : null)
        .catch(error => console.error('Telegram: no se pudo enviar alerta:', error.message));
    }

    return res.json({
      ok: true,
      dispositivo: DEVICE_ID,
      estado: updates.estado,
      armado,
      calibrar: pendiente && !calibracionGuardada,
      solicitudId: pendiente && !calibracionGuardada ? anterior.calibracion.solicitudId : null,
      calibracionGuardada,
      referencia: !pendiente && referencia && anterior.calibracion?.estado === 'GUARDADA'
        ? { ...referencia, umbralGrados: anterior.calibracion.umbralGrados || 8 }
        : calibracionGuardada ? { ...referencia, umbralGrados: 8 } : null,
    });
  } catch (error) {
    console.error('Error guardando datos en Firebase:', error.message);
    return res.status(500).json({ error: 'Error guardando en Firebase' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MotoGuard API escuchando en puerto ${PORT}`);
});
