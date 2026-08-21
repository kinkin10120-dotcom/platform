import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-[#86868b] transition hover:text-[#1d1d1f]">
          ← HANDYHAND 홈으로
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-[#1d1d1f]">이용약관</h1>
        <p className="mb-10 text-sm text-[#86868b]">최종 수정일: 2025년 1월 1일</p>

        <div className="space-y-8 text-sm leading-relaxed text-[#1d1d1f]">
          <section>
            <h2 className="mb-3 text-base font-semibold">제1조 (목적)</h2>
            <p className="text-[#86868b]">이 약관은 주식회사 핸디핸드(이하 "회사")가 제공하는 HandyWorks 서비스(이하 "서비스")의 이용에 관한 조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제2조 (정의)</h2>
            <ul className="list-disc pl-5 text-[#86868b]">
              <li>"서비스"란 회사가 제공하는 제조 프로젝트 관리 플랫폼 HandyWorks 및 관련 서비스를 의미합니다.</li>
              <li>"이용자"란 이 약관에 따라 회사가 제공하는 서비스를 이용하는 자를 의미합니다.</li>
              <li>"계정"이란 이용자의 서비스 이용을 위한 이메일 주소와 비밀번호를 의미합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제3조 (약관의 효력 및 변경)</h2>
            <p className="text-[#86868b]">이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력을 발생합니다. 회사는 합리적인 사유가 발생할 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지를 통해 고지합니다.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제4조 (서비스의 제공)</h2>
            <p className="text-[#86868b]">회사는 이용자에게 다음 서비스를 제공합니다.</p>
            <ul className="mt-2 list-disc pl-5 text-[#86868b]">
              <li>제조 프로젝트 현황 실시간 공유</li>
              <li>업무 단위 진행률 관리</li>
              <li>공지 및 알림 서비스</li>
              <li>견적 및 문의 통합 관리</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제5조 (이용자의 의무)</h2>
            <p className="text-[#86868b]">이용자는 다음 행위를 해서는 안 됩니다.</p>
            <ul className="mt-2 list-disc pl-5 text-[#86868b]">
              <li>타인의 계정을 부정하게 사용하는 행위</li>
              <li>서비스의 운영을 방해하는 행위</li>
              <li>서비스를 통해 얻은 정보를 회사의 사전 승낙 없이 복제·유통하는 행위</li>
              <li>기타 관련 법령에 위반되는 행위</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제6조 (서비스 이용 제한)</h2>
            <p className="text-[#86868b]">회사는 이용자가 이 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우, 서비스 이용을 경고·일시 정지·영구 정지 등으로 제한할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제7조 (책임의 한계)</h2>
            <p className="text-[#86868b]">회사는 천재지변, 불가항력적 사유, 이용자의 귀책사유로 인한 서비스 이용 장애에 대해서는 책임을 지지 않습니다. 회사는 서비스를 통해 제공하는 정보의 정확성에 대해 보증하지 않으며, 이와 관련하여 발생하는 손해에 대해 책임을 지지 않습니다.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제8조 (분쟁 해결)</h2>
            <p className="text-[#86868b]">서비스 이용과 관련하여 발생한 분쟁에 대해서는 대한민국 법률을 준거법으로 하며, 분쟁 발생 시 회사의 소재지를 관할하는 법원을 전속관할로 합니다.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제9조 (사업자 정보)</h2>
            <div className="text-[#86868b]">
              <ul className="list-disc pl-5">
                <li>상호: 주식회사 핸디핸드</li>
                <li>대표자: 최형준</li>
                <li>사업자등록번호: 128-87-00105</li>
                <li>통신판매업 신고번호: 2020-고양덕양구-1900</li>
                <li>주소: 경기도 고양시 덕양구 삼원로63 고양아크비즈지식산업센터 F804호</li>
                <li>전화: 070-8835-2311</li>
                <li>이메일: handyhand91@naver.com</li>
              </ul>
            </div>
          </section>
        </div>

        <div className="mt-12 border-t border-[#e5e5e5] pt-6 text-xs text-[#86868b]">
          <a href="/" className="hover:text-[#1d1d1f] transition">← HANDYHAND 홈으로</a>
        </div>
      </div>
    </div>
  );
}
