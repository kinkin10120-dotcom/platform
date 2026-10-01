import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

// 협력사(파트너) 계정에게 보여줄 중국어 UI 문자열 사전. 계정 생성 시 관리자가 지정한
// partnerLang이 "zh"인 협력사에게만 적용되고(중국업체), "ko"(한국업체)는 원문 그대로 보인다.
// 파트너가 실제로 보는 화면(사이드바, 홈, 프로젝트의 일정·업무·자료·코멘트 탭)에 한정해서만
// 적용한다 — 관리자·클라이언트 전용 화면과 사용자가 직접 입력한 데이터(프로젝트명, 업무명,
// 코멘트 본문 등)는 번역 대상이 아니다. 키는 한국어 원문 그대로 써서, 못 찾으면 원문이 보인다.
const ZH_DICT: Record<string, string> = {
  // Sidebar
  "제품개발·제조 올인원 플랫폼": "产品开发·制造一体化平台",
  "핸디핸드": "汉迪汉德",
  "홈": "首页",
  "협력사 관리": "合作伙伴管理",
  "알림 설정": "通知设置",
  "공지사항": "公告",
  "로그아웃": "退出登录",
  "핸디핸드 사업자 서류": "HANDYHAND 相关文件",
  "사업자등록증": "营业执照",
  "통장사본": "银行存折复印件",

  // Home
  "내 프로젝트": "我的项目",
  "내가 참여 중인 프로젝트의 진행 상황을 확인하세요.": "查看您参与的项目进度。",
  "프로젝트명 검색": "搜索项目名称",
  "전체": "全部",
  "진행 중": "进行中",
  "보류": "暂停",
  "완료": "已完成",
  "아직 배정된 프로젝트가 없습니다.": "暂无分配的项目。",
  "검색 결과가 없습니다.": "没有搜索结果。",
  "완료된 프로젝트 숨기기": "隐藏已完成的项目",
  "불러오는 중...": "加载中...",
  "확인/승인이 필요한 업무": "需要确认/批准的任务",
  "건": "项",
  "외": "另有",
  "건 더 있음": "项",

  // Project workspace tabs
  "프로젝트 일정": "项目日程",
  "업무 리스트": "任务列表",
  "첨부 자료": "附件资料",
  "코멘트": "评论",

  // Project type tags (PROJECT_TYPE_LABEL)
  "개발": "开发",
  "양산": "量产",
  "패키지": "包装",
  "상세페이지": "详情页",
  "전체 진행률": "总体进度",

  // Gantt / Task list common
  "업무명": "任务名称",
  "담당자": "负责人",
  "시작일": "开始日期",
  "마감일": "截止日期",
  "상태": "状态",
  "대기": "待处理",
  "진행중": "进行中",
  "지연": "延迟",
  "임박": "临近截止",
  "검토 대기": "待审核",
  "업무 추가": "添加任务",
  "새 업무": "新任务",
  "저장": "保存",
  "취소": "取消",
  "삭제": "删除",
  "수정": "编辑",
  "닫기": "关闭",
  "확인": "确认",

  // Files tab
  "파일 첨부": "添加文件",
  "업로드": "上传",
  "업로드 중...": "上传中...",
  "다운로드": "下载",
  "파일이 없습니다.": "暂无文件。",
  "AI 분석 보기": "查看 AI 分析",
  "AI 분석 숨기기": "隐藏 AI 分析",
  "AI 분석": "AI 分析",
  "첨부된 자료가 없습니다.": "暂无附件。",
  "자료 업로드": "上传资料",
  "업로드 권한이 없습니다. 관리자에게 문의해주세요.": "没有上传权限，请联系管理员。",
  "업로드에 실패했습니다. 잠시 후 다시 시도해주세요.": "上传失败，请稍后重试。",
  "업로드에 실패했습니다.": "上传失败。",

  // Comments tab
  "코멘트를 입력하세요": "请输入评论",
  "등록": "发布",
  "아직 등록된 코멘트가 없습니다.": "暂无评论。",
  "아직 코멘트가 없습니다.": "暂无评论。",
  "(운영팀)": "(运营团队)",
  "(클라이언트)": "(客户)",
  "(협력사)": "(合作伙伴)",
  "(Claude 자동)": "(Claude 自动)",
  "답글": "回复",
  "답글 작성": "写回复",

  // Task detail drawer (partner-visible parts)
  "업무 상세": "任务详情",
  "설명": "说明",
  "설명이 없습니다.": "暂无说明。",
  "메모": "备注",
  "결정 필요": "需要决策",
  "결정 대기 중": "等待决策",
  "확인/승인이 필요합니다": "需要确认/批准",
  "응답 메모(선택)": "回复备注（可选）",
  "확인했습니다": "已确认",
  "확인 처리 중 오류가 발생했습니다.": "处理确认时发生错误。",
  "마감임박": "临近截止",
  "일정": "日程",
  "일정 변경 이력": "日程变更记录",
  "선행 업무 변경으로 자동 조정": "因前置任务变更自动调整",
  "담당 및 진행 상태": "负责人及进度状态",
  "선행 업무가 모두 완료되면 자동으로 시작 가능 상태로 전환됩니다.": "所有前置任务完成后将自动转为可开始状态。",
  "체크리스트 완료 항목 기준으로 자동 계산됩니다.": "根据已完成的清单项自动计算。",
  "체크리스트": "清单",
  "선행 업무": "前置任务",
  "확인/승인 이력": "确认/批准记录",
  "요청": "请求",
  "요청 취소됨": "请求已取消",
  "확인 완료": "已确认",
  "대기 중": "等待中",

  // Notification settings / notices
  "알림 유형": "通知类型",
  "알림 설정을 관리하세요.": "管理您的通知设置。",
  "공지사항이 없습니다.": "暂无公告。",
  "읽음": "已读",
  "알림": "通知",
  "모두 읽음": "全部已读",
  "전체 삭제": "全部删除",
  "브라우저 알림 끄기": "关闭浏览器通知",
  "브라우저 알림 켜기": "开启浏览器通知",
  "알림이 없습니다.": "暂无通知。",
  "모든 알림을 삭제하시겠습니까?": "确定要删除所有通知吗？",
  "푸시 알림이 켜졌습니다. 이제 이 기기로 알림이 옵니다.": "推送通知已开启，此设备现在将收到通知。",
  "설정에 실패했습니다.": "设置失败。",
  "검색 (⌘K)": "搜索（⌘K）",
  "꺼둔 알림은 푸시·이메일로 보내지 않아요. 알림 목록에는 계속 남습니다.": "关闭的通知不会通过推送/邮件发送，但仍会保留在通知列表中。",
  "알림 테스트": "通知测试",
  "나에게 테스트 알림을 한 건 보냅니다. 알림벨·푸시·이메일이 모두 정상인지 한 번에 확인할 수 있어요.": "向自己发送一条测试通知，一次性确认通知铃、推送、邮件是否都正常。",
  "보내는 중...": "发送中...",
  "테스트 알림 보내기": "发送测试通知",
  "보냈습니다. 알림벨에 바로 뜨고, 푸시·이메일은 1분 안에 도착합니다. 안 오면 이 화면 맨 위에 빨간 안내가 뜹니다.": "已发送。通知铃会立即显示，推送/邮件将在 1 分钟内送达。如果没收到，页面顶部会出现红色提示。",
  "테스트 알림을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.": "测试通知发送失败，请稍后重试。",
  // NOTIFICATION_TYPE_LABEL
  "업무 배정": "任务分配",
  "업무 상태 변경": "任务状态变更",
  "새 코멘트": "新评论",
  "업무 시작 가능": "任务可以开始",
  "마감일 임박": "截止日期临近",
  "마감일 초과": "已超过截止日期",
  "일정 자동 조정": "日程自动调整",
  "주간 업무 요약": "每周任务摘要",
  "확인/승인 요청": "确认/批准请求",
  "새 문의": "新咨询",
  "문의 답변 등록": "咨询已回复",
  "새 견적 요청": "新报价请求",
  "견적서 응답": "报价单回复",
  "새 발주": "新采购订单",
  "발주 상태 변경": "订单状态变更",
  "발주 취소 요청": "订单取消请求",
  "계약서 서명 완료": "合同签署完成",
  "계약서 수정 요청": "合同修改请求",
  "계약 만료 임박": "合同即将到期",

  // Home — misc
  "새 프로젝트를 준비하고 있습니다": "新项目筹备中",

  // AiDiagnosisPanel
  "AI 진단": "AI 诊断",
  "실제 데이터 수치만 근거로 생성되는 참고 의견입니다": "仅基于实际数据生成的参考意见",
  "진단 중...": "诊断中...",
  "다시 진단": "重新诊断",
  "AI 진단하기": "AI 诊断",
  "* AI가 자동 생성한 참고 의견입니다.": "* 此为 AI 自动生成的参考意见。",
  "양호": "良好",
  "주의": "注意",
  "위험": "风险",

  // Task list / gantt — 업무 목록 로딩 실패
  "업무 목록을 불러오지 못했습니다.": "无法加载任务列表。",

  // Calendar subscribe / excel export
  "캘린더 구독 링크 — 구글/애플 캘린더에 URL로 추가하면 일정이 자동으로 갱신됩니다": "日历订阅链接 — 添加到 Google/Apple 日历后会自动更新日程",
  "준비 중...": "准备中...",
  "캘린더 구독": "订阅日历",
  "엑셀 다운로드": "下载 Excel",
  "아래 버튼을 누르면 캘린더 앱이 바로 열리면서 구독이 시작됩니다. 안 열리면 링크를 복사해서 캘린더 앱에 직접 추가해주세요.":
    "点击下方按钮即可打开日历应用并开始订阅。如果无法打开，请复制链接后手动添加到日历应用。",
  "캘린더 앱에 바로 추가": "立即添加到日历应用",
  "링크 복사": "复制链接",
  "복사됨!": "已复制！",

  // GanttChart
  "등록된 업무가 없습니다. 업무 리스트 탭에서 업무를 추가해보세요.": "还没有任务。请在任务列表标签页中添加任务。",
  "전체 보기": "查看全部",
  "축소": "缩小",
  "확대": "放大",

  // TaskList / task status
  "대기(선행업무)": "等待中（前置任务）",
  "진행 전": "未开始",
  "확인필요": "需确认",
  "선행": "前置任务",
  "미지정": "未指定",
  "업무명 또는 담당자 검색": "搜索任务名称或负责人",
  "진행률": "进度",
  "등록된 업무가 없습니다.": "暂无任务。",

  // My supplier orders (협력사 발주 목록)
  "발주 목록": "订单列表",
  "불러오지 못했습니다": "加载失败",
  "HANDYHAND에서 발행한 발주서 내역입니다.": "这里是 HANDYHAND 发出的采购订单记录。",
  "등록된 발주서가 없습니다.": "暂无采购订单。",
  "선적항": "装运港",
  "납기": "交货期",
  "일": "天",
  "결제조건": "付款条件",
  "포장": "包装",
  "작성중": "草拟中",
  "발행됨": "已发行",
  "접근 권한이 없습니다.": "没有访问权限。",
  "구매발주 정보를 찾을 수 없습니다.": "找不到该采购订单信息。",
  "인쇄 시 A4 크기로 저장됩니다.": "打印时将保存为 A4 大小。",
  "인쇄 / PDF 저장": "打印 / 保存为 PDF",
  "미리보기 / PDF": "预览 / PDF",

  // Partner archive tab (협력사 자료함)
  "이 탭은 관리자와 협력사만 볼 수 있습니다. 고객에게는 노출되지 않습니다.": "此标签页仅管理员和合作伙伴可见，客户无法看到。",
  "협력사 자료함": "合作伙伴资料库",
};

