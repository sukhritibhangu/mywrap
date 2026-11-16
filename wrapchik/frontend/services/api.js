import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { emitAuthExpired } from './authEvents';

// Dynamically determine Backend API base URL
const getBaseUrl = () => {
  // 1. Explicit override — always wins if set in frontend/.env
  //    e.g. EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '') + '/api';
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }

  // 2. Extract developer laptop's local LAN IP from Expo connection URL
  //    Supports Expo SDK 50, 51, 52, 53, 54
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost;

  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:5000/api`;
  }

  // 3. Fallback for Android Emulator
  return 'http://10.0.2.2:5000/api';
};

const getStoredToken = async () => {
  if (Platform.OS !== 'web') {
    return SecureStore.getItemAsync('wrapchik_jwt_token');
  }
  return AsyncStorage.getItem('wrapchik_jwt_token');
};

const clearStoredAuth = async () => {
  try { await AsyncStorage.multiRemove(['wrapchik_jwt_token', 'wrapchik_user_data']); } catch (e) {}
  if (Platform.OS !== 'web') {
    try { await SecureStore.deleteItemAsync('wrapchik_jwt_token'); await SecureStore.deleteItemAsync('wrapchik_user_data'); } catch (e) {}
  }
};

const API_BASE_URL = getBaseUrl();

console.log('[Wrapchik API] Target Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Automatically attach JWT Token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('[API Interceptor Error]:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle user-friendly error formatting
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    let customError = 'Something went wrong. Please check your network connection.';

    if (error.response) {
      if (error.response.status === 401) {
        if (error.config?.headers?.Authorization) {
          try {
            await clearStoredAuth();
            emitAuthExpired();
          } catch (e) {}
        }
        customError = error.response.data?.message || 'Session expired. Please log in again.';
      } else if (error.response.data && error.response.data.message) {
        customError = error.response.data.message;
      } else if (error.response.status === 403) {
        customError = 'You do not have permission to perform this action.';
      } else if (error.response.status === 404) {
        customError = 'Requested resource was not found.';
      }
    }

    const normalizedError = new Error(customError);
    normalizedError.status = error.response?.status;
    normalizedError.code = error.code;
    normalizedError.requiresVerification = error.response?.data?.requiresVerification;
    normalizedError.phone = error.response?.data?.phone;
    return Promise.reject(normalizedError);
  }
);

export default api;
