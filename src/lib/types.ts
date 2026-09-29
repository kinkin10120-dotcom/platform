// 전역에서 쓰는 타입 정의

// partner: 중국 파트너 공장 등 제조 협력사 계정 — 지정된 프로젝트의 일정·업무·첨부 자료·
// 코멘트만 보고 코멘트/파일 등록까지 가능하지만, 클라이언트 목록·계약·견적·발주 등
// 금액이 얽힌 데이터는 애초에 접근 경로 자체가 없다(firestore.rules 참고).
export type UserRole = "admin" | "client" | "partner";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  clientId?: string; // role === 'client' 일 때만 존재
  projectIds?: string[]; // role === 'partner' 일 때만 존재 — 볼 수 있는 프로젝트 목록
  partnerLang?: "ko" | "zh"; // role === 'partner' 일 때만 존재 — 협력사가 보는 화면 UI 언어
  createdAt: number;
  notificationPrefs?: Partial<Record<NotificationType, boolean>>; // 설정 안 된 타입은 기본 on
}

export interface Client {
  id: string;
  name: string;
  memo?: string;
  logoUrl?: string;       // 브랜드 로고 이미지 URL
  sortOrder?: number;
  bizCompanyName?: string; // 기업명(법인명)
  bizRegNumber?: string;  // 사업자등록번호
  bizCeoName?: string;    // 대표명
  bizPhone?: string;      // 대표전화
  bizAddress?: string;    // 사업장주소
  createdAt: number;
  createdBy: string;
}

export type ProjectStatus = "active" | "on_hold" | "completed";
export type ProjectType = "dev" | "mass" | "package" | "detail_page";

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  dev: "개발",
  mass: "양산",
  package: "패키지",
  detail_page: "상세페이지",
};

export const ALL_PROJECT_TYPES: ProjectType[] = ["dev", "mass", "package", "detail_page"];

export interface Project {
  id: string;
  clientId: string;
  name: string;
  nameZh?: string; // 중국 업체 협력사용 사전 번역 캐시(저장 시 미리 번역) — 없으면 즉석 번역으로 대체
  description?: string;
  descriptionZh?: string;
  // 협력사 계정은 clients 컬렉션 자체를 읽을 권한이 없다(사업자등록번호 등 민감 정보 포함) —
  // 로고·표시명만 이 프로젝트 문서에 그대로 복사해둬서, 새 컬렉션 접근 권한 없이도 "이 프로젝트가
  // 어느 고객사 것인지"만 보여줄 수 있게 한다. createClient/updateClient에서 동기화한다.
  clientDisplayName?: string;
  clientLogoUrl?: string;
  projectType?: ProjectType[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: ProjectStatus;
  // 기본값(true)은 지금까지처럼 고객이 바로 볼 수 있는 상태. 새 프로젝트는 false로 시작해서,
  // 세팅(업무 구조 등)을 다 끝내고 관리자가 직접 켤 때까지 고객 쪽 조회 자체가 막힌다(firestore.rules).
  clientVisible?: boolean;
  sortOrder?: number;
  calendarToken?: string;
  createdAt: number;
  createdBy: string;
}

// pending: 선행 업무 대기 중이라 아직 시작 불가
// todo: 시작 가능 (대기열)
// in_progress: 진행 중
// done: 완료
export type TaskStatus = "pending" | "todo" | "in_progress" | "done" | "on_hold";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "대기(선행업무)",
  todo: "진행 전",
  in_progress: "진행 중",
  done: "완료",
  on_hold: "보류",
};

export const TASK_STATUS_ORDER: TaskStatus[] = ["pending", "todo", "in_progress", "on_hold", "done"];

export interface StatusHistoryEntry {
  status: TaskStatus;
  enteredAt: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  textZh?: string; // 중국 업체 협력사용 사전 번역 캐시 — 없으면 화면에서 즉석 번역(useZhAutoTranslate)으로 대체
  done: boolean;
}

