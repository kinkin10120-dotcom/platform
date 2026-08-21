import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="HANDYHAND" className="mb-8 h-6 w-auto" />
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#86868b]">404</p>
      <h1 className="mb-3 text-2xl font-bold text-[#1d1d1f] sm:text-3xl">페이지를 찾을 수 없습니다</h1>
      <p className="mb-8 max-w-sm text-sm leading-relaxed text-[#86868b]">
        주소가 잘못되었거나, 페이지가 이동 또는 삭제되었을 수 있습니다.
      </p>
      <Link
        href="/"
        className="rounded-full bg-[#1d1d1f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
