import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchBlogPost } from '@entities/blog-post/api';

type Props = { params: Promise<{ slug: string }> };

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
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
