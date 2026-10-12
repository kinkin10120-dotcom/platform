import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// 관리자용 "AI 비서"(/admin-assistant)의 입력창 — 협력사용 /api/assistant와 같은 설계
// 철학을 따른다: 이 라우트는 Firestore에 아무것도 쓰지 않고, "무엇을 하려는 것인지"와
// "그 내용"만 판단해서 돌려준다. 실제 생성·발행(제품 등록, 발주서 생성, 청구서 발행)은
// 화면에서 사람이 미리보기 카드를 확인하고 버튼을 눌러야 일어난다.
interface NameRef { id: string; name: string }
interface ClientProductEntry { clientId: string; clientName: string; name: string; unitPrice: number; currency: string; unit?: string }
interface UnbilledInstallment {
  ref: string; // "<orderId>:<installmentIndex>" — AI는 이 문자열만 그대로 골라서 돌려준다(금액·고객을 지어내지 못하게).
  clientId: string;
  clientName: string;
  poNumber: string;
  label: string;
  amount: number;
  currency: string;
  status: string;
}
interface OrderOverview { poNumber: string; clientName: string; status: string; totalAmount: number; currency: string }
interface SupplierOrderOverview { soNumber: string; supplierName: string; status: string; totalAmount: number; currency: string }
interface ContractOverview { companyName: string; title: string; status: string; amount: number; currency: string; signedAt?: string }
interface HistoryTurn { role: "user" | "assistant"; text: string }

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    text,
    clients,
    clientProducts,
    partners,
    unbilledInstallments,
    ordersOverview,
    supplierOrdersOverview,
    contractsOverview,
    history,
  }: {
    text?: string;
    clients: NameRef[];
    clientProducts?: ClientProductEntry[];
    partners: NameRef[];
    unbilledInstallments?: UnbilledInstallment[];
    ordersOverview?: OrderOverview[];
    supplierOrdersOverview?: SupplierOrderOverview[];
    contractsOverview?: ContractOverview[];
    history?: HistoryTurn[];
  } = body;

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "내용이 비어 있습니다." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let ctx = "";
  ctx += `너는 제조업 발주 중개 플랫폼(HANDYHAND)의 관리자(운영진)가 쓰는 AI 비서다. 아래 입력을 보고 다섯 가지 중 정확히 하나의 의도(intent)를 판단해라:\n\n`;
  ctx += `1. "product_register" — 고객사의 제품(판매가/청구 단가)을 새로 등록하거나 기존 단가를 수정해달라는 것 (예: "OO사 도어스토퍼 5000원에 등록해놔", "OO사 OOO 단가 6000원으로 바꿔줘")\n`;
  ctx += `2. "purchase_order" — 협력사(공급사)에게 새 매입 발주서를 만들어달라는 것 (예: "RANHUI한테 OOO 100개 발주서 좀", "OO협력사한테 OOO 500개 단가 2.5달러로 발주")\n`;
  ctx += `3. "client_invoice" — 이미 확정된 고객 발주건 중 아직 청구서(회차)를 발행하지 않은 것을 발행해달라는 것 (예: "OO사 지난번 발주건 청구서 만들어줘", "OO사 잔금 청구해줘", "이번 달 미청구건 전부 청구 처리해줘")\n`;
  ctx += `4. "question" — 고객/제품/발주/청구/협력사 발주 현황 등 플랫폼에 쌓인 데이터를 물어보는 것, 또는 그 데이터와 무관하게 업무 전반에 대해 자유롭게 상담·자문을 구하는 것(지금 클로드와 대화하는 것처럼 — 데이터 조회가 아니어도 괜찮다)\n`;
  ctx += `5. "unclear" — 위 네 가지 어디에도 뚜렷하게 안 맞고 무엇을 원하는지 확신이 안 설 때\n\n`;

  const clientListText = (clients ?? []).map((c) => `- "${c.name}" (id: ${c.id})`).join("\n") || "(없음)";
  ctx += `[고객 목록 — product_register/client_invoice에서 고객명을 매칭할 때 참고]\n${clientListText}\n\n`;

  const partnerListText = (partners ?? []).map((p) => `- "${p.name}" (id: ${p.id})`).join("\n") || "(없음)";
  ctx += `[협력사(공급사) 목록 — purchase_order에서 공급사명을 매칭할 때 참고]\n${partnerListText}\n\n`;

  if (clientProducts && clientProducts.length > 0) {
    const text2 = clientProducts
      .slice(0, 300)
      .map((p) => `- [${p.clientName}] ${p.name}: ${p.unitPrice.toLocaleString()} ${p.currency}${p.unit ? `/${p.unit}` : ""}`)
      .join("\n");
    ctx += `[등록된 고객 제품·단가 목록 — product_register(기존 제품이면 "수정"임을 판단), question(단가 조회)에 사용]\n${text2}\n\n`;
  }

  if (unbilledInstallments && unbilledInstallments.length > 0) {
    const text3 = unbilledInstallments
      .map((u) => `- ref="${u.ref}" [${u.clientName}] ${u.poNumber} / ${u.label}: ${u.amount.toLocaleString()} ${u.currency} (주문상태: ${u.status})`)
      .join("\n");
    ctx +=
      `[아직 청구서 발행 안 된 고객 발주 회차 목록 — client_invoice일 때 이 중에서만 골라라]\n${text3}\n` +
      `- client_invoice로 판단했으면 이 목록에 있는 ref 문자열을 "그대로" 복사해서 골라라. 지어내거나 변형하지 마라. 해당하는 게 하나도 없으면 refs를 빈 배열로 둬라.\n\n`;
  }

  if (ordersOverview && ordersOverview.length > 0) {
    const text4 = ordersOverview
      .slice(0, 150)
      .map((o) => `- ${o.poNumber} [${o.clientName}] ${o.status}: ${o.totalAmount.toLocaleString()} ${o.currency}`)
      .join("\n");
    ctx += `[고객 발주 현황 전체 — question일 때 참고]\n${text4}\n\n`;
  }

  if (supplierOrdersOverview && supplierOrdersOverview.length > 0) {
    const text5 = supplierOrdersOverview
      .slice(0, 150)
      .map((o) => `- ${o.soNumber} [${o.supplierName}] ${o.status}: ${o.totalAmount.toLocaleString()} ${o.currency}`)
      .join("\n");
    ctx += `[협력사 매입 발주 현황 전체 — question일 때 참고]\n${text5}\n\n`;
  }

  if (contractsOverview && contractsOverview.length > 0) {
    const text6 = contractsOverview
      .slice(0, 150)
      .map((c) => `- [${c.companyName}] ${c.title}: ${c.status}, ${c.amount.toLocaleString()} ${c.currency}${c.signedAt ? `, 서명일 ${c.signedAt}` : ""}`)
      .join("\n");
    ctx += `[계약 현황 전체(서명완료/발송됨/작성중 등) — question일 때 참고, "체결된 계약" = status가 "서명완료"나 "계정연결됨"인 것]\n${text6}\n\n`;
  }

  ctx += `[입력 텍스트]\n${text}\n\n`;

  ctx +=
    `판단한 intent에 따라 아래 JSON 형식 중 그 intent에 해당하는 형식으로만, 다른 말 없이 답해라. 다른 intent의 필드는 아예 넣지 마라. 모든 형식에 "title" 필드를 공통으로 포함해라 — [입력 텍스트]를 그대로 자르지 말고, 클로드·제미나이 대화 목록처럼 이번 요청 전체를 대표하는 6~14자 내외의 짧은 제목으로 새로 지어라(예: "비즈클라우드 계약 조회", "RANHUI 발주서 작성", "OO사 단가 등록"). 따옴표·마침표는 넣지 마라.\n\n` +
    `intent가 "product_register"면:\n{"intent": "product_register", "clientName": "...", "productName": "...", "unitPrice": 0, "currency": "KRW" | "USD", "unit": "..."}\n` +
    `- clientName은 [고객 목록]에 있는 이름과 최대한 똑같이 써라(완전히 일치하는 게 없으면 입력한 원문 그대로). "만원"은 ×10000, "$"는 USD, "원"/"₩"은 KRW, 통화를 안 밝히면 KRW로 가정해라.\n\n` +
    `intent가 "purchase_order"면:\n{"intent": "purchase_order", "supplierName": "...", "items": [{"name": "...", "spec": "...", "quantity": 0, "unit": "EA", "unitPrice": 0}], "currency": "USD" | "CNY" | "KRW", "memo": "..."}\n` +
    `- supplierName은 [협력사 목록]에 있는 이름과 최대한 똑같이 써라. "$"/달러=USD, "¥"/위안/元=CNY, "원"/₩=KRW, 통화를 안 밝히면 USD로 가정해라.\n\n` +
    `intent가 "client_invoice"면:\n{"intent": "client_invoice", "clientName": "...", "refs": ["..."]}\n` +
    `- refs는 [아직 청구서 발행 안 된 고객 발주 회차 목록]의 ref를 그대로 골라 담은 배열이다(위 설명 참고).\n\n` +
    `intent가 "question"면:\n{"intent": "question", "answer": "..."}\n` +
    `- answer는 위 데이터를 근거로 실제 운영진에게 답하듯 구체적으로 작성해라. 데이터에서 못 찾으면 모른다고 솔직히 답하고, 데이터와 무관한 일반 상담/자문 질문이면 평소 너(클로드)의 지식으로 자연스럽게 답해라.\n\n` +
    `intent가 "unclear"면:\n{"intent": "unclear", "reply": "..."}\n` +
    `- reply는 무슨 뜻인지 못 알아들었다는 걸 짧고 자연스럽게 되묻는 한두 문장이다.\n\n` +
    `공통: 숫자(JSON number)는 따옴표 없이, 모르는 선택 필드는 생략하거나 빈 문자열로 둬라. 모든 답변은 한국어로 써라.` +
    (history && history.length > 0 ? `\n\n이전 대화도 함께 주어진다 — "그거", "방금 그거 금액만 바꿔서" 같은 후속 요청이면 이전 대화 내용을 이어받아 판단해라.` : "");

  const historyMessages: Anthropic.MessageParam[] = (history ?? [])
    .filter((h) => h.text && h.text.trim())
    .map((h) => ({ role: h.role, content: h.text }));

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [...historyMessages, { role: "user", content: ctx }],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("admin-assistant error:", e);
    return NextResponse.json({ error: "AI 비서 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
