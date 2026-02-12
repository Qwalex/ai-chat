'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ModelItem,
  type ConversationListItem,
  type ChatMessage,
  fetchModels,
  fetchConversations,
  fetchConversation,
  createConversation,
  sendMessageStream,
  uploadImages,
} from '@/lib/api';
import { Markdown } from '@/components/Markdown';

const SESSION_KEY = 'kimiChatSession';
const MODEL_KEY = 'chatModel';
const MAX_SEND_RETRIES = 5;
const RETRY_DELAY_MS = 1500;

const loadSessionState = (): { conversationIds: string[]; activeId: string | null } => {
  if (typeof window === 'undefined') return { conversationIds: [], activeId: null };
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { conversationIds: [], activeId: null };
    const data = JSON.parse(raw);
    return {
      conversationIds: Array.isArray(data.conversationIds) ? data.conversationIds : [],
      activeId: data.activeId ?? null,
    };
  } catch {
    return { conversationIds: [], activeId: null };
  }
};

const saveSessionState = (state: { conversationIds: string[]; activeId: string | null }): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
};

const readFilesAsDataUrls = (files: File[]): Promise<string[]> => {
  if (!files?.length) return Promise.resolve([]);
  return Promise.all(
    files.map(
      (file) =>
        new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        }),
    ),
  ).then((urls) => urls.filter((u): u is string => Boolean(u)));
};

const getImageUrl = (p: { type: string; imageUrl?: { url: string }; image_url?: { url: string } }): string | undefined =>
  p.imageUrl?.url ?? p.image_url?.url;

const extractTextAndImages = (
  content: ChatMessage['content'],
): { message: string; images: string[] } => {
  if (typeof content === 'string') return { message: content, images: [] };
  if (!Array.isArray(content)) return { message: '', images: [] };
  const textPart = content.find((p) => p.type === 'text');
  const text = (textPart as { text?: string })?.text ?? '';
  const images = content
    .filter((p) => p.type === 'image_url' && getImageUrl(p))
    .map((p) => getImageUrl(p)!);
  return { message: text, images };
};

const renderUserContent = (content: ChatMessage['content']): React.ReactNode => {
  if (typeof content === 'string') {
    return <Markdown content={content} />;
  }
  if (!Array.isArray(content)) return null;
  const parts: React.ReactNode[] = [];
  for (const part of content) {
    if (part.type === 'text' && part.text) {
      parts.push(<Markdown key={parts.length} content={part.text} />);
    }
    if (part.type === 'image_url') {
      const url = part.imageUrl?.url ?? (part as { image_url?: { url: string } }).image_url?.url;
      if (url) {
        parts.push(
          <img key={parts.length} className="msg-thumb" src={url} alt="" loading="lazy" />,
        );
      }
    }
  }
  return <>{parts}</>;
};

type Props = {
  defaultModelId?: string | null;
};

