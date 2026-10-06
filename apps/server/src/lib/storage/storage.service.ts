import { createHash } from 'node:crypto';
import { Client } from 'minio';
import type { Readable } from 'node:stream';
import { serverEnv } from '@siteflow/env/server';
import type { StorageService } from './storage.interface.js';

const MAX_PRESIGN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

function validateExpiry(expiresInSeconds: number): void {
  if (
    !Number.isInteger(expiresInSeconds)
    || expiresInSeconds < 1
    || expiresInSeconds > MAX_PRESIGN_EXPIRY_SECONDS
  ) {
    throw new RangeError('Presigned URL expiry must be between 1 and 604800 seconds');
  }
}

function validateObjectKey(key: string): void {
  if (!key || key.startsWith('/') || key.split('/').some((segment) => !segment || segment === '..')) {
    throw new TypeError('Invalid object key');
  }
}

function validatePathSegment(value: string, name: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value;
}

const minioClient = new Client({
  endPoint: serverEnv.MINIO_ENDPOINT,
  port: serverEnv.MINIO_PORT,
  useSSL: serverEnv.MINIO_USE_SSL,
  accessKey: serverEnv.MINIO_ACCESS_KEY,
  secretKey: serverEnv.MINIO_SECRET_KEY,
});

export class MinioStorageService implements StorageService {
  async putPresignedUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    validateObjectKey(key);
    validateExpiry(expiresInSeconds);
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) {
      throw new TypeError('Invalid content type');
    }
    return minioClient.presignedPutObject(serverEnv.MINIO_BUCKET_DOCUMENTS, key, expiresInSeconds);
  }

  async getPresignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    validateObjectKey(key);
    validateExpiry(expiresInSeconds);
    return minioClient.presignedGetObject(serverEnv.MINIO_BUCKET_DOCUMENTS, key, expiresInSeconds);
  }

  async deleteObject(key: string): Promise<void> {
    validateObjectKey(key);
    await minioClient.removeObject(serverEnv.MINIO_BUCKET_DOCUMENTS, key);
  }

  async headObject(
    key: string,
  ): Promise<{ size: number; etag: string; contentType: string } | null> {
    validateObjectKey(key);
    try {
      const stat = await minioClient.statObject(serverEnv.MINIO_BUCKET_DOCUMENTS, key);
      return {
        size: stat.size,
        etag: stat.etag,
        contentType: stat.metaData?.['content-type'] ?? stat.metaData?.['Content-Type'] ?? '',
      };
    } catch (error) {
      if (
        error !== null
        && typeof error === 'object'
        && 'code' in error
        && (error.code === 'NotFound' || error.code === 'NoSuchKey')
      ) {
        return null;
      }
      throw error;
    }
  }

  objectKey(
    orgId: string,
    projectId: string,
    category: string,
    fileId: string,
    ext: string,
  ): string {
    const safeOrgId = validatePathSegment(orgId, 'organization id');
    const safeProjectId = validatePathSegment(projectId, 'project id');
    const safeCategory = validatePathSegment(category, 'category');
    const safeFileId = validatePathSegment(fileId, 'file id');
    const safeExtension = validatePathSegment(ext.replace(/^\./, '').toLowerCase(), 'extension');
    const [year, month] = new Date().toISOString().slice(0, 7).split('-');
    return `${safeOrgId}/${safeProjectId}/${safeCategory}/${year}/${month}/${safeFileId}.${safeExtension}`;
  }
}

export async function calculateObjectSha256(key: string): Promise<string> {
  validateObjectKey(key);
  const stream = await minioClient.getObject(serverEnv.MINIO_BUCKET_DOCUMENTS, key) as Readable;
  const hash = createHash('sha256');
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}
