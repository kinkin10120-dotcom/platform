"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, LayoutDashboard, Lightbulb, Layers, Globe, Palette, PenTool, Rocket, Landmark, Cpu, Ruler, Menu, X, Mail, Languages } from "lucide-react";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

// src/app/service/ServiceClient.tsx의 영문 버전. src/app/en/page.tsx 상단 주석과 같은 이유로
// 별도 파일로 관리한다(자동 동기화 없음). 한국어 원본의 hasBatchim/eunNeun/iGa(조사 선택
// helper)는 한국어 문법 전용이라 영문판에는 없다 — 적합도 안내 문장을 조사 없이 영어로 새로
// 구성했다(아래 "isGoodFit" 분기 참고).
const NAV_LINKS = [
  { href: "/en/about", label: "About" },
  { href: "/en/service", label: "Services" },
  { href: "/en/process", label: "Process" },
  { href: "/en/portfolio", label: "Portfolio" },
  { href: "/en/ai-analysis", label: "AI Analysis" },
];

const MATERIALS = [
  {
    name: "Metal",
    detail: "Aluminum · Stainless Steel · Carbon Steel · Zinc Alloy · Brass",
    image: "/material-tile-metal.jpg",
    sub: [
      { name: "Aluminum (Al Alloy)", desc: "Lightweight with excellent strength and machinability — used in die-cast parts, extruded profiles, and other structural components." },
      { name: "Stainless Steel (SUS 304/316)", desc: "Highly corrosion-resistant — used in precision parts, medical components, and food containers." },
      { name: "Carbon Steel (S45C/SS400)", desc: "Strong and cost-effective — used in structural and mechanical parts." },
      { name: "Zinc Alloy (for Die-Casting)", desc: "Well-suited for mass-producing small parts with complex geometries." },
      { name: "Brass (Cu-Zn Alloy)", desc: "Good electrical conductivity and machinability — used in electronic components and more." },
    ],
  },
  {
    name: "Plastic",
    detail: "ABS · PP · PC · POM · TPU · Acrylic",
    image: "/material-tile-plastic.jpg",
    sub: [
      { name: "ABS (General-Purpose)", desc: "Good impact resistance — used in electronics housings and enclosures." },
      { name: "PP (Polypropylene)", desc: "Good chemical resistance and flexibility — used in containers such as tableware." },
      { name: "PC (Polycarbonate)", desc: "Transparent and high-strength — used in functional components." },
      { name: "POM (Acetal)", desc: "Dimensionally stable with excellent lubricity — used in precision parts like gears and bearings." },
      { name: "TPU (Elastic Plastic)", desc: "Flexible and wear-resistant — used in cables and products requiring elasticity." },
      { name: "Acrylic (PMMA)", desc: "Excellent clarity and gloss — used in windows, lenses, and similar components." },
    ],
  },
  {
    name: "Silicone",
    detail: "Silicone (Elastic Material)",
    image: "/material-tile-other.jpg",
    sub: [
      { name: "Silicone (Elastic Material)", desc: "Soft and heat-resistant — used in cases, seals, and grips." },
    ],
  },
];

