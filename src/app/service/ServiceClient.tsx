"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, LayoutDashboard, Lightbulb, Layers, Globe, Palette, PenTool, Rocket, Landmark, Cpu, Ruler, Menu, X, Mail } from "lucide-react";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

const NAV_LINKS = [
  { href: "/about", label: "기업소개" },
  { href: "/service", label: "서비스" },
  { href: "/process", label: "프로세스" },
  { href: "/portfolio", label: "개발사례" },
  { href: "/ai-analysis", label: "AI 제조분석" },
];

const MATERIALS = [
  {
    name: "금속",
    detail: "알루미늄 · 스테인리스 · 일반 강철 · 아연 합금 · 황동",
    image: "/material-tile-metal.jpg",
    sub: [
      { name: "알루미늄 (Al 합금)", desc: "경량이며 강도가 우수하고 가공성이 좋아 다이캐스팅 주조, 프로파일 제조 등 구조부품에 사용됩니다." },
      { name: "스테인리스 (SUS 304/316)", desc: "내식성이 뛰어나 정밀 부품·의료부품, 식품용기에 사용됩니다." },
      { name: "일반 강철 (S45C/SS400)", desc: "강도·경제성이 좋아 구조용·기계 부품에 사용됩니다." },
      { name: "아연 합금 (다이캐스팅용)", desc: "복잡한 형상의 소형 부품 양산에 적합합니다." },
      { name: "황동 (Cu-Zn 합금)", desc: "전기 전도도, 가공성에 좋아 전자 부품 등에 사용됩니다." },
    ],
  },
  {
    name: "플라스틱",
    detail: "ABS · PP · PC · POM · TPU · 아크릴",
    image: "/material-tile-plastic.jpg",
    sub: [
      { name: "ABS (범용)", desc: "내충격성이 좋아 전자제품 외장재·케이스에 사용됩니다." },
      { name: "PP (폴리프로필렌)", desc: "내약품성·유연성이 좋아 식기 등 용기에 사용됩니다." },
      { name: "PC (폴리카보네이트)", desc: "투명하고 강도가 높아 기능성 부품에 사용됩니다." },
      { name: "POM (아세탈)", desc: "치수가 안정적이고 내윤활성이 우수하여 기어·베어링 등 정밀 부품에 사용됩니다." },
      { name: "TPU (탄성 플라스틱)", desc: "유연하고 내마모성이 좋아 케이블· 탄성이 필요한 제품에 사용됩니다." },
      { name: "아크릴 (PMMA)", desc: "투명도·광택이 우수해 윈도우, 렌즈 부품 등에 사용됩니다." },
    ],
  },
  {
    name: "실리콘",
    detail: "실리콘 (탄성 소재)",
    image: "/material-tile-other.jpg",
    sub: [
      { name: "실리콘 (탄성 소재)", desc: "부드럽고 내열성이 좋아 케이스·씰·그립에 사용됩니다." },
    ],
  },
];

const PROCESSES: { name: string; desc: string }[] = [
  {
    name: "CNC가공",
    desc: "CNC 가공은 컴퓨터 프로그램으로 공구의 움직임을 정밀하게 제어하여 금속, 플라스틱 등의 원자재를 도면대로 깎아 정밀 부품을 제작하는 절삭 가공 방식입니다.",
  },
  {
    name: "사출금형",
    desc: "사출금형은 녹인 플라스틱 등의 소재를 정밀하게 제작된 금형 틀에 고압으로 주입하고 냉각하여, 동일한 형상의 제품을 대량으로 생산하는 정밀 제조 공법입니다.",
  },
  {
    name: "다이캐스팅",
    desc: "다이캐스팅은 녹인 금속을 고압으로 금형 틀에 주입하여, 복잡하고 정밀한 형상의 금속 부품을 대량으로 생산하는 금속 주조 공법입니다.",
  },
  {
    name: "레이저커팅·판금가공",
    desc: "레이저로 금속을 정밀하게 절단한 뒤, 절곡·성형해 형상을 만드는 가공입니다. 케이스, 브라켓 등 판재 기반 구조물 제작에 적합합니다.",
  },
  {
    name: "알루미늄 프로파일",
    desc: "알루미늄 프로파일 가공은 가열된 알루미늄 빌렛에 고압을 가해 특정 단면 모양의 금형 틀로 밀어냄으로써, 일정한 단면 형태의 긴 제품을 연속적으로 성형하는 금속 가공 공법입니다.",
  },
  {
    name: "실리콘 압축성형",
    desc: "정량의 고무 원료(생고무 덩어리)를 가열된 금형 틀 사이에 넣고, 유압 프레스로 강하게 눌러 열과 압력으로 경화시켜 제품을 만드는 전통적이고 경제적인 공법입니다.",
  },
  {
    name: "실리콘 사출성형",
    desc: "액상 상태의 실리콘 원료를 밀폐된 금형 내부로 고압 주입하고, 고온에서 신속하게 가황(경화)시켜 복잡한 형상의 제품을 대량 생산하는 자동화 공법입니다.",
  },
  {
    name: "실리콘 압출성형",
    desc: "실리콘 압출 성형은 고무 원료를 연속적으로 가열하고 스크루나 피스톤으로 밀어내어, 일정한 단면 모양(튜브, 호스, 프로파일 등)을 가진 긴 형태의 실리콘 제품을 연속적으로 성형하고 경화시키는 공법입니다.",
  },
  {
    name: "실리콘 샘플금형",
    desc: "간단한 샘플 금형으로 소량의 실리콘 시제품을 빠르게 제작하는 방식입니다. 정식 양산 금형 없이도 실제 제품과 유사한 품질의 샘플을 확인할 수 있습니다.",
  },
  {
    name: "프레스금형",
    desc: "프레스 금형은 판금 소재를 금형 사이에 넣고 상하 프레스로 강한 압력을 가해, 절단(Cutting), 굽힘(Bending), 드로잉(Drawing) 등의 소성 변형을 일으켜 원하는 형상의 판금 부품을 대량으로 생산하는 가공 공법입니다.",
  },
  {
    name: "3D프린팅",
    desc: "3D 프린팅은 디지털 모델을 바탕으로 소재를 층층이 쌓아 올리는 적층 제조 공법이며, 대표적으로 필라멘트를 녹여 압출하는 FDM 방식과 자외선 레이저로 액상 레진을 경화시키는 SLA 방식으로 나뉩니다.",
  },
  {
    name: "진공주형",
    desc: "진공주형은 마스터 모델로 만든 실리콘 금형 내부에 플라스틱 수지를 진공 상태에서 주입하여 기포 없이 정밀하게 채운 뒤 경화시키는 방식으로, 시제품 제작이나 소량 양산에 주로 사용되는 복제 공법입니다.",
  },
];

