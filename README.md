# Beat The Bot 

BeatTheBot is an interactive React + TypeScript quiz game that challenges players to answer trivia questions faster and more accurately than an AI bot opponent. Built for the MTN Syria Technology Conference, it features dynamic question generation via Google Gemini API, real-time scoring, and immersive audio effects.

---

## 🎮 What is this project?

**For Players:**  
Beat The Bot is a fast-paced browser quiz game where you compete against an intelligent bot. Answer 5 trivia questions across various topics (general knowledge, Syrian culture, technology, or random) within tight time limits. The bot adapts its difficulty based on the score, making every match competitive and fun. Winners earn data bundles!

**For Developers:**  
This is a modern TypeScript/React application demonstrating:
- Vite + React 19 best practices
- Real-time game state management
- Integration with Google Gemini API for dynamic content generation
- Audio engineering (synthesized sounds + background music)
- Responsive UI with Framer Motion animations
- Arabic language support throughout

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **Google Gemini API key** (free tier available at [AI Studio](https://aistudio.google.com))

### Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# 3. Start development server
npm run dev
# Opens at http://localhost:3004 by default
```

### Production Build

```bash
npm run build      # Compile to production bundle
npm run preview    # Test production build locally
```

---

## 🎯 How the Game Works

### Game Flow
1. **Intro Screen** → Player selects question topic (General, Syrian Culture, Tech, or Random)
2. **Countdown** → 3-second countdown before each question
3. **Question Phase** (5 seconds) → Player can buzz in early or wait for options
4. **Answer Phase** (6 seconds) → Selected player answers - bot attempts simultaneously
5. **Round Result** → Show correct answer, update scores
6. **Final Score** → After 5 rounds, determine winner and award prize

### Scoring System
- **Correct Answer** → +1 point, crowd energy +15%
- **Wrong Answer** → 0 points, crowd energy -10%, bot gets chance to answer
- **Crowd Energy** → Used for hints (costs 15%), helps determine bot difficulty
- **Streaks** → Track consecutive correct answers

### Bot Behavior
- Base accuracy: 85% (adaptive based on score difference)
- If bot leading significantly → reduces accuracy to 20%
- If human leading → responds faster and more carefully
- Close final round → bot plays more strategically

---

## 📁 Project Structure

```
src/
├── App.tsx                          # Main game component (game logic, UI, state)
├── main.tsx                         # React entry point
├── index.css                        # Global styles (Tailwind + custom)
├── custom.d.ts                      # TypeScript declarations
├── music/                           # Audio assets
│   ├── *.wav                        # Sound effects (correct, bot_win, human_win, etc.)
│   └── syria.svg                    # Syrian flag icon
└── services/
    ├── questionGenerator.ts         # Agentic question generation (Gemini API)
    └── soundEffects.ts              # Audio playback service

Configuration & Tooling:
├── vite.config.ts                   # Vite bundler configuration
├── tsconfig.json                    # TypeScript settings
├── index.html                       # HTML entry point
├── package.json                     # Dependencies & scripts
└── .env.example                     # Environment template (copy to .env.local)
```

---

## 🔧 Key Components

### App.tsx
- **Game State Management**: Tracks rounds, scores, timers, buzz state, crowd energy
- **Game Phases**: INTRO → COUNTDOWN → WAITING_BUZZ → DECISION → ROUND_RESULT → FINAL_RESULT
- **Player Interactions**: Buzz button, answer selection, hint usage, skip question
- **Bot Logic**: Simulates bot thinking time, answer selection, and difficulty adaptation
- **Audio & Animations**: Plays background tracks and effects; animates UI transitions

### questionGenerator.ts
- **Agentic Loop**: Uses Gemini's chat API with multi-turn conversation to iteratively improve questions
- **Duplicate Detection**: Tracks seen questions across game sessions
- **Topic Filters**: Context-aware generation (general knowledge, tech, Syrian culture, or random selection)
- **Fallback System**: Returns pre-cached questions if API quota exhausted
- **Self-Evaluation**: Validates question quality (proper JSON, unique options, non-empty fields)

### soundEffects.ts
- **One-Shot Sounds**: Generated via Web Audio API (oscillators, gain envelopes)
  - `tick` (880 Hz sine), `buzz` (120 Hz sawtooth), `lock` (440 Hz square)
  - `wrong` (descending sawtooth), `bot_thinking`, `bot_buzz`, `bot_correct`, `bot_wrong`
- **WAV Files**: Loaded from `src/music/` for polished audio
  - `correct.wav` (player correct), `bot_win.wav`, `human_win.wav`
  - `new_question.wav` (50s background for question phase)
  - `out_of_time.wav` (30s background for decision phase)
- **Looping Background Tracks**: Pulled dynamically based on game phase

---

## 🎨 UI/UX Highlights

- **Responsive Design**: Optimized for mobile, tablet, and desktop (Tailwind CSS + media queries)
- **Arabic RTL Support**: `dir="rtl"` with right-to-left text alignment
- **Animations**: Framer Motion for smooth transitions, floating effects, count-up animations
- **Accessibility**: High contrast MTN yellow (#FFCC00) on navy backgrounds, readable font sizes
- **Sound Toggle**: Settings panel to mute/unmute all audio effects

---

## ⚙️ Configuration

### Environment Variables
Create `.env.local`:
```
VITE_GEMINI_API_KEY=your_api_key_here
```

### Game Settings (src/App.tsx constants)
```typescript
const TOTAL_ROUNDS = 5;               // Questions per match
const QUESTION_TIMER = 5000;          // Milliseconds to buzz in
const DECISION_TIMER = 6000;          // Milliseconds to answer
const COUNTDOWN_TIME = 3;             // Seconds before question appears
```

### Audio Assets
Expected WAV files in `src/music/`:
- `correct.wav` — Player correct answer feedback
- `bot_win.wav` — Match winner sound (bot)
- `human_win.wav` — Match winner sound (player)
- `new_question.wav` — 50-second looping background (question phase)
- `out_of_time.wav` — 30-second looping background (decision phase)

To add custom audio, update the `AUDIO_ASSETS` mapping in [soundEffects.ts](src/services/soundEffects.ts).

---

## 🧠 AI & Question Generation

The app uses an **agentic pattern** for reliable question generation:

1. **Think**: Model receives topic filter + constraints + list of already-asked questions
2. **Act**: Generates batch of 5+ questions in JSON format
3. **Observe**: Validator checks JSON validity, question quality, required fields, no duplicates
4. **Feedback Loop**: If score < 100, model tries again with explicit error list

This ensures:
- ✅ No repeated questions within a session
- ✅ Consistent JSON output (parseable, valid shape)
- ✅ Diverse, appropriate topics per selection
- ✅ Graceful fallback if API quota hit

---

## 🎯 Topic Selection

Players can choose question categories:

| Topic | Content |
|-------|---------|
| **عشوائي (Random)** | Mix of mobile networks, AI, telecom, Syrian geography, language, math |
| **معلومات عامة (General)** | Science, history, geography, language, logic |
| **الثقافة السورية (Syrian Culture)** | Syrian history, arts, geography, traditions, notable figures |
| **تكنولوجيا (Tech)** | Mobile networks, cybersecurity, Internet tech, AI, programming |

---

## 🎵 Audio Engineering

### Synthesized Sounds (Web Audio API)
Generated in real-time with oscillators + gain envelopes to provide instant feedback with minimal file size.

### Background Music
Two looping tracks provide atmosphere:
- **Question Phase** (`new_question.wav`, 50s loop) — Calm, exploratory
- **Decision Phase** (`out_of_time.wav`, 30s loop) — Tense, decision-focused

Both loop seamlessly and mix under player answer selections.

---

## 🔐 Data & Privacy

- **No Server Storage**: All game data stays in browser (localStorage could be added)
- **API Keys**: Gemini API key stored locally in `.env.local` — never committed to repo
- **Questions**: Not persisted; regenerated each game (seen questions tracked in-memory)
- **Analytics**: None — this is a demo app

---

## 📦 Dependencies

### Core
- **react** (19.0) — UI framework
- **react-dom** (19.0) — DOM rendering
- **vite** (6.2) — Build bundler
- **typescript** (5.8) — Type safety

### UI & Animation
- **lucide-react** (0.546) — SVG icons
- **motion** (12.23) — Framer Motion: smooth animations
- **tailwindcss** (4.1) — Utility-first CSS
- **@tailwindcss/vite** (4.1) — Vite integration

### API & Audio
- **@google/genai** (1.29) — Gemini SDK (unused; using REST fetch instead)
- **dotenv** (17.2) — Environment variable loader

### Dev Tools
- **@vitejs/plugin-react** (5.0) — JSX support
- **@types/node** (22.14) — Node type definitions
- **@types/express** (4.17) — Express types (if backend planned)
- **tsx** (4.21) — TypeScript executor
- **autoprefixer** (10.4) — CSS vendor prefixes

---

## 🚀 Deployment

### Environment Variables
Set `VITE_GEMINI_API_KEY` as an environment variable on your hosting platform:
- **Netlify**: Site settings → Build & Deploy → Environment
- **Vercel**: Project Settings → Environment Variables
- **Docker**: Add to `.env` during build

### Port Configuration
Production uses port 3004. Change in [vite.config.ts](vite.config.ts) if needed:
```typescript
server: { port: 3004, host: '0.0.0.0' }
```

---

## 📝 Maintenance & Future Improvements

### Known Limitations
- **Gemini API Rate Limits**: Free tier has quota; fallback to static questions if exhausted
- **Arabic-Only Content**: Currently all questions/UI in Arabic; could add language toggle
- **Single-Device**: No multiplayer; bot is always opponent

### Potential Enhancements
```
[ ] Leaderboard (LocalStorage or backend database)
[ ] Language toggle (English/Arabic)
[ ] Difficulty levels (Easy, Medium, Hard)
[ ] Daily challenges (fixed questions per day)
[ ] Social sharing (WhatsApp, Telegram)
[ ] Offline mode (cached questions)
[ ] 2-player mode (local pass-and-play)
[ ] Mobile app (React Native)
```

---

## 📄 License

Licensed under Apache 2.0 (see `@license` comment in [App.tsx](src/App.tsx)).

---

## 👥 Credits

Built for **MTN Syria Technology Conference** as an interactive engagement tool showcasing modern web development with TypeScript, React, Vite, AI integration, and immersive UX.

---

## ❓ Troubleshooting

| Issue | Solution |
|-------|----------|
| "GEMINI_API_KEY not configured" | Copy `.env.example` → `.env.local` and add your key |
| Blank screen on startup | Check browser console for errors; ensure port 3004 not in use |
| Audio not playing | Enable browser sound; check mute toggle in settings |
| Questions fail to load | Gemini API quota exhausted (daily limit); try again later |
| Animations stuttering | Reduce window size; disable browser extensions |

---

**Happy gaming! 🎮 Challenge the bot, answer fast, and claim your prize! 🏆**
<div align="center">
<h1>BeatTheBot — Friendly Technical Overview</h1>
</div>

BeatTheBot is a compact React + TypeScript quiz game that pits a human player against an AI opponent. This README explains the user journey, how the code is organized, how AI is used, and how sounds and timers are wired — in plain language so both technical and non-technical readers can follow along.

**Quick start**
- Install dependencies: `npm install`
- Copy environment template: `cp .env.example .env.local` and set your Gemini API key (`GEMINI_API_KEY`)
- Run locally (developer mode): `npm run dev` (default Vite port can be changed in `package.json` / `vite.config.ts`).

**Note:** The project is intended to run on port `3004` in production deployments; change the dev server port if you want to match that locally.

**User experience (what the player sees and hears)**
- Intro screen with a big "Start" button.
- A short countdown before each question.
- Question displayed with a 50s background loop (atmospheric music) while waiting for a buzzer.
- Player can press a buzzer to answer; pressing opens the options menu which runs a 30s looping background track.
- Correct / incorrect one-shot sounds play to highlight outcomes.
- At the end of the match, a win/lose sound plays (`human_win` or `bot_win`).

---
- **Rate-limits & Quotas:**: The service detects `429` responses and distinguishes between transient rate limits (retry with backoff) and hard quota errors (abort and fallback). Errors and retry attempts are logged for debugging.
- **Why this design:**: The agentic loop gives the model actionable feedback to fix formatting and content issues, improves consistency across calls, and minimizes bad outputs reaching the UI while still preferring live, topical questions when available.


**Sound design and service behavior**
- Background loops:
	- `new_question` — used during the question display / waiting-for-buzz phase; intended to loop while the question is active (50s target scope).
	- `out_of_time` — used while the options menu (decision) is active (30s target scope).
- One-shot sounds: `correct`, `bot_win`, `human_win` (play once on events).
- Implementation: `src/services/soundEffects.ts` uses HTMLAudioElements to play tracks from `src/music/` and also provides small oscillator-based beeps for UI ticks and bot cues. The service exposes:
	- `playSound(type, muted)` — play a one-shot sound or small oscillator cue
	- `playBackgroundSound(key, type, muted)` — start a looping music track
	- `stopBackgroundSound(key)` and `stopAllBackgroundSounds()` — stop loops and cleanup
- Muting: audio respects the `mutedSounds` state in the app; toggling in settings disables playback.

**Timers and progress UI**
- Question phase timer: 50 seconds (configurable in `src/App.tsx` constants). The progress bar visually transitions colors as time elapses (green → yellow → red).
- Decision (options) phase timer: 30 seconds (configurable). When it runs out the game auto-resolves and the bot may take over.
- Bot behavior: The bot's buzzer delay is randomized within configured bounds and the bot's accuracy is probabilistic (adjusted based on score difference). Bot timers are kept in sync with the question timers in `src/App.tsx`.

**How sounds interact with gameplay (practical rules)**
- `new_question` starts when a question is presented and stops when the player buzzes or the question phase ends.
- When the player buzzes, `new_question` is stopped and `out_of_time` (decision loop) starts for the options menu.
- `correct` plays as a one-shot and does not stop the background by default (you can change this behavior in the sound service if you want fading or ducking).
- At game end, the service plays either `human_win` or `bot_win` once.

**Running & debugging tips**
- If audio does not play in your browser, check autoplay policies — user interaction is often required before audio will play. The app attempts to `play()` safely and logs blocked playback to the console.
- Check console warnings for audio playback errors or network errors from the Gemini API.
- To force a local-only run (no Gemini calls), you can temporarily set `GEMINI_API_KEY` empty and the app will fall back to `FALLBACK_QUESTIONS`.

**Configuration and environment**
- `GEMINI_API_KEY` — must be set in `.env.local` for question generation.
- Dev port: `npm run dev` (Vite) — can be configured via `vite.config.ts` or environment variables.

**Contributing / Extending**
- Replace or add audio files in `src/music/` and update `src/services/soundEffects.ts` asset mapping.
- To change timers or bot behavior, edit the constants at the top of `src/App.tsx`.
- To improve question prompts or localization (e.g., stricter MTN Syria context), update the prompt text in `src/services/questionGenerator.ts`.

**Where to look in the codebase**
- Main game flow: `src/App.tsx`
- Questions: `src/services/questionGenerator.ts`
- Sounds: `src/services/soundEffects.ts`
- Music assets: `src/music/`

If you'd like, I can also: add a short troubleshooting section for CI/deploy, add automated tests for the question schema, or create a small demo script that preloads audio before the game starts — tell me which you'd prefer and I will implement it.

---
Made with care — if anything in this README is unclear or you'd like more detail in a specific area (e.g., the Gemini prompt or the audio mixing strategy), tell me which part and I'll expand it.
