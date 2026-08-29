"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { compressImage } from "@/lib/imageCompress";
import { PAGE_PADDING_PX, CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX, SAFETY_BUFFER_PX, HEADER_BODY_GAP_PX } from "@/lib/a4Layout";
import { paginateHtml, measurePageHeight } from "@/lib/contractPagination";
import PdfPageScaler from "@/components/PdfPageScaler";
import { PageHeader, ContractHeaderData } from "@/components/ContractPreviewDocument";
import { PageGaps, pageGapsPluginKey, PageGap } from "@/lib/tiptapPageGaps";
import { TableWidthClamp } from "@/lib/tiptapTableWidthClamp";
import { RevisionMark, RevisionAutoMark } from "@/lib/tiptapRevisionMark";
import { SignatureBlock } from "@/lib/tiptapSignatureBlock";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List as ListIcon,
  ListOrdered,
  Table2,
  ImagePlus,
  Rows3,
  Columns3,
  Trash2,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Combine,
  TableCellsSplit,
  Baseline,
} from "lucide-react";

const FONT_SIZES = [
  { label: "본문", value: "" },
  { label: "작게", value: "12px" },
  { label: "크게", value: "18px" },
  { label: "제목", value: "22px" },
];

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-medium ${
        active ? "bg-[#1d1d1f] text-white" : "text-[#1d1d1f] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function ContractBodyEditor({
  value,
  onChange,
  contractId,
  pageStyle,
  onClose,
  standalonePage,
  topBar,
  headerData,
  hideImageButton,
  markInsertions,
}: {
  value: string;
  onChange: (html: string) => void;
  contractId: string;
  // true면 A4 실제 폭/여백/글자 크기 그대로 편집 영역을 보여준다 — "크게 편집" 모달에서 실제
  // 인쇄 결과와 가까운 레이아웃을 보면서 수정할 수 있게 하는 용도.
  pageStyle?: boolean;
  // pageStyle과 별개로, 이 컴포넌트가 (app) 레이아웃의 <main> 안에 독립 페이지로 곧바로
  // 렌더링될 때만 true로 준다 — 그때만 <main>의 위쪽 여백을 취소하고 서식 툴바를 앱
  // 상단바 바로 아래에 자체적으로 fixed 고정한다. 반대로 고객 서명 페이지의 "수정 요청"
  // 편집기처럼 이미 자기만의 fixed 오버레이 안에 들어있는 경우 이 트릭을 또 적용하면
  // <main> 기준 오프셋이 안 맞아 레이아웃이 깨지므로, 그런 곳에서는 켜지 않는다(예전
  // sticky 방식 그대로 유지).
  standalonePage?: boolean;
  // 지정하면 툴바 오른쪽 끝에 닫기 버튼이 붙는다 — 전체화면 모달로 띄웠을 때 사용.
  onClose?: () => void;
  // standalonePage일 때만 사용 — 서식 툴바 위에 붙는 별도 줄(예: "계약 목록으로"/"저장"
  // 버튼). 툴바와 한데 뭉치지 않도록 분리된 자기 줄로 고정 상단바 스택에 같이 얹는다.
  topBar?: React.ReactNode;
  // 지정하면 미리보기와 동일한 위치(맨 위)에 제목/당사자/금액 헤더를 같이 보여준다.
  headerData?: ContractHeaderData;
  // 이미지 업로드는 Firebase Storage 쓰기 권한(로그인 필요)이 있어야 동작한다 — 로그인하지
  // 않은 상대방(서명 페이지의 수정 요청 편집기)에게는 눌러도 실패할 버튼을 아예 숨긴다.
  hideImageButton?: boolean;
  // 켜면 이 세션에서 새로 타이핑/붙여넣은 내용에 자동으로 빨간 글자(RevisionMark)를 씌운다 —
  // 고객이 계약서를 직접 고쳐 수정 요청을 보낼 때, 어디를 바꿨는지 담당자가 한눈에 알아볼 수
  // 있게 하는 용도. 관리자 쪽 일반 편집에서는 켜지 않는다.
  markInsertions?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      // 오른쪽 바깥 경계선을 직접 잠그지 않고(lastColumnResizable), 실제 저장되는 열 너비 값
      // 자체를 TableWidthClamp가 A4 본문 폭 안으로 강제한다(globals.css의 CSS 클램프는 혹시
      // 남는 화면 표시 오차를 잡는 보조 안전망일 뿐, 값 자체를 고치는 건 이 확장이다).
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TableWidthClamp,
      PageGaps,
      RevisionMark,
      ...(markInsertions ? [RevisionAutoMark] : []),
      SignatureBlock,
      Image.configure({
        // 이 버전의 Image 확장은 resize 옵션에 className을 전달받지 않는다(내부적으로
        // ResizableNodeView에 그대로 넘기지 않음) — 대신 핸들은 항상 data-resize-handle
        // 속성을 갖고 렌더링되므로, globals.css에서 그 속성 선택자로 직접 스타일을 준다.
        resize: {
          enabled: true,
          directions: ["bottom-right", "bottom-left", "top-right", "top-left"],
          minWidth: 60,
          alwaysPreserveAspectRatio: true,
        },
      }),
    ],
    content: value,
    // 이미 저장돼 있던 본문에 폭이 넘친 표가 있을 수 있으므로(예: 폭 상한이 생기기 전에
    // 만들어진 표), 에디터가 뜨자마자 빈 트랜잭션을 한 번 보내 TableWidthClamp의 검사를
    // 강제로 한 번 돌려서 즉시 고쳐지게 한다.
    onCreate: ({ editor: e }) => {
      e.view.dispatch(e.state.tr);
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: pageStyle
          ? "tiptap-content text-[13px] leading-[1.9] text-[#1d1d1f] outline-none"
          : "tiptap-content h-[300px] overflow-y-auto rounded-b-2xl border border-t-0 border-[#d1d1d6] px-3 py-2.5 text-xs leading-relaxed text-[#1d1d1f] outline-none",
      },
    },
  });

  // 툴바 버튼의 "눌린 상태"는 커서/선택 영역이 바뀔 때마다(마우스로 다른 곳을 클릭하는 것도
  // 포함) 갱신되어야 한다. editor.isActive(...)를 JSX에서 바로 읽으면 이 컴포넌트가 리렌더될
  // 때(주로 문서 내용이 바뀔 때)의 스냅샷만 보여줘서, 커서만 옮기는 경우엔 버튼 표시가
  // 그대로 멈춰 있는 문제가 있었다 — useEditorState로 선택 변화까지 구독해 항상 최신 상태로
  // 리렌더되게 한다.
  const activeMarks = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      underline: e?.isActive("underline") ?? false,
      bulletList: e?.isActive("bulletList") ?? false,
      orderedList: e?.isActive("orderedList") ?? false,
      alignLeft: e?.isActive({ textAlign: "left" }) ?? false,
      alignCenter: e?.isActive({ textAlign: "center" }) ?? false,
      alignRight: e?.isActive({ textAlign: "right" }) ?? false,
    }),
  }) ?? {
    bold: false,
    italic: false,
    underline: false,
    bulletList: false,
    orderedList: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
  };

  // 외부에서 value가 바뀌면(예: 다른 계약 선택, 저장 후 재조회, 다른 입력 필드 변경으로 인한
  // 토큰 재치환) 에디터 내용도 맞춰준다 — 단, 이 value는 form.bodyText가 바뀔 때마다(즉 사용자가
  // 이 에디터에 타이핑할 때마다) 매번 resolveContractTokens를 다시 거쳐 새로 계산되는 값이라,
  // 문자열이 정확히 한 글자도 안 틀리고 같지 않으면(직렬화 방식 차이 등으로 실제로는 자주 이럴
  // 수 있다) 타이핑 중에도 계속 setContent가 걸려 편집 중인 내용을 통째로 덮어써 버린다 —
  // 이 경우 한글 입력기(IME) 조합이 깨지면서 방금 지운 글자가 되살아나는 것처럼 보인다.
  // 사용자가 지금 이 에디터에 포커스를 두고 직접 타이핑하는 중이라면(=본인이 만든 변화) 외부
  // value로 덮어쓸 필요가 없으므로, 포커스가 없을 때만(다른 계약 선택, 다른 필드 편집 등 진짜
  // "외부" 변화일 때만) 동기화한다.
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  // "크게 편집" 화면은 실제로는 하나로 이어진 편집 영역이지만, "미리보기"와 정확히 같은
  // 기준(블록 단위 그리디 분할, 같은 페이지 예산·여유값)으로 쪽 나눔 위치를 계산해 그 자리에
  // 실제 빈 공간(회색 띠, PageGaps 확장의 위젯 데코레이션)을 끼워 넣는다 — 화면 표시 전용이라
  // 저장되는 본문 HTML에는 전혀 영향을 주지 않는다. 편집 영역 자체(줄바꿈이 반영된 실제 DOM)를
  // 직접 측정하므로 미리보기처럼 별도 숨김 요소나 웹폰트 로딩 경쟁 문제도 없다.
  const headerRef = useRef<HTMLDivElement>(null);

  // standalonePage일 때 상단바(계약서 미리보기와 같은 방식 — 앱 자체 헤더 h-14는 그대로
  // 두고 그 바로 아래에 position:fixed로 이어붙인다)의 실제 높이를 측정해 본문
  // padding-top으로 되돌려준다. topBar(있으면)와 서식 툴바 두 줄의 높이를 각각 잰다.
  const topBarRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  useLayoutEffect(() => {
    if (!standalonePage) return;
    function measure() {
      setTopBarHeight(topBarRef.current?.offsetHeight ?? 0);
      setToolbarHeight(toolbarRef.current?.offsetHeight ?? 0);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [standalonePage, topBar]);

  // 쪽 나눔 계산 전용 숨김 측정 요소 — 미리보기(ContractPreviewDocument)와 똑같은 방식
  // (paginateHtml에 HTML을 다시 그려 넣어 높이를 잰다)을 여기서도 그대로 쓴다. 예전엔 이
  // 편집기가 실제 렌더링된 라이브 DOM을 직접 측정하는 별도 방식을 썼는데, 두 화면이 서로
  // 다른 방식으로 재다 보니 미묘하게 어긋나는 문제가 반복됐다 — 알고리즘 자체를 하나로
  // 합쳐야 두 화면이 항상 정확히 같은 결과를 낸다.
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor || !pageStyle) return;
    function recompute() {
      const measureEl = measureRef.current;
      if (!measureEl) return;

      const html = editor!.getHTML();
      const headerHeight = headerData ? (headerRef.current?.offsetHeight ?? 0) + HEADER_BODY_GAP_PX : 0;
      const budgets = { first: CONTENT_HEIGHT_PX - headerHeight - SAFETY_BUFFER_PX, rest: CONTENT_HEIGHT_PX - SAFETY_BUFFER_PX };
      const pages = paginateHtml(html, budgets, measureEl);
      measureEl.innerHTML = "";

      // doc의 최상위 노드 시작 위치를 인덱스로 미리 찾아둔다 — 페이지 경계가 "몇 번째
      // 블록 다음"인지만 알면 바로 그 위치를 찾을 수 있다. editor.getHTML()과
      // doc.forEach는 같은 문서를 순서대로 순회하므로 인덱스가 정확히 대응한다.
      const nodeOffsets: number[] = [];
      editor!.view.state.doc.forEach((_node, offset) => nodeOffsets.push(offset));

      const gaps: PageGap[] = [];
      let blockIndex = 0;
      pages.forEach((pageHtml, i) => {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = pageHtml;
        blockIndex += wrapper.children.length;

        const budget = i === 0 ? budgets.first : budgets.rest;
        const used = measurePageHeight(pageHtml, measureEl);
        const leftoverHeight = Math.max(0, budget - used);
        const isLastPage = i === pages.length - 1;

        if (isLastPage) {
          // 마지막 페이지는 다음 페이지로 넘어가는 경계가 없다 — 미리보기(항상 A4 한 장
          // 전체 높이로 보이는)와 달리 내용이 끝나는 지점에서 뚝 끊겨 보이지 않도록, 남은
          // 공간을 흰 스페이서로 채우고 아래쪽 여백만 문서 맨 끝에 붙인다.
          gaps.push({
            pos: editor!.state.doc.content.size,
            height: PAGE_PADDING_PX,
            leftoverHeight,
            label: `${i + 1}쪽 끝`,
          });
        } else {
          const pos = nodeOffsets[blockIndex];
          if (pos !== undefined) {
            // 회색 띠 높이는 항상 A4 여백(위+아래) 고정값만 쓰고, 이 페이지에 아직 못 채운
            // 남은 공간은 흰 스페이서(leftoverHeight)로 따로 채운다 — 그래야 줄을 지우거나
            // 늘려도 "흰 종이 영역" 자체의 높이는 항상 A4 한 장 그대로 유지되고, 회색 띠는
            // 항상 같은 크기라 그 자체를 기준자처럼 믿을 수 있다.
            gaps.push({ pos, height: PAGE_PADDING_PX * 2, leftoverHeight, label: `${i + 1}쪽 끝` });
          }
        }
      });

      editor!.view.dispatch(editor!.view.state.tr.setMeta(pageGapsPluginKey, gaps));
    }
    recompute();
    editor.on("update", recompute);
    window.addEventListener("resize", recompute);
    return () => {
      editor.off("update", recompute);
      window.removeEventListener("resize", recompute);
    };
  }, [editor, pageStyle, headerData]);

  function insertNextArticle() {
    if (!editor) return;
    const text = editor.getText();
    const nums = [...text.matchAll(/제\s*(\d+)\s*조/g)].map((m) => Number(m[1]));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    editor.chain().focus().insertContent(`<p><strong>제 ${next} 조 ( )</strong></p><p></p>`).run();
  }

  // 관리자가 본문을 직접 손으로 써서 "서명: (전자서명 대기 중)" 같은 가짜 서명란 텍스트를
  // 타이핑해 넣는 경우, 실제 직인/서명 이미지가 나오는 signatureBlock 노드로 그 자리에서
  // 바로 바꿔 끼울 수 있게 커서 위치에 삽입한다. 서명 전이라 attrs는 아직 비어있는 상태로
  // 넣는다(을 직인은 variant·entity만으로 항상 실제 이미지가 나오고, 갑 서명은 실제 서명
  // 시점에 Cloud Function이 signedBodyText를 새로 만들 때 채워진다). 을 직인은 계약금액
  // 통화(headerData.currency)로 핸디핸드/AIM 법인을 자동으로 고른다.
  function insertSignatureBlock(variant: "gap" | "eul") {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "signatureBlock",
        attrs: {
          variant,
          signerName: null,
          signerTitle: null,
          signatureUrl: null,
          signedAtLabel: null,
          sentBy: null,
          sentAtLabel: null,
          entity: variant === "eul" && headerData?.currency === "USD" ? "aim" : "handyhand",
        },
      })
      .run();
  }

  async function handleImageUpload(file: File) {
    if (!editor) return;
    const compressed = await compressImage(file, 1000);
    const path = `contracts/${contractId}/images/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, compressed);
    const url = await getDownloadURL(ref);
    editor.chain().focus().setImage({ src: url }).run();
  }

  if (!editor) return null;

  return (
    <div
      className={
        standalonePage
          ? "-mx-4 -mt-[4.5rem] -mb-4 min-h-screen bg-[#e5e5e5] md:-mx-6 md:-mt-[5.5rem] md:-mb-6"
          : undefined
      }
    >
      {pageStyle && (
        // 화면에 보이지 않는 측정용 요소 — 미리보기와 똑같은 폭/폰트로 쪽 나눔 위치를 계산한다.
        <div
          ref={measureRef}
          aria-hidden
          className="tiptap-content text-[13px] leading-[1.9]"
          style={{ position: "fixed", top: -9999, left: -9999, width: CONTENT_WIDTH_PX }}
        />
      )}
      {standalonePage && topBar && (
        <div ref={topBarRef} className="fixed inset-x-0 top-14 z-10 border-b border-[#e5e5e5] bg-white/90 px-4 py-3 backdrop-blur-xl md:left-56">
          <div className="mx-auto w-full max-w-[210mm]">{topBar}</div>
        </div>
      )}
      <div
        ref={toolbarRef}
        style={standalonePage ? { top: 56 + topBarHeight } : undefined}
        className={`flex flex-wrap items-center gap-1 border border-[#d1d1d6] bg-[#f5f5f7] p-1.5 ${standalonePage ? "fixed inset-x-0 z-10 md:left-56" : pageStyle ? "sticky top-0 z-10" : "rounded-t-2xl"}`}
      >
        <ToolbarButton title="굵게" active={activeMarks.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <BoldIcon size={13} />
        </ToolbarButton>
        <ToolbarButton title="기울임" active={activeMarks.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <ItalicIcon size={13} />
        </ToolbarButton>
        <ToolbarButton title="밑줄" active={activeMarks.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={13} />
        </ToolbarButton>
        {/* 고객이 "수정 요청"에서 빨간 글자로 써넣은 부분을, 담당자가 검토·반영한 뒤 선택해서
            누르면 일반 검정 글자로 되돌린다(revisionMark 마크만 제거, 글자 자체는 안 바뀜). */}
        <ToolbarButton title="검정으로 되돌리기 (수정 요청 표시 해제)" onClick={() => editor.chain().focus().unsetMark("revisionMark").run()}>
          <Baseline size={13} />
        </ToolbarButton>
        <ToolbarButton title="글머리 기호" active={activeMarks.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <ListIcon size={13} />
        </ToolbarButton>
        <ToolbarButton title="번호 목록" active={activeMarks.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={13} />
        </ToolbarButton>

        <span className="mx-0.5 h-4 w-px bg-[#d1d1d6]" />

        <ToolbarButton title="왼쪽 정렬" active={activeMarks.alignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft size={13} />
        </ToolbarButton>
        <ToolbarButton title="가운데 정렬" active={activeMarks.alignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter size={13} />
        </ToolbarButton>
        <ToolbarButton title="오른쪽 정렬" active={activeMarks.alignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight size={13} />
        </ToolbarButton>

        <span className="mx-0.5 h-4 w-px bg-[#d1d1d6]" />

        <select
          onChange={(e) => {
            if (e.target.value) editor.chain().focus().setFontSize(e.target.value).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
          className="h-7 rounded-lg border-none bg-transparent px-1 text-xs text-[#1d1d1f] outline-none hover:bg-white"
          defaultValue=""
        >
          {FONT_SIZES.map((s) => (
            <option key={s.label} value={s.value}>{s.label}</option>
          ))}
        </select>

        <span className="mx-0.5 h-4 w-px bg-[#d1d1d6]" />

        <ToolbarButton title="표 삽입" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <Table2 size={13} />
        </ToolbarButton>
        <ToolbarButton title="행 추가" onClick={() => editor.chain().focus().addRowAfter().run()}>
          <Rows3 size={13} />
        </ToolbarButton>
        <ToolbarButton title="열 추가" onClick={() => editor.chain().focus().addColumnAfter().run()}>
          <Columns3 size={13} />
        </ToolbarButton>
        <ToolbarButton title="셀 병합" onClick={() => editor.chain().focus().mergeCells().run()}>
          <Combine size={13} />
        </ToolbarButton>
        <ToolbarButton title="셀 분할" onClick={() => editor.chain().focus().splitCell().run()}>
          <TableCellsSplit size={13} />
        </ToolbarButton>
        <ToolbarButton title="표 삭제" onClick={() => editor.chain().focus().deleteTable().run()}>
          <Trash2 size={13} />
        </ToolbarButton>

        {!hideImageButton && (
          <>
            <span className="mx-0.5 h-4 w-px bg-[#d1d1d6]" />

            <label className="flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-lg px-1.5 text-[#1d1d1f] hover:bg-white" title="이미지 삽입">
              <ImagePlus size={13} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
              />
            </label>
          </>
        )}

        <span className="mx-0.5 h-4 w-px bg-[#d1d1d6]" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertNextArticle}
          className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-[#1d1d1f] shadow-sm hover:bg-[#e5e5e5]"
        >
          + 조항 추가
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertSignatureBlock("gap")}
          className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-[#1d1d1f] shadow-sm hover:bg-[#e5e5e5]"
        >
          갑 서명란 삽입
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertSignatureBlock("eul")}
          className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-[#1d1d1f] shadow-sm hover:bg-[#e5e5e5]"
        >
          을 서명란 삽입
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="닫기"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-[#86868b] hover:bg-white hover:text-[#1d1d1f]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {pageStyle ? (
        // 문서 자체의 실제 폭(210mm)은 그대로 유지해야 줄바꿈이 미리보기·인쇄와 어긋나지
        // 않는다 — 그래서 폭을 줄이는 대신(그러면 줄바꿈이 달라짐) 화면에서만 보기 좋게
        // 축소해서 보여준다(PdfPageScaler, 미리보기 모달과 동일). 툴바는 이 축소 래퍼
        // 바깥에 둬서(transform이 걸린 조상 안에 있으면 position:sticky가 깨진다) 계속
        // 정상적으로 화면 상단에 고정된다.
        <div
          className="bg-[#e5e5e5] px-4 py-4"
          style={standalonePage ? { paddingTop: 56 + topBarHeight + toolbarHeight + 16 } : undefined}
        >
          <PdfPageScaler>
            <div className="po-page relative mx-auto min-h-[297mm] w-[210mm] bg-white p-[20mm] shadow-lg">
              {headerData && (
                <div ref={headerRef}>
                  <PageHeader data={headerData} />
                </div>
              )}
              <div className={headerData ? "pt-8" : ""}>
                <EditorContent editor={editor} />
              </div>
            </div>
          </PdfPageScaler>
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
