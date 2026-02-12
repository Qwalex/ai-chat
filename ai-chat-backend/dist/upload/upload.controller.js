"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
};
let UploadController = class UploadController {
    constructor(config) {
        this.config = config;
        this.uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        this.publicUrl = this.config.get('PUBLIC_URL') || 'http://localhost:3001';
        try {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
        catch {
        }
    }
    uploadImages(body) {
        const dataUrls = Array.isArray(body.images) ? body.images : [];
        if (dataUrls.length === 0) {
            throw new common_1.BadRequestException('images array required');
        }
        const urls = [];
        for (const dataUrl of dataUrls) {
            if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/'))
                continue;
            const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!match)
                continue;
            const mime = `image/${match[1].toLowerCase()}`;
            const ext = MIME_TO_EXT[mime] || '.bin';
            const base64 = match[2];
            const buffer = Buffer.from(base64, 'base64');
            const name = `${crypto.randomUUID()}${ext}`;
            const filePath = path.join(this.uploadsDir, name);
            try {
                fs.writeFileSync(filePath, buffer);
            }
            catch {
                throw new common_1.InternalServerErrorException('Failed to save image');
            }
            urls.push(`${this.publicUrl}/uploads/${name}`);
        }
        return { urls };
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)('upload-images'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadController.prototype, "uploadImages", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadController);
//# sourceMappingURL=upload.controller.js.map