export function zh(useZh: boolean, ko: string): string {
  if (!useZh) return ko;
  return ZH_DICT[ko] ?? ko;
}

// 현재 로그인한 계정이 "중국업체" 협력사인지 — 화면 곳곳에서 매번 role/partnerLang을
// 직접 비교하지 않도록 훅으로 묶어둔다.
export function usePartnerZh(): boolean {
  const { appUser } = useAuth();
  return appUser?.role === "partner" && appUser.partnerLang === "zh";
}

// ---- 프로젝트명·업무명 등 자유 텍스트 자동 번역 ----
// ZH_DICT는 고정된 UI 문구용이라, 관리자가 직접 입력해 매번 값이 다른 데이터(프로젝트명,
// 업무명 등)는 /api/translate-zh로 기계 번역한다. 같은 문구를 반복 요청하지 않도록 메모리
// + localStorage에 캐싱한다(새로고침해도 유지, 프라이빗 모드 등으로 storage를 못 쓰면
// 메모리 캐시만으로 계속 동작).
const autoTranslateCache = new Map<string, string>();
const AUTO_TRANSLATE_STORAGE_KEY = "zh-auto-translate-cache-v1";
let cacheLoadedFromStorage = false;

function loadCacheFromStorage() {
  if (cacheLoadedFromStorage) return;
  cacheLoadedFromStorage = true;
  try {
    const raw = localStorage.getItem(AUTO_TRANSLATE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) autoTranslateCache.set(k, v);
  } catch {
    // 프라이빗 모드 등으로 localStorage를 못 쓰면 메모리 캐시만으로 계속 동작한다.
  }
}

