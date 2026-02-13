import Link from 'next/link';
import { ChatClient } from '@features/chat/ui/ChatClient';
import { fetchModels } from '@entities/model/api';
import { fetchBlogPosts } from '@entities/blog-post/api';
import { slugFromModelId } from '@shared/lib/slug';
import { ModelLinksList } from '@widgets/model-links-list';
import { BlogFeed } from '@widgets/blog-feed';

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
      <ChatClient initialModels={models} />
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
      <ModelLinksList
        items={modelPages}
        intro="Перейдите на страницу модели — там свой SEO-текст и модель выбрана по умолчанию."
        showDescriptions
      />
      <BlogFeed
        posts={blogPosts}
        limit={10}
        intro="Статьи и заметки — обзоры и мысли про ИИ и не только."
      />
    </main>
  );
}
