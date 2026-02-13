import { notFound } from 'next/navigation';
import { ChatClient } from '@features/chat/ui/ChatClient';
import { fetchModels } from '@entities/model/api';
import { slugFromModelId } from '@shared/lib/slug';
import { ModelLinksList } from '@widgets/model-links-list';

type Props = { params: Promise<{ slug: string }> };

export default async function ModelPage({ params }: Props) {
  const { slug } = await params;
  const models = await fetchModels();
  const modelPage = models.find((m) => slugFromModelId(m.id) === slug);
  if (!modelPage) notFound();

  const modelPages = models.map((m) => ({
    id: m.id,
    label: m.label,
    slug: slugFromModelId(m.id),
  }));

  return (
    <main className="container">
      <header className="header">
        <h1>{modelPage.label} — ИИ онлайн бесплатно, AI онлайн</h1>
      </header>
      <ChatClient defaultModelId={modelPage.id} initialModels={models} />
      <section className="seo">
        <h2>{modelPage.label} — ИИ онлайн бесплатно, ответы и идеи от нейросети</h2>
        <p>
          {modelPage.label} — ИИ онлайн бесплатно: модель для общения в одном окне. AI онлайн без
          регистрации: формулируйте вопросы, уточняйте детали и получайте структурированные ответы.
        </p>
        <ul>
          <li>{modelPage.label} — ИИ онлайн бесплатно, чат на русском языке</li>
          <li>AI онлайн, AI бесплатно — структурированные ответы и краткие выводы</li>
          <li>ИИ бесплатно — быстрый старт без регистрации</li>
          <li>подходит для учёбы, работы и творчества</li>
        </ul>
      </section>
      <ModelLinksList items={modelPages} currentSlug={slug} />
    </main>
  );
}
