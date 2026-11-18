import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { ENV } from "./_core/env";

// Stage C — AI support chat (Gemini Flash via REST, no SDK).
// Grounded ONLY in MODEL-LOCKED.md. Public endpoint: rate-limited per
// identity (user id when signed in, otherwise IP) and cached for repeat FAQs.

export type ChatMessage = { role: "user" | "assistant"; content: string };

const DAILY_LIMIT = 30;
const MAX_HISTORY = 10;
const FALLBACK_MODEL = "gemini-2.0-flash";
const REQUEST_TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT = `You are the Khalis Doodh support assistant. Khalis Doodh is a verification-first online marketplace in Punjab, Pakistan that connects households (customers) with local milkmen (gwalas) for daily fresh milk delivery.

Answer ONLY from the facts below. Never invent prices, fee amounts, features, cities or policies that are not stated here.

FACTS:
- Customers are 100% FREE. Customers never pay the platform anything — no fee, no commission, ever.
- How subscribing works: the customer picks their city and area, chooses a verified gwala, selects litres per day, delivery days and a weekly or monthly plan, and sends the request. The gwala accepts it, then daily deliveries start.
- Khata (monthly ledger): milk is paid POSTPAID, monthly. The customer pays the GWALA directly at the end of the month (cash, Easypaisa, JazzCash or bank transfer — between customer and gwala). The platform NEVER holds or takes the milk money and there is no wallet. The app only keeps the shared hisaab (khata): every delivered delivery is recorded with date, litres and amount, and both sides can see the same record. No delivery = no entry = no charge. Paused or skipped days are not charged.
- Pause/cancel: a customer can pause, resume or cancel their subscription from their account dashboard.
- Milk price: each gwala sets his own per-litre price; it is shown on his card on the Subscribe page. The platform does not fix milk prices.
- Becoming a gwala: use "Sign Up as Gwala" on the signup page, then complete enrollment with CNIC and area-proof documents. The admin verifies the documents before the gwala goes live. Customer and gwala accounts are separate: a customer account can never become a gwala account — a person who wants to sell must create a NEW gwala account.
- Login is email + password for everyone.
- Platform income (if asked): gwalas pay the platform a flat monthly base subscription fee, and a separate product-listing subscription (1-week or 1-month plans) if they want to list dairy products. These are flat subscriptions, NOT a commission — the platform takes no percentage of any sale. Fee amounts are NOT final yet: if anyone asks the amount, say exactly this idea in their language: fees abhi tay ho rahi hain (the amounts are being decided and will be announced soon). Never state or guess a number.
- Dairy products: gwalas with an active product-listing subscription can list products like dahi (yogurt), desi ghee, makhan (butter) and anday (eggs). Customers order them in the app; the amount is added to the same monthly khata and paid to the gwala directly, like the milk.
- Ratings: a customer can rate a gwala only ONCE per rolling 30 days, and only if they received at least one delivery from that gwala in that period. A gwala with an average of 4.5 or more (with enough ratings) gets a "Top Rated" badge; a gwala with no ratings yet shows a "New" badge.
- Complaints and quality: a customer can file a complaint from their account (with details/photo). A single complaint is only recorded. The admin reviews complaints; when complaints from several different households form a pattern against one gwala, the admin decides — if a complaint is approved, that amount is deducted from the customer's khata (the gwala bears it through the khata deduction). Gwalas are CNIC-verified, and repeat quality problems can cost them their badge or their place on the platform. If a customer asks how a complaint about bad milk is verified, explain this record → pattern → admin decision process honestly; do not promise instant refunds.
- Support: signed-in users can also send a support ticket from the Help Center page.

RULES:
- Reply in the SAME language and script the user used: English, Urdu script (اردو), or Roman Urdu. Match the user, every time.
- Keep answers short, clear and friendly — usually 2 to 5 sentences. Use simple words.
- Only answer questions about Khalis Doodh. For unrelated topics, politely say you can only help with Khalis Doodh questions and offer a Khalis Doodh topic instead.
- Never invent a fee amount, milk price, delivery time or policy. If something is not covered in the facts, say you do not have that information and suggest the Help Center or a support ticket.`;

// Friendly bilingual fallbacks (Roman Urdu + English, matching the site's audience).
const NO_KEY_MESSAGE =
  "Muazrat, AI assistant abhi available nahi hai. Aap Help Center ke sawal-jawab dekh sakte hain ya sign in karke support ticket bhej sakte hain. / Sorry, the AI assistant is not available right now. Please check the Help Center FAQs or sign in and send a support ticket.";
const ERROR_MESSAGE =
  "Muazrat, abhi jawab nahi mil pa raha. Thodi dair baad dobara try karein, ya Help Center se support ticket bhej dein. / Sorry, I could not answer just now. Please try again shortly, or send a support ticket from the Help Center.";
