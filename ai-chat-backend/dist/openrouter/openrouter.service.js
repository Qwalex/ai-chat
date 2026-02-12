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
exports.OpenRouterService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = require("@openrouter/sdk");
let OpenRouterService = class OpenRouterService {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.getClient = () => this.client;
        const apiKey = this.config.get('OPENROUTER_API_KEY');
        if (!apiKey)
            return;
        const httpReferer = this.config.get('OPENROUTER_HTTP_REFERER');
        const xTitle = this.config.get('OPENROUTER_X_TITLE');
        this.client = new sdk_1.OpenRouter({ apiKey, httpReferer, xTitle });
    }
};
exports.OpenRouterService = OpenRouterService;
exports.OpenRouterService = OpenRouterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenRouterService);
//# sourceMappingURL=openrouter.service.js.map