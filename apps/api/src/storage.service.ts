import { Injectable } from '@nestjs/common';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private bucket = process.env.S3_BUCKET!;
  private ttl = Number(process.env.S3_PRESIGNED_TTL_SECONDS || 3600);
  private s3 = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  uploadUrl(key: string, mime: string) {
    return getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mime, ServerSideEncryption: 'AES256' }), { expiresIn: this.ttl });
  }

  async createMultipart(key: string, mime: string) {
    const result = await this.s3.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: mime, ServerSideEncryption: 'AES256' }));
    if (!result.UploadId) throw new Error('Impossible de démarrer l’import multipart');
    return result.UploadId;
  }

  multipartPartUrl(key: string, uploadId: string, partNumber: number) {
    return getSignedUrl(this.s3, new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: this.ttl });
  }

  completeMultipart(key: string, uploadId: string, parts: Array<{ partNumber: number; etag: string }>) {
    return this.s3.send(new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.sort((a, b) => a.partNumber - b.partNumber).map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) },
    }));
  }

  abortMultipart(key: string, uploadId: string) {
    return this.s3.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }));
  }

  downloadUrl(key: string, disposition = 'attachment') {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: disposition }), { expiresIn: this.ttl });
  }

  async readBuffer(key: string): Promise<Buffer> {
    const result = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error('Objet S3 vide');
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  putBuffer(key: string, body: Buffer, mime = 'application/octet-stream') {
    return this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mime,
      ServerSideEncryption: 'AES256',
    }));
  }

  copy(sourceKey: string, destinationKey: string) {
    const encodedSource = `${this.bucket}/${sourceKey}`.split('/').map(encodeURIComponent).join('/');
    return this.s3.send(new CopyObjectCommand({
      Bucket: this.bucket,
      Key: destinationKey,
      CopySource: encodedSource,
      ServerSideEncryption: 'AES256',
    }));
  }

  head(key: string) { return this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); }
  delete(key: string) { return this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); }

  async deletePrefixPermanently(prefix: string) {
    let keyMarker: string | undefined;
    let versionIdMarker: string | undefined;
    do {
      const page = await this.s3.send(new ListObjectVersionsCommand({ Bucket: this.bucket, Prefix: prefix, KeyMarker: keyMarker, VersionIdMarker: versionIdMarker }));
      const objects = [
        ...(page.Versions || []).map((v) => ({ Key: v.Key!, VersionId: v.VersionId })),
        ...(page.DeleteMarkers || []).map((v) => ({ Key: v.Key!, VersionId: v.VersionId })),
      ];
      for (let i = 0; i < objects.length; i += 1000) {
        await this.s3.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects.slice(i, i + 1000), Quiet: true } }));
      }
      keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
      versionIdMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined;
    } while (keyMarker);
  }
}
