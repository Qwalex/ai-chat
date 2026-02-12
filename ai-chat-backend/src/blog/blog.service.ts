import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { marked } from 'marked';

@Injectable()
export class BlogService {
  private readonly blogDir: string;

  constructor(private readonly config: ConfigService) {
    this.blogDir = path.join(process.cwd(), 'blog');
  }

  listPosts = (): { slug: string; title: string }[] => {
    try {
      const files = fs.readdirSync(this.blogDir) || [];
      const posts: { slug: string; title: string }[] = [];
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
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
    } catch {
      return [];
    }
  };

  getPostBySlug = (slug: string): { title: string; html: string } | null => {
    const safeSlug = path.basename(slug, '.md').replace(/[^a-z0-9_-]/gi, '');
    const filePath = path.join(this.blogDir, `${safeSlug}.md`);
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf8');
      const firstLine = (raw.split('\n')[0] || '').replace(/^\uFEFF/, '').trim();
      const titleMatch = firstLine.match(/^#\s+(.+)$/);
      const title = titleMatch
        ? titleMatch[1].trim()
        : firstLine.startsWith('#')
          ? firstLine.replace(/^#\s*/, '').trim() || safeSlug
          : safeSlug;
      const html = marked.parse(raw, { async: false }) as string;
      return { title, html };
    } catch {
      return null;
    }
  };
}
