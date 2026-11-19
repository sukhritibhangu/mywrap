/**
 * Rapo's voice. A thin, defensive wrapper around the browser's
 * SpeechSynthesis API: no paid services, no autoplay, and a silent no-op
 * on platforms without speech support (React Native, older browsers).
 */

const LANGUAGE_PREFERENCE = /^(en(-|_)(IN|GB|US|AU)|en)$/i;
const FRIENDLY_VOICE = /(female|samantha|karen|moira|tessa|zira|aria|jenny|google uk english female|google us english)/i;

let currentUtterance = null;
let primed = false;

export function isSpeechSupported() {
  if (typeof window === 'undefined') return false;
  return typeof window.speechSynthesis !== 'undefined'
    && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

function listVoices() {
  if (!isSpeechSupported()) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch (error) {
    return [];
  }
}

/**
 * Browsers load voices asynchronously. Reading them once at module scope is
 * usually empty, so we prime the list and let later calls pick a real voice.
 */
function primeVoices() {
  if (primed || !isSpeechSupported()) return;
  primed = true;
  try {
    listVoices();
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', () => listVoices(), { once: true });
    }
  } catch (error) {
    // Voices are a nicety; speaking still works with the platform default.
  }
}

function pickVoice() {
  const voices = listVoices();
  if (!voices.length) return null;
  const matchLanguage = (voice) => LANGUAGE_PREFERENCE.test(String(voice?.lang || ''));
  return voices.find((voice) => matchLanguage(voice) && FRIENDLY_VOICE.test(voice.name || ''))
    || voices.find((voice) => matchLanguage(voice) && voice.localService)
    || voices.find(matchLanguage)
    || null;
}

/**
 * Speak `text`, cancelling anything already in flight so messages never
 * overlap. Returns true when speech actually started.
 */
export function speak(text, { onStart, onEnd, onError, rate = 0.98, pitch = 1.08 } = {}) {
  if (!isSpeechSupported() || !text) {
    onError?.();
    return false;
  }
  primeVoices();
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(String(text));
    const voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'en-IN';
    }
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;

    const settle = () => {
      if (currentUtterance === utterance) currentUtterance = null;
    };
    utterance.onstart = () => onStart?.();
    utterance.onend = () => { settle(); onEnd?.(); };
    utterance.onerror = () => { settle(); onError?.(); };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    currentUtterance = null;
    onError?.();
    return false;
  }
}

export function stopSpeech() {
  currentUtterance = null;
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (error) {
    // Nothing to cancel.
  }
}

export function isSpeaking() {
  if (!isSpeechSupported()) return false;
  try {
    return Boolean(window.speechSynthesis.speaking);
  } catch (error) {
    return false;
  }
}
