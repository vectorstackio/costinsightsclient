import 'server-only'
import { requireSession } from '@/lib/auth/server'
// lib/s3/getReports.ts

import { ListObjectsV2Command } from '@aws-sdk/client-s3'

import { s3 } from './client'

import type { ReportHistoryItem } from '@/types'

export const getReports = async (): Promise<ReportHistoryItem[]> => {
  await requireSession()
  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET!,
      Prefix: 'reports/'
    })
  )

  return (
    result.Contents?.map(file => {
      const key = file.Key!

      const month =
        key
          .replace('reports/aws-cost-', '')
          .replace('.pdf', '')

      return {
        month,
        key,

        pdfUrl:
          `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`,

        generatedAt:
          file.LastModified?.toISOString() ?? ''
      }
    }) ?? []
  ).sort((a, b) =>
    b.month.localeCompare(a.month)
  )
}