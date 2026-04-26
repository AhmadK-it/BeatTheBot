
/**
 * Agentic Question Generator Service
 * Uses a Think → Act → Observe → Repeat loop with self-evaluation and tool use.
 *
 * DROP-IN REPLACEMENT for the original questionGenerator.ts
 * Same exports: generateQuestions(), FALLBACK_QUESTIONS
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Question {
  id: number;
  category: string;
  question: string;
  options: string[];
  correct: number;
  hint: string;
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
  score: number; // 0-100
}

interface AgentMemory {
  iteration: number;
  previousIssues: string[];
  attemptedFixes: string[];
}

interface ConversationMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const GEMINI_API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  (process.env as any)?.GEMINI_API_KEY;

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent';

const MAX_AGENT_ITERATIONS = 1;

// ─── Seen-questions registry ──────────────────────────────────────────────────
// Persists across game restarts (session lifetime).
// Stores normalized question text to detect duplicates.
const seenQuestions: Set<string> = new Set();

function normalizeQuestion(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isDuplicate(question: string): boolean {
  return seenQuestions.has(normalizeQuestion(question));
}

function markAsSeen(questions: Question[]): void {
  questions.forEach((q) => seenQuestions.add(normalizeQuestion(q.question)));
}

/** Call this to reset seen history (e.g. full app reset, not just game restart) */
export function clearQuestionHistory(): void {
  seenQuestions.clear();
}

// ─── Tool: Validator ──────────────────────────────────────────────────────────
// This is the agent's "observation" step. It gives the model objective feedback.

function validateQuestions(questions: any[]): ValidationResult {
  const issues: string[] = [];
  let score = 100;

  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, issues: ['Output is not a valid array or is empty'], score: 0 };
  }

  questions.forEach((q, i) => {
    const label = `Q${i + 1}`;

    if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 10) {
      issues.push(`${label}: question text is missing or too short`);
      score -= 15;
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      issues.push(`${label}: must have exactly 4 options (got ${q.options?.length ?? 0})`);
      score -= 15;
    } else {
      const nonEmpty = q.options.filter((o: any) => typeof o === 'string' && o.trim().length > 0);
      if (nonEmpty.length !== 4) {
        issues.push(`${label}: all 4 options must be non-empty strings`);
        score -= 10;
      }

      const unique = new Set(q.options.map((o: string) => o.trim().toLowerCase()));
      if (unique.size < 4) {
        issues.push(`${label}: options contain duplicates`);
        score -= 10;
      }
    }

    if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) {
      issues.push(`${label}: "correct" must be a number between 0 and 3`);
      score -= 10;
    }

    if (!q.category || typeof q.category !== 'string' || q.category.trim().length === 0) {
      issues.push(`${label}: category is missing`);
      score -= 5;
    }

    if (!q.hint || typeof q.hint !== 'string' || q.hint.trim().length === 0) {
      issues.push(`${label}: hint is missing`);
      score -= 5;
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    score: Math.max(0, score),
  };
}

// ─── Core: Single Gemini API Call ─────────────────────────────────────────────

// ─── Custom error for hard quota exhaustion ───────────────────────────────────
class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RATE_LIMIT_RETRIES = 2;

