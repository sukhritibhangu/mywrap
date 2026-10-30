import React, {
  createContext,
  useState,
  useEffect,
} from 'react';

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import authService from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const saveSession = async (newToken, newUser) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem('wrapchik_jwt_token', newToken);
    } else {
      await SecureStore.setItemAsync('wrapchik_jwt_token', newToken);
    }

    await AsyncStorage.setItem(
      'wrapchik_user_data',
      JSON.stringify(newUser)
    );

    setToken(newToken);
    setUser(newUser);
  };

  const loadStoredAuth = async () => {
    try {
      const storedToken =
        Platform.OS === 'web'
          ? await AsyncStorage.getItem('wrapchik_jwt_token')
          : await SecureStore.getItemAsync('wrapchik_jwt_token');

      const storedUser =
        await AsyncStorage.getItem(
          'wrapchik_user_data'
        );

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.log(
        '[Auth] Restore failed',
        error
      );
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    setIsLoading(true);

    try {
      const res = await authService.login(
        email,
        password
      );

      if (res.success && res.token) {
        await saveSession(
          res.token,
          res.user
        );

        return {
          success: true,
          user: res.user,
        };
      }

      return {
        success: false,
        message: res.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        requiresVerification:
          error.requiresVerification,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name,
    email,
    phone,
    password
  ) => {
    setIsLoading(true);

    try {
      return await authService.register(
        name,
        email,
        phone,
        password
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    setToken(null);

    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync('wrapchik_jwt_token');
    }
    await AsyncStorage.removeItem('wrapchik_jwt_token');

    await AsyncStorage.removeItem(
      'wrapchik_user_data'
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        isAdmin: user?.role === 'admin',

        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};