export interface DateChangeEntry {
  fromStartDate: string;
  toStartDate: string;
  fromDueDate: string;
  toDueDate: string;
  changedAt: number;
  changedBy: string;
  cascaded?: boolean; // 선행 업무 일정 변경으로 인한 자동 조정 여부
}

export interface DecisionEntry {
  note: string; // 무엇에 대한 확인/승인 요청인지
  requestedAt: number;
  requestedBy: string;
  decidedAt?: number;
  decidedBy?: string;
  responseNote?: string; // 확인/승인 시 남긴 코멘트(선택)
  resolution?: "approved" | "cancelled"; // 클라이언트 확인 완료인지, 관리자가 요청 자체를 취소했는지 구분
}

export interface Task {
  id: string;
  projectId: string;
  clientId: string;
  name: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: TaskStatus;
  progress: number; // 0-100
  needsDecision?: boolean; // 클라이언트의 확인/승인이 필요한 업무로 표시
  decisionHistory?: DecisionEntry[]; // 확인/승인 요청·처리 이력
  checklist: ChecklistItem[];
  order: number;
  dependsOn: string[]; // 선행 업무 taskId 목록
  templateId?: string;
  group?: string; // 업무 목록에서 묶어 보기 위한 자유 태그(관리자가 직접 지정)
  hiddenFromPartner?: boolean; // true면 협력사 계정에게는 이 업무 자체가 안 보임(firestore.rules에서 강제)
  nameZh?: string; // 중국 업체 협력사용 사전 번역 캐시(저장 시 미리 번역) — 없으면 즉석 번역으로 대체
  groupZh?: string;
  statusHistory: StatusHistoryEntry[];
  dateHistory?: DateChangeEntry[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

// 코멘트 작성자 표시용 역할. 실제 로그인 계정 역할(UserRole)에 "claude-auto"(자동 생성/수정)를 더한 표시 전용 확장.
export type CommentAuthorRole = UserRole | "claude-auto";

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorRole: CommentAuthorRole;
  text: string;
  textZh?: string; // 중국 업체 협력사용 사전 번역 캐시(등록 시 미리 번역) — 없으면 즉석 번역으로 대체
  createdAt: number;
}

export interface TaskFileAiMethod {
  method: string;
  confidence: number;
  reason: string;
  initialCostLevel: number;
  unitCostLevel: number;
}

export interface TaskFileAiAnalysis {
  status: "pending" | "done" | "error";
  partName?: string;
  complexity?: string;
  material?: string;
  surfaceTreatment?: string;
  recommendedMethods?: TaskFileAiMethod[];
  summary?: string;
  error?: string;
  analyzedAt?: number;
}

export interface TaskFile {
  id: string;
  taskId: string;
  name: string;
  url: string;
  storagePath: string;
  size: number;
  contentType: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: number;
  version: number;
  aiAnalysis?: TaskFileAiAnalysis;
  visibleToClient?: boolean; // false면 클라이언트(고객)에게는 안 보임 — 협력사가 올린 자료의 기본값(관리자 승인 전 비공개)
}

// 3D(STEP) 모델 위의 특정 지점에 꽂는 리뷰 핀 — position은 모델 로컬 좌표(StepViewer가
// 렌더링 시 그룹을 바운딩박스 중심으로 옮기는 것과 동일한 기준)라 카메라 각도와 무관하게
// 항상 같은 모델 표면 지점을 가리킨다.
export interface ModelAnnotation {
  id: string;
  taskId: string;
  fileId: string;
  position: { x: number; y: number; z: number };
  number: number;
  createdBy: string;
  createdByName: string;
  createdByRole: CommentAuthorRole;
  createdAt: number;
  resolved: boolean;
}

export type NotificationType =
  | "assigned"
  | "status_change"
  | "comment"
  | "unblocked"
  | "due_soon"
  | "overdue"
  | "rescheduled"
  | "weekly_summary"
  | "notice"
  | "decision_needed"
  | "inquiry"
  | "inquiry_answered"
  | "quote_request"
  | "quote_response"
  | "purchase_order"
  | "order_status_change"
  | "order_cancel_request"
  | "contract_signed"
  | "contract_revision_requested"
  | "contract_expiring";

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  assigned: "업무 배정",
  status_change: "업무 상태 변경",
  comment: "새 코멘트",
  unblocked: "업무 시작 가능",
  due_soon: "마감일 임박",
  overdue: "마감일 초과",
  rescheduled: "일정 자동 조정",
  weekly_summary: "주간 업무 요약",
  notice: "공지사항",
  decision_needed: "확인/승인 요청",
  inquiry: "새 문의",
  inquiry_answered: "문의 답변 등록",
  quote_request: "새 견적 요청",
  quote_response: "견적서 응답",
  purchase_order: "새 발주",
  order_status_change: "발주 상태 변경",
  order_cancel_request: "발주 취소 요청",
  contract_signed: "계약서 서명 완료",
  contract_revision_requested: "계약서 수정 요청",
  contract_expiring: "계약 만료 임박",
};

