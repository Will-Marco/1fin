import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileType, SystemRole } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { STORAGE_PROVIDER, StorageProvider } from './storage/storage.interface';

// Fayl o'lchamlari (baytlarda)
const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 15 * 1024 * 1024, // 15MB (katta PDF/Excel uchun)
  VOICE: 5 * 1024 * 1024, // 5MB (uzoqroq audio uchun)
  OTHER: 10 * 1024 * 1024, // 10MB
};

// Ruxsat berilgan MIME turlari
const ALLOWED_MIME_TYPES = {
  IMAGE: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  VOICE: [
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
  ],
};

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  /**
   * Fayl turini aniqlash
   */
  private getFileType(mimeType: string): FileType {
    if (ALLOWED_MIME_TYPES.IMAGE.includes(mimeType)) {
      return FileType.IMAGE;
    }
    if (ALLOWED_MIME_TYPES.DOCUMENT.includes(mimeType)) {
      return FileType.DOCUMENT;
    }
    if (ALLOWED_MIME_TYPES.VOICE.includes(mimeType)) {
      return FileType.VOICE;
    }
    return FileType.OTHER;
  }

  /**
   * Fayl o'lchamini tekshirish
   */
  private validateFileSize(size: number, fileType: FileType): void {
    const maxSize = FILE_SIZE_LIMITS[fileType];
    if (size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      throw new BadRequestException(
        `Fayl hajmi ${maxMB}MB dan oshmasligi kerak`,
      );
    }
  }

  /**
   * Faylni yuklash
   */
  async upload(file: Express.Multer.File, dto: UploadFileDto, userId: string) {
    // Clean up empty strings to null/undefined for proper validation
    const cleanedDto = {
      ...dto,
      messageId: dto.messageId?.trim() || undefined,
      documentId: dto.documentId?.trim() || undefined,
      globalDepartmentId: dto.globalDepartmentId?.trim() || undefined,
    };

    // Validate foreign key references if provided
    if (cleanedDto.messageId) {
      const messageExists = await this.prisma.message.findUnique({
        where: { id: cleanedDto.messageId },
        select: { id: true },
      });
      if (!messageExists) {
        throw new NotFoundException(
          `Message with ID ${cleanedDto.messageId} not found. Please create the message first or upload without messageId.`,
        );
      }
    }

    if (cleanedDto.documentId) {
      const documentExists = await this.prisma.document.findUnique({
        where: { id: cleanedDto.documentId },
        select: { id: true },
      });
      if (!documentExists) {
        throw new NotFoundException(
          `Document with ID ${cleanedDto.documentId} not found`,
        );
      }
    }

    if (cleanedDto.globalDepartmentId) {
      const departmentExists = await this.prisma.globalDepartment.findUnique({
        where: { id: cleanedDto.globalDepartmentId },
        select: { id: true },
      });
      if (!departmentExists) {
        throw new NotFoundException(
          `Department with ID ${cleanedDto.globalDepartmentId} not found`,
        );
      }
    }

    // Fayl turini aniqlash
    const fileType = this.getFileType(file.mimetype);

    // Fayl o'lchamini tekshirish
    this.validateFileSize(file.size, fileType);

    // Papka nomini aniqlash
    const folder = this.getFolderName(fileType);

    // Faylni storage ga yuklash
    const uploaded = await this.storage.upload(file, folder);

    // DB ga saqlash
    const savedFile = await this.prisma.file.create({
      data: {
        uploadedBy: userId,
        globalDepartmentId: cleanedDto.globalDepartmentId,
        messageId: cleanedDto.messageId,
        documentId: cleanedDto.documentId,
        originalName: uploaded.originalName,
        fileName: uploaded.fileName,
        fileSize: uploaded.size,
        mimeType: uploaded.mimeType,
        fileType,
        path: uploaded.path,
      },
      include: {
        uploader: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    return {
      ...savedFile,
      url: this.storage.getUrl(savedFile.path),
    };
  }

  /**
   * Bir nechta fayllarni yuklash
   */
  async uploadMultiple(
    files: Express.Multer.File[],
    dto: UploadFileDto,
    userId: string,
  ) {
    const results: Awaited<ReturnType<typeof this.upload>>[] = [];

    for (const file of files) {
      const result = await this.upload(file, dto, userId);
      results.push(result);
    }

    return results;
  }

  /**
   * Faylni olish
   */
  async findOne(id: string, userId: string, systemRole: SystemRole | null) {
    const file = await this.prisma.file.findUnique({
      where: { id },
      include: {
        uploader: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('Fayl topilmadi');
    }

    // O'chirilgan fayllarni faqat admin ko'rishi mumkin
    if (file.isDeleted && !this.isAdmin(systemRole)) {
      throw new NotFoundException('Fayl topilmadi');
    }

    return {
      ...file,
      url: this.storage.getUrl(file.path),
    };
  }

  /**
   * Department fayllarini olish
   */
  async findByDepartment(
    globalDepartmentId: string,
    userId: string,
    systemRole: SystemRole | null,
    page: number = 1,
    limit: number = 20,
    includeDeleted: boolean = false,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { globalDepartmentId };

    // O'chirilgan fayllarni faqat admin ko'rishi mumkin
    if (!includeDeleted || !this.isAdmin(systemRole)) {
      where.isDeleted = false;
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: {
            select: { id: true, name: true, username: true },
          },
        },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      data: files.map((file) => ({
        ...file,
        url: this.storage.getUrl(file.path),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Faylni o'chirish (soft delete)
   */
  async remove(id: string, userId: string, systemRole: SystemRole | null) {
    const file = await this.prisma.file.findUnique({ where: { id } });

    if (!file) {
      throw new NotFoundException('Fayl topilmadi');
    }

    // Faqat yuklagan yoki admin o'chirishi mumkin
    if (file.uploadedBy !== userId && !this.isAdmin(systemRole)) {
      throw new ForbiddenException("Ushbu faylni o'chirish huquqi yo'q");
    }

    await this.prisma.file.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return { message: "Fayl o'chirildi" };
  }

  /**
   * O'chirilgan fayllarni ko'rish (admin only)
   */
  async getDeleted(
    userId: string,
    systemRole: SystemRole | null,
    globalDepartmentId?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    if (!this.isAdmin(systemRole)) {
      throw new ForbiddenException("Faqat admin ko'rishi mumkin");
    }

    const skip = (page - 1) * limit;

    const where: any = { isDeleted: true };
    if (globalDepartmentId) {
      where.globalDepartmentId = globalDepartmentId;
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          uploader: {
            select: { id: true, name: true, username: true },
          },
        },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      data: files.map((file) => ({
        ...file,
        url: this.storage.getUrl(file.path),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Faylni tiklash (admin only)
   */
  async restore(id: string, userId: string, systemRole: SystemRole | null) {
    if (!this.isAdmin(systemRole)) {
      throw new ForbiddenException('Faqat admin tiklashi mumkin');
    }

    const file = await this.prisma.file.findUnique({ where: { id } });

    if (!file) {
      throw new NotFoundException('Fayl topilmadi');
    }

    if (!file.isDeleted) {
      throw new BadRequestException("Fayl o'chirilmagan");
    }

    await this.prisma.file.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
    });

    return { message: 'Fayl tiklandi' };
  }

  /**
   * Faylni butunlay o'chirish (admin only)
   */
  async permanentDelete(
    id: string,
    userId: string,
    systemRole: SystemRole | null,
  ) {
    if (!this.isAdmin(systemRole)) {
      throw new ForbiddenException("Faqat admin o'chirishi mumkin");
    }

    const file = await this.prisma.file.findUnique({ where: { id } });

    if (!file) {
      throw new NotFoundException('Fayl topilmadi');
    }

    // Storage dan o'chirish
    await this.storage.delete(file.path);

    // DB dan o'chirish
    await this.prisma.file.delete({ where: { id } });

    return { message: "Fayl butunlay o'chirildi" };
  }

  /**
   * Faylni xabarga biriktirish (attach file to message after upload)
   */
  async attachToMessage(fileId: string, messageId: string, userId: string) {
    // Check if file exists
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('Fayl topilmadi');
    }

    // Verify the user owns the file
    if (file.uploadedBy !== userId) {
      throw new ForbiddenException(
        "Siz faqat o'zingiz yuklagan fayllarni biriktira olasiz",
      );
    }

    // Check if message exists
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true },
    });
    if (!message) {
      throw new NotFoundException('Xabar topilmadi');
    }

    // Verify the user owns the message
    if (message.senderId !== userId) {
      throw new ForbiddenException(
        "Siz faqat o'zingizning xabaringizga fayl biriktira olasiz",
      );
    }

    // Update file to attach it to message
    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: { messageId },
      include: {
        uploader: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    return {
      ...updatedFile,
      url: this.storage.getUrl(updatedFile.path),
    };
  }

  /**
   * Bir nechta fayllarni xabarga biriktirish
   */
  async attachMultipleToMessage(
    fileIds: string[],
    messageId: string,
    userId: string,
  ) {
    const results: Awaited<ReturnType<typeof this.attachToMessage>>[] = [];

    for (const fileId of fileIds) {
      const result = await this.attachToMessage(fileId, messageId, userId);
      results.push(result);
    }

    return results;
  }

  private getFolderName(fileType: FileType): string {
    switch (fileType) {
      case FileType.IMAGE:
        return 'images';
      case FileType.DOCUMENT:
        return 'documents';
      case FileType.VOICE:
        return 'voice';
      default:
        return 'other';
    }
  }

  private isAdmin(role: SystemRole | null): boolean {
    return role === SystemRole.FIN_ADMIN || role === SystemRole.FIN_DIRECTOR;
  }
}
