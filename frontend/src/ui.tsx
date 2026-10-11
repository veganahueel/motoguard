import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.brandWrap, compact && styles.brandSmall]}>
      <View style={[styles.brandImage, compact && styles.brandImageSmall]}>
        <Image source={require('../assets/motoguard-logo.png')} resizeMode="contain" style={{ width: compact ? 58 : 114, height: compact ? 58 : 112 }} />
      </View>
      {!compact && <Text style={styles.brandTag}>TU MOTO, BAJO CONTROL</Text>}
    </View>
  );
}

export function Button({ text, onPress, variant='primary', icon, loading=false, disabled=false }: {
  text: string; onPress: () => void; variant?: 'primary'|'secondary'|'danger'; icon?: keyof typeof Ionicons.glyphMap; loading?: boolean; disabled?: boolean;
}) {
  const bg = variant==='primary' ? colors.blue : variant==='danger' ? '#6A2436' : colors.panel2;
  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.82} onPress={onPress} disabled={loading || disabled} style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}>
      {loading ? <ActivityIndicator color="white" /> : <>{icon && <Ionicons name={icon} size={19} color="white" />}<Text style={styles.buttonText}>{text}</Text></>}
    </TouchableOpacity>
  );
}

export function InfoBox({ children, icon='information-circle-outline' }: {
  children: React.ReactNode; icon?: keyof typeof Ionicons.glyphMap;
}) {
  return <View style={styles.info}><Ionicons name={icon} size={19} color={colors.cyan}/><Text style={styles.infoText}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  brandWrap: { alignItems: 'center', marginBottom: 22 },
  brandSmall: { marginBottom: 0 },
  brandImage: { width: 136, height: 136, borderRadius: 36, backgroundColor: '#F5FAFF', alignItems:'center', justifyContent: 'center', marginBottom: 16 },
  brandImageSmall: { width: 68, height: 68, borderRadius: 18, marginBottom: 0 },
  brandTag: { color: colors.subtle, fontSize: 12, fontWeight:'800', letterSpacing: 2.4 },
  button: { minHeight: 53, borderRadius: 16, alignItems:'center', justifyContent:'center', flexDirection:'row', gap: 9, paddingHorizontal:16, marginTop: 9 },
  buttonText: { color:'white', fontSize: 15, fontWeight:'800' },
  info: { borderWidth:1, borderColor:colors.stroke, backgroundColor:colors.panel2, borderRadius:16, padding:13, flexDirection:'row', alignItems:'flex-start', gap:9 },
  infoText: { color:colors.subtle, fontSize:13, lineHeight:19, flex:1 },
});
