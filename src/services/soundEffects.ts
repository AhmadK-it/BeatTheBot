/**
 * Sound Effects Service
 * Handles one-shot sound effects and looping background tracks sourced from the src/music folder.
 */

type SoundType = 'tick' | 'buzz' | 'correct' | 'wrong' | 'lock' | 'bot_thinking' | 'bot_buzz' | 'bot_correct' | 'bot_wrong' | 'bot_win' | 'human_win' | 'bg_question' | 'bg_decision';

const AUDIO_ASSETS = {
  correct: new URL('../music/correct.wav', import.meta.url).href,
  bot_win: new URL('../music/bot_win.wav', import.meta.url).href,
  human_win: new URL('../music/human_win.wav', import.meta.url).href,
  new_question: new URL('../music/new_question.wav', import.meta.url).href,
  out_of_time: new URL('../music/out_of_time.wav', import.meta.url).href,
} as const;

const activeLoopingAudio = new Map<string, HTMLAudioElement>();

const createAudioElement = (src: string, loop = false, volume = 0.45) => {
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = volume;
  audio.preload = 'auto';
  return audio;
};

const safePlay = async (audio: HTMLAudioElement) => {
  try {
    await audio.play();
  } catch (error) {
    console.warn('Audio playback blocked or failed:', error);
  }
};

export const playSound = (type: SoundType, muted: boolean = false): void => {
  if (muted) return;

  switch (type) {
    case 'correct': {
      const audio = createAudioElement(AUDIO_ASSETS.correct, false, 0.65);
      void safePlay(audio);
      return;
    }
    case 'bot_win': {
      const audio = createAudioElement(AUDIO_ASSETS.bot_win, false, 0.7);
      void safePlay(audio);
      return;
    }
    case 'human_win': {
      const audio = createAudioElement(AUDIO_ASSETS.human_win, false, 0.7);
      void safePlay(audio);
      return;
    }
    default: {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      switch(type) {
        case 'tick':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        case 'buzz':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(120, now);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        case 'lock':
          osc.type = 'square';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
          break;
        case 'wrong':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(100, now);
          osc.frequency.linearRampToValueAtTime(50, now + 0.5);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.start(now);
          osc.stop(now + 0.6);
          break;
        case 'bot_thinking':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(50, now);
          osc.frequency.linearRampToValueAtTime(60, now + 0.1);
          gain.gain.setValueAtTime(0.015, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        case 'bot_buzz':
          osc.type = 'square';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(250, now + 0.2);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        case 'bot_correct':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.setValueAtTime(800, now + 0.1);
          osc.frequency.setValueAtTime(1000, now + 0.2);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        case 'bot_wrong':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(80, now);
          osc.frequency.linearRampToValueAtTime(30, now + 1.0);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
          osc.start(now);
          osc.stop(now + 1.0);
          break;
      }
      break;
    }
  }
};

export const playBackgroundSound = (soundKey: string, soundType: 'bg_question' | 'bg_decision', muted: boolean = false): void => {
  if (muted) return;

  stopBackgroundSound(soundKey);

  const track = soundType === 'bg_question' ? AUDIO_ASSETS.new_question : AUDIO_ASSETS.out_of_time;
  const audio = createAudioElement(track, true, 0.28);
  activeLoopingAudio.set(soundKey, audio);
  void safePlay(audio);
};

export const stopBackgroundSound = (soundKey: string): void => {
  const audio = activeLoopingAudio.get(soundKey);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    activeLoopingAudio.delete(soundKey);
  }
};

export const stopAllBackgroundSounds = (): void => {
  activeLoopingAudio.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  activeLoopingAudio.clear();
};
