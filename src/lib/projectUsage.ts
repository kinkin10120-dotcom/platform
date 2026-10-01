// 프로젝트 드롭다운이 매번 처음부터 스크롤해야 할 만큼 길어지는 걸 막기 위해, 이 브라우저에서
// 최근/자주 실제로 업로드까지 이어진 프로젝트를 목록 위쪽으로 올린다. 기기별 개인 사용
// 습관이라 서버 동기화 없이 localStorage로 충분하다. (work-intake 앱과 동일한 헬퍼)
const STORAGE_KEY = "pm-platform-project-usage";

interface UsageEntry {
  count: number;
  lastUsedAt: number;
}
type UsageMap = Record<string, UsageEntry>;

function readUsage(): UsageMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function recordProjectUsage(projectId: string) {
  if (!projectId || typeof window === "undefined") return;
  const usage = readUsage();
  const prev = usage[projectId] ?? { count: 0, lastUsedAt: 0 };
  usage[projectId] = { count: prev.count + 1, lastUsedAt: Date.now() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // localStorage 접근 실패(시크릿 모드 등)해도 정렬만 못 할 뿐 기능엔 지장 없다.
  }
}

export function sortProjectsByUsage<T extends { id: string }>(projects: T[]): T[] {
  const usage = readUsage();
  if (Object.keys(usage).length === 0) return projects;
  return [...projects].sort((a, b) => {
    const ua = usage[a.id];
    const ub = usage[b.id];
    if (!ua && !ub) return 0;
    if (!ua) return 1;
    if (!ub) return -1;
    return ub.lastUsedAt - ua.lastUsedAt || ub.count - ua.count;
  });
}
