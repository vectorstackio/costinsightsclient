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

export const getReportJson = async (
  month: string
) => {
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: `reports/${month}.json`
      })
    )

    const body =
      await res.Body?.transformToString()

    if (!body) {
      return null
    }

    return JSON.parse(body)

  } catch {
    // console.error(
    //   `Failed to get report for ${month}:`,
    //   err
    // )

    return null
  }
}

export const saveReportPdf = async (
  key: string,
  pdf: Uint8Array
) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: pdf,
      ContentType: 'application/pdf'
    })
  )
}


export const getReportPdf = async (
  key: string
): Promise<Uint8Array | null> => {
  try {
    const response =
      await s3.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key
        })
      )

    if (!response.Body) {
      return null
    }

    return new Uint8Array(
      await response.Body.transformToByteArray()
    )

  } catch (error: unknown) {

    if (
      error instanceof Error &&
      error.name === 'NoSuchKey'
    ) {
      return null
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      '$metadata' in error &&
      typeof error.$metadata === 'object' &&
      error.$metadata !== null &&
      'httpStatusCode' in error.$metadata &&
      error.$metadata.httpStatusCode === 404
    ) {
      return null
    }

    throw error
  }
}