import 'server-only'
import { requireSession } from '@/lib/auth/server'
// lib/s3/uploadPdf.ts

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from './client'

export const uploadPdfToS3 = async (
  buffer: Uint8Array,
  key: string
) => {
  await requireSession()
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf'
    })
  )

  return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`
}