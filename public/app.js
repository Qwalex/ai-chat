const form = document.querySelector("#chat-form");
const systemInput = document.querySelector("#system");
const messageInput = document.querySelector("#message");
const sendButton = document.querySelector("#send");
const history = document.querySelector("#history");
const chatList = document.querySelector("#chat-list");
const newChatButton = document.querySelector("#new-chat");
const modelSelect = document.querySelector("#model");
const imageUploadWrap = document.querySelector("#image-upload-wrap");
const imageInput = document.querySelector("#image-input");
const imagePreviews = document.querySelector("#image-previews");

const IMAGE_MODEL_ID = "google/gemini-3-pro-image-preview";

let currentConversationId = null;
let selectedImageFiles = [];
let lastMessages = [];
let streamingAssistantContent = null;
const pendingById = new Set();
const messageCacheById = new Map();
const pendingMessagesById = new Map();

const MAX_SEND_RETRIES = 5;
const RETRY_DELAY_MS = 1500;

const SESSION_KEY = "kimiChatSession";
const MODEL_KEY = "chatModel";

const loadSessionState = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return { conversationIds: [], activeId: null };
    }
    const data = JSON.parse(raw);
    return {
      conversationIds: Array.isArray(data.conversationIds) ? data.conversationIds : [],
      activeId: data.activeId || null
    };
  } catch (error) {
    return { conversationIds: [], activeId: null };
  }
};

const saveSessionState = (state) => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
};

const getSessionState = () => {
  return loadSessionState();
};

const setActiveConversation = (id) => {
  const state = loadSessionState();
  const nextState = { ...state, activeId: id };
  saveSessionState(nextState);
};

const addConversationToSession = (id) => {
  const state = loadSessionState();
  if (!state.conversationIds.includes(id)) {
    const nextState = {
      ...state,
      conversationIds: [...state.conversationIds, id],
      activeId: id
    };
    saveSessionState(nextState);
    return;
  }
  setActiveConversation(id);
};

const loadSelectedModel = () => {
  try {
    return sessionStorage.getItem(MODEL_KEY) || "";
  } catch (error) {
    return "";
  }
};

const saveSelectedModel = (modelId) => {
  try {
    sessionStorage.setItem(MODEL_KEY, modelId);
  } catch (error) {
    // ignore
  }
};

const getSelectedModel = () => {
  if (!modelSelect || modelSelect.options.length === 0) {
    return "";
  }
  const saved = loadSelectedModel();
  for (let i = 0; i < modelSelect.options.length; i++) {
    if (modelSelect.options[i].value === saved) {
      return saved;
    }
  }
  return modelSelect.options[0].value;
};

const isImageModelSelected = () => getSelectedModel() === IMAGE_MODEL_ID;

const updateImageUploadVisibility = () => {
  if (!imageUploadWrap) {
    return;
  }
  if (isImageModelSelected()) {
    imageUploadWrap.classList.remove("hidden");
  } else {
    imageUploadWrap.classList.add("hidden");
    selectedImageFiles = [];
    renderImagePreviews();
  }
};

const renderImagePreviews = () => {
  if (!imagePreviews) {
    return;
  }
  if (selectedImageFiles.length === 0) {
    imagePreviews.innerHTML = "";
    return;
  }
  imagePreviews.innerHTML = selectedImageFiles
    .map(
      (file, index) =>
        `<span class="image-preview-item" data-index="${index}">
          <img class="image-preview-thumb" src="${escapeHtml(URL.createObjectURL(file))}" alt="" />
          <button type="button" class="image-preview-remove" data-index="${index}" aria-label="Удалить">×</button>
        </span>`
    )
    .join("");
};

const readFilesAsDataUrls = (files) => {
  if (!files || files.length === 0) {
    return Promise.resolve([]);
  }
  const promises = Array.from(files).map(
    (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      })
  );
  return Promise.all(promises).then((urls) => urls.filter(Boolean));
};

const clearImageSelection = () => {
  selectedImageFiles = [];
  renderImagePreviews();
  if (imageInput) {
    imageInput.value = "";
  }
};

const escapeHtml = (value) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const configureMarkdown = () => {
  if (!window.marked?.setOptions) {
    return;
  }

  window.marked.setOptions({
    mangle: false,
    headerIds: false,
    highlight: (code, language) => {
      if (!window.hljs) {
        return escapeHtml(code);
      }

      if (language && window.hljs.getLanguage(language)) {
        return window.hljs.highlight(code, { language }).value;
      }

      return window.hljs.highlightAuto(code).value;
    }
  });
};

