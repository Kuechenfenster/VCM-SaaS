import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

const BUCKET = process.env.S3_BUCKET || 'vcm-saas-uploads';

export function getS3Key(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    try {
      const url = new URL(pathOrUrl);
      return decodeURIComponent(url.pathname.replace(/^\//, ''));
    } catch {
      return pathOrUrl;
    }
  }
  return pathOrUrl;
}

export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<{ url: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return { url, key };
}

export async function getFileUrl(
  pathOrUrl: string,
  expiresIn = 3600
): Promise<string> {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: pathOrUrl,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteFile(pathOrUrl: string): Promise<void> {
  const key = getS3Key(pathOrUrl);
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}
