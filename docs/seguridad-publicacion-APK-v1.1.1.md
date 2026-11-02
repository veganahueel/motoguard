# MotoGuard — publicación segura del APK (plan de despliegue)

**Fecha:** 2026-11-02
**Estado:** preparación; NO se ha realizado migración, borrado, modificación de reglas ni despliegue.

## APK probado
- EAS Build ID: bf7bdaeb-1b8a-4a67-be02-cb2dd906307d
- SDK Expo: 58; version 1.1.0; Android versionCode 3.
- El usuario informó que instaló y ejecutó el APK en Android, inició sesión, utilizó Inicio/Ubicación/Alertas y reabrió la app exitosamente.
- A pesar de pasar las pruebas funcionales, la APP **NO debe distribuirse públicamente** todavía.

## Hallazgos verificables en el ZIP de la nueva app
1. `src/services/firebaseBackend.js` guarda `{email, password,...}` bajo `MotoGuard/usuarios/{email_sanitizado}` y en el login compara `datos.password !== password`.
2. Los PIN están en `MotoGuard/catalogo_dispositivos` y se consultan desde el cliente.
3. El cliente escribe directamente `activo`, `comando`, `peso_min`, `peso_max` y `dueño` en Realtime Database; la validación de propiedad se hace en el cliente y NO es una barrera de seguridad.
4. `BiometriaCard` permite 40–150 kg pero escribe esos valores en `peso_min`/`peso_max`, que el firmware V9 interpreta como rango de **sensor** en kg. Con un HX711 limitado a 20 kg esa configuración es incompatible con el prototipo.
5. En conversaciones previas se identificaron reglas `.read: true` / `.write: true` en Firebase RTDB. Debe verificarse su estado actual en la consola; el simple hecho de iniciar sesión NO protege la DB si las reglas siguen abiertas.
6. El firmware V9 accede a Firebase REST directamente sin autenticación. Bloquear reglas globales antes de adaptar esa comunicación interrumpiría el dispositivo. La actualización del firmware queda pendiente del equipo de hardware.

## Secuencia de preparación, preservando cuentas y enlace web

### A. Auditoría de solo lectura
- Sin publicar datos de personas, ejecutar:
  `cd backend && npm ci && node scripts/auditar-seguridad-motoguard.js`
- El script usa el mismo archivo privado de Firebase Admin que el backend. Requiere `FIREBASE_DATABASE_URL`; NO muestra emails, contraseñas, PIN, tokens, chat IDs ni otros secretos.
- No se requiere ejecutar auditoría desde un teléfono ni compartir credenciales.
- Desde Firebase Console verificar reglas actualmente activas y el proveedor Email/Password de Authentication.
- Obtener un backup administrado de la base antes de cualquier migración; protegerlo porque contiene contraseñas en claro.

### B. Autenticación segura sin perder cuentas
- Migrar a **Firebase Authentication** (Email/Password) con sesión persistente mediante `onAuthStateChanged`.
- Eliminar de la app la comparación directa de contraseñas con Realtime Database.
- Para usuarios legados, relacionar sus emails con una identidad de Firebase Auth y su dispositivo correspondiente. En caso de cuentas existentes en Auth, **no reemplazar** contraseñas.
- Para usuarios legados no presentes en Auth, crear la identidad mediante un proceso administrativo y usar **restablecimiento de contraseña por correo**, nunca publicar/importar la contraseña antigua en el frontend.
- Guardar perfiles sin password en `MotoGuard/usuarios_auth/{uid}`; asignar `ownerUid` en dispositivos y comprobar colisiones entre propietarios.
- Verificar que cada usuario recupera sus datos y su dispositivo ANTES de retirar las cuentas legadas.
- Eliminar contraseñas legadas de Firebase después de confirmar la migración y mantener los backups inaccesibles al público.

### C. Vinculación y controles autorizados
- Trasladar PIN y vinculación al backend de Render, con Firebase Admin SDK.
- Cada operación sensible debe validar el token de Firebase Auth y que `ownerUid === uid` en backend/reglas (vincular, desvincular, armar, desarmar, calibrar, tara, rango y Telegram).
- No entregar PIN ni `telegram_chat_id` a cuentas ajenas.
- Diferenciar **peso corporal personal** de **rango de la celda HX711**, que para el prototipo no puede superar 20 kg.
- Eliminar la escritura en base de datos desde los sliders sin confirmación o aplicar la validación backend correspondiente.
- No anunciar bloqueo físico del encendido: `moto_encendida` es solo estado lógico salvo que exista relé validado.

### D. Hardware y reglas Firebase
- Reemplazar el acceso anónimo del firmware por HTTPS a la API autenticada con clave de dispositivo (cabecera `x-device-key`), sin exponer el servicio de Firebase Admin al ESP32.
- Probar telemetría, comandos y mensajes de Telegram con el nuevo camino.
- Después, revisar cuidadosamente reglas RTDB para que ninguna ruta de usuarios, dispositivos, catálogo/PIN o Telegram permita escrituras públicas; leer/editar solo con propietario autorizado o mediante Admin SDK.
- Hacer la migración en ambiente de prueba antes de producción.
- Si el hardware aún no está listo, NO activar reglas incompatibles ni afirmar que el sistema es seguro en uso real.

### E. Compilar APK publicable
- Usar identificador `com.veganahueel.motoguard`, mismo keystore de Android y siguiente `versionCode` superior a 3.
- Crear una nueva versión (por ejemplo `1.1.1`), ya con autentificación y controles corregidos.
- Cargar las seis variables Firebase en EAS si usa variables de entorno. No incluir service account ni secretos de servidor en el APK.
- Ejecutar análisis de dependencias, pruebas de autenticación, regreso de sesión, propietario ajeno, backend, datos antiguos y funciones de UI.
- Compilar con `npx eas-cli@latest build --platform android --profile preview` desde el proyecto ya corregido.
- Instalar sobre la versión anterior verificando firma, identidad y migración de datos.

### F. Publicación web (después de E)
- Descargar y guardar el APK final desde Expo (los artefactos pueden expirar).
- Publicar en GitHub **veganahueel/motoguard-downloads** un Release final con el archivo nombrado exactamente `MotoGuard.apk`.
- Verificar descarga de `https://github.com/veganahueel/motoguard-downloads/releases/latest/download/MotoGuard.apk` en modo incógnito, comprobando que no devuelve 404.
- Actualizar el texto de versión del sitio y fusionar el PR borrador web #2 *solo después* de que el asset y la seguridad estén verificados.
- Mantener disponible el APK anterior como respaldo, y no borrar Releases antiguos.

## Bloqueos reales para la publicación
- Falta verificar reglas Firebase actuales, cantidad de cuentas y su migración.
- Falta programar e integrar la autenticación de la nueva app con Firebase Auth y API autenticada, preservando la UI.
- Falta adaptar comunicación de ESP32 que hoy depende de reglas públicas (equipo de hardware).
- No se puede afirmar que la compilación exitosa 1.1.0 sea una versión segura.