const renderMarkdown = (value) => {
  if (window.marked?.parse) {
    return window.marked.parse(value, { mangle: false, headerIds: false });
  }

  return escapeHtml(value).replaceAll("\n", "<br />");
};

const formatCost = (value, currency) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  if (currency === "RUB") {
    return `${value.toFixed(2)} ₽`;
  }
  return `$${value.toFixed(6)}`;
};

const applyHighlighting = () => {
  if (!window.hljs || !history) {
    return;
  }
  const blocks = history.querySelectorAll("pre code");
  blocks.forEach((block) => {
    window.hljs.highlightElement(block);
  });
};

const updateSendButton = () => {
  const isPending = currentConversationId && pendingById.has(currentConversationId);
  sendButton.disabled = Boolean(isPending);
  sendButton.textContent = isPending ? "Отправка..." : "Отправить";
};

const startRequest = (conversationId) => {
  if (!conversationId) {
    return;
  }
  pendingById.add(conversationId);
  streamingAssistantContent = "";
  updateSendButton();
  renderHistory(lastMessages, streamingAssistantContent);
};

const endRequest = (conversationId) => {
  if (!conversationId) {
    return;
  }
  pendingById.delete(conversationId);
  streamingAssistantContent = null;
  updateSendButton();
  renderHistory(lastMessages);
};

const renderUserContent = (content) => {
  if (typeof content === "string") {
    return renderMarkdown(content);
  }
  if (!Array.isArray(content)) {
    return renderMarkdown("");
  }
  const parts = [];
  for (const part of content) {
    if (part.type === "text" && part.text) {
      parts.push(renderMarkdown(part.text));
    }
    if (part.type === "image_url") {
      const imgUrl = part.imageUrl?.url || part.image_url?.url;
      if (imgUrl) {
        parts.push(
          `<img class="msg-thumb" src="${escapeHtml(imgUrl)}" alt="" loading="lazy" />`
        );
      }
    }
  }
  return parts.join("");
};

const renderHistory = (messages = [], streamingContent = null) => {
  const wasAtBottom = isHistoryScrolledToBottom();
  const isTyping = currentConversationId && pendingById.has(currentConversationId);
  const showStreamingBubble =
    isTyping &&
    typeof streamingContent === "string" &&
    streamingContent.length > 0;

  if (!messages.length && !isTyping) {
    history.innerHTML = `<div class="empty">Сообщений пока нет.</div>`;
    return;
  }

  const itemsHtml = messages
    .filter((item) => item.role !== "system")
    .map((item) => {
      const roleClass = item.role === "user" ? "bubble user" : "bubble assistant";
      const roleLabel = item.role === "user" ? "Вы" : "Ассистент";
      const contentHtml =
        item.role === "user"
          ? renderUserContent(item.content)
          : renderMarkdown(item.content || "");
      const cost = formatCost(item?.meta?.costRubFinal, "RUB");
      const costHtml = cost ? `<div class="message-meta">Стоимость: ${cost}</div>` : "";
      const hasCost = false;
      const retryBtn =
        item.role === "assistant" && item.retryable
          ? `<button type="button" class="retry-send-btn">Повторить отправку</button>`
          : "";
      return `<div class="${roleClass}">
        <span class="role">${roleLabel}:</span>
        <div class="markdown">${contentHtml}</div>
        ${hasCost ? costHtml : ""}
        ${retryBtn}
      </div>`;
    })
    .join("");

  let typingHtml = "";
  if (isTyping) {
    if (showStreamingBubble) {
      typingHtml = `<div class="bubble assistant streaming">
        <span class="role">Ассистент:</span>
        <div class="markdown">${renderMarkdown(streamingContent)}</div>
      </div>`;
    } else {
      typingHtml = `<div class="bubble assistant typing">
        <span class="role">Ассистент:</span>
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>`;
    }
  }

  history.innerHTML = `${itemsHtml}${typingHtml}`;
  applyHighlighting();
  scrollHistoryToBottom(wasAtBottom);
};

const SCROLL_AT_BOTTOM_THRESHOLD = 10;

const isHistoryScrolledToBottom = () => {
  if (!history) return false;
  const { scrollTop, scrollHeight, clientHeight } = history;
  return scrollTop + clientHeight >= scrollHeight - SCROLL_AT_BOTTOM_THRESHOLD;
};

