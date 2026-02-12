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
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const models_constants_1 = require("../models/models.constants");
const openrouter_service_1 = require("../openrouter/openrouter.service");
const conversations_service_1 = require("../conversations/conversations.service");
const USD_TO_RUB_RATE = Number(process.env.USD_TO_RUB_RATE) || 90;
const USD_RATE_API = process.env.USD_RATE_API || 'https://open.er-api.com/v6/latest/USD';
const USD_RATE_CACHE_MS = Number(process.env.USD_RATE_CACHE_MS) || 10 * 60 * 1000;
const COMMISSION_MULTIPLIER = Number(process.env.COMMISSION_MULTIPLIER) || 1.5;
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
let ChatController = class ChatController {
    constructor(openRouter, conversations) {
        this.openRouter = openRouter;
        this.conversations = conversations;
    }
    async chat(body) {
        const message = typeof body.message === 'string' ? body.message : '';
        if (!message) {
            throw new common_1.BadRequestException('message is required');
        }
        const client = this.openRouter.getClient();
        if (!client) {
            throw new common_1.InternalServerErrorException('OPENROUTER_API_KEY is not set');
        }
        const model = this.conversations.getModel(body.model);
        const messages = [
            { role: 'system', content: (0, models_constants_1.getSystemPromptForModel)(model) },
        ];
        if (body.system && typeof body.system === 'string') {
            messages.push({ role: 'system', content: body.system });
        }
        messages.push({ role: 'user', content: message });
        try {
            const result = await client.chat.send({
                model,
                messages: messages,
                stream: false,
            });
            const rawContent = result?.choices?.[0]?.message?.content;
            const text = normalizeMessageContent(rawContent) || '';
            const usage = result?.usage;
            const costUsd = typeof usage?.cost === 'number' ? usage.cost : null;
            const rate = await getUsdToRubRate();
            const { costRub, costRubFinal } = calculateRub(costUsd, rate, COMMISSION_MULTIPLIER);
            return {
                text,
                costUsd,
                costRub,
                costRubFinal,
                rate,
                usage: usage ?? null,
                raw: result,
            };
        }
        catch (error) {
            const errMessage = error instanceof Error ? error.message : 'Request failed';
            throw new common_1.InternalServerErrorException(errMessage);
        }
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)('chat'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "chat", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [openrouter_service_1.OpenRouterService,
        conversations_service_1.ConversationsService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map