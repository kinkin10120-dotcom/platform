"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Copy, Check, Printer, X } from "lucide-react";
import { isIosDevice, isStandaloneMode, isInAppBrowser } from "@/lib/pwa";
import PdfPageScaler from "@/components/PdfPageScaler";
import { usePrintFileName } from "@/lib/usePrintFileName";
import ContractPreviewDocument, { ContractPreviewData } from "@/components/ContractPreviewDocument";

// 예전엔 position:fixed로 화면을 덮는 모달이었는데, 그 안에서는 크롬/사파리 인쇄 엔진이 여러
// 페이지로 못 나누고 한 페이지로 뭉개는 문제가 있어서, "화면 밖에 항상 숨겨둔 인쇄 전용
// 사본"을 따로 계산해 인쇄하는 우회 구조를 썼다. 근데 그 사본이(화면에 실제 보이는 진짜
// 미리보기는 항상 정확한데도) 페이지 나눔을 잘못 계산하는 새 버그가 있었다 — 화면 밖 아주
// 먼 좌표에 놓인 콘텐츠라 모바일 사파리가 다르게 측정한 것으로 추정된다.
//
// 그래서 이 컴포넌트를 "떠 있는 모달"이 아니라 호출한 화면 내용을 통째로 대신하는 "일반
// 페이지 내용"으로 바꿨다 — 사본 자체가 필요 없어져서(화면에 보이는 것 = 인쇄되는 것) 이
// 버그가 구조적으로 사라지고, 핀치 줌·상단바 고정도 일반 페이지처럼 정상 동작한다. 인쇄
// 시에는 이 컴포넌트만 남기고 나머지 페이지(사이드바 등)를 visibility로 숨긴다.
export default function ContractPreviewModal({
  data,
  onClose,
  noAppChrome,
}: {
  data: ContractPreviewData;
  onClose: () => void;
  // 관리자 쪽 (app) 레이아웃 안에서 쓸 때는 그 레이아웃의 상단바(h-14)·사이드바(md:left-56)를
  // 피해서 붙어야 하지만, 고객이 보는 /contracts/sign 페이지는 그런 레이아웃 자체가 없는
  // 완전히 독립된 라우트라 그 여백을 상쇄하려던 음수 마진과 상단바 오프셋이 오히려 내용을
  // 엉뚱한 위치로 밀어 헤더가 붕 뜨고 로고가 겹쳐 보였다 — 그 경우엔 이 값을 켜서 순수
  // top-0 기준으로 그린다.
  noAppChrome?: boolean;
}) {
  const [standalone, setStandalone] = useState(false);
  const [copied, setCopied] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    setStandalone(isInAppBrowser() || (isIosDevice() && isStandaloneMode()));
  }, []);

  usePrintFileName([data.companyName, data.title, data.productName]);

  // position:sticky는 (app) 레이아웃의 <main>이 위쪽에 자체 여백을 갖고 있어서 스크롤 중에
  // "완전히 뷰포트 상단에 붙어있는" 상태를 보장하지 못했다(스크롤하면 그 여백만큼 본문이
  // 헤더 바 위로 비쳐 보였다) — 대신 앱 자체 상단바(z-20)와 똑같이 position:fixed로 뷰포트에
  // 직접 고정하고(z-30로 그 위에 덮어씀), 실제 렌더링된 높이를 측정해 본문 쪽에 그만큼
  // padding-top으로 돌려준다. 배너(홈 화면 추가 시 안내문) 유무에 따라 높이가 달라지므로
  // 고정값 대신 매번 측정한다.
  useLayoutEffect(() => {
    function measure() {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [standalone]);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      id="contract-print-root"
      className={
        noAppChrome
          ? "min-h-screen bg-[#e5e5e5] print:m-0 print:mt-0 print:bg-white"
          : "-mx-4 -mt-[calc(4.5rem+env(safe-area-inset-top))] -mb-4 min-h-screen bg-[#e5e5e5] md:-mx-6 md:-mt-[calc(5.5rem+env(safe-area-inset-top))] md:-mb-6 print:m-0 print:mt-0 print:bg-white"
      }
    >
      <style>{`
        @page { size: 210mm 297mm; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          #contract-print-root, #contract-print-root * { visibility: visible; }
          #contract-print-root { position: absolute; top: 0; left: 0; width: 210mm; }
          /* min-height:0이 핵심이다 — .po-page는 화면용으로 인라인 style min-height:297mm를
             갖고 있는데(짧은 페이지도 항상 A4 한 장 높이로 보이게), 인쇄 시 이걸 그대로 두면
             실제 콘텐츠 높이가 반올림 오차 등으로 297mm 경계에 정확히 걸려서, 인쇄 엔진이
             그 미세한 초과분만으로 페이지를 한 번 더 쪼갠 뒤(그 몫이 사실상 빈 페이지),
             CSS의 break-after까지 또 적용되어 총 2번 넘어가버린다 — 실제로 한 페이지 다음에
             빈 페이지가 하나 끼고 그다음 내용이 나오는 증상과 정확히 일치했다. 콘텐츠가 항상
             예산보다 여유 있게 짧다는 게 이미 보장되어 있으므로(SAFETY_BUFFER_PX) min-height
             강제를 없애고 실제 콘텐츠 높이 그대로 렌더링하면 이 경계 문제 자체가 사라진다. */
          .po-page { box-shadow: none !important; margin: 0 !important; min-height: 0 !important; }
          .pdf-scale-wrapper { width: auto !important; height: auto !important; }
          .pdf-scale-inner { transform: none !important; width: 210mm !important; }
          /* 헤더 높이만큼 인라인 style로 준 padding-top은 인쇄 시(헤더 자체가 안 보이므로)
             필요 없다 — 인라인 style은 !important 없이는 다른 규칙으로 못 이겨서 명시한다. */
          .contract-preview-body { padding-top: 0 !important; }
        }
      `}</style>

      {/* top-14(56px)는 앱 자체 상단바(h-14, z-20) 바로 아래에 이어붙이는 위치다 — 앱
          상단바를 덮어쓰는 게 아니라 그대로 두고 그 밑에 붙여야 한다는 요청이라, z-index도
          앱 상단바보다 낮게 둔다(어차피 겹칠 일이 없다). */}
      <div
        ref={headerRef}
        className={
          noAppChrome
            ? "fixed inset-x-0 top-0 z-10 border-b border-[#e5e5e5] bg-white/90 px-4 py-3 backdrop-blur-xl print:hidden"
            : "fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-10 border-b border-[#e5e5e5] bg-white/90 px-4 py-3 backdrop-blur-xl print:hidden md:left-56"
        }
      >
        <div className="mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
              title="닫기"
            >
              <X size={16} />
            </button>
            <p className="text-sm text-[#86868b]">계약서 미리보기 — 인쇄 시 A4 크기로 저장됩니다.</p>
          </div>
          {standalone ? (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "복사됨" : "링크 복사"}
            </button>
          ) : (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              <Printer size={15} /> 인쇄 / PDF 저장
            </button>
          )}
        </div>
        {standalone && (
          <p className="mx-auto mt-2 w-full max-w-[210mm] rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
            이 화면(홈 화면 추가 앱 또는 카카오톡·네이버 등 인앱 브라우저)에서는 인쇄/PDF 저장이 동작하지 않아요. 위 &quot;링크 복사&quot; 버튼으로 링크를 복사해서 사파리 브라우저에 붙여넣어 열어주세요.
          </p>
        )}
      </div>

      <div className="contract-preview-body px-4 pb-10 print:p-0" style={{ paddingTop: 56 + headerHeight }}>
        <PdfPageScaler>
          <ContractPreviewDocument data={data} />
        </PdfPageScaler>
      </div>
    </div>
  );
}