async function callGemini(history: ConversationMessage[]): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Set VITE_GEMINI_API_KEY in .env.local');
  }

  let attempt = 0;

  while (attempt <= MAX_RATE_LIMIT_RETRIES) {
    
    try{
      const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: history }),
      });

    if (response.status === 429) {
      const err = await response.json().catch(() => ({}));
      const message: string = err?.error?.message || '';

      // Hard quota exhaustion — billing period limit, retrying won't help
      if (message.includes('free_tier') || message.includes('quota') || message.includes('billing')) {
        throw new QuotaExceededError(`Gemini API Error: ${message}`);
      }

      // Transient rate limit — wait then retry
      const retryMatch = message.match(/retry in ([\d.]+)s/i);
      const waitMs = Math.min((retryMatch ? parseFloat(retryMatch[1]) : Math.pow(2, attempt + 1) * 5) * 1000, 30_000);
      console.warn(`[Agent] 429 rate limit. Waiting ${waitMs / 1000}s (retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})...`);
      await delay(waitMs);
      attempt++;
      continue;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini API Error: ${err.error?.message || response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini API');
    return text;
  }catch (err) {
    if (err instanceof QuotaExceededError) {
      throw err; // Don't retry on hard quota errors
    }
    console.error('Error calling Gemini API:', err);
    if (attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitMs = Math.pow(2, attempt + 1) * 5000;
      console.warn(`[Agent] Error calling Gemini API. Waiting ${waitMs / 1000}s before retrying...`);
      await delay(waitMs);
      attempt++;
      return callGemini(history);
    }
  }

  throw new Error('Gemini API rate limit exceeded after retries. Please wait a moment and try again.');
}
}
// ─── Core: Parse JSON from Model Response ─────────────────────────────────────

function extractJSON(raw: string): any[] {
  // Strip markdown code fences if present
  const stripped = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

  const match = stripped.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!match) throw new Error('No JSON array found in model response');

  return JSON.parse(match[0]);
}

// ─── Topic Filter Helper ──────────────────────────────────────────────────────
function getTopicFilter(topic: string): string {
  const filters: { [key: string]: string } = {
    random: `Topic rules — choose ONLY from these categories, with accurate and up-to-date facts:
1. شبكات الجوّال (Mobile Networks) — 4G LTE, 5G NR, VoLTE, VoNR, carrier aggregation, spectrum bands, Open RAN
2. الذكاء الاصطناعي والحوسبة (AI & Computing) — machine learning, edge computing, cloud infrastructure, LLMs, IoT
3. اتصالات عامة (General Telecom) — SIM/eSIM, roaming, QoS, network slicing, satellite internet (Starlink, OneWeb)
4. الجغرافيا السورية (Syrian Geography) — cities, landmarks, natural features, regions
5. اللغة والثقافة (Language & Culture) — literature, languages, cultural facts
6. الرياضيات والمنطق (Math & Logic) — mathematical concepts, puzzles, logic problems`,

    general: `Topic rules — ONLY generate questions from these general knowledge categories about technology and modern life:
1. العلوم والطبيعة (Science & Nature) — physics, chemistry, biology, astronomy
2. التاريخ (History) — world history, technological milestones, important events
3. الجغرافيا (Geography) — countries, capitals, landmarks, climate zones
4. اللغة والثقافة (Language & Culture) — literature, languages, cultural facts
5. الرياضيات والمنطق (Math & Logic) — mathematical concepts, puzzles, logic problems`,

    'syrian-culture': `Topic rules — ONLY generate questions about Syrian culture, history, geography, and traditions:
1. التاريخ السوري (Syrian History) — ancient civilizations, modern history, key figures
2. الثقافة والفنون السورية (Syrian Culture & Arts) — traditional music, dance, crafts, literature
3. الجغرافيا السورية (Syrian Geography) — cities, landmarks, natural features, regions
4. التقاليد والعادات (Traditions & Customs) — celebrations, food, customs, values
5. الشخصيات البارزة (Notable Figures) — leaders, artists, authors, scientists from Syria`,

    tech: `Topic rules — ONLY generate questions about technology, computing, and innovation:
1. شبكات الجوّال (Mobile Networks) — 4G LTE, 5G NR, VoLTE, VoNR, carrier aggregation, spectrum bands, Open RAN
2. أمن المعلومات (Cybersecurity) — phishing, encryption, 2FA, VPN, malware, zero-day, GDPR/data privacy
3. تقنيات الإنترنت (Internet Technologies) — Wi-Fi 6/6E/7, IPv6, fiber optics, DNS, HTTP/3, QUIC, CDN
4. الذكاء الاصطناعي والحوسبة (AI & Computing) — machine learning, edge computing, cloud infrastructure, LLMs, IoT
5. البرمجة والتطوير (Programming & Development) — languages, frameworks, databases, DevOps`,
  };

  return filters[topic] || filters['random'];
}

