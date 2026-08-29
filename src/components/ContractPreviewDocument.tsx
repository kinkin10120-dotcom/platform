"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Currency } from "@/lib/types";
import { sanitizeContractHtml } from "@/lib/contractSanitize";
import { plainTextToHtml } from "@/lib/contractTemplate";
import { PAGE_HEIGHT_PX, CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX, SAFETY_BUFFER_PX, HEADER_BODY_GAP_PX } from "@/lib/a4Layout";
import { paginateHtml } from "@/lib/contractPagination";

export interface ContractPreviewAttachment {
  id: string;
  title: string;
  bodyHtml: string;
}

// 헤더(제목/당사자/금액/기간/대금지급) 렌더링에 필요한 최소 필드 — 미리보기와 "크게 편집"
// 화면이 동일한 헤더 컴포넌트를 공유하기 위해 별도 타입으로 뺐다.
export interface ContractHeaderData {
  title: string;
  companyName: string;
  productName?: string;
  contactName: string;
  amount: number;
  currency: Currency;
  vatApplicable?: boolean;
  periodStart?: string;
  periodEnd?: string;
  paymentTerms?: string;
  // true면 핸디핸드가 갑, 상대방(companyName)이 을 — 아래 요약 표가 뒤바뀐다.
  handyhandIsGap?: boolean;
}

export interface ContractPreviewData extends ContractHeaderData {
  bodyText: string;
  attachments?: ContractPreviewAttachment[];
  signerName?: string;
  signerTitle?: string;
  signedAt?: number;
  signatureUrl?: string;
  // 서명 완료본에만 존재 — 있으면 매 페이지 하단에 찍어서, 낱장이 인쇄물 상태로 유통되더라도
  // 다른 버전과 바꿔치기된 페이지가 있으면 해시가 달라 바로 드러나게 한다.
  contentHash?: string;
}

// 페이지 크기 상수는 src/lib/a4Layout.ts 공용 정의를 쓴다(ContractBodyEditor의 "크게 편집"
// 화면과 쪽 나눔 기준이 어긋나지 않도록).
// 별첨 제목 줄(굵은 한 줄 + 여백)의 대략적인 높이 — 실측 대신 고정값으로 근사한다.
const ATTACHMENT_HEADER_HEIGHT_PX = 60;

