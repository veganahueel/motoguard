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
  const [clock,setClock]=useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const lastContact = Number(device?.ultimaConexion);
  const online = !preview && Number.isFinite(lastContact) && lastContact > 0 && clock-lastContact < 20000;

  const lat = validCoordinate(device?.lat ?? device?.latitud, -90, 90);
  const lng = validCoordinate(device?.lng ?? device?.longitud, -180, 180);
  const hasLocation = lat!==null && lng!==null && !(lat===0 && lng===0);
  const state = String(device?.estado || 'SIN DATOS').replace(/_/g,' ');
  const alarm = ['ALERTA','MOVIMIENTO CONFIRMADO','MOVIMIENTO_CONFIRMADO'].includes(String(device?.estado||'').toUpperCase());
  const active = device?.activo === true || device?.activo === 1 || device?.activo === 'true';
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
    if (!active && !online) {
      Alert.alert('Dispositivo desconectado', 'No podemos confirmar que el ESP32 reciba o aplique el cambio. Esperá a que vuelva a conectarse.');
      return;
    }
    const next = !active;
    Alert.alert(
      next ? 'Activar protección' : 'Desactivar protección',
      next ? `¿Querés activar la vigilancia de ${deviceCode}? Las vibraciones podrán generar alertas.` : '¿Querés desactivar las alertas de movimiento de este dispositivo?',
      [
        {text:'Cancelar', style:'cancel'},
        {text:next ? 'Activar' : 'Desactivar', onPress:async()=>{
          try {
            setChangingProtection(true);
            if (auth?.currentUser?.uid !== uid) throw new Error('Sesión no válida');
            // Las reglas solo permiten cambiar el campo booleano activo si sos propietario.
            await set(ref(db, `MotoGuard/dispositivos/${deviceCode}/activo`), next);
          } catch (error) {
            Alert.alert('No se pudo cambiar', 'Revisá tu conexión y las reglas de seguridad de Firebase.');
          } finally {
            setChangingProtection(false);
          }
        }}
      ]
    );
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
            <Text style={styles.heroLabel}>{alarm?'ALERTA DE SEGURIDAD':active?'PROTECCIÓN ACTIVADA':'PROTECCIÓN DESACTIVADA'}</Text>
            <Text style={styles.heroStatus}>{preview?'Vista de ejemplo':!device?'SIN DISPOSITIVO':!online?'SIN CONEXIÓN':state}</Text>
            <Text style={styles.heroDetail}>{deviceCode?`Dispositivo: ${deviceCode}`:'No hay dispositivo vinculado'}</Text>
            <View style={styles.statRow}>
              <View style={styles.mini}><Ionicons name="pulse-outline" size={18} color={colors.cyan}/><Text style={styles.miniLabel}>Dispositivo</Text><Text style={styles.miniValue}>{online?'En línea':'Sin conexión'}</Text></View>
              <View style={styles.mini}><Ionicons name="location-outline" size={18} color={colors.cyan}/><Text style={styles.miniLabel}>GPS</Text><Text style={styles.miniValue}>{hasLocation?'Disponible':'Sin ubicación'}</Text></View>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CONTROL DE PROTECCIÓN</Text>
            <Text style={styles.cardValue}>{active ? 'Alarma activada' : 'Alarma desactivada'}</Text>
            <Text style={styles.subtitle}>{online ? 'ESP32 conectado · Actualización automática' : 'ESP32 sin comunicación reciente. No se puede confirmar la protección.'}</Text>
            <Button
              text={active ? 'Desactivar protección' : 'Activar protección'}
              icon={active ? 'lock-open-outline' : 'lock-closed-outline'}
              variant={active ? 'secondary' : 'primary'}
              loading={changingProtection}
              disabled={!device || !uid || preview || changingProtection || (!active && !online)}
              onPress={requestProtectionChange}
            />
            <Text style={styles.subtitle}>El cambio se guarda en Firebase y solo funciona para la cuenta propietaria. No controla el encendido de la moto.</Text>
          </View>
          <Text style={styles.sectionTitle}>Accesos rápidos</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={()=>setTab('ubicacion')}><Ionicons name="map-outline" size={28} color={colors.cyan}/><Text style={styles.actionTitle}>Última ubicación</Text><Text style={styles.actionSub}>Ver GPS</Text></TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={()=>setTab('alertas')}><Ionicons name="notifications-outline" size={28} color={colors.orange}/><Text style={styles.actionTitle}>Alertas</Text><Text style={styles.actionSub}>Consultar eventos</Text></TouchableOpacity>
          </View>
          <InfoBox>Este panel muestra datos reales solamente cuando un dispositivo autorizado escribe en Firebase. La app no simula coordenadas.</InfoBox>
        </>}

        {tab==='ubicacion' && <>
          <Text style={styles.sectionTitle}>Localización GPS</Text>
          <View style={styles.card}>
            <View style={styles.mapPlaceholder}><Ionicons name="navigate-circle-outline" size={70} color={colors.cyan}/><Text style={styles.mapTitle}>{hasLocation?'Ubicación disponible':'Esperando ubicación GPS'}</Text><Text style={styles.smallCenter}>Mostramos la última coordenada guardada por el dispositivo.</Text></View>
            <View style={styles.coordRow}><Text style={styles.coordLabel}>LATITUD</Text><Text style={styles.coordValue}>{hasLocation?lat!.toFixed(6):'Sin datos'}</Text></View>
            <View style={styles.coordRow}><Text style={styles.coordLabel}>LONGITUD</Text><Text style={styles.coordValue}>{hasLocation?lng!.toFixed(6):'Sin datos'}</Text></View>
            <Button text="Abrir ubicación en Maps" icon="map-outline" onPress={openMaps} disabled={!hasLocation}/>
          </View>
          <InfoBox>El GPS puede tardar en fijar coordenadas. En esta versión el mapa se abre en Google Maps; incorporaremos un mapa dentro de la app después.</InfoBox>
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
  card:{backgroundColor:colors.panel,borderRadius:22,padding:19,borderWidth:1,borderColor:colors.stroke,gap:9},mapPlaceholder:{height:185,backgroundColor:'#102640',borderRadius:16,alignItems:'center',justifyContent:'center',padding:10},mapTitle:{color:colors.text,fontWeight:'800',fontSize:17,marginTop:8},smallCenter:{color:colors.subtle,textAlign:'center',fontSize:12,lineHeight:19,marginTop:6},coordRow:{flexDirection:'row',justifyContent:'space-between',borderBottomColor:colors.stroke,borderBottomWidth:1,paddingVertical:12},coordLabel:{color:colors.subtle,fontWeight:'800',fontSize:12},coordValue:{color:colors.text,fontWeight:'800'},
  alert:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#391C2A',borderRadius:16,padding:14,borderWidth:1,borderColor:'#75354C'},alertTitle:{color:colors.text,fontWeight:'800'},alertSub:{color:colors.subtle,fontSize:12,marginTop:3},empty:{color:colors.text,fontWeight:'800',fontSize:17,marginTop:15},event:{flexDirection:'row',gap:11,alignItems:'center',backgroundColor:colors.panel2,padding:16,borderRadius:14},eventTitle:{color:colors.text,fontWeight:'800'},
  cardLabel:{color:colors.cyan,fontSize:11,fontWeight:'900',letterSpacing:2},cardValue:{color:colors.text,fontSize:16,fontWeight:'700'},uid:{color:colors.text,fontSize:12,marginTop:3},codeInput:{borderWidth:1,borderColor:colors.stroke,backgroundColor:colors.bg,color:colors.text,borderRadius:13,paddingHorizontal:13,height:49,marginTop:8},linked:{color:colors.cyan,marginTop:9,fontSize:12},
  nav:{backgroundColor:'#0C192A',borderTopWidth:1,borderTopColor:colors.stroke,flexDirection:'row',paddingHorizontal:7,paddingTop:10,paddingBottom:4},navItem:{flex:1,alignItems:'center',gap:4,paddingVertical:4},navLabel:{fontSize:10,fontWeight:'700'},
});
