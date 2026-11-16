import React, { createContext, useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter, Platform } from 'react-native';
import authService from '../services/authService';
import notificationService from '../services/notificationService';
import { AUTH_EXPIRED_EVENT } from '../services/authEvents';

export const AuthContext = createContext();

const TOKEN_KEY = 'wrapchik_jwt_token';
const USER_KEY = 'wrapchik_user_data';

const readToken = () => Platform.OS === 'web'
  ? AsyncStorage.getItem(TOKEN_KEY)
  : SecureStore.getItemAsync(TOKEN_KEY);

const writeToken = async (token) => {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  // Remove tokens written by older builds to AsyncStorage; native auth uses SecureStore only.
  await AsyncStorage.removeItem(TOKEN_KEY);
};

const removeStoredSession = async () => {
  await Promise.allSettled([
    AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]),
    Platform.OS === 'web'
      ? Promise.resolve()
      : SecureStore.deleteItemAsync(TOKEN_KEY),
  ]);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [developmentOtp, setDevelopmentOtp] = useState('');

  const clearSession = useCallback(async () => {
    setUser(null);
    setToken(null);
    await removeStoredSession();
  }, []);

  useEffect(() => {
    const onExpired = () => { clearSession(); };
    let subscription;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    } else {
      subscription = DeviceEventEmitter.addListener(AUTH_EXPIRED_EVENT, onExpired);
    }
    return () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      }
      subscription?.remove();
    };
  }, [clearSession]);

  useEffect(() => {
    if (Platform.OS === 'web' || !token || !user || isLoading) return undefined;
    let active = true;
    notificationService.registerForPushNotifications().then(async (pushToken) => {
      if (!active || !pushToken || pushToken === user.pushToken) return;
      try {
        const response = await authService.updateProfile({ pushToken });
        if (active && response?.success && response.user) {
          setUser(response.user);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
        }
      } catch (error) {
        console.warn('[Push Registration] Could not save this device token:', error.message);
      }
    });
    return () => { active = false; };
  }, [token, user?._id, user?.pushToken, isLoading]);

  useEffect(() => {
    let active = true;
    const loadStoredAuth = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          readToken(),
          AsyncStorage.getItem(USER_KEY),
        ]);

        if (!storedToken) {
          await AsyncStorage.removeItem(USER_KEY);
          return;
        }

        if (active) setToken(storedToken);
        try {
          const result = await authService.getMe();
          if (result?.success && result.user) {
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(result.user));
            if (active) setUser(result.user);
          } else {
            await clearSession();
          }
        } catch (error) {
          if (error.status === 401 || error.status === 403) {
            await clearSession();
          } else if (storedUser) {
            // Keep the last known profile for offline launch; the API still validates each request.
            if (active) setUser(JSON.parse(storedUser));
          } else {
            await clearSession();
          }
        }
      } catch (error) {
        console.warn('[Auth] Session restore failed:', error.message);
        await clearSession();
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadStoredAuth();
    return () => { active = false; };
  }, [clearSession]);

  const saveSession = async (newToken, newUser) => {
    await writeToken(newToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await authService.login(email, password);
      if (res.success && res.token) {
        await saveSession(res.token, res.user);
        return { success: true, user: res.user };
      }
      return { success: false, message: res.message };
    } catch (error) {
      return { success: false, message: error.message, requiresVerification: error.requiresVerification };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name, email, phone, password) => {
    setIsLoading(true);
    try {
      const result = await authService.register(name, email, phone, password);
      if (result.success && result.developmentCode) setDevelopmentOtp(result.developmentCode);
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email, code, purpose = 'LOGIN') => {
    setIsLoading(true);
    try {
      const res = await authService.verifyOtp(email, code, purpose);
      if (res.success && res.token) {
        await saveSession(res.token, res.user);
        setDevelopmentOtp('');
        return { success: true, user: res.user };
      }
      return { success: false, message: res.message };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const res = await authService.updateProfile(profileData);
      if (res.success && res.user) {
        setUser(res.user);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
      }
      return res;
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const logout = async () => {
    if (user?.pushToken) {
      try { await authService.updateProfile({ pushToken: null }); }
      catch (error) { console.warn('[Push Registration] Could not clear this device token:', error.message); }
    }
    setUser(null);
    setToken(null);
    await removeStoredSession();
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!token && !!user,
      isAdmin: user?.role === 'admin',
      login,
      register,
      verifyOtp,
      updateProfile,
      developmentOtp,
      clearDevelopmentOtp: () => setDevelopmentOtp(''),
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
