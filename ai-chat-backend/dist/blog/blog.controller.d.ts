import { BlogService } from './blog.service';
export declare class BlogController {
    private readonly blog;
    constructor(blog: BlogService);
    listPosts(): {
        posts: {
            slug: string;
            title: string;
        }[];
    };
    getPost(slug: string): {
        title: string;
        html: string;
    };
}
