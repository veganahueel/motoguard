import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, User } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthScreen from './src/AuthScreen';
import Dashboard from './src/Dashboard';
import { auth, db } from './src/firebase';
import { colors } from './src/theme';
import type { DeviceInfo } from './src/types';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [preview, setPreview] = useState(false);
  const [deviceCode, setDeviceCode] = useState('');
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!auth) { setInitializing(false); return; }
    return onAuthStateChanged(auth, async current => {
      setUser(current);
      setDevice(null);
      setDeviceCode('');
      setInfo('');
      if (current) {
        try {
          const saved = await AsyncStorage.getItem(`motoguard_dispositivo_${current.uid}`);
          if (saved) setDeviceCode(saved);
        } catch { /* La app puede continuar aunque falle el almacenamiento local. */ }
      }
      setInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !deviceCode || !db || preview) return;
    setInfo('');
    setDevice(null);
    return onValue(ref(db, `MotoGuard/dispositivos/${deviceCode}`), snapshot => {
      const data = snapshot.exists() ? snapshot.val() as DeviceInfo : null;
      if (!data) {
        setDevice(null);
        setInfo('Este dispositivo no tiene datos o no existe.');
      } else if (data.ownerUid !== user.uid) {
        setDevice(null);
        setInfo('Esta cuenta no es propietaria del dispositivo. Revisá ownerUid en Firebase.');
      } else {
        setDevice(data);
        setInfo('');
      }
    }, error => {
      setDevice(null);
      setInfo('Acceso denegado: verificá que ownerUid coincida con tu UID y que las reglas estén publicadas.');
    });
  }, [user?.uid, deviceCode, preview]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{flex:1,backgroundColor:colors.bg}} edges={['top','bottom']}>
        <StatusBar style="light" />
        {initializing ? <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={colors.cyan} size="large" /></View> :
        user || preview ? <Dashboard preview={preview} email={user?.email??''} uid={user?.uid??null} deviceCode={deviceCode} onDeviceCode={setDeviceCode} info={info} device={device} onLeave={()=>setPreview(false)}/> :
        <AuthScreen onPreview={()=>setPreview(true)}/>}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