const scrollHistoryToBottom = (wasAtBottom = true) => {
  if (!history) return;
  requestAnimationFrame(() => {
    if (!wasAtBottom) return;
    history.scrollTop = history.scrollHeight;
  });
};

const updateHistory = (messages, conversationId = currentConversationId) => {
  if (conversationId) {
    messageCacheById.set(conversationId, messages);
  }

  if (conversationId === currentConversationId) {
    lastMessages = messages;
    renderHistory(messages);
  }
};

const getPendingMessages = (conversationId) => {
  return pendingMessagesById.get(conversationId) || [];
};

const renderChatList = (conversations = []) => {
  if (!conversations.length) {
    chatList.innerHTML = `<li class="empty">Диалогов пока нет</li>`;
    return;
  }

  chatList.innerHTML = conversations
    .map((conversation) => {
      const isActive = conversation.id === currentConversationId;
      return `<li class="${isActive ? "active" : ""}" data-id="${conversation.id}">
        ${conversation.title}
      </li>`;
    })
    .join("");
};

const loadModels = async () => {
  if (!modelSelect) {
    return;
  }
  const response = await fetch("/api/models");
  const data = await response.json().catch(() => ({}));
  const models = data?.models || [];
  modelSelect.innerHTML = models
    .map(
      (m) =>
        `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label || m.id)}</option>`
    )
    .join("");
  const saved = loadSelectedModel();
  if (saved) {
    const found = models.some((m) => m.id === saved);
    if (found) {
      modelSelect.value = saved;
    }
  }
  if (modelSelect.options.length > 0 && !modelSelect.value) {
    modelSelect.selectedIndex = 0;
    saveSelectedModel(modelSelect.value);
  }
};

const loadConversations = async () => {
  const response = await fetch("/api/conversations");
  const data = await response.json().catch(() => ({}));
  const allConversations = data?.conversations || [];
  const sessionState = loadSessionState();
  const filtered = allConversations.filter((conversation) =>
    sessionState.conversationIds.includes(conversation.id)
  );

  const validIds = filtered.map((conversation) => conversation.id);
  if (validIds.length !== sessionState.conversationIds.length) {
    saveSessionState({ ...sessionState, conversationIds: validIds });
  }

  renderChatList(filtered);
};

