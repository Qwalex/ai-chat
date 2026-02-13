import Link from 'next/link';
import { slugFromModelId } from '@shared/lib/slug';

export type ModelLinkItem = { id: string; label: string; slug: string };

type Props = {
  items: ModelLinkItem[];
  currentSlug?: string | null;
  intro?: string | null;
  showDescriptions?: boolean;
};

export const ModelLinksList = ({
  items,
  currentSlug = null,
  intro = null,
  showDescriptions = false,
}: Props) => (
  <section className={currentSlug ? 'model-links' : 'model-links'} id="model-links">
    <h2>Модели в чате</h2>
    {intro != null && <p className="model-links-intro">{intro}</p>}
    <ul className="model-links-list">
      {items.map((p) => (
        <li key={p.id} className="model-link-item">
          <Link href={currentSlug && slugFromModelId(p.id) === currentSlug ? '#' : `/model/${p.slug}`}>
            {p.label}
          </Link>
          {showDescriptions && (
            <p className="model-link-desc">Чат с {p.label}. Структурированные ответы, подсветка кода.</p>
          )}
        </li>
      ))}
    </ul>
  </section>
);
