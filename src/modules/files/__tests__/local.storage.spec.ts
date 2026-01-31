import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocalStorage } from '../storage/local.storage';
import * as fs from 'fs';

// Mock uuid module
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
  },
}));

describe('LocalStorage', () => {
  let storage: LocalStorage;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'UPLOAD_DIR') return './uploads';
      if (key === 'APP_URL') return 'http://localhost:3000';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStorage,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    storage = module.get<LocalStorage>(LocalStorage);
  });

  describe('upload', () => {
    it('should upload a file and return metadata', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await storage.upload(mockFile, 'images');

      expect(result.originalName).toBe('test.jpg');
      expect(result.fileName).toBe('mock-uuid-1234.jpg');
      expect(result.path).toBe('images/mock-uuid-1234.jpg');
      expect(result.size).toBe(1024);
      expect(result.mimeType).toBe('image/jpeg');
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should create folder if not exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: Buffer.from('pdf content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      await storage.upload(mockFile, 'documents');

      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete an existing file', async () => {
      (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.unlink as jest.Mock).mockResolvedValue(undefined);

      await storage.delete('images/test.jpg');

      expect(fs.promises.unlink).toHaveBeenCalled();
    });

    it('should not throw if file does not exist', async () => {
      (fs.promises.access as jest.Mock).mockRejectedValue(new Error('Not found'));

      await expect(storage.delete('images/nonexistent.jpg')).resolves.not.toThrow();
    });
  });

  describe('getUrl', () => {
    it('should return full URL for file path', () => {
      const url = storage.getUrl('images/test.jpg');

      expect(url).toBe('http://localhost:3000/uploads/images/test.jpg');
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      (fs.promises.access as jest.Mock).mockResolvedValue(undefined);

      const result = await storage.exists('images/test.jpg');

      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      (fs.promises.access as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await storage.exists('images/nonexistent.jpg');

      expect(result).toBe(false);
    });
  });
});
