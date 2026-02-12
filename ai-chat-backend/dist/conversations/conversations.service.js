"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsService = exports.buildUserMessageContent = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const models_constants_1 = require("../models/models.constants");
const openrouter_service_1 = require("../openrouter/openrouter.service");
const write_log_service_1 = require("../write-log/write-log.service");
const ALLOWED_MODEL_IDS = models_constants_1.ALLOWED_MODELS.map((m) => m.id);
const generateId = () => Math.random().toString(36).slice(2, 10);
const dropLeadingSystemMessages = (messages) => {
    let i = 0;
    while (i < messages.length && messages[i].role === 'system')
        i++;
    return messages.slice(i);
};
const buildUserMessageContent = (messageText, imageUrls) => {
    if (!imageUrls?.length)
        return messageText;
    const parts = [{ type: 'text', text: messageText || '' }];
    for (const url of imageUrls) {
        if (url && typeof url === 'string') {
            parts.push({ type: 'image_url', imageUrl: { url } });
        }
    }
    return parts;
};
exports.buildUserMessageContent = buildUserMessageContent;
const normalizeMessageContent = (content) => {
    if (typeof content === 'string')
        return content;
    if (Array.isArray(content) && content.length > 0) {
        const first = content[0];
        if (typeof first === 'string')
            return first;
        if (first?.text)
            return first.text;
    }
    return '';
};
const normalizeTitle = (value) => {
    if (!value)
        return null;
    const cleaned = String(value)
        .replaceAll(/[`*_#>\n\r]/g, ' ')
        .replaceAll(/\s+/g, ' ')
        .trim();
    if (!cleaned)
        return null;
    return cleaned.slice(0, 40);
};
const titleFallbackFromMessage = (message) => normalizeTitle(message)?.slice(0, 40) || 'Новый диалог';
let ConversationsService = class ConversationsService {
    constructor(openRouter, config, writeLogService) {
        this.openRouter = openRouter;
        this.config = config;
        this.writeLogService = writeLogService;
        this.conversations = new Map();
        this.getDefaultModel = () => this.config.get('OPENROUTER_MODEL') || 'moonshotai/kimi-k2.5';
        this.getModel = (modelFromRequest) => {
            if (modelFromRequest && ALLOWED_MODEL_IDS.includes(modelFromRequest)) {
                return modelFromRequest;
            }
            return this.getDefaultModel();
        };
        this.listConversations = () => Array.from(this.conversations.values()).map((c) => ({
            id: c.id,
            title: c.title,
            updatedAt: c.updatedAt,
            messageCount: c.messages.length,
        }));
        this.createConversation = (dto) => {
            const id = generateId();
            const now = new Date().toISOString();
            const defaultModel = this.getDefaultModel();
            const systemPrompt = (0, models_constants_1.getSystemPromptForModel)(defaultModel);
            const messages = [{ role: 'system', content: systemPrompt }];
            if (dto.system && typeof dto.system === 'string') {
                messages.push({ role: 'system', content: dto.system });
            }
            const conversation = {
                id,
                title: dto.title || 'Новый диалог',
                createdAt: now,
                updatedAt: now,
                messages,
            };
            this.conversations.set(id, conversation);
            return conversation;
        };
        this.getConversation = (id) => this.conversations.get(id);
        this.getOrThrow = (id) => {
            const c = this.getConversation(id);
            if (!c)
                throw new common_1.NotFoundException('Conversation not found');
            return c;
        };
        this.hasUserMessages = (conversation) => conversation.messages.some((m) => m.role === 'user');
        this.buildMessagesPayload = (conversation, userMessageContent, modelId) => {
            const systemPrompt = (0, models_constants_1.getSystemPromptForModel)(modelId);
            const withoutLeading = dropLeadingSystemMessages(conversation.messages);
            return [
                { role: 'system', content: systemPrompt },
                ...withoutLeading,
                { role: 'user', content: userMessageContent },
            ];
        };
        this.appendUserMessage = (conversation, userMessageContent) => {
            conversation.messages.push({ role: 'user', content: userMessageContent });
        };
        this.appendAssistantMessage = (conversation, text, meta) => {
            conversation.messages.push({ role: 'assistant', content: text, meta });
            conversation.updatedAt = new Date().toISOString();
        };
        this.popLastMessage = (conversation) => {
            conversation.messages.pop();
        };
        this.setTitle = (conversation, title) => {
            conversation.title = title;
            conversation.updatedAt = new Date().toISOString();
        };
        this.generateTitle = async (message) => {
            const client = this.openRouter.getClient();
            if (!client)
                return null;
            try {
                const result = await client.chat.send({
                    model: 'arcee-ai/trinity-large-preview:free',
                    messages: [
                        {
                            role: 'user',
                            content: `Сформулируй короткое название диалога (3-6 слов, до 40 символов). Одна строка. Без кавычек и точек. По фразе: "${message}"`,
                        },
                    ],
                    temperature: 0.2,
                    stream: false,
                });
                const content = result?.choices?.[0]?.message?.content;
                return normalizeTitle(normalizeMessageContent(content));
            }
            catch {
                return null;
            }
        };
        this.scheduleTitleUpdate = (conversation, messageText) => {
            const titleSource = messageText.trim() || 'Изображение';
            this.generateTitle(titleSource)
                .then((generated) => {
                if (generated)
                    this.setTitle(conversation, generated);
                else
                    this.setTitle(conversation, titleFallbackFromMessage(titleSource));
            })
                .catch(() => { });
        };
        this.logUsage = (model, messageText, costUsd, costRub, costRubFinal, rate) => {
            this.writeLogService.writeLog(`Use ${model} to generate response: ${messageText}`);
            this.writeLogService.writeLog(`Cost: $${costUsd} → ${costRub}₽ → ${costRubFinal}₽ (rate: ${rate})`);
            this.writeLogService.writeLog('---');
        };
    }
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openrouter_service_1.OpenRouterService,
        config_1.ConfigService,
        write_log_service_1.WriteLogService])
], ConversationsService);
//# sourceMappingURL=conversations.service.js.map