// ─── Agentic Loop ─────────────────────────────────────────────────────────────

export async function generateQuestions(count: number = 5, topic: string = 'random'): Promise<Question[]> {
  // Always hits the API on each call — no session cache.
  // The seen-questions registry ensures no repeats across restarts.

  const memory: AgentMemory = {
    iteration: 0,
    previousIssues: [],
    attemptedFixes: [],
  };

  // Build the "avoid these" block from seen questions so the model knows what to skip
  const avoidBlock =
    seenQuestions.size > 0
      ? `\nDo NOT generate any of these questions that were already used in previous rounds:\n${[...seenQuestions]
          .map((q, i) => `  ${i + 1}. ${q}`)
          .join('\n')}\n`
      : '';

  // Build the topic filter for the prompt
  const topicFilter = getTopicFilter(topic);

  // Conversation history
  const history: ConversationMessage[] = [];

  // ── Initial system-level instruction ──────────────────────────────────────
  history.push({
    role: 'user',
    parts: [
      {
        text: `You are a quiz question generator for a telecom trivia game called "Beat The Bot!".
Your ONLY output format is a raw JSON array. No markdown, no explanation, no code blocks.
Start with [ and end with ].

Each question object must follow this exact shape:
{
  "id": <number>,
  "category": "<Arabic category name>",
  "question": "<question in Arabic>",
  "options": ["<opt1>", "<opt2>", "<opt3>", "<opt4>"],
  "correct": <0|1|2|3>,
  "hint": "<hint in Arabic>"
}

${topicFilter}

STRICT content rules:
- Do NOT generate questions about any specific telecom operator, brand, or company (e.g. no MTN, Syriatel, Vodafone, etc.)
- Do NOT ask about prices, plans, promotions, or operator-specific features
- Questions must be factual and based on established technology standards — no opinion or marketing
- All 4 options must be distinct and meaningful and not just random words
- The "correct" field is the 0-based index of the right answer
- Hints should be helpful but not give away the answer
- Questions must be clear, concise, and in Arabic. Avoid overly complex language or technical jargon that may confuse players.
- questions should be suitable for a general audience with an interest in telecom and technology, not just experts.
- questions must vary in difficulty, with some easier and some harder ones, but all should be answerable with careful thought and knowledge of the topics.
- All text must be in Arabic
${avoidBlock}
Now generate ${count} fresh questions that have NOT been asked before.`,
      },
    ],
  });

  let lastValidQuestions: Question[] = [];

  // ── Agent Loop ─────────────────────────────────────────────────────────────
  while (memory.iteration < MAX_AGENT_ITERATIONS) {
    memory.iteration++;
    console.log(`[Agent] Iteration ${memory.iteration}/${MAX_AGENT_ITERATIONS}`);

    // ── THINK + ACT: call the model ─────────────────────────────────────────
    let rawResponse: string;
    try {
      rawResponse = await callGemini(history);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        console.warn('[Agent] Quota exhausted. Falling back to static questions.');
        return lastValidQuestions.length > 0
          ? lastValidQuestions.slice(0, count).map((q: any, idx: number) => ({
              id: idx + 1,
              category: q.category?.trim() || 'عام',
              question: q.question?.trim() || '',
              options: (q.options || []).map((o: string) => o?.trim() || ''),
              correct: q.correct ?? 0,
              hint: q.hint?.trim() || 'فكر جيداً في الإجابة',
            }))
          : FALLBACK_QUESTIONS.slice(0, count);
      }
      throw err;
    }

    // Push model response into history
    history.push({
      role: 'model',
      parts: [{ text: rawResponse }],
    });

    // ── OBSERVE: parse + deduplicate ────────────────────────────────────────
    let parsed: any[];
    try {
      parsed = extractJSON(rawResponse);
    } catch (parseError) {
      console.warn(`[Agent] JSON parse failed on iteration ${memory.iteration}:`, parseError);
      history.push({
        role: 'user',
        parts: [
          {
            text: `Your response could not be parsed as JSON. Error: ${parseError}
Please return ONLY a valid raw JSON array. No markdown, no backticks, no extra text.
Start your response directly with [ and end with ].`,
          },
        ],
      });
      continue;
    }

    // Filter out any question already seen in previous rounds
    const deduplicated = parsed.filter((q: any) => {
      if (!q.question || typeof q.question !== 'string') return true; // let validator catch it
      if (isDuplicate(q.question)) {
        console.warn(`[Agent] Duplicate question filtered out: "${q.question.slice(0, 60)}..."`);
        return false;
      }
      return true;
    });

    if (deduplicated.length < parsed.length) {
      console.log(`[Agent] Removed ${parsed.length - deduplicated.length} duplicate(s). ${deduplicated.length} remain.`);
    }

    const validation = validateQuestions(deduplicated);
    console.log(`[Agent] Validation score: ${validation.score}/100, Issues: ${validation.issues.length}`);

    if (validation.valid && deduplicated.length >= count) {
      // ── GOAL MET ─────────────────────────────────────────────────────────
      console.log(`[Agent] ✓ Goal met on iteration ${memory.iteration}`);

      const result: Question[] = deduplicated.slice(0, count).map((q: any, idx: number) => ({
        id: idx + 1,
        category: q.category.trim(),
        question: q.question.trim(),
        options: q.options.map((o: string) => o.trim()),
        correct: q.correct,
        hint: q.hint?.trim() || 'فكر جيداً في الإجابة',
      }));

      // ── SANITY CHECK: Ensure all questions have exactly 4 non-empty options ──
      const validResult = result.filter((q) => {
        if (!Array.isArray(q.options) || q.options.length !== 4) return false;
        return q.options.every((opt) => typeof opt === 'string' && opt.length > 0);
      });

      if (validResult.length < result.length) {
        console.warn(`[Agent] Filtered out ${result.length - validResult.length} questions with incomplete options`);
      }

      // Register these as seen so they won't repeat in future rounds
      markAsSeen(validResult);
      return validResult.length >= count ? validResult.slice(0, count) : result;
    }

    // ── GOAL NOT MET: store progress ─────────────────────────────────────
    if (deduplicated.length > 0) {
      const partialValid = deduplicated.filter(
        (_: any, i: number) =>
          !validation.issues.some((issue) => issue.startsWith(`Q${i + 1}:`))
      );
      if (partialValid.length > lastValidQuestions.length) {
        lastValidQuestions = partialValid;
      }
    }

    memory.previousIssues.push(...validation.issues);
    const feedback = buildFeedback(validation, count, deduplicated.length, memory);
    memory.attemptedFixes.push(`Iteration ${memory.iteration}: score=${validation.score}`);

    history.push({
      role: 'user',
      parts: [{ text: feedback }],
    });

    // Throttle between iterations
    if (memory.iteration < MAX_AGENT_ITERATIONS) {
      await delay(2000);
    }
  }

  // ── Max iterations reached ──────────────────────────────────────────────
  console.warn('[Agent] Max iterations reached. Returning best partial result or fallback.');

  if (lastValidQuestions.length > 0) {
    console.log(`[Agent] Returning ${lastValidQuestions.length} partial questions`);
    const partial: Question[] = lastValidQuestions.slice(0, count).map((q: any, idx: number) => ({
      id: idx + 1,
      category: q.category?.trim() || 'عام',
      question: q.question?.trim() || '',
      options: (q.options || []).map((o: string) => o?.trim() || ''),
      correct: q.correct ?? 0,
      hint: q.hint?.trim() || 'فكر جيداً في الإجابة',
    }));

    // ── SANITY CHECK: Filter out incomplete questions ──
    const validPartial = partial.filter((q) => {
      if (!Array.isArray(q.options) || q.options.length !== 4) return false;
      return q.options.every((opt) => typeof opt === 'string' && opt.length > 0);
    });

    if (validPartial.length > 0) {
      markAsSeen(validPartial);
      return validPartial;
    }
  }

  console.warn('[Agent] No valid questions produced. Using fallback questions.');
  return FALLBACK_QUESTIONS.slice(0, count);
}