const loadConversation = async (id) => {
  const response = await fetch(`/api/conversations/${id}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    renderHistory([]);
    return;
  }

  currentConversationId = data.conversation.id;
  const pendingMessages = getPendingMessages(currentConversationId);
  const cachedMessages = messageCacheById.get(currentConversationId);
  const mergedMessages =
    pendingMessages.length && cachedMessages
      ? cachedMessages
      : [...data.conversation.messages, ...pendingMessages];
  updateHistory(mergedMessages);
  systemInput.disabled = true;
  updateSendButton();
  await loadConversations();
};

const createConversation = async (system) => {
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Новый диалог",
      system: system || undefined
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Не удалось создать диалог");
  }

  return data.conversation;
};

const appendUserMessage = (conversationId, message, imageUrls = []) => {
  if (!conversationId) {
    return;
  }
  const content =
    imageUrls.length > 0
      ? [
          { type: "text", text: message },
          ...imageUrls.map((url) => ({ type: "image_url", imageUrl: { url } }))
        ]
      : message;
  const nextMessage = { role: "user", content };
  const pendingMessages = getPendingMessages(conversationId);
  pendingMessagesById.set(conversationId, [...pendingMessages, nextMessage]);
  const cached = messageCacheById.get(conversationId) || [];
  const nextMessages = [...cached, nextMessage];
  updateHistory(nextMessages, conversationId);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendMessage = async ({ message, system, images: imageUrls = [] }) => {
  let conversationId = currentConversationId;

  try {
    if (!currentConversationId) {
      const conversation = await createConversation(system);
      currentConversationId = conversation.id;
      addConversationToSession(conversation.id);
      await loadConversations();
      updateHistory(conversation.messages);
    }

    conversationId = currentConversationId;
    appendUserMessage(conversationId, message, imageUrls);
    startRequest(conversationId);

    let lastResponse = null;
    let lastData = {};
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_SEND_RETRIES; attempt++) {
      try {
        const model = getSelectedModel();
        const response = await fetch(
          `/api/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              model: model || undefined,
              images: imageUrls.length ? imageUrls : undefined
            })
          }
        );
        lastResponse = response;

        if (!response.ok) {
          lastData = await response.json().catch(() => ({}));
          lastError =
            lastData?.source === "openrouter"
              ? `Ошибка запроса к OpenRouter: ${lastData?.error || "Ошибка запроса."}`
              : lastData?.error || "Ошибка запроса.";
          if (attempt < MAX_SEND_RETRIES) {
            await sleep(RETRY_DELAY_MS);
          }
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/event-stream")) {
          lastData = await response.json().catch(() => ({}));
          pendingMessagesById.delete(conversationId);
          updateHistory(lastData.conversation?.messages ?? [], conversationId);
          await loadConversations();
          messageInput.value = "";
          systemInput.disabled = true;
          clearImageSelection();
          endRequest(conversationId);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          lastError = "Нет тела ответа.";
          continue;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = null;
        let currentData = [];

        const findSSEBoundary = () => {
          const nn = buffer.indexOf("\n\n");
          const rnrn = buffer.indexOf("\r\n\r\n");
          if (nn >= 0 && (rnrn < 0 || nn <= rnrn)) return { idx: nn, len: 2 };
          if (rnrn >= 0) return { idx: rnrn, len: 4 };
          return null;
        };

        const processBuffer = async () => {
          let boundary;
          while ((boundary = findSSEBoundary()) !== null) {
            const block = buffer.slice(0, boundary.idx);
            buffer = buffer.slice(boundary.idx + boundary.len);
            const lines = block.split(/\r\n|\n|\r/);
            let ev = null;
            const dataLines = [];
            for (const line of lines) {
              const t = line.trim();
              if (t.toLowerCase().startsWith("event:")) {
                ev = t.slice(6).trim();
              } else if (t.toLowerCase().startsWith("data:")) {
                dataLines.push(t.slice(5).replace(/^ /, ""));
              }
            }
            if (dataLines.length === 0) continue;
            if (!ev) {
              try {
                const data = JSON.parse(dataLines.join("\n"));
                if (data.delta != null) ev = "delta";
                else if (data.conversation != null) ev = "done";
                else if (data.error != null) ev = "error";
              } catch (_) {
                continue;
              }
            }
            const dataStr = dataLines.join("\n");
            try {
              const data = JSON.parse(dataStr);
              if (ev === "delta") {
                const delta = typeof data.delta === "string" ? data.delta : "";
                if (delta) {
                  streamingAssistantContent = (streamingAssistantContent ?? "") + delta;
                  renderHistory(lastMessages, streamingAssistantContent);
                }
              }
              if (ev === "done") {
                pendingMessagesById.delete(conversationId);
                const conv = data.conversation;
                if (conv?.messages) {
                  updateHistory(conv.messages, conversationId);
                }
                await loadConversations();
                messageInput.value = "";
                systemInput.disabled = true;
                clearImageSelection();
                endRequest(conversationId);
                return true;
              }
              if (ev === "error") {
                const errText =
                  data?.source === "openrouter"
                    ? `Ошибка запроса к OpenRouter: ${data?.error || "Ошибка стрима."}`
                    : data?.error || "Ошибка стрима.";
                const cached = messageCacheById.get(conversationId) || [];
                updateHistory(
                  [...cached, { role: "assistant", content: errText, retryable: true }],
                  conversationId
                );
                endRequest(conversationId);
                return true;
              }
            } catch (_) {
              // ignore parse errors
            }
          }
          return false;
        };

        let streamDone = false;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (buffer.length > 0 && (await processBuffer())) {
                streamDone = true;
              }
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            if (await processBuffer()) {
              streamDone = true;
              break;
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (streamDone) {
          updateSendButton();
          return;
        }

        lastError = "Стрим завершился без события done.";
      } catch (err) {
        lastError = "Ошибка соединения с сервером.";
        if (attempt < MAX_SEND_RETRIES) {
          await sleep(RETRY_DELAY_MS);
        }
      }
    }

    const errorText =
      typeof lastError === "string"
        ? lastError
        : "Запрос не удался после нескольких попыток.";
    const cachedMessages = messageCacheById.get(conversationId) || [];
    updateHistory(
      [
        ...cachedMessages,
        {
          role: "assistant",
          content: `${errorText} (попыток: ${MAX_SEND_RETRIES})`,
          retryable: true
        }
      ],
      conversationId
    );
  } catch (error) {
    const cachedMessages = messageCacheById.get(conversationId) || [];
    updateHistory(
      [
        ...cachedMessages,
        {
          role: "assistant",
          content: "Ошибка соединения с сервером.",
          retryable: true
        }
      ],
      conversationId
    );
  } finally {
    endRequest(conversationId);
  }
};

