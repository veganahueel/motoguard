import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, set, serverTimestamp } from 'firebase/database';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, db, firebaseConfigured } from './firebase';
import { Brand, Button, InfoBox } from './ui';
import { colors } from './theme';

function describeError(code: string) {
  if (code.includes('email-already-in-use')) return 'Este correo ya está registrado.';
  if (code.includes('invalid-email')) return 'Ingresá un correo válido.';
  if (code.includes('weak-password')) return 'La contraseña no cumple la política de seguridad del proyecto.';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Correo o contraseña incorrectos.';
  if (code.includes('network-request-failed')) return 'Sin conexión a internet. Revisá tu Wi-Fi.';
  if (code.includes('operation-not-allowed')) return 'Habilitá el proveedor Correo/contraseña en Firebase Authentication.';
  return `No se pudo continuar (${code || 'error desconocido'}).`;
}

export default function AuthScreen({ onPreview }: { onPreview: () => void }) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);

  async function submit() {
    if (!auth || !db) return Alert.alert('Falta Firebase', 'Completá el archivo .env para activar el registro real.');
    const correo = email.trim();
    if (!correo || !password) return Alert.alert('Revisá tus datos', 'Ingresá tu correo y contraseña.');
    if (register && password.length < 12) return Alert.alert('Contraseña corta', 'Para registrar una cuenta, usá al menos 12 caracteres.');

    setWorking(true);
    try {
      if (register) {
        // Authentication crea la cuenta y genera un UID único.
        const credencial = await createUserWithEmailAndPassword(auth, correo, password);
        const usuario = credencial.user;

        try {
          // Guardar el perfil bajo el mismo UID, sin almacenar contraseñas.
          await set(ref(db, `MotoGuard/usuarios/${usuario.uid}`), {
            uid: usuario.uid,
            email: usuario.email ?? correo,
            creadoEn: serverTimestamp(),
          });
        } catch (error: any) {
          // La cuenta YA existe en Authentication. No indicar que falló el registro.
          console.error('MotoGuard: no se pudo guardar el perfil en Realtime Database:', error);
          Alert.alert(
            'Cuenta creada, perfil pendiente',
            'Tu cuenta se creó en Authentication, pero no se pudo guardar el perfil en Realtime Database. Revisá las reglas y la conexión. No vuelvas a registrarte: iniciá sesión con esta cuenta.'
          );
        }
      } else {
        await signInWithEmailAndPassword(auth, correo, password);
      }
    } catch (err: any) {
      Alert.alert('MotoGuard', describeError(err?.code ?? ''));
    } finally {
      setWorking(false);
    }
  }

  return (
    <LinearGradient colors={['#0D213C', colors.bg, '#050B15']} style={styles.flex}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
          <Brand />
          <Text style={styles.heading}>{register ? 'Creá tu cuenta' : 'Bienvenido a MotoGuard'}</Text>
          <Text style={styles.description}>Protección inteligente para tu motocicleta.</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Correo electrónico</Text>
            <View style={styles.field}><Ionicons name="mail-outline" size={19} color={colors.subtle}/><TextInput autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="tu@email.com" placeholderTextColor="#7187A1" style={styles.input} value={email} onChangeText={setEmail}/></View>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.field}><Ionicons name="lock-closed-outline" size={19} color={colors.subtle}/><TextInput secureTextEntry={!showPassword} autoComplete={register?'new-password':'password'} placeholder={register ? "Mínimo 12 caracteres" : "Tu contraseña"} placeholderTextColor="#7187A1" style={styles.input} value={password} onChangeText={setPassword}/><TouchableOpacity onPress={()=>setShowPassword(x=>!x)}><Ionicons name={showPassword?'eye-off-outline':'eye-outline'} size={20} color={colors.subtle}/></TouchableOpacity></View>
            <Button text={register?'Crear cuenta':'Ingresar'} onPress={submit} loading={working} icon={register?'person-add-outline':'log-in-outline'} disabled={!firebaseConfigured}/>
            <TouchableOpacity style={styles.switcher} onPress={()=>setRegister(x=>!x)}><Text style={styles.link}>{register?'¿Ya tenés cuenta? Iniciar sesión':'¿No tenés cuenta? Registrate'}</Text></TouchableOpacity>
          </View>
          {!firebaseConfigured && <InfoBox>Firebase todavía no está configurado. Podés ver el diseño, pero las cuentas reales se habilitan al completar el archivo .env.</InfoBox>}
          <TouchableOpacity onPress={onPreview} style={styles.preview}><Text style={styles.previewText}>Ver la aplicación en modo demostración →</Text></TouchableOpacity>
          <Text style={styles.foot}>MOTOGUARD · PROTOTIPO 2026</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex:{flex:1},page:{paddingHorizontal:24,paddingTop:48,paddingBottom:55, flexGrow:1, justifyContent:'center',maxWidth:600,width:'100%',alignSelf:'center'},
  heading:{color:colors.text,fontSize:27,fontWeight:'900',textAlign:'center',letterSpacing:-0.7},
  description:{color:colors.subtle,fontSize:14,textAlign:'center',marginTop:9,marginBottom:26},
  card:{backgroundColor:colors.panel,borderRadius:25,padding:20,borderWidth:1,borderColor:colors.stroke},
  label:{color:colors.text,fontSize:13,fontWeight:'700',marginTop:8,marginBottom:9},
  field:{backgroundColor:colors.bg,flexDirection:'row',alignItems:'center',gap:10,borderColor:colors.stroke,borderWidth:1,borderRadius:13,paddingHorizontal:14,height:54,marginBottom:12},
  input:{flex:1,color:'white',fontSize:15},switcher:{paddingTop:20,paddingBottom:5,alignItems:'center'},link:{color:colors.cyan,fontWeight:'700'},
  preview:{alignItems:'center',marginTop:19,padding:11},previewText:{color:colors.subtle,fontSize:13,fontWeight:'700'},foot:{textAlign:'center',color:'#61738D',fontSize:10,letterSpacing:2,marginTop:24},
});
