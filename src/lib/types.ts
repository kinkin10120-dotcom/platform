// 전역에서 쓰는 타입 정의

export type UserRole = "admin" | "client";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  clientId?: string; // role === 'client' 일 때만 존재
  createdAt: number;
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
  checklist: ChecklistItem[];
  order: number;
  dependsOn: string[]; // 선행 업무 taskId 목록
  templateId?: string;
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

export type NotificationType =
  | "assigned"
  | "status_change"
  | "comment"
  | "unblocked"
  | "due_soon"
  | "rescheduled"
  | "notice";

export interface AppNotification {
  id: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  noticeId?: string;
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
