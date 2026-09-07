"use client";

import { useEffect } from "react";

// 인쇄/PDF 저장 대화상자가 제안하는 파일 이름은 document.title을 그대로 따른다. 문서 미리보기가
// 전용 라우트(/orders/[id]/print 같은)면 그 페이지에서 제목을 한 번 세팅하면 끝이지만, 관리자
// 화면 위에 겹쳐 뜨는 미리보기(계약서·견적서)는 제목이 사이트 기본값("HANDYWORKS _ 제조
// 파트너와 진짜로 연결되는 방법") 그대로라, 저장해두고도 어느 거래처의 무슨 문서인지 알 수 없다.
//
// 미리보기가 열려있는 동안만 제목을 바꾸고, 닫히면 반드시 원래 값으로 되돌린다 — 안 되돌리면
// 미리보기를 닫고 다른 화면으로 옮겨가도 탭 제목에 계약서·견적서 이름이 그대로 남는다.
export function usePrintFileName(parts: (string | undefined | null)[], enabled = true) {
  const name = parts
    .filter(Boolean)
    .join("_")
    // 저장 대화상자가 경로 구분자 등으로 해석하는 문자는 빼준다 — 품목명에 "1 X 1 X 2"처럼
    // 관리자가 직접 쓴 자유 텍스트가 들어오므로 실제로 걸릴 수 있다.
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  useEffect(() => {
    if (!enabled || !name) return;
    const previous = document.title;
    document.title = name;
    return () => {
      document.title = previous;
    };
  }, [name, enabled]);
}
