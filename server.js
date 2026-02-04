import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { OpenRouter } from "@openrouter/sdk";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const UPLOADS_DIR = path.join(__dirname, "public", "uploads");

try {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (err) {
  // ignore if exists
}
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5";

const ALLOWED_MODELS = [
  { id: "moonshotai/kimi-k2.5:nitro", label: "Kimi K2.5" },
  { id: "deepseek/deepseek-v3.2:nitro", label: "DeepSeek V3.2" },
  // { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image" }
];
const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map((m) => m.id);

const getModel = (modelFromRequest) => {
  if (modelFromRequest && ALLOWED_MODEL_IDS.includes(modelFromRequest)) {
    return modelFromRequest;
  }
  return DEFAULT_MODEL;
};

const createOpenRouterClient = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }
  const defaultHeaders = {};
  if (process.env.OPENROUTER_HTTP_REFERER) {
    defaultHeaders["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
  }
  if (process.env.OPENROUTER_X_TITLE) {
    defaultHeaders["X-Title"] = process.env.OPENROUTER_X_TITLE;
  }
  return new OpenRouter({ apiKey, defaultHeaders });
};

let openRouterClient = null;

const getOpenRouter = () => {
  if (!openRouterClient) {
    openRouterClient = createOpenRouterClient();
  }
  return openRouterClient;
};

console.log({ DEFAULT_MODEL, ALLOWED_MODEL_IDS });
const USD_TO_RUB_RATE = Number(process.env.USD_TO_RUB_RATE) || 90;
const USD_RATE_API =
  process.env.USD_RATE_API || "https://open.er-api.com/v6/latest/USD";
const USD_RATE_CACHE_MS = Number(process.env.USD_RATE_CACHE_MS) || 10 * 60 * 1000;
const COMMISSION_MULTIPLIER = Number(process.env.COMMISSION_MULTIPLIER) || 1.5;

const SYSTEM_PROMPTS_BY_MODEL = {
  "moonshotai/kimi-k2.5":
    "Ты — Kimi K2.5. На вопросы о версии или имени всегда отвечай: Kimi K2.5. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "deepseek/deepseek-v3.2":
    "Ты — DeepSeek V3.2. На вопросы о версии или имени всегда отвечай: DeepSeek V3.2. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "google/gemini-3-pro-image-preview":
    "Ты — Gemini 3 Pro Image. Модель для анализа и генерации изображений. На вопросы о версии или имени отвечай: Gemini 3 Pro Image. Поддерживаешь ввод и вывод изображений, описание картинок и генерацию по текстовому запросу."
};

const getSystemPromptForModel = (modelId) => {
  return (
    SYSTEM_PROMPTS_BY_MODEL[modelId] ||
    SYSTEM_PROMPTS_BY_MODEL["moonshotai/kimi-k2.5"]
  );
};

const conversations = new Map();

const generateId = () => {
  return Math.random().toString(36).slice(2, 10);
};

const createConversation = ({ title, system }) => {
  const id = generateId();
  const now = new Date().toISOString();
  const messages = [];

  messages.push({
    role: "system",
    content: getSystemPromptForModel(DEFAULT_MODEL)
  });

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

const dropLeadingSystemMessages = (messages) => {
  let i = 0;
  while (i < messages.length && messages[i].role === "system") {
    i++;
  }
  return messages.slice(i);
};

const buildUserMessageContent = (messageText, imageUrls = []) => {
  if (!imageUrls || imageUrls.length === 0) {
    return messageText;
  }
  const parts = [{ type: "text", text: messageText || "" }];
  for (const url of imageUrls) {
    if (url && typeof url === "string") {
      parts.push({ type: "image_url", imageUrl: { url } });
    }
  }
  return parts;
};

const buildMessagesPayload = (conversation, userMessageContent, modelId) => {
  const systemPrompt = getSystemPromptForModel(modelId);
  const withoutLeadingSystem = dropLeadingSystemMessages(conversation.messages);
  const messages = [
    { role: "system", content: systemPrompt },
    ...withoutLeadingSystem,
    { role: "user", content: userMessageContent }
  ];
  return messages;
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

const normalizeMessageContent = (content) => {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0];
    if (typeof first === "string") {
      return first;
    }
    if (first?.text) {
      return first.text;
    }
  }
  return "";
};

const generateTitle = async ({ model, message }) => {
  const client = getOpenRouter();
  if (!client) {
    return null;
  }

  const titleMessages = [
    {
      role: "system",
      content:
        "Сформулируй короткое название диалога (3-6 слов, до 40 символов). Одна строка. Без кавычек и точек."
    },
    { role: "user", content: message }
  ];

  try {
    const result = await client.chat.send({
      model,
      messages: titleMessages,
      temperature: 0.2,
      stream: false
    });

    const content = result?.choices?.[0]?.message?.content;
    return normalizeTitle(normalizeMessageContent(content));
  } catch (err) {
    return null;
  }
};

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

const mimeToExt = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp"
};