const MATERIAL_PROCESS_FIT: Record<string, string[]> = {
  금속: ["CNC가공", "다이캐스팅", "알루미늄 프로파일", "레이저커팅·판금가공", "프레스금형"],
  플라스틱: ["사출금형", "3D프린팅", "진공주형"],
  실리콘: ["실리콘 압축성형", "실리콘 사출성형", "실리콘 압출성형", "실리콘 샘플금형"],
};

function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}
const eunNeun = (word: string) => (hasBatchim(word) ? "은" : "는");
const iGa = (word: string) => (hasBatchim(word) ? "이" : "가");

const QUANTITY_TIERS = ["소량 (시제품~수십개)", "중량 (수백개)", "대량 (수천개 이상)"] as const;
type QuantityTier = (typeof QUANTITY_TIERS)[number];

function resolveLeadTime(leadTime: string | Partial<Record<QuantityTier, string>>, qty: QuantityTier): string {
  return typeof leadTime === "string" ? leadTime : leadTime[qty] ?? "";
}

const PROCESS_FIT: Record<string, { good: QuantityTier[]; leadTime: string | Partial<Record<QuantityTier, string>> }> = {
  CNC가공: { good: ["소량 (시제품~수십개)", "중량 (수백개)"], leadTime: { "소량 (시제품~수십개)": "2~3주", "중량 (수백개)": "3~4주" } },
  사출금형: { good: ["중량 (수백개)", "대량 (수천개 이상)"], leadTime: "금형 제작 2~2.5개월 후 양산 시작" },
  다이캐스팅: { good: ["대량 (수천개 이상)"], leadTime: "금형 제작 2~2.5개월 완료 후 양산 가능" },
  "알루미늄 프로파일": { good: ["중량 (수백개)", "대량 (수천개 이상)"], leadTime: "알루미늄 프로파일 금형 제작 2~3주 완료 후 양산 가능" },
  "레이저커팅·판금가공": { good: ["소량 (시제품~수십개)", "중량 (수백개)"], leadTime: "2~3주" },
  "실리콘 샘플금형": { good: ["소량 (시제품~수십개)"], leadTime: "2~3주" },
  "실리콘 압축성형": { good: ["중량 (수백개)", "대량 (수천개 이상)"], leadTime: { "중량 (수백개)": "3~4주", "대량 (수천개 이상)": "금형 제작 3~4주 후 양산 가능" } },
  "실리콘 사출성형": { good: ["대량 (수천개 이상)"], leadTime: "사출 금형 제작 3~4주 후 양산 가능" },
  "실리콘 압출성형": { good: ["중량 (수백개)", "대량 (수천개 이상)"], leadTime: "압출 금형 제작 3~4주 후 양산 가능" },
  프레스금형: { good: ["대량 (수천개 이상)"], leadTime: "금형 제작 3~4주 완료 후 양산 가능" },
  "3D프린팅": { good: ["소량 (시제품~수십개)"], leadTime: "1주 내" },
  진공주형: { good: ["소량 (시제품~수십개)"], leadTime: "2~3주" },
};

