"use server";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.DO_SPACES_ENDPOINT;
const bucket = process.env.DO_SPACES_BUCKET;
const accessKey = process.env.DO_SPACES_KEY;
const secretKey = process.env.DO_SPACES_SECRET;

function getS3Client(): S3Client | null {
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: false,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

/** 엑셀 파일을 DigitalOcean Spaces에 업로드(원본 백업). README: 엑셀 업로드 웹 → 저장 시 Spaces 보관 */
export async function uploadExcelToSpaces(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "엑셀 파일을 선택해 주세요." };
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return { ok: false, error: ".xlsx 또는 .xls 파일만 업로드할 수 있습니다." };
  }

  const client = getS3Client();
  if (!client) {
    return { ok: false, error: "스토리지 설정(DO_SPACES_*)이 없습니다. .env를 확인해 주세요." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `uploads/${Date.now()}_${file.name}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "업로드 실패";
    return { ok: false, error: message };
  }
}
