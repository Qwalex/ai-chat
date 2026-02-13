import { getBaseUrl } from '@shared/api/base';
import type { BlogPostFull, BlogPostListItem } from './types';

export type { BlogPostListItem, BlogPostFull } from './types';

export const fetchBlogPosts = async (): Promise<BlogPostListItem[]> => {
  const res = await fetch(`${getBaseUrl()}/api/blog`);
  const data = await res.json().catch(() => ({}));
  return data?.posts ?? [];
};

export const fetchBlogPost = async (slug: string): Promise<BlogPostFull | null> => {
  const res = await fetch(`${getBaseUrl()}/api/blog/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data?.title != null ? { title: data.title, html: data.html ?? '' } : null;
};