// 이 함수를 useEffect 안에서만 호출하면 첫 렌더는 항상 원문(한국어)으로 그려진 뒤에야
// 캐시가 채워져 화면이 한 번 깜빡인다(원문 → 중국어) — 이미 번역해본 적 있는 문구까지
// 매번 새로고침할 때마다 그렇게 보이는 게 거슬린다는 피드백이 있었다. 모듈이 로드되는
// 시점(첫 렌더보다 먼저)에 즉시 한 번 읽어둬서, 브라우저 세션에서 이미 캐싱된 문구는
// 첫 렌더부터 바로 중국어로 나오게 한다. "use client" 컴포넌트에서만 이 모듈이
// 번들되므로 브라우저 환경이 보장되지만, SSR 사전 렌더 안전을 위해 형식적으로 가드한다.
if (typeof window !== "undefined") {
  loadCacheFromStorage();
}

function persistCacheToStorage() {
  try {
    localStorage.setItem(AUTO_TRANSLATE_STORAGE_KEY, JSON.stringify(Object.fromEntries(autoTranslateCache)));
  } catch {
    // 저장 실패해도 이번 세션 동안은 메모리 캐시로 계속 동작한다.
  }
}

// 여러 컴포넌트(간트차트, 업무 리스트 등)가 겹치는 텍스트를 동시에 요청할 때 같은
// 조합을 중복으로 호출하지 않도록 진행 중인 요청도 함께 추적한다.
const pendingTranslateRequests = new Map<string, Promise<void>>();

