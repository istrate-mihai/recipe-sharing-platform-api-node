// src/config/r2.js
import { S3Client } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // required for R2
});

export const R2_BUCKET  = process.env.R2_BUCKET;
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

/** Build a public URL for a stored path */
export function r2Url(path) {
  return `${R2_PUBLIC_URL}/${path}`;
}

export default r2;
