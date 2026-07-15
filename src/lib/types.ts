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
  createdAt: number;
  createdBy: string;
}

// pending: 선행 업무 대기 중이라 아직 시작 불가
// todo: 시작 가능 (대기열)
// in_progress: 진행 중
// done: 완료
export type TaskStatus = "pending" | "todo" | "in_progress" | "done";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "대기(선행업무)",
  todo: "진행 전",
  in_progress: "진행 중",
  done: "완료",
};

export const TASK_STATUS_ORDER: TaskStatus[] = ["pending", "todo", "in_progress", "done"];

export interface StatusHistoryEntry {
  status: TaskStatus;
  enteredAt: number;
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
  order: number;
  dependsOn: string[]; // 선행 업무 taskId 목록
  templateId?: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
  createdAt: number;
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
}

export type NotificationType =
  | "assigned"
  | "status_change"
  | "comment"
  | "unblocked"
  | "due_soon";

export interface AppNotification {
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
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
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  createdBy: string;
  createdByName: string;
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
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  steps: TemplateStep[];
  createdAt: number;
  createdBy: string;
}