const extractTextAndImagesFromContent = (content) => {
  if (typeof content === "string") {
    return { message: content, images: [] };
  }
  if (!Array.isArray(content)) {
    return { message: "", images: [] };
  }
  const textPart = content.find((p) => p.type === "text");
  const text = textPart?.text ?? "";
  const images = content
    .filter(
      (p) =>
        p.type === "image_url" && (p.imageUrl?.url || p.image_url?.url)
    )
    .map((p) => p.imageUrl?.url || p.image_url?.url);
  return { message: text, images };
};

const retryLastMessage = () => {
  const messages = messageCacheById.get(currentConversationId) || [];
  const lastAssistant = messages[messages.length - 1];
  if (!lastAssistant?.retryable) {
    return;
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const { message: messageToRetry, images: imagesToRetry } =
    extractTextAndImagesFromContent(lastUser?.content);
  if (!messageToRetry && !(imagesToRetry && imagesToRetry.length)) {
    return;
  }
  const withoutErrorAndUser = messages.slice(0, -2);
  messageCacheById.set(currentConversationId, withoutErrorAndUser);
  pendingMessagesById.delete(currentConversationId);
  updateHistory(withoutErrorAndUser);
  sendMessage({ message: messageToRetry || "", images: imagesToRetry || [] });
};

history.addEventListener("click", (event) => {
  const retryBtn = event.target.closest(".retry-send-btn");
  if (retryBtn) {
    event.preventDefault();
    retryLastMessage();
    return;
  }
});

chatList.addEventListener("click", (event) => {
  const target = event.target.closest("li[data-id]");
  if (!target) {
    return;
  }

  const id = target.dataset.id;
  if (!id) {
    return;
  }

  setActiveConversation(id);
  loadConversation(id);
});

if (modelSelect) {
  modelSelect.addEventListener("change", () => {
    saveSelectedModel(modelSelect.value);
    updateImageUploadVisibility();
  });
}

if (imageInput) {
  imageInput.addEventListener("change", () => {
    selectedImageFiles = Array.from(imageInput.files || []);
    renderImagePreviews();
  });
}

if (imagePreviews) {
  imagePreviews.addEventListener("click", (event) => {
    const removeBtn = event.target.closest(".image-preview-remove");
    if (!removeBtn) {
      return;
    }
    const index = parseInt(removeBtn.dataset.index, 10);
    if (Number.isNaN(index) || index < 0 || index >= selectedImageFiles.length) {
      return;
    }
    selectedImageFiles = selectedImageFiles.filter((_, i) => i !== index);
    renderImagePreviews();
  });
}

newChatButton.addEventListener("click", () => {
  currentConversationId = null;
  setActiveConversation(null);
  updateHistory([]);
  systemInput.disabled = false;
  systemInput.value = "";
  messageInput.value = "";
  clearImageSelection();
  updateSendButton();
});

const uploadImagesAndGetUrls = async (files) => {
  if (!files || files.length === 0) {
    return [];
  }
  const dataUrls = await readFilesAsDataUrls(files);
  if (dataUrls.length === 0) {
    return [];
  }
  const response = await fetch("/api/upload-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: dataUrls })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Ошибка загрузки изображений");
  }
  return data?.urls || [];
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();
  const system = systemInput.value.trim();

  if (!message && (!selectedImageFiles || selectedImageFiles.length === 0)) {
    updateHistory([{ role: "assistant", content: "Введите сообщение или приложите изображение." }]);
    return;
  }

  messageInput.value = "";
  let imageUrls = [];
  if (selectedImageFiles.length > 0) {
    try {
      imageUrls = await uploadImagesAndGetUrls(selectedImageFiles);
    } catch (err) {
      updateHistory([
        {
          role: "assistant",
          content: err?.message || "Не удалось загрузить изображения."
        }
      ]);
      return;
    }
  }
  clearImageSelection();
  await sendMessage({ message, system, images: imageUrls });
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();

  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
    return;
  }

  form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
});

const initApp = async () => {
  configureMarkdown();
  await loadModels();
  updateImageUploadVisibility();
  await loadConversations();
  const sessionState = getSessionState();
  if (sessionState.activeId) {
    await loadConversation(sessionState.activeId);
    return;
  }
  updateHistory([]);
  updateSendButton();
};

initApp();