const PROCESSES: { name: string; desc: string }[] = [
  {
    name: "CNC Machining",
    desc: "CNC machining uses computer-controlled tool movement to precisely cut metal, plastic, and other raw materials to spec, producing precision parts.",
  },
  {
    name: "Injection Molding",
    desc: "Injection molding injects molten plastic into a precision-machined mold under high pressure, then cools it to mass-produce identical parts.",
  },
  {
    name: "Die Casting",
    desc: "Die casting injects molten metal into a mold under high pressure to mass-produce metal parts with complex, precise geometries.",
  },
  {
    name: "Laser Cutting & Sheet Metal Fabrication",
    desc: "Metal is precisely cut with a laser, then bent and formed into shape — well-suited for sheet-metal structures like enclosures and brackets.",
  },
  {
    name: "Aluminum Extrusion",
    desc: "A heated aluminum billet is forced under high pressure through a die of a specific cross-section, continuously forming long parts with a consistent profile.",
  },
  {
    name: "Silicone Compression Molding",
    desc: "A measured amount of raw rubber is placed between heated mold plates and pressed firmly with a hydraulic press, curing it with heat and pressure — a traditional, cost-effective method.",
  },
  {
    name: "Silicone Injection Molding",
    desc: "Liquid silicone is injected into a sealed mold under high pressure and rapidly vulcanized at high temperature — an automated method for mass-producing complex shapes.",
  },
  {
    name: "Silicone Extrusion",
    desc: "Raw rubber is continuously heated and pushed through a screw or piston, continuously forming and curing long silicone products with a consistent cross-section — tubes, hoses, profiles, and more.",
  },
  {
    name: "Silicone Sample Tooling",
    desc: "A simple sample mold quickly produces a small batch of silicone prototypes, letting you check near-production quality without a full production tool.",
  },
  {
    name: "Press Tooling / Stamping",
    desc: "Sheet metal is placed between mold plates and pressed with strong force to cut, bend, and draw it into shape — mass-producing sheet-metal parts.",
  },
  {
    name: "3D Printing",
    desc: "3D printing builds parts layer by layer from a digital model — commonly FDM, which melts and extrudes filament, or SLA, which cures liquid resin with a UV laser.",
  },
  {
    name: "Vacuum Casting",
    desc: "Plastic resin is injected under vacuum into a silicone mold made from a master model, filling it precisely without air bubbles before curing — a replication method mainly used for prototypes and small production runs.",
  },
];

const MATERIAL_PROCESS_FIT: Record<string, string[]> = {
  Metal: ["CNC Machining", "Die Casting", "Aluminum Extrusion", "Laser Cutting & Sheet Metal Fabrication", "Press Tooling / Stamping"],
  Plastic: ["Injection Molding", "3D Printing", "Vacuum Casting"],
  Silicone: ["Silicone Compression Molding", "Silicone Injection Molding", "Silicone Extrusion", "Silicone Sample Tooling"],
};

const QUANTITY_TIERS = ["Low (Prototype–Dozens)", "Mid (Hundreds)", "High (Thousands+)"] as const;
type QuantityTier = (typeof QUANTITY_TIERS)[number];

function resolveLeadTime(leadTime: string | Partial<Record<QuantityTier, string>>, qty: QuantityTier): string {
  return typeof leadTime === "string" ? leadTime : leadTime[qty] ?? "";
}

const PROCESS_FIT: Record<string, { good: QuantityTier[]; leadTime: string | Partial<Record<QuantityTier, string>> }> = {
  "CNC Machining": { good: ["Low (Prototype–Dozens)", "Mid (Hundreds)"], leadTime: { "Low (Prototype–Dozens)": "2–3 weeks", "Mid (Hundreds)": "3–4 weeks" } },
  "Injection Molding": { good: ["Mid (Hundreds)", "High (Thousands+)"], leadTime: "Production starts 2–2.5 months after tooling" },
  "Die Casting": { good: ["High (Thousands+)"], leadTime: "Production possible 2–2.5 months after tooling" },
  "Aluminum Extrusion": { good: ["Mid (Hundreds)", "High (Thousands+)"], leadTime: "Production possible 2–3 weeks after die fabrication" },
  "Laser Cutting & Sheet Metal Fabrication": { good: ["Low (Prototype–Dozens)", "Mid (Hundreds)"], leadTime: "2–3 weeks" },
  "Silicone Sample Tooling": { good: ["Low (Prototype–Dozens)"], leadTime: "2–3 weeks" },
  "Silicone Compression Molding": { good: ["Mid (Hundreds)", "High (Thousands+)"], leadTime: { "Mid (Hundreds)": "3–4 weeks", "High (Thousands+)": "Production possible 3–4 weeks after tooling" } },
  "Silicone Injection Molding": { good: ["High (Thousands+)"], leadTime: "Production possible 3–4 weeks after tooling" },
  "Silicone Extrusion": { good: ["Mid (Hundreds)", "High (Thousands+)"], leadTime: "Production possible 3–4 weeks after die fabrication" },
  "Press Tooling / Stamping": { good: ["High (Thousands+)"], leadTime: "Production possible 3–4 weeks after tooling" },
  "3D Printing": { good: ["Low (Prototype–Dozens)"], leadTime: "Within 1 week" },
  "Vacuum Casting": { good: ["Low (Prototype–Dozens)"], leadTime: "2–3 weeks" },
};

