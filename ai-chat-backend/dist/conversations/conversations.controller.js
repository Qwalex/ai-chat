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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const models_constants_1 = require("../models/models.constants");
const openrouter_service_1 = require("../openrouter/openrouter.service");
const conversations_service_1 = require("./conversations.service");
const conversations_service_2 = require("./conversations.service");
const USD_TO_RUB_RATE = Number(process.env.USD_TO_RUB_RATE) || 90;
const USD_RATE_API = process.env.USD_RATE_API || 'https://open.er-api.com/v6/latest/USD';
const USD_RATE_CACHE_MS = Number(process.env.USD_RATE_CACHE_MS) || 10 * 60 * 1000;
const COMMISSION_MULTIPLIER = Number(process.env.COMMISSION_MULTIPLIER) || 1.5;
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
let usdRateCache = { value: null, expiresAt: 0 };
const getUsdToRubRate = async () => {
    const now = Date.now();
    if (usdRateCache.value != null && now < usdRateCache.expiresAt) {
        return usdRateCache.value;
    }
    try {
        const response = await fetch(USD_RATE_API);
        const data = await response.json().catch(() => ({}));
        const rate = data?.rates?.RUB;
        if (typeof rate === 'number' && !Number.isNaN(rate)) {
            usdRateCache = { value: rate, expiresAt: now + USD_RATE_CACHE_MS };
            return rate;
        }
    }
    catch {
    }
    usdRateCache = { value: USD_TO_RUB_RATE, expiresAt: now + USD_RATE_CACHE_MS };
    return USD_TO_RUB_RATE;
};
const calculateRub = (costUsd, rate, multiplier) => {
    if (typeof costUsd !== 'number' || Number.isNaN(costUsd)) {
        return { costRub: null, costRubFinal: null };
    }
    const costRub = costUsd * rate;
    return { costRub, costRubFinal: costRub * multiplier };
};
const sendSSE = (res, event, data) => {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\ndata: ${payload}\n\n`);
};
const openRouterErrorJson = (message) => ({ error: message, source: 'openrouter' });
let ConversationsController = class ConversationsController {
    constructor(conversations, openRouter, config) {
        this.conversations = conversations;
        this.openRouter = openRouter;
        this.config = config;
    }
    getModels() {
        return { models: models_constants_1.ALLOWED_MODELS };
    }
    listConversations() {
        return { conversations: this.conversations.listConversations() };
    }
    createConversation(body) {
        const conversation = this.conversations.createConversation({
            title: body.title,
            system: body.system,
        });
        return { conversation };
    }
    getConversation(id) {
        const conversation = this.conversations.getOrThrow(id);
        return { conversation };
    }
    async streamMessage(id, body, res) {
        const conversation = this.conversations.getOrThrow(id);
        const messageText = typeof body.message === 'string' ? body.message : '';
        const imageUrls = Array.isArray(body.images) ? body.images : [];
        if (!messageText.trim() && imageUrls.length === 0) {
            res.status(common_1.HttpStatus.BAD_REQUEST).json({ error: 'message or images required' });
            return;
        }
        const client = this.openRouter.getClient();
        if (!client) {
            res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                error: 'OPENROUTER_API_KEY is not set',
            });
            return;
        }
        const model = this.conversations.getModel(body.model);
        const userMessageContent = (0, conversations_service_1.buildUserMessageContent)(messageText, imageUrls);
        const messages = this.conversations.buildMessagesPayload(conversation, userMessageContent, model);
        const isFirstUserMessage = !this.conversations.hasUserMessages(conversation);
        this.conversations.appendUserMessage(conversation, userMessageContent);
        const apiKey = this.config.get('OPENROUTER_API_KEY');
        const openRouterHeaders = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        };
        const referer = this.config.get('OPENROUTER_HTTP_REFERER');
        if (referer)
            openRouterHeaders['HTTP-Referer'] = referer;
        const title = this.config.get('OPENROUTER_X_TITLE');
        if (title)
            openRouterHeaders['X-Title'] = title;
        let openRouterRes;
        try {
            openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: openRouterHeaders,
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                    provider: { sort: 'latency' },
                    reasoning: { enabled: true },
                }),
            });
        }
        catch (error) {
            this.conversations.popLastMessage(conversation);
            const errMessage = error instanceof Error ? error.message : 'Request failed';
            res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json(openRouterErrorJson(errMessage));
            return;
        }
        if (!openRouterRes.ok) {
            this.conversations.popLastMessage(conversation);
            const errBody = await openRouterRes.text();
            let errMessage = 'Request failed';
            try {
                const errJson = JSON.parse(errBody);
                errMessage = errJson?.error?.message ?? errMessage;
            }
            catch {
            }
            res.status(openRouterRes.status).json(openRouterErrorJson(errMessage));
            return;
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
        let fullContent = '';
        let lastChunk = null;
        let streamError = null;
        const reader = openRouterRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buffer.indexOf('\n\n')) >= 0) {
                    const block = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    const lines = block.split(/\r\n|\n|\r/);
                    const dataParts = [];
                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            dataParts.push(line.slice(5).replace(/^\s/, ''));
                        }
                    }
                    const dataStr = dataParts.join('\n').trim();
                    if (!dataStr)
                        continue;
                    if (dataStr === '[DONE]')
                        break;
                    let chunk;
                    try {
                        chunk = JSON.parse(dataStr);
                    }
                    catch {
                        continue;
                    }
                    if (chunk?.error) {
                        streamError = chunk.error;
                        sendSSE(res, 'error', openRouterErrorJson(chunk.error?.message ?? 'Stream error'));
                        break;
                    }
                    const delta = chunk?.choices?.[0]?.delta?.content;
                    if (typeof delta === 'string') {
                        fullContent += delta;
                        sendSSE(res, 'delta', { delta });
                    }
                    if (chunk?.usage != null)
                        lastChunk = { usage: chunk.usage };
                }
                if (streamError)
                    break;
            }
        }
        catch (err) {
            streamError = err;
            sendSSE(res, 'error', openRouterErrorJson(err instanceof Error ? err.message : 'Stream failed'));
        }
        if (streamError) {
            this.conversations.popLastMessage(conversation);
            res.end();
            return;
        }
        const lastUsage = lastChunk?.usage ?? null;
        const costUsd = typeof lastUsage?.cost === 'number'
            ? lastUsage.cost
            : null;
        const rate = await getUsdToRubRate();
        const { costRub, costRubFinal } = calculateRub(costUsd, rate, COMMISSION_MULTIPLIER);
        const text = normalizeMessageContent(fullContent) || '';
        this.conversations.appendAssistantMessage(conversation, text, {
            costUsd: costUsd ?? undefined,
            costRub: costRub ?? undefined,
            costRubFinal: costRubFinal ?? undefined,
            rate,
            usage: lastUsage,
        });
        this.conversations.logUsage(model, messageText, costUsd ?? 0, costRub ?? 0, costRubFinal ?? 0, rate);
        if (isFirstUserMessage && conversation.title === 'Новый диалог') {
            this.conversations.scheduleTitleUpdate(conversation, messageText);
        }
        sendSSE(res, 'done', {
            conversation,
            text,
            usage: lastUsage,
            costUsd,
            costRub,
            costRubFinal,
            rate,
        });
        res.end();
    }
};
exports.ConversationsController = ConversationsController;
__decorate([
    (0, common_1.Get)('models'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], ConversationsController.prototype, "getModels", null);
__decorate([
    (0, common_1.Get)('conversations'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Post)('conversations'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "createConversation", null);
__decorate([
    (0, common_1.Get)('conversations/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "getConversation", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "streamMessage", null);
exports.ConversationsController = ConversationsController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [conversations_service_2.ConversationsService,
        openrouter_service_1.OpenRouterService,
        config_1.ConfigService])
], ConversationsController);
//# sourceMappingURL=conversations.controller.js.map