export interface AppNotification {
  id: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  noticeId?: string;
  orderId?: string; // 발주 관련 알림 — 발주서/청구서 페이지로 바로 연결하는 데 사용
  invoiceIndex?: number; // 청구서 발행 알림일 때만 설정 (회차 인덱스)
  contractId?: string; // 계약 서명/수정요청 알림용
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: number;
}

export interface TemplateStep {
  name: string;
  offsetDays: number; // 프로젝트/적용 시작일로부터 며칠 뒤 시작
  durationDays: number; // 소요 기간(일)
  dependsOnIndex: number | null; // steps 배열 내 선행 업무 인덱스 (없으면 null)
  checklist?: string[]; // 적용 시 업무의 체크리스트로 그대로 생성됨
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  createdBy: string;
  createdByName: string;
  readBy?: string[];
}

export type InquiryStatus = "pending" | "answered";

export interface Inquiry {
  id: string;
  userId: string;
  userName: string;
  clientId?: string;
  title: string;
  content: string;
  status: InquiryStatus;
  answer?: string;
  answeredAt?: number;
  answeredBy?: string;
  createdAt: number;
  email?: string;
  phone?: string;
  type?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  steps: TemplateStep[];
  createdAt: number;
  createdBy: string;
}

// ---- 발주 ----

export type Currency = "KRW" | "USD";

export const CURRENCY_LABEL: Record<Currency, string> = {
  KRW: "원",
  USD: "USD",
};

export interface ClientProduct {
  id: string;
  clientId: string;
  name: string;
  imageUrl?: string;
  unitPrice: number;
  currency: Currency; // 해외결제 제품은 USD, 그 외에는 KRW
  vatApplicable?: boolean; // 국내결제(KRW)일 때만 의미 있음 — 단가가 공급가액(부가세 별도)임을 의미
  unit?: string; // 예: 개, EA, 세트 (미입력 시 "개")
  active: boolean; // 비활성화된 제품은 클라이언트의 발주 화면에서 숨김
  createdAt: number;
}

// 제품별 매입/통관 관련 내부 정보. 별도 컬렉션(clientProductInternal)에 admin만 읽고 쓸 수
// 있게 분리 저장한다 — 클라이언트가 조회 가능한 clientProducts 문서에 함께 두면 Firestore
// 규칙상 문서 단위로만 접근을 제어할 수 있어 필드를 숨길 수 없기 때문(모든 제품이 중국산
// 수입이라 매입가·통관 정보가 노출되면 안 됨).
export type PurchaseType = "overseas" | "domestic";

export const PURCHASE_TYPE_LABEL: Record<PurchaseType, string> = {
  overseas: "해외결제",
  domestic: "국내결제",
};

// Incoterms 2020 전체 11종. EXW~CIP는 모든 운송수단, FAS~CIF는 해상/내륙수로 전용.
export type ShippingTerm = "EXW" | "FCA" | "CPT" | "CIP" | "DAP" | "DPU" | "DDP" | "FAS" | "FOB" | "CFR" | "CIF";

