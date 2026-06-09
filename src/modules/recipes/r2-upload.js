// src/modules/recipes/r2-upload.js
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import r2, { R2_BUCKET } from '../../config/r2.js';
import { randomUUID } from 'crypto';

/**
 * Upload a multer file buffer to R2.
 * Returns the stored path (e.g. "recipes/uuid.jpg")
 */
export async function uploadToR2(file, folder = 'recipes') {
  const ext  = file.originalname.split('.').pop();
  const key  = `${folder}/${randomUUID()}.${ext}`;

  await r2.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         key,
    Body:        file.buffer,
    ContentType: file.mimetype,
  }));

  return key;
}

/**
 * Delete a file from R2 by its stored path.
 */
export async function deleteFromR2(path) {
  await r2.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key:    path,
  }));
}

/**
 * Fetch file bytes from R2 — used for PDF export.
 * Returns { buffer, contentType }
 */
export async function getFromR2(path) {
  const response = await r2.send(new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key:    path,
  }));

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  return {
    buffer:      Buffer.concat(chunks),
    contentType: response.ContentType ?? 'image/jpeg',
  };
}