// ContractBodyEditor의 "크게 편집" 화면 상단에도 동일한 헤더를 그대로 재사용한다(편집 중에도
// 미리보기와 같은 위치에 제목/당사자/금액 정보가 보이도록).
export function PageHeader({ data }: { data: ContractHeaderData }) {
  // 계약금액이 달러(USD)면 홍콩 법인(AIM TECHNOLOGY (HK) COMPANY) 명의로 나간다 — 국내계좌로는
  // 실제 USD 해외송금을 받을 수 없어, 견적서·청구서와 마찬가지로 원화 계약과 발행 주체를 분리한다.
  const ourEntityName = data.currency === "USD" ? "AIM TECHNOLOGY (HK) COMPANY" : "주식회사 핸디핸드";
  return (
    <>
      <div className="border-b border-[#1d1d1f] pb-6">
        <h1 className="text-2xl font-bold text-[#1d1d1f]">{data.title}</h1>
        <p className="mt-1 text-sm text-[#86868b]">{data.companyName} · {data.productName || data.contactName}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-[#e5e5e5] py-5 text-sm">
        <div className="col-span-2 grid grid-cols-2 gap-x-6">
          <div>
            <p className="text-[#86868b]">갑</p>
            <p className="mt-0.5 text-[#1d1d1f]">{data.handyhandIsGap ? ourEntityName : data.companyName}</p>
          </div>
          <div>
            <p className="text-[#86868b]">을</p>
            <p className="mt-0.5 text-[#1d1d1f]">{data.handyhandIsGap ? data.companyName : ourEntityName}</p>
          </div>
        </div>
        {data.paymentTerms && (
          <>
            <p className="text-[#86868b]">대금지급 방식</p>
            <p className="whitespace-pre-wrap text-[#1d1d1f]">{data.paymentTerms}</p>
          </>
        )}
      </div>
    </>
  );
}

interface PageDescriptor {
  html: string;
  showMainHeader: boolean;
  attachmentTitle?: string;
}

export default function ContractPreviewDocument({ data }: { data: ContractPreviewData }) {
  const [pages, setPages] = useState<PageDescriptor[] | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let cancelled = false;

    function compute() {
      if (cancelled) return;
      const measureEl = measureRef.current;
      const headerEl = headerRef.current;
      if (!measureEl || !headerEl) return;

      // "크게 편집"(ContractBodyEditor)의 첫 페이지 예산 계산과 똑같이, 헤더 높이에 헤더-본문
      // 사이 여백(HEADER_BODY_GAP_PX, pt-8)까지 더해야 두 화면의 쪽 나눔 위치가 일치한다.
      const headerHeight = headerEl.offsetHeight + HEADER_BODY_GAP_PX;
      const bodyPages = paginateHtml(
        data.bodyText,
        { first: CONTENT_HEIGHT_PX - headerHeight - SAFETY_BUFFER_PX, rest: CONTENT_HEIGHT_PX - SAFETY_BUFFER_PX },
        measureEl
      );

      const descriptors: PageDescriptor[] = bodyPages.map((html, i) => ({
        html,
        showMainHeader: i === 0,
      }));

      for (const attachment of data.attachments ?? []) {
        const attachmentPages = paginateHtml(
          attachment.bodyHtml,
          { first: CONTENT_HEIGHT_PX - ATTACHMENT_HEADER_HEIGHT_PX - SAFETY_BUFFER_PX, rest: CONTENT_HEIGHT_PX - SAFETY_BUFFER_PX },
          measureEl
        );
        attachmentPages.forEach((html, i) => {
          descriptors.push({
            html,
            showMainHeader: false,
            attachmentTitle: i === 0 ? attachment.title : undefined,
          });
        });
      }

      measureEl.innerHTML = "";
      setPages(descriptors);
    }

    // 커스텀 웹폰트(Pretendard)가 로딩되기 전에 측정하면 임시 대체 폰트 기준으로 줄바꿈 위치가
    // 계산돼서, 실제 폰트가 적용된 뒤(특히 인쇄 시)와 쪽 나눔이 어긋난다(미리보기 4쪽인데 실제
    // 인쇄는 6쪽으로 나오는 식) — 폰트 로딩이 끝난 뒤 한 번 더 계산해서 이 오차를 없앤다.
    compute();
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(compute).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.bodyText, data.attachments]);

  return (
    // 화면에선 flex+gap으로 가운데 정렬해 쌓아 보여주지만, 인쇄 시에는 print:block으로 바꾼다 —
    // flex/grid 컨테이너 안에서는 브라우저 인쇄 엔진이 break-after(쪽 나눔)를 제대로 지키지
    // 않는 경우가 많아서, 인쇄 시점엔 일반 블록 흐름으로 되돌려야 A4 쪽 나눔이 실제로 먹는다.
    <div className="flex flex-col items-center gap-6 print:block">
      {/* 화면에 보이지 않는 측정용 요소 — 실제 렌더링과 동일한 폭/폰트로 페이지 분할 위치를 계산한다 */}
      <div
        ref={measureRef}
        aria-hidden
        className="tiptap-content text-[13px] leading-[1.9]"
        style={{ position: "fixed", top: -9999, left: -9999, width: CONTENT_WIDTH_PX }}
      />
      <div
        ref={headerRef}
        aria-hidden
        style={{ position: "fixed", top: -9999, left: -9999, width: CONTENT_WIDTH_PX }}
      >
        <PageHeader data={data} />
      </div>

      {(pages ?? [{ html: "", showMainHeader: true, showSignature: true } as PageDescriptor]).map((page, i, arr) => (
        <div
          key={i}
          className={`po-page relative flex w-[210mm] flex-col bg-white p-[20mm] text-[#1d1d1f] shadow-lg print:w-full print:shadow-none ${i < arr.length - 1 ? "print:break-after-page" : ""}`}
          style={{ minHeight: PAGE_HEIGHT_PX }}
        >
          {page.showMainHeader && <PageHeader data={data} />}
          {page.attachmentTitle && (
            <p className="mb-4 text-base font-bold text-[#1d1d1f]">{page.attachmentTitle}</p>
          )}
          <div
            className={`tiptap-content text-[13px] leading-[1.9] ${page.showMainHeader ? "pt-8" : ""}`}
            dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(plainTextToHtml(page.html)) }}
          />
          {/* 서명 완료본은 종이로 출력되면 낱장이 분리·재조합될 수 있으므로, 모든 페이지 하단에
              문서 해시 앞부분을 남긴다 — 다른 버전의 페이지가 섞여 들어오면 그 장만 해시가
              달라 눈으로 바로 비교해 확인할 수 있다(전체 해시는 관리자 화면에서 대조). 이
              용도상 화면·인쇄 양쪽 다 보여야 하므로 print:hidden을 주지 않는다.
              위치는 좌우와 마찬가지로 실제 여백(20mm) 기준으로 맞춘다 — bottom-4(16px)로
              고정돼 있던 걸 mm 단위로 바꿔서, 페이지 여백 설정과 어긋나지 않게 한다. */}
          <p className="absolute bottom-[8mm] left-[20mm] right-[20mm] flex items-center justify-between text-[10px] text-[#86868b]">
            <span>{data.contentHash ? `문서 해시 ${data.contentHash.slice(0, 16)}…` : ""}</span>
            <span>{i + 1} / {arr.length}쪽</span>
          </p>
        </div>
      ))}
    </div>
  );
}
