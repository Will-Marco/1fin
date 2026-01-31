export interface UploadedFile {
  originalName: string;
  fileName: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  /**
   * Faylni yuklash
   */
  upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFile>;

  /**
   * Faylni o'chirish
   */
  delete(path: string): Promise<void>;

  /**
   * Faylni olish (URL yoki path)
   */
  getUrl(path: string): string;

  /**
   * Fayl mavjudligini tekshirish
   */
  exists(path: string): Promise<boolean>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
