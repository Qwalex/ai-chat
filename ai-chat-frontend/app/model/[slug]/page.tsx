import ModelPage from '@views/model/ModelPage';
import { fetchModels } from '@entities/model/api';
import { slugFromModelId } from '@shared/lib/slug';

export const revalidate = 60;

export const generateStaticParams = async () => {
  try {
    const models = await fetchModels();
    return models.map((m) => ({ slug: slugFromModelId(m.id) }));
  } catch {
    return [];
  }
};

export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const models = await fetchModels();
  const modelPage = models.find((m) => slugFromModelId(m.id) === slug);
  if (!modelPage) return { title: 'Чат с ИИ' };
  return {
    title: `${modelPage.label} — ИИ онлайн бесплатно, AI онлайн | Чат с ИИ`,
    description: `${modelPage.label} — ИИ онлайн бесплатно. Чат с нейросетью ${modelPage.label}. Ответы с подсветкой кода, история диалогов.`,
  };
};

export default ModelPage;
