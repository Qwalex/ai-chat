import { ConfigService } from '@nestjs/config';
export declare class BlogService {
    private readonly config;
    private readonly blogDir;
    constructor(config: ConfigService);
    listPosts: () => {
        slug: string;
        title: string;
    }[];
    getPostBySlug: (slug: string) => {
        title: string;
        html: string;
    } | null;
}
