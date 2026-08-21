import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-[#86868b] transition hover:text-[#1d1d1f]">
          ← HANDYHAND 홈으로
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-[#1d1d1f]">개인정보처리방침</h1>
        <p className="mb-10 text-sm text-[#86868b]">최종 수정일: 2025년 1월 1일</p>

        <div className="space-y-8 text-sm leading-relaxed text-[#1d1d1f]">
          <section>
            <h2 className="mb-3 text-base font-semibold">제1조 (개인정보의 처리 목적)</h2>
            <p className="text-[#86868b]">주식회사 핸디핸드(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
            <ul className="mt-2 list-disc pl-5 text-[#86868b]">
              <li>견적 요청 및 문의 처리</li>
              <li>HandyWorks 서비스 이용 및 계정 관리</li>
              <li>서비스 개선 및 고객 지원</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제2조 (처리하는 개인정보 항목)</h2>
            <p className="text-[#86868b]">회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
            <ul className="mt-2 list-disc pl-5 text-[#86868b]">
              <li>필수항목: 이름, 이메일 주소, 연락처, 회사명</li>
              <li>자동 수집 항목: 접속 IP, 접속 일시, 서비스 이용 기록</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제3조 (개인정보의 처리 및 보유 기간)</h2>
            <p className="text-[#86868b]">회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유하며, 목적이 달성된 개인정보는 지체 없이 파기합니다.</p>
            <ul className="mt-2 list-disc pl-5 text-[#86868b]">
              <li>견적 요청 및 문의 상담: 처리 목적 달성 후 1년간 보유 후 파기</li>
              <li>HandyWorks 서비스 이용 계약: 계약 종료 후 5년간 보유 후 파기(상거래 관련 채권·채무 관계 확인 목적)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제4조 (개인정보의 제3자 제공)</h2>
            <p className="text-[#86868b]">회사는 정보주체의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 정보주체의 동의가 있거나 법령의 규정에 의한 경우에는 예외로 합니다.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제5조 (정보주체의 권리·의무 및 행사방법)</h2>
            <p className="text-[#86868b]">정보주체는 회사에 대해 언제든지 개인정보 열람, 정정, 삭제, 처리정지 요구 등의 권리를 행사할 수 있습니다. 권리 행사는 이메일(handyhand91@naver.com)을 통해 하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제6조 (개인정보 보호책임자)</h2>
            <div className="text-[#86868b]">
              <p>회사는 개인정보 처리에 관한 업무를 총괄하는 개인정보 보호책임자를 지정하고 있습니다.</p>
              <ul className="mt-2 list-disc pl-5">
                <li>책임자: 최형준</li>
                <li>연락처: 070-8835-2311</li>
                <li>이메일: handyhand91@naver.com</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">제7조 (사업자 정보)</h2>
            <div className="text-[#86868b]">
              <ul className="list-disc pl-5">
                <li>상호: 주식회사 핸디핸드</li>
                <li>대표자: 최형준</li>
                <li>사업자등록번호: 128-87-00105</li>
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
