import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

// 고객이 "수정 요청" 화면에서 직접 계약서 본문을 고칠 때, 새로 써넣은 부분을 구분할 수 있게
// 빨간 글자로 표시하는 마크. class(에디터에서 다시 불러올 때 인식용)와 인라인 style(읽기
// 전용 미리보기 등에서 sanitizer가 class를 지워도 색은 남도록)을 둘 다 넣는다.
export const RevisionMark = Mark.create({
  name: "revisionMark",
  parseHTML() {
    return [{ tag: "span.revision-mark" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "revision-mark", style: "color:#ef4444" }), 0];
  },
});

// 고객이 타이핑/붙여넣기로 새로 넣은 내용에 자동으로 RevisionMark를 씌운다 — 수정 요청
// 편집기에서만 켜서, 고객이 이번에 실제로 바꾼 부분만 담당자에게 빨간 글자로 명확히 보이게
// 한다(관리자 쪽 일반 편집에서는 이 확장을 켜지 않으므로 관리자가 손보는 내용은 빨갛게
// 표시되지 않는다).
export const RevisionAutoMark = Extension.create({
  name: "revisionAutoMark",
  addProseMirrorPlugins() {
    const markType = this.editor.schema.marks.revisionMark;
    if (!markType) return [];
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          let tr: typeof newState.tr | null = null;
          for (const transaction of transactions) {
            if (!transaction.docChanged) continue;
            // ContractBodyEditor가 마운트/외부 value 동기화 시 editor.commands.setContent(value,
            // { emitUpdate: false })를 쓰는데, 이것도 문서를 통째로 교체하는 "진짜 트랜잭션"이라
            // 여기서 안 걸러주면 처음 불러온 원문 전체가 "방금 새로 써넣은 내용"으로 오인되어
            // 전부 빨갛게 칠해진다. emitUpdate:false일 때 Tiptap이 자동으로 붙이는
            // "preventUpdate" 메타를 그대로 재사용해 이 경우를 구분한다.
            if (transaction.getMeta("preventUpdate")) continue;
            transaction.steps.forEach((step, i) => {
              const map = step.getMap();
              map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                if (newEnd <= newStart) return;
                const from = transaction.mapping.slice(i + 1).map(newStart, -1);
                const to = transaction.mapping.slice(i + 1).map(newEnd, 1);
                if (to <= from) return;
                if (!tr) tr = newState.tr;
                tr.addMark(from, to, markType.create());
              });
            });
          }
          return tr;
        },
      }),
    ];
  },
});
