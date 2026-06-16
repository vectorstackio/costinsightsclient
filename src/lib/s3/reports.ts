// lib/s3/reports.ts

import { s3 } from './client'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.S3_BUCKET!

export const saveReportJson = async (month: string, report: unknown) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: `reports/${month}.json`,
      Body: JSON.stringify(report),
      ContentType: 'application/json'
    })
  )
}

export const getReportJson = async (month: string) => {
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: `reports/${month}.json`
      })
    )

    const body = await res.Body?.transformToString()

    if (!body) return null

    return JSON.parse(body)
  } catch (err) {
    return {error: err, month: month}
  }
}