const SERVICES = [
  {
    icon: Layers,
    tag: "All in One",
    group: "onestop",
    title: "올인원 제품화 솔루션",
    desc: "제품기획부터 설계, 금형, 양산, 패키징까지. 아이디어 단계부터 판매 준비 완료까지 핸디핸드는 올인원 솔루션을 제공합니다.",
    points: [
      "제품 디자인 — 외형·CMF 디자인",
      "기구설계 — 양산을 전제한 3D설계",
      "PCBA 하드웨어, 소프트웨어 개발",
      "제조 컨설팅",
      "제조 소싱 & 관리 대행",
      "브랜딩 패키지 — 패키지 디자인부터 상세페이지까지",
    ],
    cta: { label: "견적 요청하기", href: "quote" },
    category: "올인원",
    badge: "핸디핸드 대표 서비스",
    featured: true,
  },
  {
    icon: PenTool,
    tag: "Design",
    group: "components",
    title: "제품 디자인",
    desc: "핸디핸드 파트너쉽 디자이너를 통해 제품 외형·CMF 디자인을 턴키로 진행합니다. 제품 디자인만 필요하신 경우에도 별도로 진행할 수 있습니다.",
    points: [
      "파트너 산업디자이너와 함께 제품 디자인 진행",
      "스케치·렌더링부터 실제 양산 설계로 이어지는 디자인",
    ],
    cta: { label: "디자인 상담하기", href: "contact" },
    category: "디자인",
  },
  {
    icon: Ruler,
    tag: "Engineering",
    group: "components",
    title: "기구설계",
    desc: "제품 구조·조립성·강도까지 고려해 실제 양산 가능한 3D 도면으로 완성합니다. 사출·다이캐스팅 등 제조 공법에 맞춘 설계로 시제품 제작을 하여 양산성을 검증하고 금형제작까지 바로 이어집니다.",
    points: [
      "구조·조립성·재질을 고려한 양산 가능한 3D 설계",
      "시제품 제작으로 양산성 검증 후 금형 제작 연계",
    ],
    cta: { label: "설계 상담하기", href: "contact" },
    category: "기구설계",
    badge: "40년+ 기구설계 경력",
  },
  {
    icon: Cpu,
    tag: "Electronics",
    group: "components",
    title: "전자제품·PCBA 개발",
    desc: "회로 설계부터 PCBA 제작까지, 국내외 파트너쉽 네트워크를 통해 소형가전·전자제품의 회로 하드웨어 개발과 소프트웨어 그리고 양산을 함께 대응합니다.",
    points: [
      "국내외 PCBA 협력업체 네트워크 보유",
      "회로 하드웨어·소프트웨어 개발부터 양산까지 올인원 대응",
    ],
    cta: { label: "전자제품 개발 문의하기", href: "contact" },
    category: "전자·PCBA",
    badge: "국내외 파트너십 네트워크",
  },
  {
    icon: Lightbulb,
    tag: "Consulting",
    group: "components",
    title: "제조 컨설팅",
    desc: "제품 구조와 소재 선정부터 제조 방식 결정까지, 수십 년간 제품 개발 경험을 바탕으로 최적의 전략을 제시합니다.",
    points: [
      "제조 공법 비교 분석 (사출·다이캐스팅·CNC 등)",
      "원가 절감 전략 수립",
    ],
    cta: { label: "컨설팅 문의하기", href: "contact" },
    category: "컨설팅",
  },
  {
    icon: Landmark,
    tag: "Grant Program",
    group: "situational",
    title: "지원사업 연계 제품화",
    desc: "창업도약패키지·TIPS·R&D 등 정부 지원사업의 사업계획서 마일스톤에 맞춰 제품 개발 산출물과 증빙자료를 관리합니다.",
    points: [
      "사업계획서 마일스톤 기준 산출물 관리",
      "증빙자료·중간보고 대응 지원",
    ],
    cta: { label: "지원사업 상담하기", href: "contact" },
    category: "지원사업·펀딩",
  },
  {
    icon: LayoutDashboard,
    tag: "Platform",
    group: "platform",
    title: "HANDYWORKS",
    desc: "핸디핸드만의 프로젝트 관리 전용 플랫폼. 메신저·이메일로 파편화된 소통을 하나로 통합해 실시간으로 진행 상황을 공유합니다.",
    points: [
      "단계별 진행 현황 실시간 공유",
      "파일·버전 이력 자동 기록",
    ],
    cta: { label: "HANDYWORKS 바로가기 ↗", href: "/handyworks" },
  },
  {
    icon: Globe,
    tag: "OEM & ODM",
    group: "components",
    title: "제조 소싱 & 관리 대행",
    desc: "핸디핸드가 최적의 협력 공장을 직접 발굴하고, 제품 개발·생산 관리를 전담하여 최고의 결과물을 낼 수 있도록 프로젝트를 관리합니다.",
    points: [
      "국내외 공장 직접 소싱",
      "품질 검수 및 납기 조율 일괄 처리",
    ],
    cta: { label: "소싱 & 관리 문의하기", href: "contact" },
    category: "금형·양산·소싱",
  },
  {
    icon: Palette,
    tag: "Product Detail",
    group: "components",
    title: "브랜딩 패키지",
    desc: "패키지 디자인, 상세페이지 제작까지. 제조와 브랜딩을 하나의 흐름으로 제작이 가능합니다.",
    points: [
      "패키지 디자인",
      "와디즈·스마트스토어·쿠팡·자사몰 최적화 상세페이지 제작",
    ],
    cta: { label: "브랜딩 상담하기", href: "contact" },
    category: "브랜딩",
  },
  {
    icon: Rocket,
    tag: "Crowdfunding",
    group: "situational",
    title: "크라우드펀딩 컨설팅",
    desc: "아이디어를 제품으로 만들고 와디즈 캠페인까지 한 번에. 개발부터 캠페인 기획, 리워드 구성까지 함께 설계합니다.",
    points: [
      "제품 개발 → 캠페인 기획 → 론칭 일괄 지원",
      "리워드 생산 일정 관리",
    ],
    cta: { label: "크라우드펀딩 상담하기", href: "contact" },
    category: "지원사업·펀딩",
    badge: "와디즈 파트너스·펀딩플래너 출신",
  },
];

