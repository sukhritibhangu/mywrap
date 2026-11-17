import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CompanionContext = createContext({
  hidden: false,
  quiet: false,
  message: null,
  celebrate: () => {},
  say: () => {},
  dismiss: () => {},
  toggleHidden: () => {},
  toggleQuiet: () => {},
});

const PREFS_KEY = 'wrapchik_wrapoo_prefs';
let messageCounter = 0;

/**
 * Wrapoo's little brain. Preferences are local-only (no account data) and the
 * companion never plays sound: "quiet" simply holds its chatter back.
 */
export const CompanionProvider = ({ children }) => {
  const [hidden, setHidden] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState(null);
  const dismissTimer = useRef(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PREFS_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        const parsed = JSON.parse(stored);
        setHidden(Boolean(parsed?.hidden));
        setQuiet(Boolean(parsed?.quiet));
      })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => {
      active = false;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ hidden, quiet })).catch(() => {});
  }, [hidden, loaded, quiet]);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setMessage(null);
  }, []);

  const show = useCallback((text, mood, duration) => {
    if (!text) return;
    messageCounter += 1;
    setMessage({ id: messageCounter, text, mood });
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setMessage(null), duration);
  }, []);

  const say = useCallback((text, options = {}) => {
    show(text, options.mood || 'idle', options.duration ?? 3400);
  }, [show]);

  const celebrate = useCallback((text, options = {}) => {
    if (quiet || hidden) return;
    show(text || 'Wohoo! Into the bag it goes!', options.mood || 'cheer', options.duration ?? 2600);
  }, [hidden, quiet, show]);

  const toggleHidden = useCallback(() => {
    setHidden((current) => {
      if (!current) dismiss();
      return !current;
    });
  }, [dismiss]);

  const toggleQuiet = useCallback(() => {
    setQuiet((current) => {
      if (!current) dismiss();
      return !current;
    });
  }, [dismiss]);

  return (
    <CompanionContext.Provider
      value={{ hidden, quiet, message, celebrate, say, dismiss, toggleHidden, toggleQuiet }}
    >
      {children}
    </CompanionContext.Provider>
  );
};

export const useCompanion = () => useContext(CompanionContext);