const SERVICES = [
  {
    icon: Layers,
    tag: "All in One",
    group: "onestop",
    title: "All-in-One Product Solution",
    desc: "From product planning to design, tooling, mass production, and packaging — HANDYHAND provides an all-in-one solution from idea to sales-ready product.",
    points: [
      "Product Design — Exterior & CMF design",
      "Mechanical Engineering — Production-ready 3D design",
      "PCBA hardware & software development",
      "Manufacturing consulting",
      "Manufacturing sourcing & management",
      "Branding Package — From packaging design to landing pages",
    ],
    cta: { label: "Request a Quote", href: "quote" },
    category: "All-in-One",
    badge: "HANDYHAND's Flagship Service",
    featured: true,
  },
  {
    icon: PenTool,
    tag: "Design",
    group: "components",
    title: "Product Design",
    desc: "HANDYHAND's partner designers handle exterior and CMF design turnkey. Product design alone can also be handled as a standalone engagement.",
    points: [
      "Product design in collaboration with partner industrial designers",
      "Design that flows from sketches and renderings straight into production-ready engineering",
    ],
    cta: { label: "Talk to a Designer", href: "contact" },
    category: "Design",
  },
  {
    icon: Ruler,
    tag: "Engineering",
    group: "components",
    title: "Mechanical Engineering",
    desc: "We finalize production-ready 3D drawings that account for structure, assembly, and strength. Designs are tailored to manufacturing methods like injection molding and die casting, verified with prototypes, and carried straight into tooling.",
    points: [
      "Production-ready 3D design accounting for structure, assembly, and material",
      "Prototype validation of manufacturability, followed directly by tooling",
    ],
    cta: { label: "Talk to an Engineer", href: "contact" },
    category: "Engineering",
    badge: "40+ Years of Engineering Experience",
  },
  {
    icon: Cpu,
    tag: "Electronics",
    group: "components",
    title: "Electronics · PCBA Development",
    desc: "From circuit design to PCBA production, we handle hardware, software, and mass production for small appliances and electronics through our partner network at home and abroad.",
    points: [
      "PCBA partner network in Korea and abroad",
      "All-in-one support from circuit hardware/software development to mass production",
    ],
    cta: { label: "Ask About Electronics Development", href: "contact" },
    category: "Electronics · PCBA",
    badge: "Partner Network, Korea & Abroad",
  },
  {
    icon: Lightbulb,
    tag: "Consulting",
    group: "components",
    title: "Manufacturing Consulting",
    desc: "From product structure and material selection to choosing the right manufacturing method, we draw on decades of product development experience to recommend the best strategy.",
    points: [
      "Comparative analysis of manufacturing methods (injection molding, die casting, CNC, etc.)",
      "Cost-reduction strategy",
    ],
    cta: { label: "Ask About Consulting", href: "contact" },
    category: "Consulting",
  },
  {
    icon: Landmark,
    tag: "Grant Program",
    group: "situational",
    title: "Government Program Product Development",
    desc: "We manage product development deliverables and supporting documentation to match the milestones of government programs like the Startup Growth Package, TIPS, and R&D grants.",
    points: [
      "Deliverables managed against business plan milestones",
      "Support for supporting documents and progress reports",
    ],
    cta: { label: "Ask About Government Programs", href: "contact" },
    category: "Gov't Programs & Funding",
  },
  {
    icon: LayoutDashboard,
    tag: "Platform",
    group: "platform",
    title: "HANDYWORKS",
    desc: "HANDYHAND's dedicated project management platform. It unifies communication that's otherwise scattered across messengers and email, sharing progress in real time.",
    points: [
      "Real-time progress sharing at every stage",
      "Automatic file and version history",
    ],
    cta: { label: "Go to HANDYWORKS ↗", href: "/handyworks" },
  },
  {
    icon: Globe,
    tag: "OEM & ODM",
    group: "components",
    title: "Manufacturing Sourcing & Management",
    desc: "HANDYHAND finds the right partner factories directly and takes charge of product development and production management to deliver the best possible result.",
    points: [
      "Direct factory sourcing, Korea and abroad",
      "End-to-end quality inspection and delivery coordination",
    ],
    cta: { label: "Ask About Sourcing & Management", href: "contact" },
    category: "Tooling · Production · Sourcing",
  },
  {
    icon: Palette,
    tag: "Product Detail",
    group: "components",
    title: "Branding Package",
    desc: "From packaging design to landing pages — manufacturing and branding, handled as one continuous process.",
    points: [
      "Packaging design",
      "Landing pages optimized for Wadiz, Smartstore, Coupang, and your own store",
    ],
    cta: { label: "Talk About Branding", href: "contact" },
    category: "Branding",
  },
  {
    icon: Rocket,
    tag: "Crowdfunding",
    group: "situational",
    title: "Crowdfunding Consulting",
    desc: "From turning an idea into a product to launching a Wadiz campaign — we plan development, campaign strategy, and reward tiers together.",
    points: [
      "End-to-end support: product development → campaign planning → launch",
      "Reward production schedule management",
    ],
    cta: { label: "Ask About Crowdfunding", href: "contact" },
    category: "Gov't Programs & Funding",
    badge: "Former Wadiz Partners & Funding Planners",
  },
];

