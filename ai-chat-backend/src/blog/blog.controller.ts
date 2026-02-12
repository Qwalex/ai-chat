import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { BlogService } from './blog.service';

@Controller('api/blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  listPosts() {
    return { posts: this.blog.listPosts() };
  }

  @Get(':slug')
  getPost(@Param('slug') slug: string) {
    const post = this.blog.getPostBySlug(slug);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }
}
