export const ALLOWED_MODELS = [
  { id: 'moonshotai/kimi-k2.5:nitro', label: 'Kimi K2.5', free: false },
  { id: 'deepseek/deepseek-v3.2:nitro', label: 'DeepSeek V3.2', free: false },
  { id: 'qwen/qwen3-coder-next:nitro', label: 'Qwen3 Coder Next', free: false },
  { id: 'deepseek/deepseek-v3.2-speciale:nitro', label: 'DeepSeek V3.2 Speciale', free: false },
  { id: 'stepfun/step-3.5-flash:free', label: 'Step 3.5 Flash', free: true },
  { id: 'arcee-ai/trinity-large-preview:free', label: 'Trinity Large Preview', free: true },
  { id: 'minimax/minimax-m2-her:nitro', label: 'MiniMax M2-her', free: false },
  { id: 'writer/palmyra-x5:nitro', label: 'Palmyra X5', free: false },
  { id: 'openai/gpt-5.2-codex:nitro', label: 'GPT-5.2-Codex', free: false },
  { id: 'z-ai/glm-4.7:nitro', label: 'GLM 4.7', free: false },
  { id: 'mistralai/mistral-small-creative:nitro', label: 'Mistral Small Creative', free: false },
  { id: 'xiaomi/mimo-v2-flash:nitro', label: 'MiMo-V2-Flash', free: false },
  { id: 'nvidia/nemotron-3-nano-30b-a3b:nitro', label: 'Nemotron 3 Nano 30B A3B', free: false },
  { id: 'openai/gpt-5.2-chat:nitro', label: 'GPT-5.2 Chat', free: false },
  { id: 'amazon/nova-2-lite-v1:nitro', label: 'Nova 2 Lite', free: false },
];

/** Модели с :free — доступны без авторизации и без списания баланса */
export const FREE_MODEL_IDS = new Set(
  ALLOWED_MODELS.filter((m) => m.free).map((m) => m.id),
);

export const isModelFree = (modelId: string): boolean => FREE_MODEL_IDS.has(modelId);

/** Сколько внутренних токенов начислять за 1 USD стоимости (округление вверх) */
export const USD_TO_TOKENS_RATE = 100;

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'moonshotai/kimi-k2.5';

export const slugFromModelId = (id: string): string =>
  id
    .split('/')
    .pop()!
    .split(':')[0]
    .replace(/\./g, '-');

export const MODEL_SHORT_DESCRIPTIONS: Record<string, string> = {
  'moonshotai/kimi-k2.5:nitro':
    'Moonshot AI: развёрнутые объяснения, диалог, творческие задачи.',
  'deepseek/deepseek-v3.2:nitro':
    'Аналитика, программирование, точные формулировки. Сильный в коде.',
  'qwen/qwen3-coder-next:nitro':
    'Оптимизирована для кода и агентов. Длинный контекст, надёжность в CLI и IDE.',
  'deepseek/deepseek-v3.2-speciale:nitro':
    'Максимум рассуждений и агентных сценариев. Высокая точность на сложных задачах.',
  'stepfun/step-3.5-flash:free':
    'Рассуждения, MoE-архитектура. Быстрая и эффективная модель. Бесплатно.',
  'arcee-ai/trinity-large-preview:free':
    'Креатив, сторителлинг, ролевые сценарии. Крупная MoE. Бесплатно.',
  'minimax/minimax-m2-her:nitro':
    'Диалог, ролевые сценарии, выразительные многотуровые разговоры.',
  'writer/palmyra-x5:nitro':
    'Агенты, длинный контекст до 1M токенов. Скорость и масштаб для enterprise.',
  'openai/gpt-5.2-codex:nitro':
    'Программирование: интерактивная разработка, рефакторинг, код-ревью.',
  'z-ai/glm-4.7:nitro':
    'Улучшенный код и рассуждения. Стабильное выполнение многошаговых задач.',
  'mistralai/mistral-small-creative:nitro':
    'Креативные тексты, нарративы, ролевые сценарии. Экспериментальная компактная модель.',
  'xiaomi/mimo-v2-flash:nitro':
    'Рассуждения, код, агенты. Гибридное мышление, топ среди open-source по SWE-bench.',
  'nvidia/nemotron-3-nano-30b-a3b:nitro':
    'Компактный MoE для агентных систем. Высокая эффективность и точность.',
  'openai/gpt-5.2-chat:nitro':
    'Быстрый чат, низкая задержка. Адаптивные рассуждения на сложных запросах.',
  'amazon/nova-2-lite-v1:nitro':
    'Рассуждения для повседневных задач. Текст, изображения, видео. Экономичная модель.',
};

