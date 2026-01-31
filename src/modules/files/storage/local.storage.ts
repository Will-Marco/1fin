import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageProvider, UploadedFile } from './storage.interface';

@Injectable()
export class LocalStorage implements StorageProvider {
  private readonly logger = new Logger(LocalStorage.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    // Upload papkasini yaratish
    this.ensureDirectoryExists(this.uploadDir);
  }

  async upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFile> {
    const folderPath = path.join(this.uploadDir, folder);
    this.ensureDirectoryExists(folderPath);

    // UUID bilan yangi nom yaratish
    const ext = path.extname(file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(folder, fileName);
    const fullPath = path.join(this.uploadDir, filePath);

    // Faylni yozish
    await fs.promises.writeFile(fullPath, file.buffer);

    this.logger.log(`File uploaded: ${filePath}`);

    return {
      originalName: file.originalname,
      fileName,
      path: filePath,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);

    try {
      if (await this.exists(filePath)) {
        await fs.promises.unlink(fullPath);
        this.logger.log(`File deleted: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filePath}`, error);
      throw error;
    }
  }

  getUrl(filePath: string): string {
    return `${this.baseUrl}/uploads/${filePath}`;
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.uploadDir, filePath);

    try {
      await fs.promises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger.log(`Directory created: ${dir}`);
    }
  }
}