const FAQS = [
  {
    q: "견적 상담과 초기 컨설팅은 비용이 드나요?",
    a: "아니요, 무료입니다. 제품과 개발 단계를 알려주시면 맞는 서비스를 안내해 드립니다.",
  },
  {
    q: "AI 제조분석은 무료인가요?",
    a: "네, 무료입니다. 도면(STP·STEP·DXF·DWG 등)을 업로드하면 AI가 제조 방법을 분석해드립니다.",
  },
  {
    q: "이미 디자인이나 설계가 끝났는데 생산만 맡길 수 있나요?",
    a: "가능합니다. 제조 소싱 & 관리 대행 서비스를 통해 진행 중인 단계부터 핸디핸드가 참여해 공장 소싱과 생산 관리만 전담해드릴 수 있습니다.",
  },
  {
    q: "개발 기간은 보통 얼마나 걸리나요?",
    a: "제품의 복잡도와 재질, 생산 수량에 따라 달라집니다. 도면이나 아이디어를 바탕으로 상담을 통해 정확한 일정을 안내해 드립니다.",
  },
  {
    q: "최소 발주 수량(MOQ)이 정해져 있나요?",
    a: "제품과 제조 공법(사출·CNC·다이캐스팅 등)에 따라 다릅니다. 상담을 통해 제품에 맞는 최소 수량을 안내해 드립니다.",
  },
  {
    q: "해외(중국) 생산 시 품질관리는 어떻게 하나요?",
    a: "핸디핸드가 중국 광둥성에 직접 운영하는 사무소와 공장에서 품질관리(QC) 담당자가 생산 전 과정을 직접 관리합니다. 진행 상황은 HANDYWORKS 플랫폼을 통해 실시간으로 공유됩니다.",
  },
  {
    q: "창업도약패키지·TIPS 같은 지원사업과 연계해서 진행할 수 있나요?",
    a: "네, 가능합니다. 지원사업의 사업계획서 마일스톤에 맞춰 제품 개발 산출물과 증빙자료를 관리해드리는 전담 서비스를 운영하고 있습니다.",
  },
  {
    q: "와디즈 같은 크라우드펀딩 런칭도 도와주나요?",
    a: "네. 와디즈 파트너스·펀딩플래너가 제품 개발부터 캠페인 페이지 기획, 리워드 구성, 펀딩 종료 후 리워드 생산 일정 관리까지 지원합니다.",
  },
  {
    q: "산업디자이너와 직접 협업할 수 있나요?",
    a: "네, 핸디핸드 파트너쉽 디자이너를 통해 외관 디자인을 턴키로 진행할 수 있습니다.",
  },
  {
    q: "비밀유지계약(NDA) 체결이 가능한가요?",
    a: "네, 가능합니다. 요청 주시면 비밀유지계약을 먼저 체결한 후 도면과 아이디어를 안전하게 공유해드립니다.",
  },
];

