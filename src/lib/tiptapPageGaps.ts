import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { PAGE_PADDING_PX } from "@/lib/a4Layout";

export interface PageGap {
  pos: number;
  // 실제 A4 여백(위+아래, 고정값) 크기 — 회색 점선 띠 부분.
  height: number;
  // 이 페이지에 아직 다 못 채운 남은 공간 — 흰 배경으로 그 자리를 그대로 메워서, 줄을
  // 지우거나 늘려도 "흰 종이 영역" 자체의 높이는 항상 A4 한 장 그대로 유지되게 한다.
  leftoverHeight: number;
  label: string;
}

export const pageGapsPluginKey = new PluginKey<DecorationSet>("pageGaps");

// "크게 편집" 화면은 실제로는 하나로 이어진 편집 영역이지만, 계산된 쪽 나눔 위치마다 실제
// 빈 공간(회색 띠)을 문서 흐름 안에 끼워 넣어 미리보기처럼 여러 페이지로 나뉜 것처럼 보이게
// 한다. 위젯 데코레이션은 화면 표시 전용이라 실제 문서 모델(저장되는 본문 HTML)에는 전혀
// 반영되지 않는다 — 이전 방식(절대위치 오버레이로 글자를 가리는 방식)과 달리 실제 내용을
// 가리지 않고, 블록 경계에서만 끊기므로 위치도 정확하다.
export const PageGaps = Extension.create({
  name: "pageGaps",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pageGapsPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const gaps = tr.getMeta(pageGapsPluginKey) as PageGap[] | undefined;
            if (!gaps) return old.map(tr.mapping, tr.doc);
            const decorations = gaps.map((gap) =>
              Decoration.widget(
                gap.pos,
                () => {
                  // 바깥 래퍼: 흰 배경 스페이서(남은 공간을 흰 종이처럼 그대로 채움) + 회색
                  // 점선 띠(실제 A4 여백, 고정 크기) 두 부분을 위아래로 쌓는다 — 이렇게 나눠야
                  // 줄을 지우거나 늘려도 흰 종이 영역 자체의 높이는 항상 A4 한 장 그대로다.
                  const wrap = document.createElement("div");
                  // 편집기가 "이 페이지가 실제로 쓴 높이"를 잴 때 본문 블록과 이 위젯을
                  // 구분해야 한다(ContractBodyEditor 참고) — 표시 전용 요소임을 명시한다.
                  wrap.dataset.pageGap = "1";
                  wrap.style.marginLeft = `-${PAGE_PADDING_PX}px`;
                  wrap.style.marginRight = `-${PAGE_PADDING_PX}px`;
                  wrap.style.width = `calc(100% + ${PAGE_PADDING_PX * 2}px)`;
                  wrap.contentEditable = "false";

                  if (gap.leftoverHeight > 0) {
                    const spacer = document.createElement("div");
                    spacer.style.height = `${gap.leftoverHeight}px`;
                    spacer.style.background = "#fff";
                    wrap.appendChild(spacer);
                  }

                  // height가 0이면(마지막 페이지) 회색 띠 자체를 만들지 않는다 — 아래쪽
                  // 여백은 감싸는 .po-page의 패딩이 이미 담당하므로, 여기서 띠를 그리면
                  // 그 장만 여백이 두 번 들어가 길어진다.
                  if (gap.height > 0) {
                    const el = document.createElement("div");
                    el.className = "contract-page-gap";
                    el.style.height = `${gap.height}px`;
                    const label = document.createElement("span");
                    label.className = "contract-page-gap-label";
                    label.textContent = gap.label;
                    el.appendChild(label);
                    wrap.appendChild(el);
                  }

                  return wrap;
                },
                {
                  side: -1,
                  // 키에 높이까지 넣어야 한다 — 위치만 넣으면 ProseMirror가 "같은 위젯"으로
                  // 보고 이전 DOM을 그대로 재사용해서, 높이를 다시 계산해 보내도 화면이
                  // 바뀌지 않는다(실제로 스페이서가 계속 0으로 남던 원인).
                  key: `page-gap-${gap.pos}-${Math.round(gap.leftoverHeight)}-${Math.round(gap.height)}`,
                }
              )
            );
            return DecorationSet.create(tr.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
