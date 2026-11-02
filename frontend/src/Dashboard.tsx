import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get, ref, set } from 'firebase/database';
import { signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './firebase';
import { Brand, Button, InfoBox } from './ui';
import { colors } from './theme';
import type { DeviceInfo, Screen } from './types';
import { validCoordinate } from './types';

const MENU: { key:Screen; name:string; icon:keyof typeof Ionicons.glyphMap }[] = [
  {key:'inicio',name:'Inicio',icon:'shield-checkmark-outline'},
  {key:'ubicacion',name:'Ubicación',icon:'location-outline'},
  {key:'alertas',name:'Alertas',icon:'notifications-outline'},
  {key:'cuenta',name:'Cuenta',icon:'person-circle-outline'},
];

export default function Dashboard({ preview, email, uid, deviceCode, onDeviceCode, info, onLeave, device }: {
  preview:boolean; email:string; uid:string | null; deviceCode:string; onDeviceCode:(code:string)=>void;
  info:string; onLeave:()=>void; device:DeviceInfo|null;
}) {
  const [tab,setTab]=useState<Screen>('inicio');
  const [codeInput,setCodeInput]=useState('');
  const [linkBusy,setLinkBusy]=useState(false);
  const [changingProtection,setChangingProtection]=useState(false);
  const [calibrating,setCalibrating]=useState(false);
  const [pesoPersonalInput,setPesoPersonalInput]=useState('');
  const [guardandoPesoPersonal,setGuardandoPesoPersonal]=useState(false);
  const [rangoMinInput,setRangoMinInput]=useState('');
  const [rangoMaxInput,setRangoMaxInput]=useState('');
  const [guardandoRango,setGuardandoRango]=useState(false);
  const [clock,setClock]=useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  // El firmware V9 no publica ultimaConexion: peso_ts indica que el
  // ESP32 continua comunicandose, incluso si el HX711 esta fallando.
  const lastContact = Math.max(Number(device?.ultimaConexion) || 0, Number(device?.peso_ts) || 0);
  const online = !preview && lastContact > 0 && clock-lastContact < 20000;

  useEffect(() => {
    setRangoMinInput(typeof device?.peso_min === 'number' ? String(device.peso_min).replace('.', ',') : '');
    setRangoMaxInput(typeof device?.peso_max === 'number' ? String(device.peso_max).replace('.', ',') : '');
  }, [deviceCode, device?.peso_min, device?.peso_max]);

  useEffect(() => {
    let activo = true;
    setPesoPersonalInput('');
    if (!uid || preview) return;
    AsyncStorage.getItem(`motoguard_peso_personal_${uid}`)
      .then(valor => { if (activo && valor) setPesoPersonalInput(valor.replace('.', ',')); })
      .catch(() => {});
    return () => { activo = false; };
  }, [uid, preview]);

  const lat = validCoordinate(device?.lat ?? device?.latitud, -90, 90);
  const lng = validCoordinate(device?.lng ?? device?.longitud, -180, 180);
  const hasLocation = lat!==null && lng!==null && !(lat===0 && lng===0);
  const origenGPS = device?.fuenteUbicacion === 'GPS';
  const origenManual = device?.fuenteUbicacion === 'MANUAL';
  const estadoPesoV9 = String(device?.estado_peso || '').toUpperCase();
  const pesoTs = Number(device?.peso_ts) || 0;
  const pesoV9 = device?.peso_actual;
  const pesoV9Disponible = online && pesoTs > 0 && clock-pesoTs < 15000 &&
    typeof pesoV9 === 'number' && Number.isFinite(pesoV9) &&
    pesoV9 >= 0 && pesoV9 <= 20000 &&
    !['BALANZA_ERROR','INICIANDO'].includes(estadoPesoV9);
  const pesoBackend = device?.sensores?.pesoKg;
  const tieneFormatoV9 = typeof device?.estado_peso === 'string' ||
    typeof device?.peso_ts === 'number';
  const pesoBackendDisponible = !tieneFormatoV9 && online && device?.sensores?.pesoValido === true &&
    typeof pesoBackend === 'number' && Number.isFinite(pesoBackend) &&
    pesoBackend >= 0 && pesoBackend <= 20;
  const pesoTexto = preview ? '0,250 kg (ejemplo)' :
    pesoV9Disponible ? `${(pesoV9! / 1000).toFixed(3)} kg` :
    pesoBackendDisponible ? `${pesoBackend!.toFixed(3)} kg` : 'Sin medir';
  const estadoHX = preview ? 'Simulado · no es una medición real' :
    !online ? 'ESP32 sin conexión reciente' :
    estadoPesoV9 === 'BALANZA_ERROR' ? 'Sensor HX711 sin datos' :
    estadoPesoV9 === 'INICIANDO' ? 'Inicializando el sensor' :
    estadoPesoV9 === 'ASIENTO_VACIO' ? 'Celda vacía' :
    estadoPesoV9 === 'SIN_REGISTRO' ? 'Sin rango autorizado guardado' :
    estadoPesoV9 === 'AUTORIZADO' ? 'Dentro del rango' :
    estadoPesoV9 === 'PESO_INSUFICIENTE' ? 'Por debajo del rango' :
    estadoPesoV9 === 'PESO_EXCEDIDO' ? 'Por encima del rango' :
    pesoBackendDisponible ? 'Medición recibida' : 'Sin lecturas válidas';
  const rangoValido = typeof device?.peso_min === 'number' && Number.isFinite(device.peso_min) &&
    typeof device?.peso_max === 'number' && Number.isFinite(device.peso_max) &&
    device.peso_min >= 0 && device.peso_min < device.peso_max && device.peso_max <= 20;
  const rangoTexto = rangoValido ?
    `${(device!.peso_min! * 1000).toFixed(0)}–${(device!.peso_max! * 1000).toFixed(0)} g` :
    'No configurado';
  const state = String(device?.estado || 'SIN DATOS').replace(/_/g,' ');
  const alarm = ['ALERTA','MOVIMIENTO CONFIRMADO','MOVIMIENTO_CONFIRMADO'].includes(String(device?.estado||'').toUpperCase());
  const active = device?.activo === true || device?.activo === 1 || device?.activo === 'true';
  const calibrationPending = device?.calibracion?.estado === 'PENDIENTE';
  const calibrationSaved = device?.calibracion?.estado === 'GUARDADA';
  const events = useMemo(() => {
    const raw = device?.historial ?? device?.alertas;
    if (!raw || typeof raw !== 'object') return [];
    return Object.entries(raw).map(([id, item]) => {
      const data = item && typeof item === 'object' ? item as Record<string, unknown> : null;
      const ms = Number(data?.timestamp);
      const validMs = Number.isFinite(ms) && ms > 0;
      const title = data ? String(data.estado ?? data.mensaje ?? data.tipo ?? 'Movimiento detectado') : String(item);
      return {
        id,
        title: title.replace(/_/g, ' '),
        date: validMs ? new Date(ms).toLocaleString('es-AR') : '',
        timestamp: validMs ? ms : 0,
      };
    }).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  },[device]);

  async function linkDevice() {
    const code=codeInput.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return Alert.alert('Código incorrecto','Ingresá el código del dispositivo (por ejemplo, MG-0001).');
    if (!uid || !db || preview) return Alert.alert('Modo demostración','Conectá Firebase e iniciá sesión para vincular un dispositivo real.');
    try {
      setLinkBusy(true);
      const snap=await get(ref(db,`MotoGuard/dispositivos/${code}`));
      if (!snap.exists()) return Alert.alert('No encontrado', 'El dispositivo no existe.');
       if (snap.child('ownerUid').val() !== uid) return Alert.alert('Acceso denegado', 'Tu cuenta no está autorizada para consultar ese dispositivo.');
      await AsyncStorage.setItem(`motoguard_dispositivo_${uid}`,code);
      onDeviceCode(code);
      setCodeInput('');
      Alert.alert('Dispositivo seleccionado',`MotoGuard ${code} está listo para consultar.`);
    } catch (e:any) {
      Alert.alert('Acceso no autorizado', 'No pudimos consultar ese dispositivo. Verificá el UID del propietario y las reglas de Firebase.');
    } finally {setLinkBusy(false);}
  }

  function requestProtectionChange() {
    if (!device || !uid || !deviceCode || preview || !db) return;
    if (calibrationPending || calibrating || changingProtection) {
      return Alert.alert('Calibración en curso', 'Esperá a que el ESP32 termine de medir la posición.');
    }

    // Armar siempre requiere medir nuevamente la posición real de la moto.
    // No escribimos activo=true directamente en Firebase.
    if (!active) {
      requestCalibration();
      return;
    }

    Alert.alert(
      'Desactivar protección',
      `¿Querés desactivar las alertas de movimiento de ${deviceCode}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desactivar', onPress: async () => {
          try {
            setChangingProtection(true);
            if (auth?.currentUser?.uid !== uid) throw new Error('Sesión no válida');
            const database = db;
            if (!database) throw new Error('Base de datos no disponible');
            await set(ref(database, `MotoGuard/dispositivos/${deviceCode}/activo`), false);
          } catch (_error) {
            Alert.alert('No se pudo desactivar', 'Revisá tu conexión y las reglas de seguridad de Firebase.');
          } finally {
            setChangingProtection(false);
          }
        } },
      ],
    );
  }

  function requestCalibration() {
    if (!device || !uid || !deviceCode || preview || !auth) return;
    if (!online) return Alert.alert('ESP32 desconectado', 'El ESP32 debe estar conectado a internet para calibrar.');
    if (calibrationPending || calibrating) {
      return Alert.alert('Calibración en curso', 'La moto debe permanecer quieta.');
    }
    Alert.alert(
      'Calibrar y activar',
      'Dejá la moto estacionada y quieta. El ESP32 medirá su posición y activará la protección únicamente cuando termine de calibrar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Calibrar', onPress: async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 70000);
          try {
            setCalibrating(true);
            const authInstance = auth;
            const currentUser = authInstance?.currentUser;
            if (!currentUser || currentUser.uid !== uid) throw new Error('Sesión no válida');
            const token = await currentUser.getIdToken();
            const response = await fetch('https://motoguard-api.onrender.com/api/calibrar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ dispositivo: deviceCode }),
              signal: controller.signal,
            });
            const data = await response.json().catch(() => ({})) as { error?: string; mensaje?: string };
            if (!response.ok) throw new Error(data.error || `Error del servidor: ${response.status}`);
            Alert.alert('Calibración solicitada', data.mensaje || 'Dejá la moto quieta y esperá la confirmación del ESP32.');
          } catch (error: any) {
            Alert.alert('No se pudo calibrar', error?.message || 'Revisá la conexión con Render.');
          } finally {
            clearTimeout(timer);
            setCalibrating(false);
          }
        } },
      ],
    );
  }

  async function guardarPesoPersonal() {
    if (!uid || preview) return Alert.alert('Iniciá sesión', 'El modo demostración no guarda datos personales.');
    const valor = Number(pesoPersonalInput.trim().replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 20 || valor > 300) {
      return Alert.alert('Peso incorrecto', 'Ingresá un peso personal entre 20 y 300 kg.');
    }
    try {
      setGuardandoPesoPersonal(true);
      await AsyncStorage.setItem(`motoguard_peso_personal_${uid}`, String(valor));
      setPesoPersonalInput(String(valor).replace('.', ','));
      Alert.alert('Peso guardado', 'Se guardó en este teléfono, sin enviar nada al sensor ni a Firebase.');
    } catch {
      Alert.alert('No se pudo guardar', 'Reintentá. El dato no se guardó en Firebase.');
    } finally {
      setGuardandoPesoPersonal(false);
    }
  }

  async function guardarRango() {
    if (preview || !uid || !deviceCode || !device) {
      return Alert.alert('Sin dispositivo', 'Iniciá sesión y seleccioná un dispositivo propio.');
    }
    const minKg = Number(rangoMinInput.trim().replace(',', '.'));
    const maxKg = Number(rangoMaxInput.trim().replace(',', '.'));
    if (!Number.isFinite(minKg) || !Number.isFinite(maxKg) ||
        minKg < 0 || minKg >= maxKg || maxKg > 20) {
      return Alert.alert('Rango incorrecto', 'Indicá dos valores entre 0 y 20 kg. El mínimo debe ser menor al máximo. Ejemplo: 0,18 y 0,20.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      setGuardandoRango(true);
      const currentUser = auth?.currentUser;
      if (!currentUser || currentUser.uid !== uid || device.ownerUid !== uid) {
        throw new Error('La cuenta no es propietaria del dispositivo.');
      }
      const token = await currentUser.getIdToken();
      const response = await fetch('https://motoguard-api.onrender.com/api/peso/rango', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dispositivo: deviceCode, minKg, maxKg }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
      Alert.alert('Rango guardado', `Guardamos el rango en Firebase para ${deviceCode}. El ESP32 lo aplicará cuando pueda leer el sensor.`);
    } catch (error: any) {
      Alert.alert('No se pudo guardar el rango', error?.message || 'Revisá tu conexión con el backend.');
    } finally {
      clearTimeout(timer);
      setGuardandoRango(false);
    }
  }

  async function openMaps() {
    if (!hasLocation) return Alert.alert('Ubicación no disponible','El ESP32 aún no envió coordenadas válidas.');
    const url=`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    try {await Linking.openURL(url);} catch {Alert.alert('Mapa','No se pudo abrir el mapa.');}
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Brand compact />
          <View style={{flex:1,marginLeft:12}}><Text style={styles.hello}>MOTOGUARD</Text><Text style={styles.subtitle}>Estado de tu dispositivo</Text></View>
          <View style={styles.roundIcon}><Ionicons name="shield-checkmark" size={22} color={colors.cyan}/></View>
        </View>
        {preview && <View style={styles.demo}><Ionicons name="flask-outline" size={17} color={colors.orange}/><Text style={styles.demoText}>MODO DEMOSTRACIÓN · Sin datos reales del ESP32</Text></View>}
        {info ? <InfoBox icon="warning-outline">{info}</InfoBox> : null}

        {tab==='inicio' && <>
          <Text style={styles.sectionTitle}>Panel de seguridad</Text>
          <View style={[styles.hero,{borderColor:alarm?'#8D4357':colors.stroke}]}>
            <View style={[styles.heroIcon,{backgroundColor:alarm?'#52243B':'#143E49'}]}><Ionicons name={alarm?'warning-outline':'shield-checkmark-outline'} size={37} color={alarm?colors.red:colors.cyan}/></View>
            <Text style={styles.heroLabel}>{alarm?'ALERTA DE SEGURIDAD':calibrationPending?'CALIBRANDO POSICIÓN':active?'PROTECCIÓN ACTIVADA':'PROTECCIÓN DESACTIVADA'}</Text>
            <Text style={styles.heroStatus}>{preview?'Vista de ejemplo':!device?'SIN DISPOSITIVO':!online?'SIN CONEXIÓN':state}</Text>
            <Text style={styles.heroDetail}>{deviceCode?`Dispositivo: ${deviceCode}`:'No hay dispositivo vinculado'}</Text>
            <View style={styles.statRow}>
              <View style={styles.mini}><Ionicons name="pulse-outline" size={18} color={colors.cyan}/><Text style={styles.miniLabel}>Dispositivo</Text><Text style={styles.miniValue}>{online?'En línea':'Sin conexión'}</Text></View>
              <View style={styles.mini}><Ionicons name="location-outline" size={18} color={colors.cyan}/><Text style={styles.miniLabel}>Ubicación</Text><Text style={styles.miniValue}>{hasLocation?(origenManual?'Manual':origenGPS?'GPS real':'Registrada'):'Sin ubicación'}</Text></View>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CONTROL DE PROTECCIÓN</Text>
            <Text style={styles.cardValue}>{calibrationPending ? 'Calibración pendiente' : active ? 'Alarma activada' : 'Alarma desactivada'}</Text>
            <Text style={styles.subtitle}>{online ? 'ESP32 conectado · Actualización automática' : 'ESP32 sin comunicación reciente. No se puede confirmar la protección.'}</Text>
            <Button
              text={active ? 'Desactivar protección' : calibrationPending ? 'Calibrando posición…' : 'Calibrar y activar protección'}
              icon={active ? 'lock-open-outline' : 'lock-closed-outline'}
              variant={active ? 'secondary' : 'primary'}
              loading={changingProtection || calibrating}
              disabled={!device || !uid || preview || changingProtection || calibrating || calibrationPending || (!active && !online)}
              onPress={requestProtectionChange}
            />
            <Text style={styles.subtitle}>{calibrationPending ? 'Dejá la moto quieta: el ESP32 debe completar la calibración antes de activar la protección.' : calibrationSaved ? 'Posición calibrada. Al volver a activar se tomará una nueva referencia.' : 'Al activar, MotoGuard solicita una calibración real del MPU6050.'} No controla el encendido de la moto.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CELDA DE CARGA HX711 · 20 KG</Text>
            <Text style={styles.cardValue}>Peso medido: {pesoTexto}</Text>
            <Text style={styles.subtitle}>Estado del sensor: {estadoHX}</Text>
            <Text style={styles.subtitle}>Rango autorizado del sensor: {preview ? '180–200 g (ejemplo)' : rangoTexto}</Text>
            <Text style={styles.subtitle}>La lectura se actualiza desde Firebase. Si el HX711 falla, se muestra “Sin medir” en lugar de presentar un valor antiguo como actual.</Text>
            <Text style={styles.subtitle}>Prueba experimental: la celda de 20 kg no puede medir directamente el peso corporal de un adulto. El estado de habilitación del firmware es lógico; no significa que exista un corte de encendido instalado.</Text>
            <Text style={styles.cardLabel}>CAMBIAR RANGO DEL SENSOR (KG)</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputColumn}>
                <Text style={styles.subtitle}>Mínimo</Text>
                <TextInput value={rangoMinInput} onChangeText={setRangoMinInput} keyboardType="decimal-pad" placeholder="0,18" placeholderTextColor="#7187A1" style={styles.codeInput} editable={!preview && !guardandoRango}/>
              </View>
              <View style={styles.inputColumn}>
                <Text style={styles.subtitle}>Máximo</Text>
                <TextInput value={rangoMaxInput} onChangeText={setRangoMaxInput} keyboardType="decimal-pad" placeholder="0,20" placeholderTextColor="#7187A1" style={styles.codeInput} editable={!preview && !guardandoRango}/>
              </View>
            </View>
            <Button text="Guardar rango del HX711" icon="save-outline" loading={guardandoRango} disabled={preview || !uid || !device || guardandoRango} onPress={guardarRango}/>
            <Text style={styles.subtitle}>Podés configurar el rango sin tener el HX711 conectado. Los cambios se guardan en Firebase para el dispositivo seleccionado.</Text>
          </View>
          <Text style={styles.sectionTitle}>Accesos rápidos</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={()=>setTab('ubicacion')}><Ionicons name="map-outline" size={28} color={colors.cyan}/><Text style={styles.actionTitle}>Última ubicación</Text><Text style={styles.actionSub}>Ver GPS</Text></TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={()=>setTab('alertas')}><Ionicons name="notifications-outline" size={28} color={colors.orange}/><Text style={styles.actionTitle}>Alertas</Text><Text style={styles.actionSub}>Consultar eventos</Text></TouchableOpacity>
          </View>
          <InfoBox>El sistema indica cuándo la ubicación es manual. No confundas una posición de prueba con un rastreo GPS real.</InfoBox>
        </>}

        {tab==='ubicacion' && <>
          <Text style={styles.sectionTitle}>Ubicación de MotoGuard</Text>
          <View style={styles.card}>
            <View style={styles.mapPlaceholder}><Ionicons name="navigate-circle-outline" size={70} color={colors.cyan}/><Text style={styles.mapTitle}>{hasLocation?(origenManual?'Ubicación manual de prueba':origenGPS?'GPS: posición real':'Última ubicación registrada'):'Esperando ubicación'}</Text><Text style={styles.smallCenter}>{origenManual ? 'Coordenada fija configurada manualmente. NO indica dónde está la moto ahora.' : 'Mostramos la última posición recibida del dispositivo.'}</Text></View>
            <View style={styles.coordRow}><Text style={styles.coordLabel}>LATITUD</Text><Text style={styles.coordValue}>{hasLocation?lat!.toFixed(6):'Sin datos'}</Text></View>
            <View style={styles.coordRow}><Text style={styles.coordLabel}>LONGITUD</Text><Text style={styles.coordValue}>{hasLocation?lng!.toFixed(6):'Sin datos'}</Text></View>
            <Button text="Abrir ubicación en Maps" icon="map-outline" onPress={openMaps} disabled={!hasLocation}/>
          </View>
          <InfoBox>{origenManual ? "Ubicación de prueba MANUAL. No corresponde a una lectura de satélites ni rastrea desplazamientos." : "El GPS NEO-6M puede tardar en fijar coordenadas. El mapa se abre en Google Maps."}</InfoBox>
        </>}

        {tab==='alertas' && <>
          <Text style={styles.sectionTitle}>Centro de alertas</Text>
          {alarm && <View style={styles.alert}><Ionicons name="warning" size={24} color={colors.red}/><View style={{flex:1}}><Text style={styles.alertTitle}>Movimiento sospechoso</Text><Text style={styles.alertSub}>El dispositivo reportó el estado {state}.</Text></View></View>}
          {events.length===0 ? <View style={[styles.card,{alignItems:'center',paddingVertical:46}]}><Ionicons name="notifications-off-outline" size={44} color={colors.subtle}/><Text style={styles.empty}>Todavía no hay historial</Text><Text style={styles.smallCenter}>Cuando el hardware guarde alertas en Firebase, aparecerán acá.</Text></View> : events.map(ev=><View key={ev.id} style={styles.event}><Ionicons name="alert-circle-outline" size={23} color={colors.orange}/><View style={{flex:1}}><Text style={styles.eventTitle}>{ev.title}</Text><Text style={styles.subtitle}>{ev.date||'Evento registrado'}</Text></View></View>)}
          <InfoBox>Las alertas se actualizan mientras la app está abierta. Las notificaciones push con la app cerrada se incorporan en otra etapa.</InfoBox>
        </>}

        {tab==='cuenta' && <>
          <Text style={styles.sectionTitle}>Mi cuenta y dispositivo</Text>
          <View style={styles.card}><Text style={styles.cardLabel}>SESIÓN</Text><Text style={styles.cardValue}>{preview?'Demostración':email}</Text><Text style={styles.subtitle}>{preview?'Vista previa sin cuenta':'Autenticación con Firebase'}</Text></View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>MI PESO PERSONAL</Text>
            <Text style={styles.subtitle}>Dato opcional para una función futura. No se compara con el HX711 de 20 kg y no genera alertas.</Text>
            <TextInput value={pesoPersonalInput} onChangeText={setPesoPersonalInput} keyboardType="decimal-pad" placeholder="Ejemplo: 72,5 kg" placeholderTextColor="#7187A1" style={styles.codeInput} editable={!preview && !guardandoPesoPersonal}/>
            <Button text="Guardar peso personal" icon="save-outline" onPress={guardarPesoPersonal} loading={guardandoPesoPersonal} disabled={preview || !uid || guardandoPesoPersonal}/>
            <Text style={styles.subtitle}>Se guarda solo en este teléfono y no se sincroniza con Firebase.</Text>
          </View>
          <View style={styles.card}><Text style={styles.cardLabel}>VINCULAR MOTO</Text><Text style={styles.subtitle}>El código debe existir en Firebase y su ownerUid debe coincidir con tu UID.</Text><TextInput value={codeInput} onChangeText={setCodeInput} autoCapitalize="characters" placeholder="Código, por ejemplo MG-0001" placeholderTextColor="#7187A1" style={styles.codeInput}/><Button text="Seleccionar dispositivo" onPress={linkDevice} icon="link-outline" loading={linkBusy}/>{deviceCode?<Text style={styles.linked}>Actual: {deviceCode}</Text>:null}<Text style={styles.subtitle}>Tu UID de Firebase (mantené pulsado para copiarlo):</Text><Text selectable style={styles.uid}>{uid ?? 'Sin sesión'}</Text></View>
          <Button text={preview?'Salir de la demostración':'Cerrar sesión'} variant="secondary" icon="log-out-outline" onPress={()=>{ if(preview) onLeave(); else if(auth) signOut(auth); }}/>
        </>}
      </ScrollView>
      <View style={styles.nav}>{MENU.map(x=><TouchableOpacity key={x.key} onPress={()=>setTab(x.key)} style={styles.navItem}><Ionicons name={x.icon} size={23} color={tab===x.key?colors.cyan:colors.subtle}/><Text style={[styles.navLabel,{color:tab===x.key?colors.cyan:colors.subtle}]}>{x.name}</Text></TouchableOpacity>)}</View>
    </View>
  );
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.bg},content:{paddingHorizontal:19,paddingTop:12,paddingBottom:32,maxWidth:700,width:'100%',alignSelf:'center',gap:15},
  header:{flexDirection:'row',alignItems:'center',marginBottom:5},hello:{fontSize:17,fontWeight:'900',color:colors.text,letterSpacing:2},subtitle:{color:colors.subtle,fontSize:12,marginTop:4},roundIcon:{backgroundColor:colors.panel2,width:45,height:45,borderRadius:15,alignItems:'center',justifyContent:'center'},
  demo:{borderColor:'#755337',borderWidth:1,backgroundColor:'#362718',flexDirection:'row',alignItems:'center',gap:8,padding:12,borderRadius:12},demoText:{color:colors.orange,fontWeight:'700',fontSize:11,flex:1},
  sectionTitle:{color:colors.text,fontSize:21,fontWeight:'900',marginTop:7,marginBottom:1},hero:{borderRadius:24,backgroundColor:colors.panel,borderWidth:1,padding:22,alignItems:'center'},heroIcon:{width:75,height:75,borderRadius:25,alignItems:'center',justifyContent:'center',marginBottom:16},heroLabel:{color:colors.cyan,fontWeight:'800',fontSize:12,letterSpacing:1.4},heroStatus:{color:colors.text,fontWeight:'900',fontSize:23,marginTop:8,textAlign:'center'},heroDetail:{color:colors.subtle,marginTop:8},statRow:{flexDirection:'row',gap:12,marginTop:22},mini:{flex:1,backgroundColor:colors.bg,padding:14,borderRadius:16,gap:5},miniLabel:{color:colors.subtle,fontSize:12},miniValue:{color:colors.text,fontWeight:'800'},
  actions:{flexDirection:'row',gap:12},action:{flex:1,backgroundColor:colors.panel2,borderColor:colors.stroke,borderWidth:1,padding:17,borderRadius:18,gap:7},actionTitle:{color:colors.text,fontWeight:'800',fontSize:15},actionSub:{color:colors.subtle,fontSize:12},
  card:{backgroundColor:colors.panel,borderRadius:22,padding:19,borderWidth:1,borderColor:colors.stroke,gap:9},
  inputRow:{flexDirection:'row',gap:12},inputColumn:{flex:1},
  mapPlaceholder:{height:185,backgroundColor:'#102640',borderRadius:16,alignItems:'center',justifyContent:'center',padding:10},mapTitle:{color:colors.text,fontWeight:'800',fontSize:17,marginTop:8},smallCenter:{color:colors.subtle,textAlign:'center',fontSize:12,lineHeight:19,marginTop:6},coordRow:{flexDirection:'row',justifyContent:'space-between',borderBottomColor:colors.stroke,borderBottomWidth:1,paddingVertical:12},coordLabel:{color:colors.subtle,fontWeight:'800',fontSize:12},coordValue:{color:colors.text,fontWeight:'800'},
  alert:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#391C2A',borderRadius:16,padding:14,borderWidth:1,borderColor:'#75354C'},alertTitle:{color:colors.text,fontWeight:'800'},alertSub:{color:colors.subtle,fontSize:12,marginTop:3},empty:{color:colors.text,fontWeight:'800',fontSize:17,marginTop:15},event:{flexDirection:'row',gap:11,alignItems:'center',backgroundColor:colors.panel2,padding:16,borderRadius:14},eventTitle:{color:colors.text,fontWeight:'800'},
  cardLabel:{color:colors.cyan,fontSize:11,fontWeight:'900',letterSpacing:2},cardValue:{color:colors.text,fontSize:16,fontWeight:'700'},uid:{color:colors.text,fontSize:12,marginTop:3},codeInput:{borderWidth:1,borderColor:colors.stroke,backgroundColor:colors.bg,color:colors.text,borderRadius:13,paddingHorizontal:13,height:49,marginTop:8},linked:{color:colors.cyan,marginTop:9,fontSize:12},
  nav:{backgroundColor:'#0C192A',borderTopWidth:1,borderTopColor:colors.stroke,flexDirection:'row',paddingHorizontal:7,paddingTop:10,paddingBottom:4},navItem:{flex:1,alignItems:'center',gap:4,paddingVertical:4},navLabel:{fontSize:10,fontWeight:'700'},
});