const FAQS = [
  {
    q: "Is there a fee for quote consultations or initial advice?",
    a: "No, it's free. Tell us about your product and where you are in development, and we'll point you to the right service.",
  },
  {
    q: "Is the AI manufacturing analysis free?",
    a: "Yes, it's free. Upload a drawing (STP, STEP, DXF, DWG, etc.) and our AI will analyze how to manufacture it.",
  },
  {
    q: "My design or engineering is already done — can I just outsource production?",
    a: "Yes. Through our manufacturing sourcing & management service, HANDYHAND can step in at your current stage and take charge of just factory sourcing and production management.",
  },
  {
    q: "How long does development usually take?",
    a: "It depends on the product's complexity, materials, and production volume. Share your drawing or idea with us and we'll give you an accurate timeline in consultation.",
  },
  {
    q: "Is there a minimum order quantity (MOQ)?",
    a: "It varies by product and manufacturing method (injection molding, CNC, die casting, etc.). We'll advise the right minimum quantity for your product in consultation.",
  },
  {
    q: "How is quality managed for production in China?",
    a: "Our own QC staff at HANDYHAND's office and factory in Guangdong, China oversee the entire production process directly. Progress is shared in real time through the HANDYWORKS platform.",
  },
  {
    q: "Can this be tied to government programs like the Startup Growth Package or TIPS?",
    a: "Yes. We run a dedicated service that manages product development deliverables and supporting documents to match your program's business plan milestones.",
  },
  {
    q: "Can you help launch a crowdfunding campaign like Wadiz?",
    a: "Yes. Our team, made up of former Wadiz Partners and funding planners, supports everything from product development to campaign page planning, reward tiers, and post-campaign reward production scheduling.",
  },
  {
    q: "Can I work directly with an industrial designer?",
    a: "Yes, HANDYHAND's partner designers can handle exterior design turnkey.",
  },
  {
    q: "Can we sign an NDA?",
    a: "Yes. Just ask, and we'll sign an NDA first before you share any drawings or ideas with us.",
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
      {/* Navigation */}
      <nav className="fixed top-[calc(1rem+env(safe-area-inset-top))] z-50 w-full px-4 sm:px-8 [transform:translateZ(0)] [will-change:transform]">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between rounded-full border border-white/15 bg-black/70 px-5 py-2.5 backdrop-blur-xl">
            <Link href="/en">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="HANDYHAND" className="h-4 w-auto sm:h-5" />
            </Link>
            <div className="hidden items-center gap-5 lg:flex">
              {NAV_LINKS.map((item) =>
                item.href === "/en/service" ? (
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
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/handyworks" className="hidden min-w-[126px] text-center rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 lg:block">
                HANDYWORKS ↗
              </Link>
              <button
                onClick={() => setQuoteOpen(true)}
                className="hidden rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 lg:block"
              >
                Get a Quote
              </button>
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Open menu"
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
              {[...NAV_LINKS, { href: "/handyworks", label: "HANDYWORKS ↗" }].map((item, i, arr) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm transition hover:bg-white/10 hover:text-white ${
                    i < arr.length - 1 ? "border-b border-white/[0.06]" : ""
                  } ${item.href === "/en/service" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/en/service" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
                </Link>
              ))}
              <div className="mt-1 border-t border-white/10 pt-2">
                <button
                  onClick={() => { setMobileMenuOpen(false); setQuoteOpen(true); }}
                  className="block w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Get a Quote
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Floating language toggle button */}
      <Link
        href="/service"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Languages size={15} />
        KOR
      </Link>

      {/* Floating contact button */}
      <button
        onClick={() => setContactOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Mail size={15} />
        Contact Us
      </button>

      {/* Hero */}
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
            HANDYHAND&apos;s Services
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            Pick only the services you need —<br className="sm:hidden" /> from product development and consulting to manufacturing, production, and funding.
          </p>
        </div>
      </section>

      {/* Service cards */}
      <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl space-y-20 sm:space-y-28">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              All in One
            </p>
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">If you want us to handle it all</h2>
            <p className="mb-10 text-sm leading-relaxed text-[#86868b] sm:mb-12 sm:text-base">
              HANDYHAND manages the entire process<br className="sm:hidden" /> — from product planning to mass production and branding.
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
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">If you just want specific services</h2>
            <p className="mb-10 text-sm leading-relaxed text-[#86868b] sm:mb-12 sm:text-base">
              These are the individual services that make up our all-in-one solution. You can start with just the parts you need.
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
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">If your goal is a grant program or funding</h2>
            <p className="mb-10 text-sm leading-relaxed text-[#86868b] sm:mb-12 sm:text-base">
              We offer services tailored to your situation<br className="sm:hidden" /> — government program alignment, crowdfunding, and more.
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
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">Every step, tracked in HANDYWORKS.</h2>
            <p className="mb-10 text-sm leading-relaxed text-[#86868b] sm:mb-12 sm:text-base">
              A platform exclusively for HANDYHAND clients<br className="sm:hidden" /> — track project progress together in real time.
            </p>
            <div className="flex flex-col items-start gap-8 rounded-3xl bg-[#1d1d1f] p-8 sm:flex-row sm:items-center sm:gap-10 sm:p-12">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <LayoutDashboard size={26} strokeWidth={1.75} className="text-[#F1CE00]" />
              </div>
              <div className="flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/handyworks-logo.png" alt="HANDYWORKS" className="h-5 w-auto sm:h-6" style={{ filter: "brightness(0) invert(1)" }} />
                <p className="mt-2 text-sm leading-relaxed text-white/50 sm:text-base">
                  HANDYHAND&apos;s dedicated project management platform. It unifies communication that&apos;s otherwise scattered across messengers and email, sharing progress in real time.
                </p>
                <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
                  {[
                    "Real-time Gantt chart & task management",
                    "AI project diagnostics",
                    "Automatic AI drawing analysis",
                    "Automatic approval history logging",
                    "Automatic calendar sync",
                    "Unified search",
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
                Go to HANDYWORKS ↗
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Materials & processes */}
      <section id="material-process" className="scroll-mt-24 bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              Material · Process
            </p>
            <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">Materials · Processes</h2>
            <p className="mb-5 text-sm leading-relaxed text-[#86868b] sm:text-base">
              Browse common materials and processes, and add a quantity<br className="sm:hidden" /> to get an instant recommendation.
            </p>
            <Link
              href="/en/ai-analysis"
              className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-[#1d1d1f]/15 bg-white px-4 py-2 text-xs font-medium text-[#1d1d1f] transition hover:border-[#1d1d1f]/30"
            >
              Have a drawing? Let our AI analyze it →
            </Link>

            <div className="ml-6 border-l border-black/10 pl-11 sm:ml-8 sm:pl-16">
            <div className="relative pb-12 sm:pb-16">
            <span className="absolute -left-[66px] flex h-11 w-11 items-center justify-center rounded-full bg-[#1d1d1f] text-sm font-bold text-white ring-4 ring-[#f5f5f7] sm:-left-[88px] sm:h-12 sm:w-12 sm:text-base">
              1
            </span>
            <p className="mb-3 text-sm font-bold text-[#1d1d1f]">Supported Materials <span className="font-normal text-[#86868b]">(click to see properties)</span></p>
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
                    <span>Details</span>
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
            <p className="mb-3 text-sm font-bold text-[#1d1d1f]">Supported Processes <span className="font-normal text-[#86868b]">(click for details)</span></p>
            {selectedMaterial && (
              <p className="mb-3 -mt-1.5 text-xs text-[#86868b]">Showing only processes compatible with {selectedMaterial}</p>
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
            <p className="mb-3 text-sm font-bold text-[#1d1d1f]">Estimated Quantity <span className="font-normal text-[#86868b]">(select to check fit)</span></p>
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
                      This combination works well for <span className="font-semibold">{guideQty.split(" ")[0]}</span>-volume production. The estimated lead time is{" "}
                      <span className="rounded-md bg-[#F1CE00]/25 px-1.5 py-0.5 text-xs font-semibold text-[#8a6d00] sm:text-sm">{resolveLeadTime(fit.leadTime, guideQty)}</span>.
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-[#1d1d1f]">
                      <span className="font-semibold">{selectedProcess}</span> may not be cost- or time-efficient at this quantity.
                      {altProcesses.length > 0 && (() => {
                        const altShown = altProcesses.slice(0, 2);
                        return (
                          <>
                            {" "}
                            <span className="font-semibold">{altShown.join(", ")}</span> may be a better fit for this quantity.
                          </>
                        );
                      })()}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-[#86868b]">* This is a rough guide for reference only — exact methods and quotes are provided after reviewing your drawing in consultation.</p>
                  <button
                    onClick={() => setQuoteOpen(true)}
                    className="mt-4 rounded-full bg-[#1d1d1f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    Request a Quote →
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
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">Frequently Asked Questions</h2>
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
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">Which service do you need?</h2>
          <p className="mb-10 text-[#86868b]">
            Tell us briefly about your product and stage of development, and we&apos;ll point you to the right service.
          </p>
          <div className="flex justify-center">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setQuoteOpen(true)}
                className="flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Request a Quote <ArrowRight size={15} />
              </button>
              <button
                onClick={() => setContactOpen(true)}
                className="rounded-full border border-white/20 px-8 py-3 text-center text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black px-6 py-12 text-center text-xs text-white/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HANDYHAND" className="mx-auto mb-4 h-5 w-auto" />
        <p className="mt-1 leading-relaxed">HANDYHAND Co., Ltd. · CEO Hyungjun Choi · Business Registration No. 128-87-00105</p>
        <p className="mt-1 leading-relaxed">Mail-Order Business License No. 2020-Goyangdeogyanggu-1900</p>
        <p className="mt-1 leading-relaxed">F804, Goyang ARC Biz Knowledge Industry Center, 63 Samwon-ro, Deogyang-gu, Goyang-si, Gyeonggi-do, Korea</p>
        <p className="mt-1">Tel. +82-70-8835-2311 · handyhand91@naver.com</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-white/60 transition">Terms of Service</Link>
        </div>
        <p className="mt-4">© 2026 HANDYHAND. All rights reserved.</p>
      </footer>

      {quoteOpen && <QuoteModal onClose={() => setQuoteOpen(false)} initialStage={ctaCategory} />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} initialType={ctaCategory} lang="en" />}
    </div>
  );
}