// ─── Helper: Build Corrective Feedback Message ────────────────────────────────
// This is the message fed back to the model so it understands what to fix.

function buildFeedback(
  validation: ValidationResult,
  needed: number,
  got: number,
  memory: AgentMemory
): string {
  const lines: string[] = [];

  lines.push(`Your response scored ${validation.score}/100. Here is the objective feedback:`);

  if (got < needed) {
    lines.push(`- You generated ${got} questions but ${needed} are required.`);
  }

  if (validation.issues.length > 0) {
    lines.push('- Specific issues found:');
    validation.issues.forEach((issue) => lines.push(`  • ${issue}`));
  }

  if (memory.iteration > 1 && memory.previousIssues.length > 0) {
    lines.push('- Recurring issues across attempts (make sure these are fully resolved):');
    const recurring = findRecurring(memory.previousIssues);
    recurring.forEach((issue) => lines.push(`  • ${issue}`));
  }

  lines.push('');
  lines.push(
    `Please regenerate all ${needed} questions fixing every issue above. Return ONLY the raw JSON array.`
  );

  return lines.join('\n');
}

function findRecurring(issues: string[]): string[] {
  const counts: Record<string, number> = {};
  issues.forEach((issue) => {
    // Normalize by stripping the Q-number prefix to find pattern-level recurrence
    const normalized = issue.replace(/^Q\d+:\s*/, '');
    counts[normalized] = (counts[normalized] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([issue]) => issue);
}

// ─── Fallback Questions ────────────────────────────────────────────────────────

export const FALLBACK_QUESTIONS: Question[] = [
  {
    id: 1,
    category: 'أساسيات الاتصالات',
    question: 'ماذا يرمز اختصار LTE في شبكات الجيل الرابع؟',
    options: [
      'التطور طويل الأمد (Long Term Evolution)',
      'طاقة تقنية منخفضة',
      'مدخل نغمة خفيف',
      'رابط إلى إيثرنت',
    ],
    correct: 0,
    hint: 'يركز على تطوير الشبكة على المدى البعيد.',
  },
  {
    id: 2,
    category: 'منتجات MTN',
    question: 'أي تقنية من MTN تسمح بمشاركة رقم واحد عبر أجهزة متعددة؟',
    options: ['الرقم الموحد', 'Multi-SIM (شريحة متعددة)', 'سوبر نت', 'خدمة باقتي'],
    correct: 1,
    hint: 'تذكر أن الرقم يعمل على أكثر من شريحة (SIM).',
  },
  {
    id: 3,
    category: 'تاريخ التقنية في سوريا',
    question: 'متى بدأت خدمة الجيل الثالث (3G) تجارياً في سوريا؟',
    options: ['2005', '2010', '2015', '2020'],
    correct: 1,
    hint: 'بدأت قبل الأزمة السورية بقليل.',
  },
  {
    id: 4,
    category: 'تقنيات عامة',
    question: "ما هو مسمى 'Latency' في عالم الشبكات؟",
    options: ['سرعة التحميل', 'سعة البيانات', 'زمن الاستجابة (تأخير)', 'قوة الإشارة'],
    correct: 2,
    hint: 'يتعلق بالوقت الذي تستغرقه البيانات للوصول.',
  },
  {
    id: 5,
    category: 'شبكات الجيل الخامس',
    question: 'ما هي الميزة الأساسية التي تجعل الـ 5G أسرع بكثير من الـ 4G؟',
    options: [
      'استخدام الأسلاك',
      'ترددات الموجات المليمترية (mmWave)',
      'البطارية الكبيرة',
      'الأقمار الصناعية فقط',
    ],
    correct: 1,
    hint: 'تقنية تعتمد على موجات ذات تردد عالٍ جداً وقصير.',
  },
];