export const SHIPPING_TERM_LABEL: Record<ShippingTerm, string> = {
  EXW: "EXW (공장인도)",
  FCA: "FCA (운송인인도)",
  CPT: "CPT (운송비지급인도)",
  CIP: "CIP (운송비보험료지급인도)",
  DAP: "DAP (도착지인도)",
  DPU: "DPU (도착지양하인도)",
  DDP: "DDP (관세지급인도)",
  FAS: "FAS (선측인도)",
  FOB: "FOB (본선인도)",
  CFR: "CFR (운임포함인도)",
  CIF: "CIF (운임보험료포함인도)",
};

// 제품 하나에 딸려오는 부대비용(조립비·포장비·도금비 등). 제품에는 "보통 이런 비용이 붙는다"는
// 기본 목록으로 저장해두고, 실제 발주(로트)마다 그중 이번에 넣을 것만 골라 담는다 — 로트에 따라
// 조립을 우리가 하기도 하고 공장이 하기도 해서, 매번 같은 항목이 붙지는 않기 때문이다.
export interface SupplierCostItem {
  name: string;
  // 발주서에 찍히는 영문/중문 항목명 — 공장이 한글을 못 읽는다. 비워두면 한글 이름이 그대로 간다.
  nameEn?: string;
  // 단가 성격의 금액. 실제로 더해지는 값은 amount × quantity다(조립비를 개당으로 받는 경우가
  // 있어서 개수를 따로 둔다). 개수가 없던 시절 데이터는 1개로 본다.
  amount: number;
  quantity?: number;
}

// 조립품은 완제품 하나에 여러 부품이 들어가고, 공장과는 부품별 단가로 이야기한다 — 발주서에도
// 그 내역이 그대로 보여야 나중에 단가 조정 협의를 할 수 있다. 이 목록의 합계가 곧 완제품
// 1개의 매입 단가이고(입력할 때 자동으로 채워진다), 금액 계산 자체는 완제품 단가 하나로만
// 한다 — 부품 합계와 완제품 단가를 각각 더하면 이중 계산이 된다.
export interface SupplierPartItem {
  name: string;
  nameEn?: string;
  unitPrice: number;
  quantity: number;
}

export interface ClientProductInternal {
  id: string; // ClientProduct.id 와 동일
  clientId: string;
  purchaseType?: PurchaseType; // 단가 통화(currency)와 짝을 이룸: 해외결제 → USD, 국내결제 → KRW
  shippingTerm?: ShippingTerm; // 해외결제 제품의 인코텀즈 선적조건
  customsNote?: string; // 수입통관 메모: HS코드, 관세율, 통관 수수료 등 자유 기재
  // 어느 공장에서 사오는지 + 그 매입 단가. 구매발주(SupplierOrder)를 만들 때 이 값이 그대로
  // 발주 품목으로 들어가고, 구매 카탈로그도 이 이름으로 업체별 묶음을 만든다. 공급사를 별도
  // 컬렉션으로 두지 않고 여기 문자열로 둔 이유는, 거래처가 사실상 소수라 관리 화면을 하나 더
  // 만드는 비용이 이득보다 크기 때문이다(입력은 기존에 쓴 이름 자동완성으로 받는다).
  supplierName?: string;
  purchasePrice?: number;
  purchaseCurrency?: SupplierCurrency;
  // 이 제품에 통상 붙는 부대비용 기본 목록 — 발주 담을 때 체크박스로 뜬다.
  costItems?: SupplierCostItem[];
  // 조립품의 구성 부품별 단가. 합계가 purchasePrice가 된다.
  parts?: SupplierPartItem[];
  // 생산(양산) 발주인지 개발(금형·시제품) 발주인지.
  orderKind?: SupplierOrderKind;
  // 발주서에 찍힐 영문/중문 품명 — 공장은 한글 품명을 못 읽는다. 비워두면 한글 품명이 그대로 간다.
  nameEn?: string;
  updatedAt: number;
}

