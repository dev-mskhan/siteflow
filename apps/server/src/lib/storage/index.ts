import { MinioStorageService } from './storage.service.js';
import type { StorageService } from './storage.interface.js';

let storageService: StorageService | undefined;

export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = new MinioStorageService();
  }
  return storageService;
}

export type { StorageService } from './storage.interface.js';
