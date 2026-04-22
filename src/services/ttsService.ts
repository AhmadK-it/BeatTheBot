/**
 * Text-to-Speech Service
 * Uses browser's native Web Speech API for Arabic speech synthesis
 */

/**
 * Speak text using browser's speechSynthesis with fallback
 * - Prioritizes Arabic voices if available
 * - Falls back to system default voice
 * - Supports both Arabic and other languages
 */
export function speakWithFallback(text: string, onEnd?: () => void): void {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech Synthesis API not available');
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    
    // Try to find Arabic voice (female preferred)
    const arVoice =
      voices.find((v) => v.lang.startsWith('ar') && v.name.toLowerCase().includes('female')) ||
      voices.find((v) => v.lang.startsWith('ar') && v.name.toLowerCase().includes('layla')) ||
      voices.find((v) => v.lang.startsWith('ar') && v.name.toLowerCase().includes('muna')) ||
      voices.find((v) => v.lang.startsWith('ar')) ||
      voices[0];
    
    if (arVoice) {
      utterance.voice = arVoice;
    }
  };

  setVoice();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = setVoice;
  }

  utterance.lang = 'ar-SA';
  utterance.rate = 0.9; // Slightly slower for clarity
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  if (onEnd) {
    utterance.onend = () => {
      onEnd();
    };
    utterance.onerror = () => {
      onEnd();
    };
  }

  window.speechSynthesis.speak(utterance);
}