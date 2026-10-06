import { describe, expect, it } from 'vitest';
import { getStorageService } from '../../../src/lib/storage/index.js';
import {
  calculateObjectSha256,
  MinioStorageService,
} from '../../../src/lib/storage/storage.service.js';

describe('MinioStorageService', () => {
  it('builds tenant-scoped object keys with a UTC year/month path', () => {
    const service = new MinioStorageService();
    const currentMonth = new Date().toISOString().slice(0, 7).replace('-', '/');

    expect(service.objectKey('org-1', 'project-1', 'REPORT', 'file-1', '.pdf')).toBe(
      `org-1/project-1/REPORT/${currentMonth}/file-1.pdf`,
    );
  });

  it('rejects unsafe object key path segments', () => {
    const service = new MinioStorageService();

    expect(() => service.objectKey('../org', 'project-1', 'REPORT', 'file-1', 'pdf')).toThrow(
      'Invalid organization id',
    );
  });

  it('returns the same storage service instance on repeated access', () => {
    expect(getStorageService()).toBe(getStorageService());
  });

  it('uploads and verifies a private object through MinIO presigned URLs', async () => {
    const service = getStorageService();
    const fileId = `storage-test-${crypto.randomUUID()}`;
    const key = service.objectKey('test-org', 'test-project', 'REPORT', fileId, 'txt');
    const contents = `SiteFlow MinIO integration test ${fileId}`;
    const expectedHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contents));
    const checksum = Buffer.from(expectedHash).toString('hex');

    try {
      const uploadUrl = await service.putPresignedUrl(key, 'text/plain', 60);
      const upload = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': 'text/plain' },
        body: contents,
      });
      expect(upload.status).toBe(200);

      const metadata = await service.headObject(key);
      expect(metadata).toMatchObject({ size: Buffer.byteLength(contents), contentType: 'text/plain' });
      expect(await calculateObjectSha256(key)).toBe(checksum);

      const downloadUrl = await service.getPresignedUrl(key, 60);
      const download = await fetch(downloadUrl);
      expect(download.status).toBe(200);
      expect(await download.text()).toBe(contents);
    } finally {
      await service.deleteObject(key);
    }

    expect(await service.headObject(key)).toBeNull();
  });
});
