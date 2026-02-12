import Link from 'next/link';
import { ChatClient } from '@/components/ChatClient';
import { fetchModels, fetchBlogPosts } from '@/lib/api';
import { slugFromModelId } from '@/lib/slug';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let models: { id: string; label: string }[] = [];
  let blogPosts: { slug: string; title: string }[] = [];
  try {
    [models, blogPosts] = await Promise.all([fetchModels(), fetchBlogPosts()]);
  } catch {
    // backend may be unavailable at build time
  }
  const modelPages = models.map((m) => ({
    id: m.id,
    label: m.label,
    slug: slugFromModelId(m.id),
  }));

  return (
    <main className="container">
      <header className="header">
        <h1>ИИ онлайн бесплатно — AI чат</h1>
      </header>
      <ChatClient />
      <section className="seo">
        <h2>ИИ онлайн бесплатно — AI онлайн, десятки моделей в одном окне</h2>
        <p>
          ИИ онлайн бесплатно: веб‑чат с выбором множества нейросетей — Kimi, DeepSeek, Qwen, GPT,
          Mistral, Palmyra, GLM, MiMo, Nemotron, Nova и другие. AI онлайн без регистрации.
        </p>
        <p>
          Есть модели для программирования (Qwen3 Coder, GPT-5.2-Codex), для рассуждений (DeepSeek
          Speciale, Step 3.5 Flash), для общения и творчества (Mistral Small Creative, MiniMax
          M2-her).
        </p>
        <ul>
          <li>ИИ онлайн бесплатно — много моделей на выбор</li>
          <li>AI онлайн, AI бесплатно — чат на русском языке</li>
          <li>структурированные ответы и краткие выводы</li>
          <li>ИИ бесплатно — быстрый старт без регистрации</li>
          <li>подходит для учёбы, работы и творчества</li>
        </ul>
      </section>
      <section className="model-links" id="model-links">
        <h2>Модели в чате</h2>
        <p className="model-links-intro">
          Перейдите на страницу модели — там свой SEO-текст и модель выбрана по умолчанию.
        </p>
        <ul className="model-links-list">
          {modelPages.map((p) => (
            <li key={p.id} className="model-link-item">
              <Link href={`/model/${p.slug}`}>{p.label}</Link>
              <p className="model-link-desc">Чат с {p.label}. Структурированные ответы, подсветка кода.</p>
            </li>
          ))}
        </ul>
      </section>
      {blogPosts.length > 0 && (
        <section className="blog-feed" id="blog-feed">
          <h2>Блог</h2>
          <p className="blog-feed-intro">Статьи и заметки — обзоры и мысли про ИИ и не только.</p>
          <ul className="blog-feed-list">
            {blogPosts.slice(0, 10).map((p) => (
              <li key={p.slug} className="blog-feed-item">
                <Link href={`/blog/${p.slug}`}>{p.title}</Link>
              </li>
            ))}
          </ul>
          <p className="blog-feed-more">
            <Link href="/blog">Все статьи →</Link>
          </p>
        </section>
      )}
    </main>
  );
}
