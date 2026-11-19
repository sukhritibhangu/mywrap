import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSpeechSupported, speak as speakText, stopSpeech } from '../services/speech';

export const CompanionContext = createContext({
  message: null,
  speaking: false,
  speechSupported: false,
  celebrate: () => {},
  say: () => {},
  speak: () => false,
  stopSpeaking: () => {},
  dismiss: () => {},
  toggleHidden: () => {},
  toggleQuiet: () => {},
});

const PREFS_KEY = 'wrapchik_wrapoo_prefs';
let messageCounter = 0;

/**
 * Rapo's little brain: what he is saying, whether he is speaking out loud, and
 * the local-only preferences for his chatter. Speech only ever starts from a
 * deliberate user gesture; nothing here autoplays on its own.
 */
export const CompanionProvider = ({ children }) => {
  const [hidden, setHidden] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const dismissTimer = useRef(null);

  useEffect(() => {
    setSpeechSupported(isSpeechSupported());
    return () => stopSpeech();
  }, []);

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
    stopSpeech();
    setSpeaking(false);
    setMessage(null);
  }, []);

  const show = useCallback((text, mood, duration) => {
    if (!text) return;
    messageCounter += 1;
    setMessage({ id: messageCounter, text, mood });
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setMessage(null), duration);
  }, []);

  /** Show a bubble without sound. */
  const say = useCallback((text, options = {}) => {
    show(text, options.mood || 'talking', options.duration ?? 4200);
  }, [show]);

  /**
   * Show a bubble and read it aloud. Call this only from a user gesture so
   * Rapo never surprises anybody with unexpected audio.
   */
  const speak = useCallback((text, options = {}) => {
    if (!text) return false;
    show(text, options.mood || 'talking', options.duration ?? 9000);
    return speakText(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, [show]);

  const stopSpeaking = useCallback(() => {
    stopSpeech();
    setSpeaking(false);
  }, []);

  const celebrate = useCallback((text, options = {}) => {
    if (quiet || hidden) return;
    show(text || 'Wohoo! Into the bag it goes!', options.mood || 'celebrating', options.duration ?? 2600);
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
      value={{ hidden, quiet, message, speaking, speechSupported, celebrate, say, speak, stopSpeaking, dismiss, toggleHidden, toggleQuiet }}
    >
      {children}
    </CompanionContext.Provider>
  );
};

export const useCompanion = () => useContext(CompanionContext);
