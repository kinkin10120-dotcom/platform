// 전역에서 쓰는 타입 정의

export type UserRole = "admin" | "client";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  clientId?: string; // role === 'client' 일 때만 존재
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
  description?: string;
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
  | "contract_revision_requested";

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  assigned: "업무 배정",
  status_change: "업무 상태 변경",
  comment: "새 코멘트",
  unblocked: "업무 시작 가능",
  due_soon: "마감일 임박",
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

export interface ClientProductInternal {
  id: string; // ClientProduct.id 와 동일
  clientId: string;
  purchaseType?: PurchaseType; // 단가 통화(currency)와 짝을 이룸: 해외결제 → USD, 국내결제 → KRW
  shippingTerm?: ShippingTerm; // 해외결제 제품의 인코텀즈 선적조건
  customsNote?: string; // 수입통관 메모: HS코드, 관세율, 통관 수수료 등 자유 기재
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
