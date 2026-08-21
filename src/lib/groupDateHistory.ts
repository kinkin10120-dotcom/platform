// 한 번의 수동 일정 변경이 여러 업무의 날짜를 연쇄적으로(자동조정) 밀어내면, 그 변경들이
// 전부 거의 같은 순간(짧은 시간差 안)에 기록된다 — 그 묶음을 시간 간격 기준으로 하나의
// 그룹으로 묶어서(홈 화면 "최근 일정 변경", 일정 변경 리포트 양쪽에서 공통으로 사용) 한 줄로
// 보여주고, 펼쳤을 때만 개별 항목이 드러나게 한다.
export const HISTORY_GROUP_GAP_MS = 5000;

export function groupDateHistory<T extends { entry: { changedAt: number } }>(entries: T[]): T[][] {
  const groups: T[][] = [];
  for (const item of entries) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1].entry.changedAt - item.entry.changedAt <= HISTORY_GROUP_GAP_MS) {
      last.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups;
}
