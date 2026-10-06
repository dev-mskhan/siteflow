export interface StorageService {
  putPresignedUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>;
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  headObject(key: string): Promise<{ size: number; etag: string; contentType: string } | null>;
  objectKey(
    orgId: string,
    projectId: string,
    category: string,
    fileId: string,
    ext: string,
  ): string;
}