export const ChatClient = ({ defaultModelId }: Props) => {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [pending, setPending] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messageCacheRef = useRef<Record<string, ChatMessage[]>>({});
  const pendingMessagesRef = useRef<Record<string, ChatMessage[]>>({});
  const historyRef = useRef<HTMLDivElement>(null);

  const loadModels = useCallback(async () => {
    const list = await fetchModels();
    setModels(list);
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem(MODEL_KEY) : null;
    const fromPage = defaultModelId ?? saved;
    const found = list.some((m) => m.id === fromPage);
    if (found && fromPage) {
      setSelectedModel(fromPage);
      sessionStorage.setItem(MODEL_KEY, fromPage);
    } else if (list.length > 0 && !selectedModel) {
      setSelectedModel(list[0].id);
      sessionStorage.setItem(MODEL_KEY, list[0].id);
    }
  }, [defaultModelId, selectedModel]);

  const loadConversationsList = useCallback(async () => {
    const list = await fetchConversations();
    const session = loadSessionState();
    const filtered = list.filter((c) => session.conversationIds.includes(c.id));
    setConversations(filtered);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const conv = await fetchConversation(id);
    if (!conv) return;
    setCurrentId(conv.id);
    const pendingList = pendingMessagesRef.current[id] ?? [];
    const cached = messageCacheRef.current[id] ?? conv.messages;
    const merged = pendingList.length ? cached : [...conv.messages, ...pendingList];
    setMessages(merged);
    messageCacheRef.current[id] = merged;
    loadConversationsList();
  }, [loadConversationsList]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    loadConversationsList();
  }, [loadConversationsList]);

  useEffect(() => {
    const session = loadSessionState();
    if (session.activeId) {
      loadConversation(session.activeId);
    } else {
      setMessages([]);
      setCurrentId(null);
    }
  }, [loadConversation]);

  const addConversationToSession = useCallback((id: string) => {
    const session = loadSessionState();
    if (session.conversationIds.includes(id)) {
      saveSessionState({ ...session, activeId: id });
      return;
    }
    saveSessionState({
      conversationIds: [...session.conversationIds, id],
      activeId: id,
    });
  }, []);

  const handleNewChat = useCallback(() => {
    setCurrentId(null);
    setMessages([]);
    setSystemPrompt('');
    setMessageInput('');
    setErrorMessage(null);
    saveSessionState({ ...loadSessionState(), activeId: null });
  }, []);

  const handleSelectConversation = useCallback(
    (id: string) => {
      saveSessionState({ ...loadSessionState(), activeId: id });
      loadConversation(id);
    },
    [loadConversation],
  );

  const processStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>, conversationId: string) => {
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      const findBoundary = () => {
        const nn = buffer.indexOf('\n\n');
        const rnrn = buffer.indexOf('\r\n\r\n');
        if (nn >= 0 && (rnrn < 0 || nn <= rnrn)) return { idx: nn, len: 2 };
        if (rnrn >= 0) return { idx: rnrn, len: 4 };
        return null;
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let b: { idx: number; len: number } | null;
          while ((b = findBoundary()) !== null) {
            const block = buffer.slice(0, b.idx);
            buffer = buffer.slice(b.idx + b.len);
            const lines = block.split(/\r\n|\n|\r/);
            let event: string | null = null;
            const dataLines: string[] = [];
            for (const line of lines) {
              const t = line.trim();
              if (t.toLowerCase().startsWith('event:')) event = t.slice(6).trim();
              else if (t.toLowerCase().startsWith('data:')) dataLines.push(t.slice(5).replace(/^ /, ''));
            }
            if (dataLines.length === 0) continue;
            try {
              const data = JSON.parse(dataLines.join('\n'));
              if (data.delta != null) event = 'delta';
              else if (data.conversation != null) event = 'done';
              else if (data.error != null) event = 'error';
              if (event === 'delta' && typeof data.delta === 'string') {
                fullContent += data.delta;
                setStreamingContent(fullContent);
              }
              if (event === 'done' && data.conversation?.messages) {
                setMessages(data.conversation.messages);
                messageCacheRef.current[conversationId] = data.conversation.messages;
                delete pendingMessagesRef.current[conversationId];
                loadConversationsList();
                setMessageInput('');
                setSystemPrompt('');
                setImageFiles([]);
                setPending(false);
                setStreamingContent(null);
                return;
              }
              if (event === 'error') {
                const errText =
                  data?.source === 'openrouter'
                    ? `Ошибка OpenRouter: ${data?.error ?? ''}`
                    : data?.error ?? 'Ошибка стрима';
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: errText } as ChatMessage & { retryable?: boolean },
                ]);
                setPending(false);
                setStreamingContent(null);
                return;
              }
            } catch {
              // ignore parse
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      setPending(false);
      setStreamingContent(null);
    },
    [loadConversationsList],
  );

  const sendMessage = useCallback(
    async (text: string, system: string, images: string[]) => {
      let conversationId = currentId;
      try {
        if (!conversationId) {
          const conv = await createConversation({
            title: 'Новый диалог',
            system: system || undefined,
          });
          conversationId = conv.id;
          addConversationToSession(conversationId);
          setCurrentId(conversationId);
          setMessages(conv.messages);
          messageCacheRef.current[conversationId] = conv.messages;
          loadConversationsList();
        }
        const userContent: ChatMessage['content'] =
          images.length > 0
            ? [
                { type: 'text', text },
                ...images.map((url) => ({ type: 'image_url' as const, imageUrl: { url } })),
              ]
            : text;
        const userMsg: ChatMessage = { role: 'user', content: userContent };
        const prev = messageCacheRef.current[conversationId] ?? messages;
        const nextMessages = [...prev, userMsg];
        setMessages(nextMessages);
        messageCacheRef.current[conversationId] = nextMessages;
        const pendingList = pendingMessagesRef.current[conversationId] ?? [];
        pendingMessagesRef.current[conversationId] = [...pendingList, userMsg];
        setPending(true);
        setStreamingContent('');
        setErrorMessage(null);

        for (let attempt = 1; attempt <= MAX_SEND_RETRIES; attempt++) {
          const reader = await sendMessageStream(conversationId, {
            message: text,
            model: selectedModel || undefined,
            images: images.length ? images : undefined,
          });
          if (!reader) {
            setErrorMessage('Нет тела ответа');
            if (attempt < MAX_SEND_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          await processStream(reader, conversationId);
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Запрос не удался после ${MAX_SEND_RETRIES} попыток.`,
          } as ChatMessage & { retryable?: boolean },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: err instanceof Error ? err.message : 'Ошибка соединения с сервером.',
          } as ChatMessage & { retryable?: boolean },
        ]);
      } finally {
        setPending(false);
        setStreamingContent(null);
      }
    },
    [
      currentId,
      messages,
      selectedModel,
      addConversationToSession,
      loadConversationsList,
      processStream,
    ],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = messageInput.trim();
      if (!text && imageFiles.length === 0) {
        setErrorMessage('Введите сообщение или приложите изображение.');
        return;
      }
      setMessageInput('');
      let urls: string[] = [];
      if (imageFiles.length > 0) {
        try {
          const dataUrls = await readFilesAsDataUrls(imageFiles);
          urls = await uploadImages(dataUrls);
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : 'Не удалось загрузить изображения');
          return;
        }
        setImageFiles([]);
      }
      await sendMessage(text, systemPrompt, urls);
    },
    [messageInput, systemPrompt, imageFiles, sendMessage],
  );

  const displayMessages = streamingContent != null ? messages : messages;
  const showStreamingBubble = pending && streamingContent != null && streamingContent.length > 0;

  return (
    <div className="layout">
      <aside className="sidebar">
        <button type="button" onClick={handleNewChat}>
          Новый диалог
        </button>
        <div className="field">
          Модель
          <select
            aria-label="Выбор модели"
            value={selectedModel}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedModel(v);
              if (typeof window !== 'undefined') sessionStorage.setItem(MODEL_KEY, v);
            }}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          System (для нового диалога)
          <textarea
            rows={2}
            placeholder="Контекст или роль ассистента"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            disabled={!!currentId}
          />
        </div>
        <ul className="chat-list">
          {conversations.length === 0 && <li className="empty">Диалогов пока нет</li>}
          {conversations.map((c) => (
            <li
              key={c.id}
              className={c.id === currentId ? 'active' : ''}
              onClick={() => handleSelectConversation(c.id)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectConversation(c.id)}
              role="button"
              tabIndex={0}
            >
              {c.title}
            </li>
          ))}
        </ul>
      </aside>
      <section className="chat">
        <div ref={historyRef} className="history">
          {displayMessages.length === 0 && !pending && (
            <div className="empty">Сообщений пока нет.</div>
          )}
          {displayMessages
            .filter((m) => m.role !== 'system')
            .map((m, i) => (
              <div
                key={i}
                className={`bubble ${m.role === 'user' ? 'user' : 'assistant'}`}
              >
                <span className="role">{m.role === 'user' ? 'Вы' : 'Ассистент'}:</span>
                {m.role === 'user'
                  ? renderUserContent(m.content)
                  : (
                    <Markdown content={typeof m.content === 'string' ? m.content : ''} />
                  )}
              </div>
            ))}
          {pending && (
            <div className={`bubble assistant ${showStreamingBubble ? 'streaming' : 'typing'}`}>
              <span className="role">Ассистент:</span>
              {showStreamingBubble ? (
                <Markdown content={streamingContent!} />
              ) : (
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} id="chat-form">
          {errorMessage && <p className="empty">{errorMessage}</p>}
          <label className="field">
            Сообщение
            <textarea
              rows={3}
              placeholder="Напишите запрос"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  (e.target as HTMLFormElement).form?.requestSubmit();
                }
              }}
            />
          </label>
          <div className="image-upload-wrap">
            <label className="field image-upload-label">
              Изображения (для моделей с поддержкой картинок)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            {imageFiles.length > 0 && (
              <div className="image-previews">
                {imageFiles.map((file, idx) => (
                  <span key={idx} className="image-preview-item">
                    <img
                      className="image-preview-thumb"
                      src={URL.createObjectURL(file)}
                      alt=""
                    />
                    <button
                      type="button"
                      className="image-preview-remove"
                      aria-label="Удалить"
                      onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <button type="submit" disabled={pending}>
            {pending ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </section>
    </div>
  );
};

