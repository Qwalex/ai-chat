import {
  BadRequestException,
  Body,
  Controller,
  Post,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

@Controller('api')
export class UploadController {
  private readonly uploadsDir: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    this.publicUrl = this.config.get<string>('PUBLIC_URL') || 'http://localhost:3001';
    try {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  @Post('upload-images')
  uploadImages(@Body() body: { images?: string[] }) {
    const dataUrls = Array.isArray(body.images) ? body.images : [];
    if (dataUrls.length === 0) {
      throw new BadRequestException('images array required');
    }
    const urls: string[] = [];
    for (const dataUrl of dataUrls) {
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;
      const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) continue;
      const mime = `image/${match[1].toLowerCase()}`;
      const ext = MIME_TO_EXT[mime] || '.bin';
      const base64 = match[2];
      const buffer = Buffer.from(base64, 'base64');
      const name = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(this.uploadsDir, name);
      try {
        fs.writeFileSync(filePath, buffer);
      } catch {
        throw new InternalServerErrorException('Failed to save image');
      }
      urls.push(`${this.publicUrl}/uploads/${name}`);
    }
    return { urls };
  }
}