export type PurchaseOrderStatus = "received" | "confirmed" | "in_production" | "shipped" | "cancelled";

export const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  received: "접수",
  confirmed: "확인",
  in_production: "생산중",
  shipped: "완료",
  cancelled: "취소됨",
};

// 진행 단계 버튼에 쓰는 순서 — "취소됨"은 별도 취소 요청/처리 흐름으로만 도달하는 종료 상태라 여기 포함하지 않는다.
export const PURCHASE_ORDER_STATUS_ORDER: PurchaseOrderStatus[] = ["received", "confirmed", "in_production", "shipped"];

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  productImageUrl?: string;
  unitPrice: number;
  currency: Currency;
  vatApplicable?: boolean;
  unit?: string;
  quantity: number;
}

// 실제 카드결제/PG 연동 전 단계: 관리자가 입금을 눈으로 확인하고 수동으로 상태를 바꾸는 방식.
// 결제수단 구분은 실무상 의미가 없어서(어차피 수동 확인) 별도로 관리하지 않는다.
export interface PaymentInstallment {
  label: string; // 선금/중도금/잔금 등 — 자유 텍스트
  amount: number;
  paid: boolean;
  paidAt?: number;
  issuedAt?: number; // 이 회차 청구서 발행 시각 — 발행 전에는 PDF 다운로드 불가
  paymentReminderSentAt?: number; // 미수금 리마인더 발송 시각 — 회차당 한 번만 보낸다
}

export interface PurchaseOrderPayment {
  installments: PaymentInstallment[];
  note?: string; // 입금 계좌 안내 등 (관리자가 직접 입력, 클라이언트에게 노출됨)
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  clientId: string;
  clientName: string;
  orderedBy: string;
  orderedByName: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  confirmedAt?: number; // 관리자가 "확인 처리"한 시각 — 발주 요청 시각(createdAt)과 다를 수 있음
  createdByAdmin?: boolean; // 클라이언트 발주 없이 관리자가 청구 목적으로 직접 등록한 발주

  payment?: PurchaseOrderPayment;
  linkedProjectId?: string;
  linkedTaskId?: string; // 계약금 입금 확인 시 이 업무를 자동으로 "진행 중"으로 전환 + 코멘트 기록
  linkedTaskName?: string;
  signatureUrl?: string; // 발주 요청 시 클라이언트가 마우스로 직접 그린 서명 (발주서 PDF에 표시)
  signedByName?: string;
  cancelRequested?: boolean; // 클라이언트가 취소를 요청했고 관리자 처리 대기 중
  cancelRequestedAt?: number;
  cancelReason?: string;
  memo?: string;
  createdAt: number;
  updatedAt: number;
}

// ---- 계약 관리 / 전자서명 ----

export type ContractStatus = "draft" | "sent" | "revision_requested" | "signed" | "linked";

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "작성중",
  sent: "발송됨",
  revision_requested: "수정 요청",
  signed: "서명완료",
  linked: "계정연결됨",
};

export interface ContractRevision {
  version: number;
  bodyText: string;
  attachments?: ContractAttachment[];
  note?: string; // 이 버전을 보낼 때 관리자가 남긴 메모, 또는 직전 고객 수정요청 내용
  updatedAt: number;
}

export interface ContractAttachment {
  id: string;
  title: string; // 예: "별첨 1 — 전자작동 자물쇠 기구개발"
  bodyHtml: string; // 본문과 동일한 리치 텍스트 HTML
}