function ServiceRow({
  s, onCta, open, onToggle,
}: {
  s: (typeof SERVICES)[number]; onCta: (href: string, category?: string) => void; open: boolean; onToggle: () => void;
}) {
  const Icon = s.icon;
  return (
    <div className="py-5 sm:py-6">
      <button onClick={onToggle} className="flex w-full items-center gap-4 text-left sm:gap-7">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1d1d1f]">
          <Icon size={20} strokeWidth={1.75} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-[#1d1d1f] sm:text-xl">{s.title}</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#86868b]">
              <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
              {s.tag}
            </span>
          </div>
          {s.badge && (
            <span className="mt-2 inline-block rounded-full bg-[#ff4c4c]/10 px-2.5 py-1 text-[10px] font-semibold text-[#ff4c4c]">
              {s.badge}
            </span>
          )}
        </div>
        <ChevronDown size={18} className={`shrink-0 transition-transform ${open ? "rotate-180 text-[#F1CE00]" : "text-[#86868b]"}`} />
      </button>

      {open && (
        <div className="pl-[60px] pt-4 sm:pl-[68px]">
          <p className="mb-3 text-sm leading-relaxed text-[#4a4a4c]">{s.desc}</p>
          <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5">
            {s.points.map((p) => (
              <li key={p} className="flex items-center gap-1.5 text-sm text-[#1d1d1f]">
                <span className="h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                {p}
              </li>
            ))}
          </ul>
          {s.cta.href === "quote" || s.cta.href === "contact" ? (
            <button
              onClick={() => onCta(s.cta.href, s.category)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:gap-2.5 hover:bg-[#1d1d1f] hover:text-white"
            >
              {s.cta.label} <ArrowRight size={13} />
            </button>
          ) : (
            <Link
              href={s.cta.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1d1d1f] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:gap-2.5 hover:bg-[#1d1d1f] hover:text-white"
            >
              {s.cta.label} <ArrowRight size={13} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function ServicePage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [ctaCategory, setCtaCategory] = useState<string | undefined>(undefined);
  const [openService, setOpenService] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [guideQty, setGuideQty] = useState<QuantityTier | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const compatibleProcesses = selectedMaterial ? MATERIAL_PROCESS_FIT[selectedMaterial] : null;

  function handleSelectMaterial(name: string) {
    const next = selectedMaterial === name ? null : name;
    setSelectedMaterial(next);
    const fit = next ? MATERIAL_PROCESS_FIT[next] : null;
    if (fit && selectedProcess && !fit.includes(selectedProcess)) {
      setSelectedProcess(null);
    }
  }

  const handleCta = (href: string, category?: string) => {
    setCtaCategory(category);
    if (href === "quote") setQuoteOpen(true);
    else if (href === "contact") setContactOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 네비게이션 */}
      <nav className="fixed top-[calc(1rem+env(safe-area-inset-top))] z-50 w-full px-4 sm:px-8 [transform:translateZ(0)] [will-change:transform]">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between rounded-full border border-white/15 bg-black/70 px-5 py-2.5 backdrop-blur-xl">
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="HANDYHAND" className="h-4 w-auto sm:h-5" />
            </Link>
            <div className="hidden items-center gap-5 lg:flex">
              {NAV_LINKS.map((item) =>
                item.href === "/service" ? (
                  <Link key={item.href} href={item.href} className="flex items-center gap-1.5 text-sm font-medium text-white">
                    <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
                    {item.label}
                  </Link>
                ) : (
                  <Link key={item.href} href={item.href} className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">
                    {item.label}
                  </Link>
                )
              )}
              <Link href="/en/service" className="whitespace-nowrap text-sm text-white/40 transition hover:text-white">ENG</Link>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/handyworks" className="hidden min-w-[126px] text-center rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 lg:block">
                HANDYWORKS ↗
              </Link>
              <button
                onClick={() => setQuoteOpen(true)}
                className="hidden rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 lg:block"
              >
                견적 요청
              </button>
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="메뉴 열기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/10 lg:hidden"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div
              className="mt-2 overflow-hidden rounded-3xl border border-white/15 bg-black/90 p-2 backdrop-blur-xl lg:hidden"
              style={{ animation: "menuFadeIn 0.2s ease forwards" }}
            >
              {[...NAV_LINKS, { href: "/handyworks", label: "HANDYWORKS ↗" }, { href: "/en/service", label: "ENG" }].map((item, i, arr) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm transition hover:bg-white/10 hover:text-white ${
                    i < arr.length - 1 ? "border-b border-white/[0.06]" : ""
                  } ${item.href === "/service" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/service" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
                </Link>
              ))}
              <div className="mt-1 border-t border-white/10 pt-2">
                <button
                  onClick={() => { setMobileMenuOpen(false); setQuoteOpen(true); }}
                  className="block w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  견적 요청
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* 플로팅 문의 버튼 */}
      <button
        onClick={() => setContactOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Mail size={15} />
        문의하기
      </button>

      {/* 히어로 */}
      <section className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden bg-[#1d1d1f] px-6 pb-24 pt-40 text-center sm:min-h-[62vh] sm:pb-32">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-service.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#F1CE00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Services
          </p>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white sm:text-5xl">
            핸디핸드의 서비스
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            고객이 필요한 서비스만 골라,<br className="sm:hidden" />
            제품 개발, 컨설팅, 제조, 양산, 펀딩까지.
          </p>
        </div>
      </section>

      {/* 서비스 카드 */}
      <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl space-y-20 sm:space-y-28">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              All in One
            </p>
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">처음부터 끝까지 맡기신다면</h2>
            <p className="mb-10 text-sm leading-relaxed text-[#86868b] sm:mb-12 sm:text-base">
              제품 기획부터 양산 그리고 브랜딩까지 전 과정을<br className="sm:hidden" />핸디핸드가 진행합니다.
            </p>
            <div className="divide-y divide-[#d1d1d6] border-y border-[#d1d1d6]">
              {SERVICES.filter((s) => s.group === "onestop").map((s) => (
                <ServiceRow key={s.title} s={s} onCta={handleCta} open={openService === s.title} onToggle={() => setOpenService(openService === s.title ? null : s.title)} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              Modular Services
            </p>
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">원하는 서비스만 맡기신다면</h2>
            <p className="mb-10 text-sm leading-relaxed text-[#86868b] sm:mb-12 sm:text-base">
              올인원 제품화 솔루션을 구성하는 개별 서비스 영역입니다. 필요한 서비스 부분부터 진행할 수 있습니다.
            </p>
            <div className="divide-y divide-[#d1d1d6] border-y border-[#d1d1d6]">
              {SERVICES.filter((s) => s.group === "components").map((s) => (
                <ServiceRow key={s.title} s={s} onCta={handleCta} open={openService === s.title} onToggle={() => setOpenService(openService === s.title ? null : s.title)} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              Special Programs
            </p>
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">지원사업·펀딩이 목적이라면</h2>
            <p className="mb-10 text-sm leading-relaxed text-[#86868b] sm:mb-12 sm:text-base">
              지원사업 연계, 크라우드펀딩 등 상황별로<br className="sm:hidden" />필요한 서비스를 제공해드립니다.
            </p>
            <div className="divide-y divide-[#d1d1d6] border-y border-[#d1d1d6]">
              {SERVICES.filter((s) => s.group === "situational").map((s) => (
                <ServiceRow key={s.title} s={s} onCta={handleCta} open={openService === s.title} onToggle={() => setOpenService(openService === s.title ? null : s.title)} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              Platform
            </p>
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">모든 진행과정을 HANDYWORKS로.</h2>
            <p className="mb-10 text-sm leading-relaxed text-[#86868b] sm:mb-12 sm:text-base">
              핸디핸드 클라이언트 전용 플랫폼으로<br className="sm:hidden" />실시간 프로젝트 진행 상황을 함께 확인합니다.
            </p>
            <div className="flex flex-col items-start gap-8 rounded-3xl bg-[#1d1d1f] p-8 sm:flex-row sm:items-center sm:gap-10 sm:p-12">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <LayoutDashboard size={26} strokeWidth={1.75} className="text-[#F1CE00]" />
              </div>
              <div className="flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/handyworks-logo.png" alt="HANDYWORKS" className="h-5 w-auto sm:h-6" style={{ filter: "brightness(0) invert(1)" }} />
                <p className="mt-2 text-sm leading-relaxed text-white/50 sm:text-base">
                  핸디핸드만의 프로젝트 관리 전용 플랫폼. 메신저·이메일로 파편화된 소통을 하나로 통합해 실시간으로 진행 상황을 공유합니다.
                </p>
                <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
                  {[
                    "실시간 간트차트·업무 관리",
                    "AI 프로젝트 진단",
                    "AI 도면 자동분석",
                    "확인·승인 이력 자동 기록",
                    "캘린더 자동 연동",
                    "통합 검색 기능",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-white/60 sm:text-sm">
                      <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href="/handyworks"
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1d1d1f] transition hover:bg-white/90"
              >
                HANDYWORKS 바로가기 ↗
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 재질·공정 */}
      <section id="material-process" className="scroll-mt-24 bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              Material · Process
            </p>
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">재질 · 공정</h2>
            <p className="mb-5 text-sm leading-relaxed text-[#86868b] sm:text-base">
              대표적인 재질과 공정을 살펴보고, 수량까지 고르면<br className="sm:hidden" />적합한 방식을 바로 추천해드립니다.
            </p>
            <Link
              href="/ai-analysis"
              className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-[#1d1d1f]/15 bg-white px-4 py-2 text-xs font-medium text-[#1d1d1f] transition hover:border-[#1d1d1f]/30"
            >
              도면이 있으신가요? AI가 직접 분석해드립니다 →
            </Link>

            <div className="ml-6 border-l border-black/10 pl-11 sm:ml-8 sm:pl-16">
            <div className="relative pb-12 sm:pb-16">
            <span className="absolute -left-[66px] flex h-11 w-11 items-center justify-center rounded-full bg-[#1d1d1f] text-sm font-bold text-white ring-4 ring-[#f5f5f7] sm:-left-[88px] sm:h-12 sm:w-12 sm:text-base">
              1
            </span>
            <p className="mb-3 text-sm font-bold text-[#1d1d1f]">지원 재료 <span className="font-normal text-[#86868b]">(눌러서 특성 보기)</span></p>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {MATERIALS.map((m) => {
                const active = selectedMaterial === m.name;
                return (
                  <button
                    key={m.name}
                    onClick={() => handleSelectMaterial(m.name)}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-2xl text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.25)] sm:rounded-3xl ${
                      active ? "-translate-y-0.5 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.25)]" : "shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.image}
                      alt={m.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/5" />
                    <div className="absolute inset-x-0 bottom-0 px-3 pb-2 pt-6 sm:px-5 sm:pb-3 sm:pt-10">
                      <span className="text-sm font-semibold text-white sm:text-base">{m.name}</span>
                      <span className="mt-0.5 hidden text-xs leading-tight text-white/70 sm:block">{m.detail}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedMaterial && (
              <div className="mt-3 rounded-2xl bg-white p-6 sm:mt-4 sm:rounded-3xl sm:p-8">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#1d1d1f] sm:text-base">
                    <span className="-ml-1.5 rounded-md bg-[#F1CE00]/25 px-1.5 py-0.5 text-xs font-semibold text-[#8a6d00] sm:text-sm">{selectedMaterial}</span>
                    <span>세부 재질</span>
                  </h3>
                  <button onClick={() => setSelectedMaterial(null)} className="shrink-0 text-[#86868b] hover:text-[#1d1d1f]">
                    <X size={16} />
                  </button>
                </div>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {MATERIALS.find((m) => m.name === selectedMaterial)?.sub.map((s) => {
                    const match = s.name.match(/^(.+?)\s*(\(.+\))$/);
                    return (
                      <p key={s.name} className="text-sm leading-relaxed text-[#86868b]">
                        <span className="font-semibold text-[#1d1d1f]">
                          {match ? match[1] : s.name}
                          {match && <span className="ml-1 text-xs font-normal text-[#86868b]">{match[2]}</span>}
                        </span>{" "}
                        — {s.desc}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
            </div>

            <div className="relative pb-12 sm:pb-16">
            <span className="absolute -left-[66px] flex h-11 w-11 items-center justify-center rounded-full bg-[#1d1d1f] text-sm font-bold text-white ring-4 ring-[#f5f5f7] sm:-left-[88px] sm:h-12 sm:w-12 sm:text-base">
              2
            </span>
            <p className="mb-3 text-sm font-bold text-[#1d1d1f]">지원 공정 <span className="font-normal text-[#86868b]">(눌러서 설명 보기)</span></p>
            {selectedMaterial && (
              <p className="mb-3 -mt-1.5 text-xs text-[#86868b]">{selectedMaterial}에 적용 가능한 공정만 표시했어요</p>
            )}
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
              {PROCESSES.filter((p) => !compatibleProcesses || compatibleProcesses.includes(p.name)).map((p) => {
                const active = selectedProcess === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => setSelectedProcess(active ? null : p.name)}
                    className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition sm:px-5 ${
                      active
                        ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                        : "border-black/5 bg-white text-[#1d1d1f] hover:border-black/10 hover:bg-[#eeeef0]"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            {selectedProcess && (
              <div className="mt-3 rounded-2xl bg-white p-6 sm:mt-4 sm:rounded-3xl sm:p-8">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold sm:text-base">
                    <span className="-ml-1.5 rounded-md bg-[#F1CE00]/25 px-1.5 py-0.5 text-xs font-semibold text-[#8a6d00] sm:text-sm">{selectedProcess}</span>
                  </h3>
                  <button onClick={() => setSelectedProcess(null)} className="shrink-0 text-[#86868b] hover:text-[#1d1d1f]">
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-[#86868b]">{PROCESSES.find((p) => p.name === selectedProcess)?.desc}</p>
              </div>
            )}
            </div>

            <div className="relative">
            <span className="absolute -left-[66px] flex h-11 w-11 items-center justify-center rounded-full bg-[#1d1d1f] text-sm font-bold text-white ring-4 ring-[#f5f5f7] sm:-left-[88px] sm:h-12 sm:w-12 sm:text-base">
              3
            </span>
            <p className="mb-3 text-sm font-bold text-[#1d1d1f]">예상 수량 <span className="font-normal text-[#86868b]">(선택 시 적합도 확인)</span></p>
            <div className="flex flex-wrap gap-2">
              {QUANTITY_TIERS.map((qt) => (
                <button
                  key={qt}
                  onClick={() => setGuideQty(guideQty === qt ? null : qt)}
                  className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition sm:px-5 ${
                    guideQty === qt
                      ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                      : "border-black/5 bg-white text-[#1d1d1f] hover:border-black/10 hover:bg-[#eeeef0]"
                  }`}
                >
                  {qt}
                </button>
              ))}
            </div>

            {selectedMaterial && selectedProcess && guideQty && (() => {
              const fit = PROCESS_FIT[selectedProcess];
              const isGoodFit = fit?.good.includes(guideQty);
              const materialCompatible = selectedMaterial ? MATERIAL_PROCESS_FIT[selectedMaterial] ?? [] : [];
              const altProcesses = PROCESSES.filter((p) => PROCESS_FIT[p.name]?.good.includes(guideQty) && p.name !== selectedProcess && materialCompatible.includes(p.name)).map((p) => p.name);
              return (
                <div className="mt-3 rounded-2xl bg-white p-6 sm:mt-4 sm:rounded-3xl sm:p-8">
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    {[selectedMaterial, selectedProcess, guideQty].map((v) => (
                      <span key={v} className="rounded-md bg-[#F1CE00]/25 px-1.5 py-0.5 text-xs font-semibold text-[#8a6d00] sm:text-sm">
                        {v}
                      </span>
                    ))}
                  </div>
                  {isGoodFit ? (
                    <p className="text-sm leading-relaxed text-[#1d1d1f]">
                      이 조합은 <span className="font-semibold">{guideQty.split(" ")[0]}</span> 생산에 적합한 방식이에요. 예상 리드타임은{" "}
                      <span className="rounded-md bg-[#F1CE00]/25 px-1.5 py-0.5 text-xs font-semibold text-[#8a6d00] sm:text-sm">{resolveLeadTime(fit.leadTime, guideQty)}</span> 입니다.
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-[#1d1d1f]">
                      {selectedProcess}{eunNeun(selectedProcess)} 이 수량대에서는 단가·리드타임 면에서 비효율적일 수 있어요.
                      {altProcesses.length > 0 && (() => {
                        const altShown = altProcesses.slice(0, 2);
                        return (
                          <>
                            {" "}
                            <span className="font-semibold">{altShown.join(", ")}</span>
                            {iGa(altShown[altShown.length - 1])} 이 수량대에는 더 적합할 수 있습니다.
                          </>
                        );
                      })()}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-[#86868b]">* 개략적인 참고용 가이드이며, 정확한 방식·견적은 도면 검토 후 상담으로 안내해드립니다.</p>
                  <button
                    onClick={() => setQuoteOpen(true)}
                    className="mt-4 rounded-full bg-[#1d1d1f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    견적 요청하기 →
                  </button>
                </div>
              );
            })()}
            </div>
            </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 bg-[#fafafb] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col items-center sm:mb-8 sm:items-start">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              FAQ
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">자주 묻는 질문</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {FAQS.map((f, i) => (
              <div
                key={f.q}
                className={`overflow-hidden rounded-2xl border transition-all sm:rounded-3xl ${
                  openFaq === i ? "border-[#F1CE00] bg-white" : "border-[#e5e5e5] bg-white"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                >
                  <span className="flex-1 text-sm font-semibold text-[#1d1d1f] sm:text-base">{f.q}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform ${openFaq === i ? "rotate-180 text-[#F1CE00]" : "text-[#86868b]"}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="border-t border-[#f0f0f0] px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                    <p className="text-sm leading-relaxed text-[#4a4a4c]">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#1d1d1f] px-6 py-20 text-center sm:py-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
          }}
        />
        <div className="relative">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#F1CE00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Get Started
          </p>
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">어떤 서비스가 필요한가요?</h2>
          <p className="mb-10 text-[#86868b]">
            제품과 개발 단계를 간단히 알려주시면 맞는 서비스를 안내해 드립니다.
          </p>
          <div className="flex justify-center">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setQuoteOpen(true)}
                className="flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
              >
                견적 요청하기 <ArrowRight size={15} />
              </button>
              <button
                onClick={() => setContactOpen(true)}
                className="rounded-full border border-white/20 px-8 py-3 text-center text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
              >
                상담 문의하기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-white/10 bg-black px-6 py-12 text-center text-xs text-white/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HANDYHAND" className="mx-auto mb-4 h-5 w-auto" />
        <p className="mt-1 leading-relaxed">주식회사 핸디핸드 · 대표자 최형준 · 사업자등록번호 128-87-00105</p>
        <p className="mt-1 leading-relaxed">통신판매업 신고번호 2020-고양덕양구-1900</p>
        <p className="mt-1 leading-relaxed">경기도 고양시 덕양구 삼원로63 고양아크비즈지식산업센터 F804호</p>
        <p className="mt-1">Tel. 070-8835-2311 · handyhand91@naver.com</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition">개인정보처리방침</Link>
          <span>·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-white/60 transition">이용약관</Link>
        </div>
        <p className="mt-4">© 2026 HANDYHAND. All rights reserved.</p>
      </footer>

      {quoteOpen && <QuoteModal onClose={() => setQuoteOpen(false)} initialStage={ctaCategory} />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} initialType={ctaCategory} />}
    </div>
  );
}
