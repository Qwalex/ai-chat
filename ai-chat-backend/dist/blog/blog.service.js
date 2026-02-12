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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const marked_1 = require("marked");
let BlogService = class BlogService {
    constructor(config) {
        this.config = config;
        this.listPosts = () => {
            try {
                const files = fs.readdirSync(this.blogDir) || [];
                const posts = [];
                for (const file of files) {
                    if (!file.endsWith('.md'))
                        continue;
                    const slug = file.slice(0, -3);
                    const filePath = path.join(this.blogDir, file);
                    const raw = fs.readFileSync(filePath, 'utf8');
                    const firstLine = (raw.split('\n')[0] || '').replace(/^\uFEFF/, '').trim();
                    const titleMatch = firstLine.match(/^#\s+(.+)$/);
                    const title = titleMatch
                        ? titleMatch[1].trim()
                        : firstLine.startsWith('#')
                            ? firstLine.replace(/^#\s*/, '').trim() || slug
                            : slug;
                    posts.push({ slug, title });
                }
                return posts.sort((a, b) => a.slug.localeCompare(b.slug));
            }
            catch {
                return [];
            }
        };
        this.getPostBySlug = (slug) => {
            const safeSlug = path.basename(slug, '.md').replace(/[^a-z0-9_-]/gi, '');
            const filePath = path.join(this.blogDir, `${safeSlug}.md`);
            try {
                if (!fs.existsSync(filePath))
                    return null;
                const raw = fs.readFileSync(filePath, 'utf8');
                const firstLine = (raw.split('\n')[0] || '').replace(/^\uFEFF/, '').trim();
                const titleMatch = firstLine.match(/^#\s+(.+)$/);
                const title = titleMatch
                    ? titleMatch[1].trim()
                    : firstLine.startsWith('#')
                        ? firstLine.replace(/^#\s*/, '').trim() || safeSlug
                        : safeSlug;
                const html = marked_1.marked.parse(raw, { async: false });
                return { title, html };
            }
            catch {
                return null;
            }
        };
        this.blogDir = path.join(process.cwd(), 'blog');
    }
};
exports.BlogService = BlogService;
exports.BlogService = BlogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BlogService);
//# sourceMappingURL=blog.service.js.map