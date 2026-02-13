import {
  BadRequestException,
  Body,
  Controller,
  Post,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const MAX_IMAGES_PER_REQUEST = 10;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB

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
  @UseGuards(JwtAuthGuard)
  uploadImages(@Body() body: { images?: string[] }) {
    const dataUrls = Array.isArray(body.images) ? body.images : [];
    if (dataUrls.length === 0) {
      throw new BadRequestException('images array required');
    }
    if (dataUrls.length > MAX_IMAGES_PER_REQUEST) {
      throw new BadRequestException(`max ${MAX_IMAGES_PER_REQUEST} images per request`);
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
      if (buffer.length > MAX_IMAGE_BYTES) {
        throw new BadRequestException(`image size must not exceed ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
      }
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
