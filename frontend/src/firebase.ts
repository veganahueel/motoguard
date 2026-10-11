import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Estos valores se obtienen desde Firebase Console y se guardan en .env.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.projectId && config.appId && config.databaseURL
);

const app = firebaseConfigured
  ? getApps().length ? getApp() : initializeApp(config)
  : null;

// Persistencia de sesión en el teléfono: no se guardan contraseñas en la base.
export const auth = app
  ? (() => {
      try {
        return initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch {
        // En recargas de desarrollo, Auth puede estar ya inicializado.
        return getAuth(app);
      }
    })()
  : null;

export const db = app ? getDatabase(app) : null;
