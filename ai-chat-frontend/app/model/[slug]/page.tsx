import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChatClient } from '@/components/ChatClient';
import { fetchModels } from '@/lib/api';
import { slugFromModelId } from '@/lib/slug';

export const dynamic = 'force-dynamic';

type Props = { params: { slug: string } };

export default async function ModelPage({ params }: Props) {
  const { slug } = params;
  const models = await fetchModels();
  const modelPage = models.find((m) => slugFromModelId(m.id) === slug);
  if (!modelPage) notFound();

  const title = `${modelPage.label} — ИИ онлайн бесплатно, AI онлайн | Чат с ИИ`;
  const description = `${modelPage.label} — ИИ онлайн бесплатно, AI бесплатно. Чат с нейросетью ${modelPage.label}. Ответы с подсветкой кода, история диалогов.`;

  return (
    <main className="container">
      <header className="header">
        <h1>{modelPage.label} — ИИ онлайн бесплатно, AI онлайн</h1>
      </header>
      <ChatClient defaultModelId={modelPage.id} />
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
      <section className="model-links">
        <h2>Модели в чате</h2>
        <ul className="model-links-list">
          {models.map((m) => (
            <li key={m.id} className="model-link-item">
              <Link href={slugFromModelId(m.id) === slug ? '#' : `/model/${slugFromModelId(m.id)}`}>
                {m.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = params;
  const models = await fetchModels();
  const modelPage = models.find((m) => slugFromModelId(m.id) === slug);
  if (!modelPage) return { title: 'Чат с ИИ' };
  return {
    title: `${modelPage.label} — ИИ онлайн бесплатно, AI онлайн | Чат с ИИ`,
    description: `${modelPage.label} — ИИ онлайн бесплатно. Чат с нейросетью ${modelPage.label}. Ответы с подсветкой кода, история диалогов.`,
  };
}
