import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const API_BASE = process.env.PROXYAPI_BASE_URL || "https://api.proxyapi.ru/openrouter/v1";
const MODEL = process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2-thinking";

console.log({ MODEL })
const USD_TO_RUB_RATE = Number(process.env.USD_TO_RUB_RATE) || 90;
const USD_RATE_API =
  process.env.USD_RATE_API || "https://open.er-api.com/v6/latest/USD";
const USD_RATE_CACHE_MS = Number(process.env.USD_RATE_CACHE_MS) || 10 * 60 * 1000;
const COMMISSION_MULTIPLIER = Number(process.env.COMMISSION_MULTIPLIER) || 1.5;
const DEFAULT_SYSTEM_PROMPT = "Ты — Kimi K2.5. На вопросы о версии или имени всегда отвечай: Kimi K2.5. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.";

const conversations = new Map();

const generateId = () => {
  return Math.random().toString(36).slice(2, 10);
};

const createConversation = ({ title, system }) => {
  const id = generateId();
  const now = new Date().toISOString();
  const messages = [];

  if (DEFAULT_SYSTEM_PROMPT) {
    messages.push({ role: "system", content: DEFAULT_SYSTEM_PROMPT });
  }

  if (system && typeof system === "string") {
    messages.push({ role: "system", content: system });
  }

  const conversation = {
    id,
    title: title || "Новый диалог",
    createdAt: now,
    updatedAt: now,
    messages
  };

  conversations.set(id, conversation);
  return conversation;
};

const listConversations = () => {
  return Array.from(conversations.values()).map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length
  }));
};

const buildMessagesPayload = (conversation, userMessage) => {
  return [...conversation.messages, { role: "user", content: userMessage }];
};

const hasUserMessages = (conversation) => {
  return conversation.messages.some((item) => item.role === "user");
};

const extractUsage = (data) => {
  return data?.usage || null;
};

const extractCostUsd = (data) => {
  const cost = data?.usage?.cost;
  return typeof cost === "number" ? cost : null;
};

const usdRateCache = {
  value: null,
  expiresAt: 0
};

const getUsdToRubRate = async () => {
  const now = Date.now();
  if (usdRateCache.value && now < usdRateCache.expiresAt) {
    return usdRateCache.value;
  }

  try {
    const response = await fetch(USD_RATE_API);
    const data = await response.json().catch(() => ({}));
    const rate = data?.rates?.RUB;
    if (typeof rate === "number" && !Number.isNaN(rate)) {
      usdRateCache.value = rate;
      usdRateCache.expiresAt = now + USD_RATE_CACHE_MS;
      return rate;
    }
  } catch (error) {
    // ignore and fallback
  }

  usdRateCache.value = USD_TO_RUB_RATE;
  usdRateCache.expiresAt = now + USD_RATE_CACHE_MS;
  return USD_TO_RUB_RATE;
};

const calculateRub = (costUsd, rate, multiplier) => {
  if (typeof costUsd !== "number" || Number.isNaN(costUsd)) {
    return { costRub: null, costRubFinal: null };
  }
  const costRub = costUsd * rate;
  return {
    costRub,
    costRubFinal: costRub * multiplier
  };
};

const normalizeTitle = (value) => {
  if (!value) {
    return null;
  }
  const cleaned = String(value)
    .replaceAll(/[`*_#>\n\r]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return null;
  }
  return cleaned.slice(0, 40);
};

const titleFallbackFromMessage = (message) => {
  const fallback = normalizeTitle(message);
  return fallback ? fallback.slice(0, 40) : "Новый диалог";
};

const generateTitle = async ({ apiKey, message }) => {
  const titleMessages = [
    {
      role: "system",
      content:
        "Сформулируй короткое название диалога (3-6 слов, до 40 символов). Одна строка. Без кавычек и точек."
    },
    { role: "user", content: message }
  ];

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: titleMessages,
      temperature: 0.2
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return null;
  }

  return normalizeTitle(data?.choices?.[0]?.message?.content);
};

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/conversations", (req, res) => {
  return res.json({ conversations: listConversations() });
});

app.post("/api/conversations", (req, res) => {
  const { title, system } = req.body || {};
  const conversation = createConversation({ title, system });
  return res.status(201).json({ conversation });
});

app.get("/api/conversations/:id", (req, res) => {
  const conversation = conversations.get(req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  return res.json({ conversation });
});

app.post("/api/conversations/:id/messages", async (req, res) => {
  const conversation = conversations.get(req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const { message } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const apiKey = process.env.PROXYAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "PROXYAPI_KEY is not set" });
  }

  const messages = buildMessagesPayload(conversation, message);
  const isFirstUserMessage = !hasUserMessages(conversation);

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model: MODEL, messages })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Upstream error",
        details: data
      });
    }

    const text = data?.choices?.[0]?.message?.content ?? "";
    const usage = extractUsage(data);
    const costUsd = extractCostUsd(data);
    const rate = await getUsdToRubRate();
    const { costRub, costRubFinal } = calculateRub(costUsd, rate, COMMISSION_MULTIPLIER);
    conversation.messages.push({ role: "user", content: message });
    conversation.messages.push({
      role: "assistant",
      content: text,
      meta: { costUsd, costRub, costRubFinal, rate, usage }
    });
    conversation.updatedAt = new Date().toISOString();

    if (isFirstUserMessage && conversation.title === "Новый диалог") {
      const generatedTitle = await generateTitle({ apiKey, message });
      conversation.title = generatedTitle || titleFallbackFromMessage(message);
      conversation.updatedAt = new Date().toISOString();
    }

    return res.json({
      text,
      conversation,
      costUsd,
      costRub,
      costRubFinal,
      rate,
      usage,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({ error: "Request failed" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, system } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const apiKey = process.env.PROXYAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "PROXYAPI_KEY is not set" });
  }

  const messages = [];
  if (DEFAULT_SYSTEM_PROMPT) {
    messages.push({ role: "system", content: DEFAULT_SYSTEM_PROMPT });
  }
  if (system && typeof system === "string") {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: message });

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model: MODEL, messages })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Upstream error",
        details: data
      });
    }

    const text = data?.choices?.[0]?.message?.content ?? "";
    const usage = extractUsage(data);
    const costUsd = extractCostUsd(data);
    const rate = await getUsdToRubRate();
    const { costRub, costRubFinal } = calculateRub(costUsd, rate, COMMISSION_MULTIPLIER);
    return res.json({ text, costUsd, costRub, costRubFinal, rate, usage, raw: data });
  } catch (error) {
    return res.status(500).json({ error: "Request failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