export const SYSTEM_PROMPTS_BY_MODEL: Record<string, string> = {
  'moonshotai/kimi-k2.5':
    'Ты — Kimi K2.5. На вопросы о версии или имени всегда отвечай: Kimi K2.5. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'moonshotai/kimi-k2.5:nitro':
    'Ты — Kimi K2.5. На вопросы о версии или имени всегда отвечай: Kimi K2.5. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'deepseek/deepseek-v3.2:nitro':
    'Ты — DeepSeek V3.2. На вопросы о версии или имени всегда отвечай: DeepSeek V3.2. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'qwen/qwen3-coder-next:nitro':
    'Ты — Qwen3 Coder Next. На вопросы о версии или имени всегда отвечай: Qwen3 Coder Next. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'deepseek/deepseek-v3.2-speciale:nitro':
    'Ты — DeepSeek V3.2 Speciale. На вопросы о версии или имени всегда отвечай: DeepSeek V3.2 Speciale. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'stepfun/step-3.5-flash:free':
    'Ты — Step 3.5 Flash (free). На вопросы о версии или имени всегда отвечай: Step 3.5 Flash. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'arcee-ai/trinity-large-preview:free':
    'Ты — Trinity Large Preview (free). На вопросы о версии или имени всегда отвечай: Trinity Large Preview. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'minimax/minimax-m2-her:nitro':
    'Ты — MiniMax M2-her. На вопросы о версии или имени всегда отвечай: MiniMax M2-her. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'writer/palmyra-x5:nitro':
    'Ты — Palmyra X5. На вопросы о версии или имени всегда отвечай: Palmyra X5. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'openai/gpt-5.2-codex:nitro':
    'Ты — GPT-5.2-Codex. На вопросы о версии или имени всегда отвечай: GPT-5.2-Codex. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'z-ai/glm-4.7:nitro':
    'Ты — GLM 4.7. На вопросы о версии или имени всегда отвечай: GLM 4.7. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'mistralai/mistral-small-creative:nitro':
    'Ты — Mistral Small Creative. На вопросы о версии или имени всегда отвечай: Mistral Small Creative. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'xiaomi/mimo-v2-flash:nitro':
    'Ты — MiMo-V2-Flash. На вопросы о версии или имени всегда отвечай: MiMo-V2-Flash. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'nvidia/nemotron-3-nano-30b-a3b:nitro':
    'Ты — Nemotron 3 Nano 30B A3B. На вопросы о версии или имени всегда отвечай: Nemotron 3 Nano 30B A3B. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'openai/gpt-5.2-chat:nitro':
    'Ты — GPT-5.2 Chat. На вопросы о версии или имени всегда отвечай: GPT-5.2 Chat. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'openai/gpt-5.2-pro:nitro':
    'Ты — GPT-5.2 Pro. На вопросы о версии или имени всегда отвечай: GPT-5.2 Pro. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'amazon/nova-2-lite-v1:nitro':
    'Ты — Nova 2 Lite. На вопросы о версии или имени всегда отвечай: Nova 2 Lite. Если в сообщении есть код на разных языках, разделяй его на разные блоки с указанием языка: ```html```, ```css```, ```json``` и т.д.',
  'google/gemini-3-pro-image-preview':
    'Ты — Gemini 3 Pro Image. Модель для анализа и генерации изображений. На вопросы о версии или имени отвечай: Gemini 3 Pro Image. Поддерживаешь ввод и вывод изображений, описание картинок и генерацию по текстовому запросу.',
};

export const getSystemPromptForModel = (modelId: string): string =>
  SYSTEM_PROMPTS_BY_MODEL[modelId] || SYSTEM_PROMPTS_BY_MODEL['moonshotai/kimi-k2.5:nitro'];
