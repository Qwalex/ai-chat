import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { OpenRouter } from "@openrouter/sdk";
import { marked } from "marked";
import { writeLog } from "./utils/writeLog.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
const IMAGES_DIR = path.join(__dirname, "public", "images");
const BLOG_DIR = path.join(__dirname, "blog");

try {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (err) {
  // ignore if exists
}
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5";

const ALLOWED_MODELS = [
  { id: "moonshotai/kimi-k2.5:nitro", label: "Kimi K2.5" },
  { id: "deepseek/deepseek-v3.2:nitro", label: "DeepSeek V3.2" },
  { id: "qwen/qwen3-coder-next:nitro", label: "Qwen3 Coder Next" },
  { id: "deepseek/deepseek-v3.2-speciale:nitro", label: "DeepSeek V3.2 Speciale" },
  { id: "stepfun/step-3.5-flash:free", label: "Step 3.5 Flash" },
  { id: "arcee-ai/trinity-large-preview:free", label: "Trinity Large Preview" },
  { id: "minimax/minimax-m2-her:nitro", label: "MiniMax M2-her" },
  { id: "writer/palmyra-x5:nitro", label: "Palmyra X5" },
  { id: "openai/gpt-5.2-codex:nitro", label: "GPT-5.2-Codex" },
  { id: "z-ai/glm-4.7:nitro", label: "GLM 4.7" },
  { id: "mistralai/mistral-small-creative:nitro", label: "Mistral Small Creative" },
  { id: "xiaomi/mimo-v2-flash:nitro", label: "MiMo-V2-Flash" },
  { id: "nvidia/nemotron-3-nano-30b-a3b:nitro", label: "Nemotron 3 Nano 30B A3B" },
  { id: "openai/gpt-5.2-chat:nitro", label: "GPT-5.2 Chat" },
  // { id: "openai/gpt-5.2-pro:nitro", label: "GPT-5.2 Pro" },
  { id: "amazon/nova-2-lite-v1:nitro", label: "Nova 2 Lite" },
];
const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map((m) => m.id);

/** slug для URL страницы модели: moonshotai/kimi-k2.5:nitro → kimi-k2-5 */
const slugFromModelId = (id) =>
  id
    .split("/")
    .pop()
    .split(":")[0]
    .replace(/\./g, "-");

/** SEO-контент для страницы одной модели */
const buildModelPageSeo = (label) => ({
  title: `${label} — ИИ онлайн бесплатно, AI онлайн | Чат с ИИ`,
  description: `${label} — ИИ онлайн бесплатно, AI бесплатно. Чат с нейросетью ${label}. Ответы с подсветкой кода, история диалогов, быстрый старт без регистрации.`,
  h2: `${label} — ИИ онлайн бесплатно, ответы и идеи от нейросети`,
  paragraphs: [
    `${label} — ИИ онлайн бесплатно: модель для общения в одном окне. AI онлайн без регистрации: формулируйте вопросы, уточняйте детали и получайте структурированные ответы. Подходит для учёбы, работы, кода и генерации идей.`,
    "ИИ бесплатно онлайн: интерфейс поддерживает историю диалогов, системный промпт и контекст — для студентов, разработчиков и менеджеров.",
    "AI бесплатно: уточняйте термины, проверяйте гипотезы, составляйте планы и получайте краткие резюме. Ответы отображаются с подсветкой кода и форматированием.",
    `Используйте ИИ онлайн с ${label} для повседневных задач: от переписки до разбора сложных тем. AI онлайн бесплатно помогает экономить время и быстрее находить нужную информацию.`
  ],
  listItems: [
    `${label} — ИИ онлайн бесплатно, чат на русском языке`,
    "AI онлайн, AI бесплатно — структурированные ответы и краткие выводы",
    "ИИ бесплатно — быстрый старт без регистрации",
    "подходит для учёбы, работы и творчества"
  ]
});

/** Краткое описание модели для блока ссылок на главной (по смыслу с openrouter.ai/models) */
const MODEL_SHORT_DESCRIPTIONS = {
  "moonshotai/kimi-k2.5:nitro":
    "Moonshot AI: развёрнутые объяснения, диалог, творческие задачи.",
  "deepseek/deepseek-v3.2:nitro":
    "Аналитика, программирование, точные формулировки. Сильный в коде.",
  "qwen/qwen3-coder-next:nitro":
    "Оптимизирована для кода и агентов. Длинный контекст, надёжность в CLI и IDE.",
  "deepseek/deepseek-v3.2-speciale:nitro":
    "Максимум рассуждений и агентных сценариев. Высокая точность на сложных задачах.",
  "stepfun/step-3.5-flash:free":
    "Рассуждения, MoE-архитектура. Быстрая и эффективная модель. Бесплатно.",
  "arcee-ai/trinity-large-preview:free":
    "Креатив, сторителлинг, ролевые сценарии. Крупная MoE. Бесплатно.",
  "minimax/minimax-m2-her:nitro":
    "Диалог, ролевые сценарии, выразительные многотуровые разговоры.",
  "writer/palmyra-x5:nitro":
    "Агенты, длинный контекст до 1M токенов. Скорость и масштаб для enterprise.",
  "openai/gpt-5.2-codex:nitro":
    "Программирование: интерактивная разработка, рефакторинг, код-ревью.",
  "z-ai/glm-4.7:nitro":
    "Улучшенный код и рассуждения. Стабильное выполнение многошаговых задач.",
  "mistralai/mistral-small-creative:nitro":
    "Креативные тексты, нарративы, ролевые сценарии. Экспериментальная компактная модель.",
  "xiaomi/mimo-v2-flash:nitro":
    "Рассуждения, код, агенты. Гибридное мышление, топ среди open-source по SWE-bench.",
  "nvidia/nemotron-3-nano-30b-a3b:nitro":
    "Компактный MoE для агентных систем. Высокая эффективность и точность.",
  "openai/gpt-5.2-chat:nitro":
    "Быстрый чат, низкая задержка. Адаптивные рассуждения на сложных запросах.",
  "amazon/nova-2-lite-v1:nitro":
    "Рассуждения для повседневных задач. Текст, изображения, видео. Экономичная модель."
};

const MODEL_PAGES = ALLOWED_MODELS.map((m) => ({
  id: m.id,
  label: m.label,
  slug: slugFromModelId(m.id),
  shortDesc: MODEL_SHORT_DESCRIPTIONS[m.id] || `Чат с ${m.label}. Структурированные ответы, подсветка кода.`,
  seo: buildModelPageSeo(m.label)
}));
const MODEL_PAGE_BY_SLUG = new Map(MODEL_PAGES.map((p) => [p.slug, p]));

const escapeHtmlAttr = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** HTML блока со ссылками на страницы моделей для главной */
const buildModelLinksBlockHtml = () => {
  const items = MODEL_PAGES.map(
    (p) =>
      `<li class="model-link-item">
        <a href="/model/${escapeHtmlAttr(p.slug)}">${escapeHtmlAttr(p.label)}</a>
        <p class="model-link-desc">${escapeHtmlAttr(p.shortDesc)}</p>
      </li>`
  ).join("\n");
  return `<section class="model-links" id="model-links">
  <h2>Модели в чате</h2>
  <p class="model-links-intro">Перейдите на страницу модели — там свой SEO-текст и модель выбрана по умолчанию.</p>
  <ul class="model-links-list">${items}</ul>
</section>`;
};

/** Список статей блога из папки blog (файлы .md), slug = имя файла без расширения */
const listBlogPosts = () => {
  try {
    const files = fs.readdirSync(BLOG_DIR) || [];
    const posts = [];
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const slug = file.slice(0, -3);
      const filePath = path.join(BLOG_DIR, file);
      const raw = fs.readFileSync(filePath, "utf8");
      const firstLine = (raw.split("\n")[0] || "").replace(/^\uFEFF/, "").trim();
      const titleMatch = firstLine.match(/^#\s+(.+)$/);
      const title = titleMatch ? titleMatch[1].trim() : (firstLine.startsWith("#") ? firstLine.replace(/^#\s*/, "").trim() || slug : slug);
      posts.push({ slug, title });
    }
    return posts.sort((a, b) => a.slug.localeCompare(b.slug));
  } catch (err) {
    return [];
  }
};

/** Контент одной статьи по slug */
const getBlogPostBySlug = (slug) => {
  const safeSlug = path.basename(slug, ".md").replace(/[^a-z0-9_-]/gi, "");
  const filePath = path.join(BLOG_DIR, `${safeSlug}.md`);
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const firstLine = (raw.split("\n")[0] || "").replace(/^\uFEFF/, "").trim();
    const titleMatch = firstLine.match(/^#\s+(.+)$/);
    const title = titleMatch ? titleMatch[1].trim() : (firstLine.startsWith("#") ? firstLine.replace(/^#\s*/, "").trim() || safeSlug : safeSlug);
    const html = marked.parse(raw, { async: false });
    return { title, html };
  } catch (err) {
    return null;
  }
};

/** HTML блока «Блог» для главной (лента статей над блоком моделей) */
const buildBlogBlockHtml = () => {
  const posts = listBlogPosts();
  if (posts.length === 0) return "";
  const items = posts
    .slice(0, 10)
    .map(
      (p) =>
        `<li class="blog-feed-item"><a href="/blog/${escapeHtmlAttr(p.slug)}">${escapeHtmlAttr(p.title)}</a></li>`
    )
    .join("\n");
  return `<section class="blog-feed" id="blog-feed">
  <h2>Блог</h2>
  <p class="blog-feed-intro">Статьи и заметки — обзоры и мысли про ИИ и не только.</p>
  <ul class="blog-feed-list">${items}</ul>
  <p class="blog-feed-more"><a href="/blog">Все статьи →</a></p>
</section>`;
};

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
  "moonshotai/kimi-k2.5:nitro":
    "Ты — Kimi K2.5. На вопросы о версии или имени всегда отвечай: Kimi K2.5. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "deepseek/deepseek-v3.2:nitro":
    "Ты — DeepSeek V3.2. На вопросы о версии или имени всегда отвечай: DeepSeek V3.2. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "qwen/qwen3-coder-next:nitro":
    "Ты — Qwen3 Coder Next. На вопросы о версии или имени всегда отвечай: Qwen3 Coder Next. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "deepseek/deepseek-v3.2-speciale:nitro":
    "Ты — DeepSeek V3.2 Speciale. На вопросы о версии или имени всегда отвечай: DeepSeek V3.2 Speciale. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "stepfun/step-3.5-flash:free":
    "Ты — Step 3.5 Flash (free). На вопросы о версии или имени всегда отвечай: Step 3.5 Flash. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "arcee-ai/trinity-large-preview:free":
    "Ты — Trinity Large Preview (free). На вопросы о версии или имени всегда отвечай: Trinity Large Preview. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "minimax/minimax-m2-her:nitro":
    "Ты — MiniMax M2-her. На вопросы о версии или имени всегда отвечай: MiniMax M2-her. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "writer/palmyra-x5:nitro":
    "Ты — Palmyra X5. На вопросы о версии или имени всегда отвечай: Palmyra X5. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "openai/gpt-5.2-codex:nitro":
    "Ты — GPT-5.2-Codex. На вопросы о версии или имени всегда отвечай: GPT-5.2-Codex. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "z-ai/glm-4.7:nitro":
    "Ты — GLM 4.7. На вопросы о версии или имени всегда отвечай: GLM 4.7. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "mistralai/mistral-small-creative:nitro":
    "Ты — Mistral Small Creative. На вопросы о версии или имени всегда отвечай: Mistral Small Creative. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "xiaomi/mimo-v2-flash:nitro":
    "Ты — MiMo-V2-Flash. На вопросы о версии или имени всегда отвечай: MiMo-V2-Flash. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "nvidia/nemotron-3-nano-30b-a3b:nitro":
    "Ты — Nemotron 3 Nano 30B A3B. На вопросы о версии или имени всегда отвечай: Nemotron 3 Nano 30B A3B. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "openai/gpt-5.2-chat:nitro":
    "Ты — GPT-5.2 Chat. На вопросы о версии или имени всегда отвечай: GPT-5.2 Chat. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "openai/gpt-5.2-pro:nitro":
    "Ты — GPT-5.2 Pro. На вопросы о версии или имени всегда отвечай: GPT-5.2 Pro. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "amazon/nova-2-lite-v1:nitro":
    "Ты — Nova 2 Lite. На вопросы о версии или имени всегда отвечай: Nova 2 Lite. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.",
  "google/gemini-3-pro-image-preview":
    "Ты — Gemini 3 Pro Image. Модель для анализа и генерации изображений. На вопросы о версии или имени отвечай: Gemini 3 Pro Image. Поддерживаешь ввод и вывод изображений, описание картинок и генерацию по текстовому запросу."
};

const getSystemPromptForModel = (modelId) => {
  return (
    SYSTEM_PROMPTS_BY_MODEL[modelId] ||
    SYSTEM_PROMPTS_BY_MODEL["moonshotai/kimi-k2.5:nitro"]
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
    { role: "user", content: `Сформулируй короткое название диалога (3-6 слов, до 40 символов). Одна строка. Без кавычек и точек. По фразе: "${message}"` }
  ];

  try {
    const result = await client.chat.send({
      model: 'arcee-ai/trinity-large-preview:free',
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

const INDEX_HTML_PATH = path.join(__dirname, "public", "index.html");
const MODEL_LINKS_PLACEHOLDER = "{{MODEL_LINKS_BLOCK}}";
const BLOG_BLOCK_PLACEHOLDER = "{{BLOG_BLOCK}}";
const BLOG_PAGE_PATH = path.join(__dirname, "public", "blog-page.html");

app.get("/", (req, res) => {
  let html;
  try {
    html = fs.readFileSync(INDEX_HTML_PATH, "utf8");
  } catch (err) {
    return res.status(500).send("Index not found");
  }
  html = html.replace(BLOG_BLOCK_PLACEHOLDER, buildBlogBlockHtml());
  html = html.replace(MODEL_LINKS_PLACEHOLDER, buildModelLinksBlockHtml());
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

app.get("/model/:slug", (req, res) => {
  const page = MODEL_PAGE_BY_SLUG.get(req.params.slug);
  if (!page) {
    return res.redirect(302, "/");
  }
  let html;
  try {
    html = fs.readFileSync(INDEX_HTML_PATH, "utf8");
  } catch (err) {
    return res.status(500).send("Index not found");
  }
  const { label, id, seo } = page;
  const titleTag = `<title>${seo.title}</title>`;
  const metaDesc = `<meta name="description" content="${seo.description.replace(/"/g, "&quot;")}" />`;
  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    titleTag
  );
  if (!html.includes('name="description"')) {
    html = html.replace("</head>", `    ${metaDesc}\n  </head>`);
  } else {
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, metaDesc);
  }
  html = html.replace(
    /<h1>[\s\S]*?<\/h1>/,
    `<h1>${label} — ИИ онлайн бесплатно, AI онлайн</h1>`
  );
  const seoSectionHtml = `    <section class="seo">
      <h2>${seo.h2}</h2>
      ${seo.paragraphs.map((p) => `      <p>\n        ${p}\n      </p>`).join("\n")}
      <ul>
        ${seo.listItems.map((li) => `        <li>${li}</li>`).join("\n")}
      </ul>
    </section>`;
  html = html.replace(
    /<section class="seo">[\s\S]*?<\/section>/,
    seoSectionHtml
  );
  const defaultModelScript = `<script>window.__DEFAULT_MODEL_ID__ = ${JSON.stringify(id)};</script>\n    `;
  html = html.replace(
    /<script src="\/app\.js" defer><\/script>/,
    defaultModelScript + '<script src="/app.js" defer></script>'
  );
  html = html.replace(BLOG_BLOCK_PLACEHOLDER, buildBlogBlockHtml());
  html = html.replace(MODEL_LINKS_PLACEHOLDER, buildModelLinksBlockHtml());
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

app.get("/blog", (req, res) => {
  const posts = listBlogPosts();
  let html;
  try {
    html = fs.readFileSync(BLOG_PAGE_PATH, "utf8");
  } catch (err) {
    return res.status(500).send("Blog not found");
  }
  const listItems = posts
    .map(
      (p) =>
        `<li class="blog-list-item"><a href="/blog/${escapeHtmlAttr(p.slug)}">${escapeHtmlAttr(p.title)}</a></li>`
    )
    .join("\n");
  const content = `<h1>Блог</h1><ul class="blog-list">${listItems}</ul>`;
  html = html.replace("{{BLOG_TITLE}}", "Блог | Чат с ИИ");
  html = html.replace("{{BLOG_CONTENT}}", content);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

app.get("/blog/:slug", (req, res) => {
  const post = getBlogPostBySlug(req.params.slug);
  if (!post) {
    return res.redirect(302, "/blog");
  }
  let html;
  try {
    html = fs.readFileSync(BLOG_PAGE_PATH, "utf8");
  } catch (err) {
    return res.status(500).send("Blog not found");
  }
  html = html.replace("{{BLOG_TITLE}}", `${escapeHtmlAttr(post.title)} | Блог | Чат с ИИ`);
  html = html.replace("{{BLOG_CONTENT}}", `<article class="blog-article">${post.html}</article>`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(IMAGES_DIR, { maxAge: "1d" }));

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

  const apiKey = process.env.OPENROUTER_API_KEY;
  const openRouterHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };
  if (process.env.OPENROUTER_HTTP_REFERER) {
    openRouterHeaders["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
  }
  if (process.env.OPENROUTER_X_TITLE) {
    openRouterHeaders["X-Title"] = process.env.OPENROUTER_X_TITLE;
  }

  let openRouterRes;
  try {
    openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterHeaders,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        provider: { sort: "latency" },
        reasoning: { enabled: true }
      })
    });
  } catch (error) {
    conversation.messages.pop();
    const errMessage = error?.message || "Request failed";
    return res.status(500).json(openRouterErrorJson(errMessage));
  }

  if (!openRouterRes.ok) {
    conversation.messages.pop();
    const errBody = await openRouterRes.text();
    let errMessage = "Request failed";
    try {
      const errJson = JSON.parse(errBody);
      errMessage = errJson?.error?.message ?? errMessage;
    } catch (_) {
      // ignore
    }
    return res.status(openRouterRes.status).json(openRouterErrorJson(errMessage));
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let fullContent = "";
  /** Последний чанк из API — целиком, с полным usage (cost_details, prompt_tokens_details и т.д.) */
  let lastChunk = null;
  let streamError = null;

  try {
    const reader = openRouterRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = block.split(/\r\n|\n|\r/);
        const dataParts = [];
        for (const line of lines) {
          if (line.startsWith("data:")) {
            dataParts.push(line.slice(5).replace(/^\s/, ""));
          }
        }
        const dataStr = dataParts.join("\n").trim();
        if (!dataStr) continue;
        if (dataStr === "[DONE]") break;
        let chunk;
        try {
          chunk = JSON.parse(dataStr);
        } catch (_) {
          continue;
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
          lastChunk = chunk;
        }
      }
      if (streamError) break;
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

  const lastUsage = lastChunk?.usage ?? null;

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
  console.log(`Use ${model} to generate response: ${messageText}`);
  console.log(`Cost: $${costUsd} → ${costRub}₽ → ${costRubFinal}₽ (rate: ${rate})`);
  console.log('---')
  writeLog(`Use ${model} to generate response: ${messageText}`);
  writeLog(`Cost: $${costUsd} → ${costRub}₽ → ${costRubFinal}₽ (rate: ${rate})`);
  writeLog('---')
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

    console.log(`Use ${model} to generate response: ${message}`);

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
