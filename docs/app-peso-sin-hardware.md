# MotoGuard: mejoras de la app sin hardware

Esta rama prepara la interfaz Expo 1.0.1 para consumir telemetria tanto de V9 (Firebase directo, `MG-0003`) como del backend original (`MG-TEST01`), sin exigir que el HX711 funcione.

## Pantalla Inicio
- Si existen `peso_actual` (gramos), `estado_peso` y `peso_ts`, se usa el formato V9.
- `BALANZA_ERROR`, `INICIANDO`, muestra obsoleta y ESP32 fuera de linea se muestran como **Sin medir**, evitando falsos valores.
- El estado de conexion puede utilizar `peso_ts` del firmware V9, porque V9 no actualiza `ultimaConexion`.
- El rango de sensor `peso_min`/`peso_max` se presenta en gramos, aunque Firebase lo almacena en kilogramos.
- Editar rango exige sesion y dispositivo con `ownerUid` correspondiente. La peticion pasa por el backend autenticado `POST /api/peso/rango`, no por una escritura directa desde la app.

## Cuenta
- El peso corporal opcional se almacena en AsyncStorage del propio telefono. No se envia a Firebase ni al ESP32, no se utiliza para validar una celda de 20 kg y no se sincroniza entre dispositivos.

## Pruebas SIN hardware
1. En GitHub, revisar y aprobar los cambios de la rama. No modificar la rama principal sin probar.
2. En la carpeta `frontend`, ejecutar `npm ci` y `npx tsc --noEmit` (requiere Node/npm) y luego `npx expo start`.
3. Abrir **Modo demostracion** y verificar que el panel indica explicitamente un peso **de ejemplo**, no una lectura real.
4. Para probar el guardado de peso personal, iniciar sesion y hacerlo desde Cuenta. Se conserva unicamente en el telefono.
5. Para probar la pantalla de datos reales, el registro `MG-0003` debe tener un `ownerUid` legitimamente asignado al usuario autenticado. Seleccionarlo desde Cuenta usando su codigo.
6. El boton para guardar un rango requiere desplegar primero el backend actualizado y configurar correctamente la cuenta propietaria; valores de ejemplo: minimo `0,18`, maximo `0,20` (kilogramos), correspondientes a 180–200 gramos.
7. No cambiar `DEVICE_ID` del backend automaticamente. Ese valor se usa para funciones ya existentes de `MG-TEST01`. La nueva ruta de rango soporta un dispositivo distinto tras comprobar su propietario.

## Pendientes importantes
- El firmware V9 reporta `MG-0003`; el backend anterior usa `MG-TEST01`. Son nodos separados.
- No modificar `ownerUid` de otros usuarios ni vincularse a dispositivos ajenos.
- Las reglas de Realtime Database deben dejar de ser publicas mediante un plan de autenticacion compatible con el firmware. La nueva ruta valida tokens, pero **no compensa** reglas `.read/.write = true` en Firebase.
- La APK instalada no cambia hasta que se genere un nuevo build de Expo/EAS.
- No hay confirmacion de compilacion ni pruebas en telefono para esta rama. `npx tsc --noEmit` y las pruebas manuales son obligatorias antes de merge o despliegue.