export interface Contract {
  id: string;
  title: string; // 예: "제품개발 용역 계약서"
  companyName: string; // 상호명(갑)
  productName?: string; // 제품 또는 서비스명 — 미리보기/크게편집 상단 헤더에 담당자명 대신 표시
  bizRegNumber?: string;
  bizCeoName?: string;
  bizAddress?: string;
  contactName: string; // 담당자명 — 서명자 이름 기본값 및 추후 계정 생성 시 이름
  contactEmail: string; // 담당자 이메일 — 서명 페이지 본인확인 + 추후 계정 생성 시 사용
  contactPhone?: string;
  amount: number;
  currency: Currency;
  vatApplicable?: boolean;
  periodStart?: string;
  periodEnd?: string;
  paymentTerms?: string; // 대금지급 방식
  // 기본값(false)은 지금까지처럼 "을 = 주식회사 핸디핸드"인 통상적인 경우. 핸디핸드가 발주하는
  // 입장(갑)인 계약은 이 값을 true로 켜서, 상단 갑/을 요약 표·서명란(직인/서명패드) 위치가
  // 자동으로 뒤바뀌고 "계정 만들기" 섹션은 숨겨지도록 한다 — 그 경우 상대방은 우리가 관리하는
  // 고객이 아니라 우리에게 용역을 제공하는 거래처라 클라이언트 포털 계정이 의미가 없다.
  handyhandIsGap?: boolean;
  bodyText: string; // 계약서 본문 전문 (리치 텍스트 HTML, 관리자가 작성/수정)
  attachments?: ContractAttachment[]; // 별첨 문서 (표지/도면 등 본문과 별도 페이지로 이어붙는 첨부)
  version: number; // 1부터 시작, 재발송할 때마다 +1
  history: ContractRevision[];
  status: ContractStatus;
  revisionNote?: string; // (레거시) status === "revision_requested"일 때 고객이 남긴 자유 텍스트 요청 내용
  revisionRequestedBodyText?: string; // 고객이 "수정 요청" 화면에서 직접 고친 본문 — 새로 넣은 부분은 RevisionMark(빨간 글자)로 표시됨
  // 발송(을 쪽) 행위 증빙 — 갑의 서명 증빙(IP/기기/시각)과 대칭으로, 매번 발송할 때마다 최신값으로 덮어써진다.
  sentBy?: string; // 발송한 관리자 이름(또는 이메일)
  sentAt?: number;
  sentIp?: string;
  sentUserAgent?: string;
  sentContentHash?: string; // 발송 시점 본문+별첨 SHA-256 — 이후 signedAt의 contentHash와 대조해 위변조 여부를 검증할 수 있다.
  lastSignatureReminderAt?: number; // 서명 대기 리마인더 마지막 발송 시각 — 3일 간격 재발송 기준점
  viewedAt?: number; // 상대방이 (현재 버전의) 서명 페이지를 열어본 시각
  // 그때 열어본 문서의 버전. 수정 후 재발송하면 version이 올라가므로, 이 값과 비교해서
  // "지금 보낸 수정본을 봤는지"를 구분한다.
  viewedVersion?: number;
  // 서명 완료 후 채워지는, 이후 절대 수정되지 않는 증빙 스냅샷
  signedAt?: number;
  signerName?: string;
  signerTitle?: string; // 서명자 직위/직책
  authorityConfirmed?: boolean; // 서명자가 "계약 체결 권한이 있는 자"임을 스스로 확인했는지
  consentAcknowledged?: boolean; // 전자서명이 서면과 동일한 법적 효력을 가짐에 동의했는지
  signerEmail?: string;
  signatureUrl?: string;
  signedBodyText?: string; // 서명 시점 bodyText 그대로 복사 (이후 원본이 바뀌어도 불변)
  signedAttachments?: ContractAttachment[]; // 서명 시점 attachments 스냅샷 (이후 원본이 바뀌어도 불변)
  signedVersion?: number;
  contentHash?: string; // signedBodyText의 SHA-256 — 위변조 여부 사후 검증용
  signerIp?: string;
  signerUserAgent?: string;
  linkedClientId?: string;
  bizRegCertUrl?: string; // 상대방이 서명 시 함께 첨부한 사업자등록증 이미지/PDF
  memo?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

// 계약서 본문 재사용 템플릿 — 고객사마다 계약 유형(개발/양산/금형 등)이 달라 매번 새로
// 작성하기보다, 서식(볼드·줄간격 등)까지 그대로 저장해둔 본문 중에서 골라 시작할 수 있게 한다.
export interface ContractTemplate {
  id: string;
  name: string;
  bodyHtml: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

// ---- 구매발주 (핸디핸드 → 해외 공급사, 관리자 전용) ----
//
// 위쪽 PurchaseOrder와 이름은 비슷하지만 방향이 정반대다. PurchaseOrder는 "고객 → 핸디핸드"로
// 들어오는 발주(매출)라 clientId·받을 돈(payment.installments)·고객 서명을 갖고 있고, 이쪽은
// "핸디핸드 → 공장"으로 나가는 발주(매입/원가)다. 한 타입에 합치면 매출과 매입이 섞여서
// 프로젝트 수익성을 볼 수 없게 되므로 처음부터 분리한다.
//
// 여기에는 clientId를 절대 두지 않는다. 필드가 없으면 firestore.rules에서 "고객은 자기 것만"
// 식으로 규칙을 열 근거 자체가 생기지 않아, 원가가 고객에게 노출될 경로가 구조적으로 막힌다.

// 무역 대금은 보통 USD, 중국 공장 직거래는 CNY로 결제한다. 매출 쪽 Currency(KRW|USD)를
// 넓히면 calcOrderTotals·formatMoney를 쓰는 견적서·청구서·발주서가 전부 영향을 받으므로,
// 매입 전용 통화를 따로 둔다.
export type SupplierCurrency = "USD" | "CNY" | "KRW";

// 같은 공장에 내는 발주라도 성격이 다르다 — 금형·시제품처럼 개발 단계에서 한 번 나가는
// 발주와, 양산 부품처럼 반복해서 나가는 발주는 원가를 볼 때 섞으면 안 된다.
export type SupplierOrderKind = "production" | "development";

export const SUPPLIER_ORDER_KIND_LABEL: Record<SupplierOrderKind, string> = {
  production: "생산",
  development: "개발",
};

// 발주서에 찍히는 표기(중문/영문 병기용).
export const SUPPLIER_ORDER_KIND_CN: Record<SupplierOrderKind, string> = {
  production: "量产 / Production",
  development: "开发 / Development",
};

export interface SupplierOrderItem {
  name: string; // 내부용 한글 품명 (목록·검색에 쓰인다)
  nameEn?: string; // 발주서에 실제로 찍히는 영문/중문 품명
  spec?: string; // 재질·캐비티·치수 등 사양
  unitPrice: number;
  quantity: number;
  unit?: string; // SET / PCS / EA
  // 이번 로트에 실제로 포함시킨 부대비용만 담긴다(제품의 기본 목록에서 골라 담거나 즉석에서
  // 추가한 것). 제품 쪽 기본 목록을 참조만 하지 않고 값을 복사해 넣는 이유는, 나중에 제품의
  // 기본 단가가 바뀌어도 이미 나간 발주서 금액이 따라 변하면 안 되기 때문이다.
  costs?: SupplierCostItem[];
  // 조립품 구성 부품 내역 — 발주서에 부품별 단가를 그대로 보여주기 위한 것이고, 합계는 이미
  // unitPrice에 반영되어 있으므로 금액 계산에는 쓰지 않는다.
  parts?: SupplierPartItem[];
  // 제품 사진 — 공장이 어떤 물건인지 바로 알아보게 발주서에 함께 실린다.
  imageUrl?: string;
  orderKind?: SupplierOrderKind;
  // 이 품목이 어느 고객 건인지 — 발주서에 표기해서 라벨·포장·구분에 쓴다. 담는 시점의
  // 이름을 복사해 둔다(고객사명이 나중에 바뀌어도 이미 나간 발주서는 그대로여야 한다).
  clientName?: string;
  // 어느 제품에서 담았는지 — 구매 카탈로그와 이어보기 위한 참조일 뿐, 금액 계산에는 안 쓴다.
  sourceProductId?: string;
}

// 금형·부자재처럼 고객에게 팔지는 않고 사오기만 하는 품목. 고객 제품(clientProducts)에
// 얹어두면 고객 발주 카탈로그가 지저분해지고, 무엇보다 그 컬렉션은 고객이 읽을 수 있어서
// 매입 단가를 함께 둘 수도 없다 — 그래서 관리자 전용 컬렉션을 따로 둔다.
// supplierOrders와 마찬가지로 clientId 필드를 두지 않는다(고객에게 열어줄 근거를 안 만든다).
export interface SupplierProduct {
  id: string;
  supplierName: string;
  name: string;
  orderKind?: SupplierOrderKind;
  // 이 품목이 어느 고객 건인지 — 발주서에 표기된다. 고객 제품과 달리 clientProducts에 매여
  // 있지 않아 고객을 알 수 없으므로 여기에 직접 적어둔다(이름만 쓰고 clientId는 두지 않는다 —
  // 이 컬렉션에 clientId가 생기면 고객에게 규칙을 열어줄 근거가 만들어진다).
  clientName?: string;
  nameEn?: string;
  spec?: string;
  imageUrl?: string;
  purchasePrice?: number;
  purchaseCurrency?: SupplierCurrency;
  unit?: string;
  parts?: SupplierPartItem[];
  costItems?: SupplierCostItem[];
  createdAt: number;
  updatedAt: number;
}

// 상태는 "아직 작성만 해둔 건"과 "실제로 공장에 보낸 건"을 가르는 용도 하나뿐이다. 그 외
// 단계(공장 확인·종료 등)는 걸려 있는 동작이 없어서 눌러도 아무 일이 안 일어나는 라벨이었고,
// 나중에 보면 무슨 뜻인지 본인도 헷갈려서 없앴다.
export type SupplierOrderStatus = "draft" | "issued";

export const SUPPLIER_ORDER_STATUS_LABEL: Record<SupplierOrderStatus, string> = {
  draft: "작성중",
  issued: "발행됨",
};

export interface SupplierOrder {
  id: string;
  soNumber: string;
  // 발행 시점의 공급사명을 그대로 박아둔다 — 상수(SUPPLIER)가 나중에 바뀌어도 과거 발주서는
  // 당시 상호 그대로 남아야 한다.
  supplierName: string;
  items: SupplierOrderItem[];
  currency: SupplierCurrency;
  totalAmount: number;
  // 발주 시점 환율(외화 1단위 = N원). 나중에 환율이 움직여도 이 건의 원가가 흔들리지 않도록
  // 그때 값을 박아둔다.
  exchangeRate?: number;
  incoterms?: string; // EXW / FOB / DDP
  portOfLoading?: string;
  paymentTerms?: string;
  // 공장은 납기를 "계약일"이 아니라 "선금 입금일로부터 N일"로 센다.
  leadTimeDays?: number;
  packingNote?: string;
  memo?: string;
  linkedProjectId?: string;
  linkedProjectName?: string;
  // 같은 제품을 여러 차례 나눠 발주할 때 공장과 맞추는 로트 번호(자유 텍스트).
  lotNo?: string;
  // "이 고객 발주가 들어와서 이 구매발주를 냈다"를 잇는 참조. 반드시 이쪽(매입 문서)에만 둔다 —
  // 반대로 purchaseOrders에 "이 발주로 낸 구매발주" 필드를 달면 그 컬렉션은 고객도 읽을 수 있어
  // 원가 문서의 존재와 번호가 그대로 새어나간다. supplierOrders는 관리자 전용이라 여기서
  // 거꾸로 걸어두면 관리자 화면에서만 조회된다.
  linkedPurchaseOrderId?: string;
  linkedPurchaseOrderNo?: string;
  // 이 발주서를 실제로 받는 협력사 계정(uid) — 연동해두면 그 협력사 계정이 자기 발주
  // 내역으로 직접 조회할 수 있다(firestore.rules에서 partnerId == 본인 uid로 허용).
  partnerId?: string;
  partnerName?: string;
  status: SupplierOrderStatus;
  issuedAt?: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}
