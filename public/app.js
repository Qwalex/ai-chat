const form = document.querySelector("#chat-form");
const systemInput = document.querySelector("#system");
const messageInput = document.querySelector("#message");
const sendButton = document.querySelector("#send");
const history = document.querySelector("#history");
const chatList = document.querySelector("#chat-list");
const newChatButton = document.querySelector("#new-chat");

let currentConversationId = null;
let lastMessages = [];
const pendingById = new Set();
const messageCacheById = new Map();
const pendingMessagesById = new Map();

const SESSION_KEY = "kimiChatSession";

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
  updateSendButton();
  renderHistory(lastMessages);
};

const endRequest = (conversationId) => {
  if (!conversationId) {
    return;
  }
  pendingById.delete(conversationId);
  updateSendButton();
  renderHistory(lastMessages);
};

const renderHistory = (messages = []) => {
  const isTyping = currentConversationId && pendingById.has(currentConversationId);

  if (!messages.length && !isTyping) {
    history.innerHTML = `<div class="empty">Сообщений пока нет.</div>`;
    return;
  }

  const itemsHtml = messages
    .filter((item) => item.role !== "system")
    .map((item) => {
      const roleClass = item.role === "user" ? "bubble user" : "bubble assistant";
      const roleLabel = item.role === "user" ? "Вы" : "Ассистент";
      const contentHtml = renderMarkdown(item.content || "");
      return `<div class="${roleClass}">
        <span class="role">${roleLabel}:</span>
        <div class="markdown">${contentHtml}</div>
      </div>`;
    })
    .join("");

  const typingHtml = isTyping
    ? `<div class="bubble assistant typing">
        <span class="role">Ассистент:</span>
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>`
    : "";

  history.innerHTML = `${itemsHtml}${typingHtml}`;
  applyHighlighting();
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

const appendUserMessage = (conversationId, message) => {
  if (!conversationId) {
    return;
  }
  const nextMessage = { role: "user", content: message };
  const pendingMessages = getPendingMessages(conversationId);
  pendingMessagesById.set(conversationId, [...pendingMessages, nextMessage]);
  const cached = messageCacheById.get(conversationId) || [];
  const nextMessages = [...cached, nextMessage];
  updateHistory(nextMessages, conversationId);
};

const sendMessage = async ({ message, system }) => {
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
    appendUserMessage(conversationId, message);
    startRequest(conversationId);

    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const cachedMessages = messageCacheById.get(conversationId) || [];
      updateHistory([
        ...cachedMessages,
        { role: "assistant", content: data?.error || "Ошибка запроса." }
      ], conversationId);
      return;
    }

    pendingMessagesById.delete(conversationId);
    updateHistory(data.conversation.messages, conversationId);
    await loadConversations();
    messageInput.value = "";
    systemInput.disabled = true;
    updateSendButton();
  } catch (error) {
    const cachedMessages = messageCacheById.get(conversationId) || [];
    updateHistory([
      ...cachedMessages,
      { role: "assistant", content: "Ошибка соединения с сервером." }
    ], conversationId);
  } finally {
    endRequest(conversationId);
  }
};

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

newChatButton.addEventListener("click", () => {
  currentConversationId = null;
  setActiveConversation(null);
  updateHistory([]);
  systemInput.disabled = false;
  systemInput.value = "";
  messageInput.value = "";
  updateSendButton();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();
  const system = systemInput.value.trim();

  if (!message) {
    updateHistory([{ role: "assistant", content: "Введите сообщение." }]);
    return;
  }

  messageInput.value = "";
  await sendMessage({ message, system });
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
