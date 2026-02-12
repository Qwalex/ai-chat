"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const conversations_module_1 = require("./conversations/conversations.module");
const models_module_1 = require("./models/models.module");
const openrouter_module_1 = require("./openrouter/openrouter.module");
const blog_module_1 = require("./blog/blog.module");
const upload_module_1 = require("./upload/upload.module");
const chat_module_1 = require("./chat/chat.module");
const write_log_module_1 = require("./write-log/write-log.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(process.cwd(), 'public', 'uploads'),
                serveRoot: '/uploads',
            }),
            write_log_module_1.WriteLogModule,
            models_module_1.ModelsModule,
            openrouter_module_1.OpenRouterModule,
            conversations_module_1.ConversationsModule,
            blog_module_1.BlogModule,
            upload_module_1.UploadModule,
            chat_module_1.ChatModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map