async function translateBatch(texts: string[]): Promise<void> {
  const key = texts.join(" ");
  const existing = pendingTranslateRequests.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch("/api/translate-zh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const translations = data.translations as string[];
      texts.forEach((t, i) => {
        if (translations[i]) autoTranslateCache.set(t, translations[i]);
      });
      persistCacheToStorage();
    } catch {
      // 번역 실패 시 원문을 계속 보여주는 걸로 충분하다 — 별도 에러 UI 없음.
    } finally {
      pendingTranslateRequests.delete(key);
    }
  })();
  pendingTranslateRequests.set(key, promise);
  return promise;
}

/**
 * 저장 시점에 미리 번역해두기 위한 일회성 호출(훅이 아님) — Firestore 쓰기 헬퍼(tasks.ts,
 * projects.ts, comments.ts 등)에서 값을 저장한 직후 fire-and-forget으로 호출해, 결과를
 * nameZh/textZh 같은 필드에 함께 저장한다. 뷰 쪽의 useZhAutoTranslate와 캐시를 공유하므로,
 * 같은 문구를 화면에서 다시 보게 되면 이미 캐시된 값을 즉시 재사용한다. 실패하면 null을
 * 반환하고 호출 쪽은 그냥 필드를 비워둔다 — 화면에서 즉석 번역(useZhAutoTranslate)으로
 * 대체되므로 사용자에게 보이는 실패는 없다.
 */
export async function translateForCache(texts: string[]): Promise<(string | null)[]> {
  const missing = Array.from(new Set(texts.filter((t) => t && !autoTranslateCache.has(t)))).slice(0, 50);
  if (missing.length > 0) {
    await translateBatch(missing);
  }
  return texts.map((t) => autoTranslateCache.get(t) ?? null);
}

/**
 * 협력사(중국 업체) 계정에게 texts(예: 업무명 목록)를 자동 번역해서 보여준다.
 * useZh가 false면 빈 맵을 반환한다(호출 쪽에서 map[text] ?? text로 원문 폴백).
 * 반환값은 { [원문]: 번역문 } — 아직 번역 중이거나 실패한 항목은 키가 없다.
 */
export function useZhAutoTranslate(useZh: boolean, texts: string[]): Record<string, string> {
  const [, forceRerender] = useState(0);
  const key = texts.filter(Boolean).join(" ");

  useEffect(() => {
    if (!useZh || !key) return;
    loadCacheFromStorage();
    const unique = Array.from(new Set(key.split(" "))).filter((t) => t && !autoTranslateCache.has(t));
    if (unique.length === 0) return;
    // API 쪽 1회 요청 상한(MAX_TEXTS=50)에 맞춰 과도하게 큰 목록은 앞부분만 우선 번역한다.
    translateBatch(unique.slice(0, 50)).then(() => forceRerender((n) => n + 1));
  }, [useZh, key]);

  if (!useZh || !key) return {};
  const map: Record<string, string> = {};
  for (const t of key.split(" ")) {
    if (t && autoTranslateCache.has(t)) map[t] = autoTranslateCache.get(t)!;
  }
  return map;
}
