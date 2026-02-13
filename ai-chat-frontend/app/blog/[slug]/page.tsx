import BlogPostPage from '@views/blog-post/BlogPostPage';
import { fetchBlogPost, fetchBlogPosts } from '@entities/blog-post/api';

export const revalidate = 60;

export const generateStaticParams = async () => {
  try {
    const posts = await fetchBlogPosts();
    return posts.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
};

export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const post = await fetchBlogPost(slug);
  if (!post) return { title: 'Блог | Чат с ИИ' };
  return { title: `${post.title} | Блог | Чат с ИИ` };
};

export default BlogPostPage;
