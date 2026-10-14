// 메뉴를 옮길 때마다 Firestore 리스너를 새로 맺고 첫 응답을 기다리는 왕복이 반복된다 —
// 프록시를 거치는 세션에서는 이 왕복 하나하나가 느려서, 페이지를 오갈 때마다 매번
// "불러오는 중..."이 길게 느껴졌다. 한 번 받아온 데이터를 메모리에 잠깐 기억해뒀다가,
// 같은 화면에 다시 들어오면 일단 그 데이터를 먼저 보여주고(로딩 화면 생략) 실시간
// 리스너는 그대로 백그라운드에서 다시 맺어 최신값으로 조용히 갱신한다(stale-while-
// revalidate). 탭/새로고침하면 그냥 비워지는 순수 메모리 캐시라 영속성 걱정은 없다.
const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}
