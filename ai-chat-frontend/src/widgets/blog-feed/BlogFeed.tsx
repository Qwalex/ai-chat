import Link from 'next/link';
import type { BlogPostListItem } from '@entities/blog-post/api';

type Props = {
  posts: BlogPostListItem[];
  limit?: number;
  intro?: string | null;
};

export const BlogFeed = ({ posts, limit = 10, intro = null }: Props) => {
  const slice = posts.slice(0, limit);
  if (slice.length === 0) return null;
  return (
    <section className="blog-feed" id="blog-feed">
      <h2>Блог</h2>
      {intro != null && <p className="blog-feed-intro">{intro}</p>}
      <ul className="blog-feed-list">
        {slice.map((p) => (
          <li key={p.slug} className="blog-feed-item">
            <Link href={`/blog/${p.slug}`}>{p.title}</Link>
          </li>
        ))}
      </ul>
      <p className="blog-feed-more">
        <Link href="/blog">Все статьи →</Link>
      </p>
    </section>
  );
};