app.post("/api/upload-images", (req, res) => {
  const { images: bodyImages } = req.body || {};
  const dataUrls = Array.isArray(bodyImages) ? bodyImages : [];
  if (dataUrls.length === 0) {
    return res.status(400).json({ error: "images array required" });
  }
  const urls = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const dataUrl = dataUrls[i];
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      continue;
    }
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      continue;
    }
    const mime = `image/${match[1].toLowerCase()}`;
    const ext = mimeToExt[mime] || ".bin";
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");
    const name = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, name);
    try {
      fs.writeFileSync(filePath, buffer);
    } catch (err) {
      return res.status(500).json({ error: "Failed to save image" });
    }
    urls.push(`${PUBLIC_URL}/uploads/${name}`);
  }
  return res.json({ urls });
});

app.get("/api/models", (req, res) => {
  return res.json({ models: ALLOWED_MODELS });
});

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

const sendSSE = (res, event, data) => {
  const payload =
    typeof data === "string" ? data : JSON.stringify(data);
  res.write(`event: ${event}\ndata: ${payload}\n\n`);
};

/** Ошибки при вызове OpenRouter API — в ответ добавляем source: "openrouter" */
const openRouterErrorJson = (message) => ({
  error: message,
  source: "openrouter"
});

app.post("/api/conversations/:id/messages", async (req, res) => {
  const conversation = conversations.get(req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const { message, model: bodyModel, images: bodyImages } = req.body || {};
  const messageText = typeof message === "string" ? message : "";
  const imageUrls = Array.isArray(bodyImages) ? bodyImages : [];
  if (!messageText.trim() && imageUrls.length === 0) {
    return res.status(400).json({ error: "message or images required" });
  }

  const client = getOpenRouter();
  if (!client) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not set" });
  }

  const model = getModel(bodyModel);
  const userMessageContent = buildUserMessageContent(messageText, imageUrls);
  const messages = buildMessagesPayload(conversation, userMessageContent, model);
  const isFirstUserMessage = !hasUserMessages(conversation);

  conversation.messages.push({ role: "user", content: userMessageContent });

  let stream;
  try {
    stream = await client.chat.send({
      model,
      messages,
      stream: true,
      provider: {
        sort: 'latency'
      }
    });
  } catch (error) {
    conversation.messages.pop();
    const errMessage = error?.message || "Request failed";
    return res.status(500).json(openRouterErrorJson(errMessage));
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let fullContent = "";
  let lastUsage = null;
  let streamError = null;

  try {
    for await (const chunk of stream) {
      if (chunk?.done) {
        break;
      }
      if (chunk?.error) {
        streamError = chunk.error;
        sendSSE(res, "error", openRouterErrorJson(
          chunk.error?.message ?? "Stream error"
        ));
        break;
      }
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === "string") {
        fullContent += delta;
        sendSSE(res, "delta", { delta });
      }
      if (chunk?.usage) {
        lastUsage = chunk.usage;
      }
    }
  } catch (err) {
    streamError = err;
    sendSSE(res, "error", openRouterErrorJson(
      err?.message ?? "Stream failed"
    ));
  }

  if (streamError) {
    conversation.messages.pop();
    res.end();
    return;
  }

  const text = normalizeMessageContent(fullContent) ?? "";
  const costUsd =
    typeof lastUsage?.cost === "number"
      ? lastUsage.cost
      : extractCostUsd({ usage: lastUsage });
  const rate = await getUsdToRubRate();
  const { costRub, costRubFinal } = calculateRub(
    costUsd,
    rate,
    COMMISSION_MULTIPLIER
  );
  conversation.messages.push({
    role: "assistant",
    content: text,
    meta: { costUsd, costRub, costRubFinal, rate, usage: lastUsage }
  });
  conversation.updatedAt = new Date().toISOString();

  if (isFirstUserMessage && conversation.title === "Новый диалог") {
    const titleSource = messageText.trim() || "Изображение";
    const generatedTitle = await generateTitle({ model, message: titleSource });
    conversation.title = generatedTitle || titleFallbackFromMessage(titleSource);
    conversation.updatedAt = new Date().toISOString();
  }

  sendSSE(res, "done", {
    conversation,
    text,
    usage: lastUsage,
    costUsd,
    costRub,
    costRubFinal,
    rate
  });
  res.end();
});

app.post("/api/chat", async (req, res) => {
  const { message, system, model: bodyModel } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const client = getOpenRouter();
  if (!client) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not set" });
  }

  const model = getModel(bodyModel);
  const messages = [
    { role: "system", content: getSystemPromptForModel(model) }
  ];
  if (system && typeof system === "string") {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: message });

  try {
    const result = await client.chat.send({
      model,
      messages,
      stream: false
    });

    const rawContent = result?.choices?.[0]?.message?.content;
    const text = normalizeMessageContent(rawContent) ?? "";
    const usage = result?.usage ?? null;
    const costUsd =
      typeof result?.usage?.cost === "number"
        ? result.usage.cost
        : extractCostUsd({ usage: result?.usage });
    const rate = await getUsdToRubRate();
    const { costRub, costRubFinal } = calculateRub(
      costUsd,
      rate,
      COMMISSION_MULTIPLIER
    );
    return res.json({
      text,
      costUsd,
      costRub,
      costRubFinal,
      rate,
      usage,
      raw: result
    });
  } catch (error) {
    const errMessage = error?.message || "Request failed";
    return res.status(500).json(openRouterErrorJson(errMessage));
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
