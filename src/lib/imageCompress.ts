// 업로드 전 이미지를 리사이즈/재인코딩한다. 휴대폰 카메라 원본(수 MB, 수천 픽셀)을 그대로 올리면
// 실제로는 아주 작게(썸네일 크기로) 표시되는 발주서/청구서 인쇄 시 브라우저가 그 큰 원본을
// 그대로 디코드·축소해야 해서 모바일 인쇄가 눈에 띄게 느려진다.
export async function compressImage(file: File, maxDimension = 1000, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return blob ?? file;
}
