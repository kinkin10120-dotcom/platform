import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { CONTENT_WIDTH_PX } from "@/lib/a4Layout";

// prosemirror-tables 열 드래그 리사이즈의 기본 최소 셀 폭(우리 Table.configure에서 별도로
// cellMinWidth를 지정하지 않아 라이브러리 기본값 그대로다).
const DEFAULT_CELL_MIN_WIDTH = 25;

// CSS(max-width + overflow:hidden)만으로 표 폭을 A4 본문 폭 안에 가두면, 이미 그 폭을 넘겨
// 드래그해버린 표는 화면에서 잘려 보일 뿐 실제 저장된 열 너비 값은 그대로 남는다 — 그러면
// 넘어간 만큼의 드래그 손잡이 자체가 화면 밖으로 나가서 다시 줄일 방법이 없어진다. 그래서
// 여기서는 문서가 바뀔 때마다(트랜잭션마다) 모든 표를 검사해서, 열 너비 합이 A4 본문 폭을
// 넘으면 그 자리에서 비례적으로 줄여 항상 폭 안에 맞게 되돌린다 — 화면 클리핑이 아니라 실제
// 저장되는 값 자체를 고친다. 이미 기존에 저장돼 있던(넘친 채로 굳어있던) 표도, 에디터가 처음
// 열리는 순간(ContractBodyEditor의 onCreate에서 빈 트랜잭션을 한 번 보내 이 로직을 강제로
// 한 번 돌려준다) 자동으로 고쳐진다.
export const TableWidthClamp = Extension.create({
  name: "tableWidthClamp",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          let tr: typeof newState.tr | null = null;
          let modified = false;

          newState.doc.descendants((tableNode, tablePos) => {
            if (tableNode.type.name !== "table") return;

            const headerRow = tableNode.firstChild;
            if (!headerRow) return;
            const colWidths: number[] = [];
            for (let i = 0, col = 0; i < headerRow.childCount; i++) {
              const { colspan, colwidth } = headerRow.child(i).attrs as {
                colspan: number;
                colwidth?: (number | null)[] | null;
              };
              for (let j = 0; j < colspan; j++, col++) {
                colWidths[col] = (colwidth && colwidth[j]) || DEFAULT_CELL_MIN_WIDTH;
              }
            }
            const total = colWidths.reduce((a, b) => a + b, 0);
            if (total <= CONTENT_WIDTH_PX) return;

            const scale = CONTENT_WIDTH_PX / total;
            tableNode.descendants((cellNode, relPos) => {
              if (cellNode.type.name !== "tableCell" && cellNode.type.name !== "tableHeader") return;
              const colwidth = cellNode.attrs.colwidth as (number | null)[] | null;
              if (!colwidth) return;
              const nextColwidth = colwidth.map((w) =>
                w ? Math.max(DEFAULT_CELL_MIN_WIDTH, Math.round(w * scale)) : w
              );
              if (nextColwidth.some((w, idx) => w !== colwidth[idx])) {
                if (!tr) tr = newState.tr;
                tr.setNodeMarkup(tablePos + 1 + relPos, null, { ...cellNode.attrs, colwidth: nextColwidth });
                modified = true;
              }
            });
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
