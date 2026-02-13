import Link from 'next/link';
import { fetchBlogPosts } from '@entities/blog-post/api';
export default async function BlogListPage() {
  let posts: { slug: string; title: string }[] = [];
  try {
    posts = await fetchBlogPosts();
  } catch {
    // backend may be unavailable
  }
  return (
    <main className="container container--blog">
      <nav className="blog-nav">
        <Link href="/">Главная</Link> · <Link href="/blog">Блог</Link>
      </nav>
      <div className="blog-content">
        <h1>Блог</h1>
        <ul className="blog-list">
          {posts.map((p) => (
            <li key={p.slug} className="blog-list-item">
              <Link href={`/blog/${p.slug}`}>{p.title}</Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
