
require('dotenv').config();

const DEVICE_KEY = process.env.DEVICE_KEY;
const PORT = process.env.PORT || 3001;

if (!DEVICE_KEY || DEVICE_KEY.length < 32) {
  console.error('ERROR: DEVICE_KEY no configurada');
  process.exit(1);
}

async function probarAPI() {
  console.log('================================');
  console.log('       MOTOGUARD - TEST API');
  console.log('================================');

  try {
    const respuesta = await fetch(
      `http://127.0.0.1:${PORT}/api/dispositivo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-key': DEVICE_KEY
        },
        body: JSON.stringify({
          vibracion: false,
          movimiento: false
        }),
        signal: AbortSignal.timeout(12000)
      }
    );

    const resultado = await respuesta.text();

    console.log('Codigo HTTP:', respuesta.status);
    console.log('Respuesta:', resultado);

    if (respuesta.ok) {
      console.log('PRUEBA EXITOSA');
    } else {
      console.log('La API respondio con un error');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

probarAPI();
