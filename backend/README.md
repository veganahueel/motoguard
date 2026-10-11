# MotoGuard API local (prototipo)

La API recibe reportes del ESP32, valida su clave y actualiza solo `MotoGuard/dispositivos/MG-TEST01` en Firebase. **No implementa un sistema seguro de provisión y revocación de dispositivos para producción.** Usar HTTP únicamente en una LAN confiable para demostración; antes de desplegar usar HTTPS, credenciales rotables, control de acceso y protecciones operativas.

## Instalación (CMD en Windows)

```cmd
cd /d "D:\gitHUb\motoguard\backend"
npm install express firebase-admin dotenv helmet express-rate-limit
copy .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiar el valor generado a `DEVICE_KEY` en `.env` sin comillas. Nunca subir esa clave a GitHub.

## Descargar credencial Firebase Admin

1. Firebase Console > engranaje > Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada.
2. Descargar el JSON y **guardarlo como** `backend/secrets/firebase-admin.json` (la carpeta `secrets` viene incluida).
3. No compartir ni publicar este archivo. Las credenciales de servicio permiten acceso administrativo al proyecto. Si se expone, revocar inmediatamente su clave.

## Ejecutar

```cmd
node server.js
```

Desde la PC, probar en el navegador `http://localhost:3001/health` y comprobar que responde `{"ok":true,"servicio":"MotoGuard API"}`.

Para el ESP32, la URL debe ser `http://IP_DE_TU_PC:3001/api/dispositivo`; la IP de la computadora se obtiene con `ipconfig`, no usar la IP del ESP32. Ambos deben estar en la misma LAN y el firewall debe permitir el puerto solo en red privada.

## Contrato del endpoint

`POST /api/dispositivo`, header `x-device-key` igual a `DEVICE_KEY`, JSON:

```json
{"vibracion": true, "movimiento": true, "lat": -27.45, "lng": -58.98}
```

Los campos `lat` y `lng` son opcionales, pero deben enviarse juntos y ser números válidos. `activo` en Firebase debe ser booleano `true` para disparar `ALERTA` cuando ambos sensores informan `true`; si es `false`, el estado será `REPOSO`. El servidor nunca altera `activo` ni `ownerUid`. Guarda `ultimaConexion` y solo registra un nuevo evento cuando cambia de otro estado a `ALERTA`.

## Seguridad

- No poner el JSON de Firebase Admin ni `.env` en la app Expo o el ESP32.
- `.gitignore` excluye secretos, pero comprobar `git status` antes de publicar.
- No enviar credenciales en capturas o chats.
- El token estático viaja sin cifrar si se utiliza HTTP local: **no usar fuera de LAN de confianza**. Para producción HTTPS y rotación.
- Actualmente limita frecuencia básica, valida cuerpo y limita al dispositivo MG-TEST01; implementar controles adicionales para despliegue público.