const LIMIT_MESSAGE =
  "Aaj ke liye aap ke chat messages ki limit (30/day) poori ho gayi hai. Kal dobara baat kar sakte hain — tab tak Help Center aap ki madad ke liye hazir hai. / You have reached today's chat limit (30 messages/day). Please come back tomorrow — meanwhile the Help Center can help you.";

// ---- FAQ cache (identical single questions only) ---------------------------

const faqCache = new Map<string, string>();
const FAQ_CACHE_MAX = 200;

function cacheKey(question: string): string {
  return question.toLowerCase().replace(/\s+/g, " ").trim();
}

function cacheGet(key: string): string | undefined {
  return faqCache.get(key);
}

function cacheSet(key: string, reply: string) {
  if (faqCache.size >= FAQ_CACHE_MAX) {
    const oldest = faqCache.keys().next().value;
    if (oldest !== undefined) faqCache.delete(oldest);
  }
  faqCache.set(key, reply);
}

// ---- Daily usage cap (SQLite) ----------------------------------------------

async function incrementUsageAndCheck(identity: string): Promise<boolean> {
  const db = await getDb();
  const day = new Date().toISOString().slice(0, 10);
  const rows = await db.all<{ count: number }>(
    sql`SELECT count FROM ai_chat_usage WHERE identity = ${identity} AND day = ${day}`,
  );
  const current = rows[0]?.count ?? 0;
  if (current >= DAILY_LIMIT) return false;
  const now = Date.now();
  await db.run(sql`
    INSERT INTO ai_chat_usage (identity, day, count, updatedAt)
    VALUES (${identity}, ${day}, 1, ${now})
    ON CONFLICT(identity, day) DO UPDATE SET count = count + 1, updatedAt = ${now}
  `);
  return true;
}

// ---- Gemini call with key rotation ------------------------------------------

type GeminiResult = { ok: true; text: string } | { ok: false; status: number };

let lastGoodKeyIndex = 0;

async function callGeminiOnce(apiKey: string, model: string, history: ChatMessage[]): Promise<GeminiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: history.map(message => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: { maxOutputTokens: 600, temperature: 0.4 },
        }),
      },
    );
    if (!response.ok) return { ok: false, status: response.status };
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map(part => part.text ?? "")
      .join("")
      .trim();
    if (!text) return { ok: false, status: 502 };
    return { ok: true, text };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiWithRotation(history: ChatMessage[]): Promise<string | null> {
  const keys = ENV.geminiApiKeys;
  if (keys.length === 0) return null;
  const models = [ENV.geminiModel, FALLBACK_MODEL].filter(
    (model, index, all) => all.indexOf(model) === index,
  );
  for (const model of models) {
    let allNetworkFailures = true;
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const keyIndex = (lastGoodKeyIndex + attempt) % keys.length;
      const result = await callGeminiOnce(keys[keyIndex], model, history);
      if (result.ok) {
        lastGoodKeyIndex = keyIndex;
        return result.text;
      }
      if (result.status !== 0) allNetworkFailures = false;
      // 404 = model not available on this key/account: stop rotating keys for
      // this model and fall through to the fallback model.
      if (result.status === 404) break;
      // Other errors (429 quota, 403, 5xx, network): try the next key.
    }
    // If every key failed at the network level (timeout/unreachable), the
    // fallback model would fail the same way — stop instead of doubling the wait.
    if (allNetworkFailures) break;
  }
  return null;
}

// ---- Public entry point ------------------------------------------------------

export async function chatWithAssistant(
  identity: string,
  messages: ChatMessage[],
): Promise<{ reply: string }> {
  const history = messages
    .filter(message => (message.role === "user" || message.role === "assistant") && message.content.trim())
    .slice(-MAX_HISTORY)
    .map(message => ({ role: message.role, content: message.content.trim().slice(0, 2000) }));

  const lastUser = [...history].reverse().find(message => message.role === "user");
  if (!lastUser) {
    return { reply: "Assalam-o-Alaikum! Khalis Doodh ke baray mein apna sawal likhein — subscription, khata, gwala ya rating, mein madad karta hun." };
  }

  // Identical fresh questions are served from the FAQ cache at no API cost.
  const isFreshQuestion = history.length === 1;
  const key = cacheKey(lastUser.content);
  if (isFreshQuestion) {
    const cached = cacheGet(key);
    if (cached) return { reply: cached };
  }

  if (ENV.geminiApiKeys.length === 0) {
    return { reply: NO_KEY_MESSAGE };
  }

  const allowed = await incrementUsageAndCheck(identity);
  if (!allowed) return { reply: LIMIT_MESSAGE };

  const text = await callGeminiWithRotation(history);
  if (!text) return { reply: ERROR_MESSAGE };

  if (isFreshQuestion) cacheSet(key, text);
  return { reply: text };
}
