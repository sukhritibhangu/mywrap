import { DeviceEventEmitter, Platform } from 'react-native';

export const AUTH_EXPIRED_EVENT = 'wrapchik:auth-expired';

export const emitAuthExpired = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return;
  }
  DeviceEventEmitter.emit(AUTH_EXPIRED_EVENT);
};
