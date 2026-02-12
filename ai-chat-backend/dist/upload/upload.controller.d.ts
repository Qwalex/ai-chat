import { ConfigService } from '@nestjs/config';
export declare class UploadController {
    private readonly config;
    private readonly uploadsDir;
    private readonly publicUrl;
    constructor(config: ConfigService);
    uploadImages(body: {
        images?: string[];
    }): {
        urls: string[];
    };
}
