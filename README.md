# Beat The Bot — MTN

Friendly, in-depth technical summary for both technical and non-technical readers.

---

## What is this project? (Non-technical)

Beat The Bot is a small interactive web game that challenges a human player to "beat" an automated opponent (the bot) by answering music-related prompts. It uses short audio clips, text-to-speech (TTS), and a question-generation system to present prompts and give feedback. The goal is fast, fun rounds where the player competes against a predictable automated experience.

Why this is fun: it mixes music snippets and short, timed questions to create a quick, replayable challenge. It runs in the browser, no heavy setup for players.

---

## Quick start (for everyone)

Prerequisites:
- Node.js (LTS recommended, e.g., 16+)

To run locally:

```bash
npm install
npm run dev
```

Open the dev server URL (Vite prints it, usually `http://localhost:5173`). Play!

To create a production bundle:

```bash
npm run build
npm run preview
```

---

## How the game works (plain language)

- The app shows a prompt that asks a music-related question (e.g., identify a tune or react to a sound).
- Short audio clips or synthesized speech (TTS) play to give the player context.
- The player has a short time window to answer.
- The bot's behavior is deterministic or rule-based (so players can learn and improve).
- The app tracks rounds, scores, and plays sound effects for feedback.

---

## Who is this for?

- Players who enjoy short music-quiz experiences in a browser.
- Developers learning how to combine audio playback, TTS, and simple game loops in a Vite + React/TypeScript app.

---

## Architecture overview (technical)

High-level components:

- Frontend app: React + TypeScript, bundled with Vite. Entry points: `src/main.tsx` and `src/App.tsx`.
- Audio & TTS services: small service modules under `src/music/services/` responsible for loading audio clips, playing sound effects, and calling TTS.
- Question generation: `questionGenerator.ts` contains logic to produce questions and choices for each round.
- State & UI: `App.tsx` orchestrates the main game state (rounds, timer, score) and renders UI.

Data flow:

1. On round start, the UI requests a question from the question generator.
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

**High-level architecture**
- UI: React + TypeScript (`src/App.tsx`) — manages game state, timers, and the full player flow.
- Question generation: `src/services/questionGenerator.ts` — uses the Gemini API to generate quiz questions (model: `gemini-3.1-flash-lite-preview`).
- Sounds: `src/services/soundEffects.ts` — central sound service that plays one-shot sounds and looping background tracks from `src/music/`.
- Legacy TTS: `src/services/ttsService.ts` exists but TTS was removed from the user-facing flow; speech fallback remains for accessibility where enabled.

**Key files and responsibilities**
- `src/App.tsx`: Main component — game phases, timers, bot logic, UI.
- `src/services/questionGenerator.ts`: Builds prompts and calls Gemini to return validated questions.
- `src/services/soundEffects.ts`: Centralized audio service — plays `new_question` (50s loop), `out_of_time` (30s loop), `correct`, `bot_win`, `human_win`, and other one-shot effects.
- `src/music/`: Audio assets (expected files: `new_question.wav`, `out_of_time.wav`, `correct.wav`, `bot_win.wav`, `human_win.wav`).

If you want to change the asset names or formats, update the mapping inside `src/services/soundEffects.ts`.

**AI integration (how we use Gemini)**
- Purpose: automatic question generation only — no TTS or voice generation in the gameplay flow.
- Endpoint: use Google Generative Language API (v1beta) with model `gemini-3.1-flash-lite-preview` for question generation.
- Prompting: `questionGenerator` builds a constrained prompt to return JSON-like objects (question text, four options, correct index, hint, category). The service validates the response and falls back to local questions on failure.
- Error handling: The generator retries a few times and then uses a local fallback (`FALLBACK_QUESTIONS`) if the API fails.

**Agentic Workflow**

- **Overview:**: The question generator implements an agent-like loop — Think → Act → Observe → Repeat — to produce validated quiz questions from the Gemini model while enforcing strict output shape and content rules.
- **Think (Prompt Construction):**: The service builds a focused prompt that includes the game role, strict JSON-only output format, a topic filter (based on the selected topic), and an "avoid" block listing previously seen questions so the model does not repeat content.
- **Act (Model Call):**: The generator calls the Gemini API with the constructed prompt and receives a raw text response. The code extracts the JSON array from the model output (stripping fences and extra text) before parsing.
- **Observe (Validation):**: Parsed output is validated against a schema: exactly 4 non-empty `options`, a numeric `correct` index (0–3), non-empty `question`, `category`, and `hint`. Validation also checks for duplicate or identical options.
- **Repeat (Feedback & Retries):**: If validation fails, the system composes corrective feedback and (within configured retry limits) re-invokes the model with the feedback to improve results. The loop tracks iterations and attempted fixes in a small in-memory agent memory.
- **Deduplication & State:**: A session-scoped `seenQuestions` registry stores normalized question text across rounds so the agent can include an "avoid" list in future prompts to reduce repeats.
- **Sanity Filters:**: After a successful model response, additional sanity checks filter any items missing the required 4 valid options; the generator will fall back to partial results only when appropriate.
- **Fallback Strategy:**: If the API fails, returns malformed data, or retries are exhausted, the service returns a deterministic `FALLBACK_QUESTIONS` array so the UI always has playable content.
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
