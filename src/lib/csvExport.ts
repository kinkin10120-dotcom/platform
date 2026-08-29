// 쉼표/줄바꿈/따옴표가 섞인 값도 안전하게 CSV 셀로 감싼다.
function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 맨 앞에 붙인다.
  const csv = "﻿" + [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
