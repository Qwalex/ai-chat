import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchBlogPost } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Props = { params: { slug: string } };

export default async function BlogPostPage({ params }: Props) {
  const { slug } = params;
  const post = await fetchBlogPost(slug);
  if (!post) notFound();

  return (
    <main className="container container--blog">
      <nav className="blog-nav">
        <Link href="/">Главная</Link> · <Link href="/blog">Блог</Link>
      </nav>
      <div className="blog-content">
        <article className="blog-article" dangerouslySetInnerHTML={{ __html: post.html }} />
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = params;
  const post = await fetchBlogPost(slug);
  if (!post) return { title: 'Блог | Чат с ИИ' };
  return {
    title: `${post.title} | Блог | Чат с ИИ`,
  };
}

