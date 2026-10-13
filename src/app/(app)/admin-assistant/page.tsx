"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { MessageSquarePlus, Send, Sparkles, Trash2, Check } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  listenConversations,
  listenMessages,
  createConversation,
  renameConversation,
  addMessage,
  deleteConversation,
  markMessageActionDone,
} from "@/lib/firestore/assistantChat";
import { createClientProduct, updateClientProduct } from "@/lib/firestore/products";
import { createSupplierOrder } from "@/lib/firestore/supplierOrders";
import { listenAllPurchaseOrders, issueInstallmentInvoice } from "@/lib/firestore/purchaseOrders";
import { AssistantConversation, AssistantMessage, PurchaseOrder, PURCHASE_ORDER_STATUS_LABEL, SUPPLIER_ORDER_STATUS_LABEL, CONTRACT_STATUS_LABEL } from "@/lib/types";

// 관리자 전용 "AI 비서" — 협력사용 /organize와 같은 구조(assistantConversations 재사용,
// partnerId 필드에 관리자 자신의 uid를 써서 내 대화만 걸러본다)를 쓰되, 의도는 전혀 다르다:
// 고객 제품 단가 등록/수정, 매입 발주서 작성, 고객 청구서(회차) 발행, 현황 조회·일반 상담.
// AI는 /api/admin-assistant에서 초안만 만들고, 실제 Firestore 쓰기는 여기(클릭 시점)에서
// 기존 관리자 화면들이 쓰는 그 함수를 그대로 호출한다 — 비서 전용 쓰기 로직을 새로 만들지 않는다.

interface NameRef { id: string; name: string }

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function AdminAssistantPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const router = useRouter();

  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draftText, setDraftText] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);

  const composingRef = useRef(false);
  const sendingRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appUser || appUser.role !== "admin") return;
    // 클로드·제미나이처럼 들어올 때마다 새 대화로 시작한다 — 지난 대화를 자동으로 이어서
    // 열면 완전히 다른 용건으로 왔는데 직전 맥락이 남아있어 오히려 헷갈린다는 피드백으로
    // 바꿨다. 지난 대화는 왼쪽 "대화 기록"에서 사람이 직접 골라 들어간다.
    return listenConversations(appUser.uid, setConversations, (e) => setAssistantError(e.message));
  }, [appUser]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    return listenMessages(activeConversationId, (list) => {
      setMessages((prev) => (list.length < prev.length && Date.now() - lastSentAtRef.current < 8000 ? prev : list));
    });
  }, [activeConversationId]);

  useEffect(() => {
    // 회차 발행(issueInstallmentInvoice)에는 최신 PurchaseOrder 객체가 필요하다 —
    // /orders 페이지와 같은 방식으로 항상 구독해둔다.
    if (!isAdmin) return;
    return listenAllPurchaseOrders(setPurchaseOrders);
  }, [isAdmin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, assistantLoading]);

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  async function handleDeleteConversation(c: AssistantConversation) {
    if (!confirm(`"${c.title || "대화"}" 대화를 삭제할까요?`)) return;
    await deleteConversation(c.id);
    if (activeConversationId === c.id) startNewConversation();
  }

  async function handleSendChat() {
    const text = draftText.trim();
    if (!text || !appUser) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    lastSentAtRef.current = Date.now();
    setAssistantLoading(true);
    setAssistantError("");
    setDraftText("");
    try {
      let conversationId = activeConversationId;
      const isNewConversation = !conversationId;
      if (!conversationId) {
        // 제목은 AI 응답이 돌아온 뒤(아래) 대화 내용을 대표하는 짧은 제목으로 다시 붙인다 —
        // 여기서는 그때까지 목록에 보일 임시 제목만 둔다.
        conversationId = await createConversation(appUser.uid, text.slice(0, 20));
        setActiveConversationId(conversationId);
      }
      const userMsg: AssistantMessage = { id: newId(), role: "user", text, createdAt: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      await addMessage(conversationId, { role: "user", text });

      const [clientsSnap, partnersSnap, clientProductsSnap, supplierOrdersSnap, contractsSnap, clientProductInternalSnap, supplierProductsSnap] = await Promise.all([
        getDocs(collection(db, "clients")),
        getDocs(query(collection(db, "users"), where("role", "==", "partner"))),
        getDocs(collection(db, "clientProducts")),
        getDocs(collection(db, "supplierOrders")),
        getDocs(collection(db, "contracts")),
        getDocs(collection(db, "clientProductInternal")),
        getDocs(collection(db, "supplierProducts")),
      ]);
      const clients: NameRef[] = clientsSnap.docs.map((d) => ({ id: d.id, name: d.data().name ?? "" }));
      const partners: NameRef[] = partnersSnap.docs.map((d) => ({ id: d.id, name: d.data().name ?? "" }));
      const clientNameById = new Map(clients.map((c) => [c.id, c.name]));
      const clientProducts = clientProductsSnap.docs.map((d) => {
        const data = d.data();
        return {
          clientId: data.clientId as string,
          clientName: clientNameById.get(data.clientId) ?? "",
          name: data.name as string,
          unitPrice: (data.unitPrice ?? 0) as number,
          currency: (data.currency ?? "KRW") as string,
          unit: (data.unit || undefined) as string | undefined,
        };
      });
      const supplierOrdersOverview = supplierOrdersSnap.docs.slice(0, 150).map((d) => {
        const data = d.data();
        return {
          soNumber: data.soNumber as string,
          supplierName: data.supplierName as string,
          status: SUPPLIER_ORDER_STATUS_LABEL[data.status as keyof typeof SUPPLIER_ORDER_STATUS_LABEL] ?? data.status,
          totalAmount: (data.totalAmount ?? 0) as number,
          currency: (data.currency ?? "USD") as string,
        };
      });
      const contractsOverview = contractsSnap.docs.map((d) => {
        const data = d.data();
        const signedAt = data.signedAt?.toMillis ? data.signedAt.toMillis() : data.signedAt;
        return {
          companyName: data.companyName as string,
          title: data.title as string,
          status: CONTRACT_STATUS_LABEL[data.status as keyof typeof CONTRACT_STATUS_LABEL] ?? data.status,
          amount: (data.amount ?? 0) as number,
          currency: (data.currency ?? "KRW") as string,
          signedAt: signedAt ? new Date(signedAt).toISOString().slice(0, 10) : undefined,
        };
      });
      // 발주서 단가를 안 불러줘도 이미 등록된 매입 단가가 있으면 그걸 쓸 수 있도록, 두
      // 카탈로그(조립품 BOM이 있는 clientProductInternal과 단순 품목인 supplierProducts)를
      // 합쳐서 넘긴다.
      const purchaseCatalog = [
        ...clientProductInternalSnap.docs.map((d) => {
          const data = d.data();
          return {
            productName: (data.productName as string) || "",
            nameEn: data.nameEn as string | undefined,
            supplierName: data.supplierName as string | undefined,
            partnerName: data.partnerName as string | undefined,
            purchasePrice: data.purchasePrice as number | undefined,
            purchaseCurrency: data.purchaseCurrency as string | undefined,
            unit: data.productUnit as string | undefined,
          };
        }),
        ...supplierProductsSnap.docs.map((d) => {
          const data = d.data();
          return {
            productName: (data.name as string) || "",
            nameEn: data.nameEn as string | undefined,
            supplierName: data.supplierName as string | undefined,
            partnerName: data.partnerName as string | undefined,
            purchasePrice: data.purchasePrice as number | undefined,
            purchaseCurrency: data.purchaseCurrency as string | undefined,
            unit: data.unit as string | undefined,
          };
        }),
      ].filter((p) => p.productName);

      // 아직 청구서 발행 안 된 회차 — ref를 "orderId:installmentIndex"로 만들어, AI가 고른
      // 걸 다시 실제 PurchaseOrder·회차에 정확히 대응시킨다(금액·대상을 AI가 지어내지 못하게).
      const unbilledInstallments: { ref: string; clientId: string; clientName: string; poNumber: string; label: string; amount: number; currency: string; status: string }[] = [];
      const ordersOverview: { poNumber: string; clientName: string; status: string; totalAmount: number; currency: string }[] = [];
      purchaseOrders.forEach((o) => {
        if (o.status === "cancelled") return;
        const currency = o.items[0]?.currency ?? "KRW";
        ordersOverview.push({ poNumber: o.poNumber, clientName: o.clientName, status: PURCHASE_ORDER_STATUS_LABEL[o.status], totalAmount: o.totalAmount, currency });
        (o.payment?.installments ?? []).forEach((inst, idx) => {
          if (inst.issuedAt) return;
          unbilledInstallments.push({
            ref: `${o.id}:${idx}`,
            clientId: o.clientId,
            clientName: o.clientName,
            poNumber: o.poNumber,
            label: inst.label,
            amount: inst.amount,
            currency,
            status: PURCHASE_ORDER_STATUS_LABEL[o.status],
          });
        });
      });

      let recentMessages = messages.slice(-6);
      if (recentMessages[0]?.role === "assistant") recentMessages = recentMessages.slice(1);
      const history = recentMessages.map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch("/api/admin-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, clients, partners, clientProducts, unbilledInstallments, ordersOverview, supplierOrdersOverview, contractsOverview, purchaseCatalog, history }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        intent?: "product_register" | "purchase_order" | "client_invoice" | "question" | "unclear";
        clientName?: string;
        productName?: string;
        unitPrice?: number;
        currency?: "KRW" | "USD" | "CNY";
        unit?: string;
        supplierName?: string;
        items?: { name: string; spec?: string; quantity: number; unit?: string; unitPrice: number }[];
        memo?: string;
        refs?: string[];
        answer?: string;
        reply?: string;
        title?: string;
      };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`서버 응답을 읽을 수 없습니다 (${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
      // 대화 목록 제목 — 첫 메시지 원문을 그대로 자르는 대신, AI가 이번 대화 전체를
      // 대표하도록 새로 지어준 짧은 제목으로 바꿔 붙인다(클로드·제미나이 대화 목록과 동일한 방식).
      if (isNewConversation && data.title) {
        renameConversation(conversationId, data.title).catch(() => {});
      }

      if (data.intent === "product_register") {
        const name = data.clientName ?? "";
        const matched = clients.find((c) => c.name === name) ?? clients.find((c) => name && (c.name.includes(name) || name.includes(c.name)));
        const existing = matched ? clientProductsSnap.docs.find((d) => d.data().clientId === matched.id && d.data().name === data.productName) : undefined;
        const draft = {
          clientName: name,
          matchedClientId: matched?.id,
          matchedClientName: matched?.name,
          productName: data.productName ?? "",
          unitPrice: data.unitPrice ?? 0,
          currency: (data.currency === "USD" ? "USD" : "KRW") as "KRW" | "USD",
          unit: data.unit || undefined,
          existingProductId: existing?.id,
        };
        const replyText = matched
          ? `${existing ? "기존 제품 단가 수정" : "제품 등록"} 초안을 만들었어요: [${matched.name}] ${draft.productName} — ${draft.unitPrice.toLocaleString()} ${draft.currency}${!draft.unitPrice ? " (단가를 못 받아서 0으로 들어갔어요 — 등록 후 직접 고쳐주세요.)" : ""}`
          : `"${name}" 고객을 목록에서 못 찾았어요. 등록된 고객명과 똑같이 다시 말씀해주세요.`;
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: replyText, intent: "product_register", productRegisterDraft: draft, createdAt: Date.now() }]);
        await addMessage(conversationId, { role: "assistant", text: replyText, intent: "product_register", productRegisterDraft: draft });
        return;
      }

      if (data.intent === "purchase_order") {
        const name = data.supplierName ?? "";
        const matched = partners.find((p) => p.name === name) ?? partners.find((p) => name && (p.name.includes(name) || name.includes(p.name)));
        const draft = {
          supplierName: name,
          matchedPartnerId: matched?.id,
          matchedPartnerName: matched?.name,
          items: data.items ?? [],
          currency: (data.currency ?? "USD") as "USD" | "CNY" | "KRW",
          memo: data.memo,
        };
        const itemsSummary = draft.items.map((it) => `${it.name} ${it.quantity}${it.unit ?? "EA"}`).join(", ");
        // 단가를 안 불러줬으면 AI가 임의로 0을 채운다 — 그대로 생성하면 총액 0짜리 발주서가
        // 조용히 만들어져서, 마치 아무 일도 안 일어난 것처럼 보일 수 있다. 눈에 띄게 경고한다.
        const missingPrice = draft.items.some((it) => !it.unitPrice);
        const warning = missingPrice ? " (단가를 못 받아서 0으로 들어갔어요 — 발주 관리에서 직접 채운 뒤 발행해주세요.)" : "";
        const replyText = `매입 발주서 초안을 만들었어요: [${matched?.name ?? name}]${matched ? "" : " (연동된 협력사 계정 없음 — 거래처명만 기록됩니다)"} ${itemsSummary || "(품목 없음)"}${warning}`;
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: replyText, intent: "purchase_order", purchaseOrderDraft: draft, createdAt: Date.now() }]);
        await addMessage(conversationId, { role: "assistant", text: replyText, intent: "purchase_order", purchaseOrderDraft: draft });
        return;
      }

      if (data.intent === "client_invoice") {
        const refs = data.refs ?? [];
        const matchedEntries = unbilledInstallments.filter((u) => refs.includes(u.ref));
        const draft = matchedEntries.map((u) => ({
          clientId: u.clientId,
          clientName: u.clientName,
          orderId: u.ref.split(":")[0],
          poNumber: u.poNumber,
          installmentIndex: Number(u.ref.split(":")[1]),
          installmentLabel: u.label,
          amount: u.amount,
          currency: u.currency as "KRW" | "USD",
        }));
        const replyText =
          draft.length > 0
            ? `발행 대기 중인 청구 ${draft.length}건을 찾았어요: ${draft.map((d) => `${d.poNumber}(${d.installmentLabel})`).join(", ")}`
            : `해당하는 미청구 발주건을 못 찾았어요. 고객명이나 조건을 다시 확인해주세요.`;
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: replyText, intent: "client_invoice", clientInvoiceDraft: draft.length > 0 ? draft : undefined, createdAt: Date.now() }]);
        await addMessage(conversationId, { role: "assistant", text: replyText, intent: "client_invoice", clientInvoiceDraft: draft });
        return;
      }

      if (data.intent === "question") {
        const answerText = data.answer ?? "";
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: answerText, intent: "question", createdAt: Date.now() }]);
        await addMessage(conversationId, { role: "assistant", text: answerText, intent: "question" });
        return;
      }

      const replyText = data.reply ?? "무슨 말씀이신지 잘 모르겠어요. 제품 등록, 발주서 작성, 청구서 발행, 현황 조회 중 어떤 걸 원하시는지 알려주세요.";
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: replyText, intent: "unclear", createdAt: Date.now() }]);
      await addMessage(conversationId, { role: "assistant", text: replyText, intent: "unclear" });
    } catch (e) {
      setAssistantError(e instanceof Error ? e.message : "AI 비서 요청에 실패했습니다.");
    } finally {
      setAssistantLoading(false);
      sendingRef.current = false;
    }
  }

  async function runProductRegister(message: AssistantMessage) {
    const draft = message.productRegisterDraft;
    if (!draft || !draft.matchedClientId || !activeConversationId) return;
    setRunningId(message.id);
    try {
      if (draft.existingProductId) {
        await updateClientProduct(draft.existingProductId, { unitPrice: draft.unitPrice, currency: draft.currency, ...(draft.unit ? { unit: draft.unit } : {}) });
      } else {
        await createClientProduct({ clientId: draft.matchedClientId, name: draft.productName, unitPrice: draft.unitPrice, currency: draft.currency, unit: draft.unit });
      }
      await markMessageActionDone(activeConversationId, message.id);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, actionDone: true } : m)));
      router.push("/orders?tab=catalog");
    } catch (e) {
      setAssistantError(e instanceof Error ? e.message : "제품 등록/수정에 실패했습니다.");
    } finally {
      setRunningId(null);
    }
  }

  async function runPurchaseOrderCreate(message: AssistantMessage) {
    const draft = message.purchaseOrderDraft;
    if (!draft || !appUser || !activeConversationId) return;
    setRunningId(message.id);
    try {
      await createSupplierOrder({
        supplierName: draft.matchedPartnerName ?? draft.supplierName,
        items: draft.items,
        currency: draft.currency,
        memo: draft.memo,
        partnerId: draft.matchedPartnerId,
        partnerName: draft.matchedPartnerName,
        createdBy: appUser.uid,
      });
      await markMessageActionDone(activeConversationId, message.id);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, actionDone: true } : m)));
      router.push("/partners?tab=supplier");
    } catch (e) {
      setAssistantError(e instanceof Error ? e.message : "발주서 생성에 실패했습니다.");
    } finally {
      setRunningId(null);
    }
  }

  async function runClientInvoiceIssue(message: AssistantMessage) {
    const draft = message.clientInvoiceDraft;
    if (!draft || draft.length === 0 || !activeConversationId) return;
    setRunningId(message.id);
    try {
      for (const d of draft) {
        const order = purchaseOrders.find((o) => o.id === d.orderId);
        if (!order) continue;
        // eslint-disable-next-line no-await-in-loop
        await issueInstallmentInvoice(order, d.installmentIndex);
      }
      await markMessageActionDone(activeConversationId, message.id);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, actionDone: true } : m)));
      router.push("/orders");
    } catch (e) {
      setAssistantError(e instanceof Error ? e.message : "청구서 발행에 실패했습니다.");
    } finally {
      setRunningId(null);
    }
  }

  if (!appUser || !isAdmin) {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="flex items-start gap-4">
      <aside className={`${sidebarOpen ? "fixed inset-0 z-40 lg:static lg:z-auto" : "hidden lg:block"} shrink-0`}>
        {sidebarOpen && <div className="fixed inset-0 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        <div className="relative z-10 flex h-full w-72 max-w-[82vw] flex-col gap-2 overflow-hidden bg-white p-3 lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] lg:w-64 lg:max-w-none lg:rounded-3xl">
          <button
            onClick={startNewConversation}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-[#d1d1d6] px-3 py-2 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
          >
            <MessageSquarePlus size={15} /> 새 대화
          </button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {conversations.length === 0 && <p className="px-2 py-3 text-xs text-[#86868b]">대화 기록이 없습니다.</p>}
            {conversations.map((c) => (
              <div key={c.id} className={`group flex items-center gap-1 rounded-xl pr-1 transition ${c.id === activeConversationId ? "bg-[#f5f5f7]" : "hover:bg-[#f5f5f7]"}`}>
                <button
                  onClick={() => { setActiveConversationId(c.id); setSidebarOpen(false); }}
                  className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${c.id === activeConversationId ? "font-medium text-[#1d1d1f]" : "text-[#86868b] group-hover:text-[#1d1d1f]"}`}
                >
                  {c.title || "대화"}
                </button>
                <button onClick={() => handleDeleteConversation(c)} title="이 대화 삭제" className="shrink-0 rounded-full p-1.5 text-[#d1d1d6] opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
              <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
              AI 비서
            </h1>
            <p className="mt-1 hidden pl-4 text-sm text-[#86868b] sm:block">
              제품 단가 등록·수정, 매입 발주서 작성, 고객 청구서 발행, 현황 조회·상담까지 자연어로 처리합니다.
            </p>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] lg:hidden">
            <MessageSquarePlus size={13} /> 대화 기록
          </button>
        </div>

        <div className="flex flex-col overflow-hidden rounded-3xl bg-white">
          <div className="h-[50dvh] min-h-[16rem] space-y-3 overflow-y-auto p-4 lg:h-[46vh]">
            {messages.length === 0 ? (
              <p className="flex h-24 items-center justify-center text-center text-sm text-[#86868b]">
                예: &quot;OO사 도어스토퍼 5000원에 등록해놔&quot;, &quot;RANHUI한테 OOO 100개 발주서 좀&quot;, &quot;OO사 잔금 청구해줘&quot;
              </p>
            ) : (
              messages.map((m) => (
                <AdminChatBubble
                  key={m.id}
                  message={m}
                  running={runningId === m.id}
                  onRunProductRegister={runProductRegister}
                  onRunPurchaseOrder={runPurchaseOrderCreate}
                  onRunClientInvoice={runClientInvoiceIssue}
                />
              ))
            )}
            {assistantLoading && (
              <div className="flex items-end gap-2">
                <Sparkles size={14} className="mb-2.5 shrink-0 text-[#4a7fd6]" />
                <div className="flex items-center gap-2 rounded-2xl bg-[#f0f7ff] px-4 py-3">
                  <span className="text-sm text-[#4a7fd6]">생각하는 중</span>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4a7fd6] [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4a7fd6] [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4a7fd6]" />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[#f0f0f0] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !composingRef.current) { e.preventDefault(); handleSendChat(); } }}
                rows={1}
                placeholder="무엇이든 물어보세요..."
                className="max-h-32 min-h-9 flex-1 resize-none rounded-2xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
              <button
                onClick={handleSendChat}
                disabled={assistantLoading || !draftText.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-white transition hover:bg-black disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
            {assistantError && <p className="mt-1.5 text-xs text-red-500">{assistantError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminChatBubble({
  message,
  running,
  onRunProductRegister,
  onRunPurchaseOrder,
  onRunClientInvoice,
}: {
  message: AssistantMessage;
  running: boolean;
  onRunProductRegister: (m: AssistantMessage) => void;
  onRunPurchaseOrder: (m: AssistantMessage) => void;
  onRunClientInvoice: (m: AssistantMessage) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] space-y-1.5 ${isUser ? "" : "flex items-start gap-2"}`}>
        {!isUser && <Sparkles size={14} className="mt-2 shrink-0 text-[#4a7fd6]" />}
        <div>
          {message.text && (
            <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${isUser ? "bg-[#1d1d1f] text-white" : "bg-[#f0f7ff] text-[#1d1d1f]"}`}>
              {message.text}
            </div>
          )}

          {!isUser && message.intent === "product_register" && message.productRegisterDraft?.matchedClientId && (
            <button
              onClick={() => onRunProductRegister(message)}
              disabled={running || message.actionDone}
              className="mt-1.5 flex items-center gap-1 rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {message.actionDone ? <><Check size={12} /> 완료됨</> : message.productRegisterDraft.existingProductId ? "단가 수정하기" : "제품 등록하기"}
            </button>
          )}

          {!isUser && message.intent === "purchase_order" && message.purchaseOrderDraft && (
            <button
              onClick={() => onRunPurchaseOrder(message)}
              disabled={running || message.actionDone}
              className="mt-1.5 flex items-center gap-1 rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {message.actionDone ? <><Check size={12} /> 발주서 생성됨</> : "발주서 작성하기"}
            </button>
          )}

          {!isUser && message.intent === "client_invoice" && message.clientInvoiceDraft && message.clientInvoiceDraft.length > 0 && (
            <button
              onClick={() => onRunClientInvoice(message)}
              disabled={running || message.actionDone}
              className="mt-1.5 flex items-center gap-1 rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {message.actionDone ? <><Check size={12} /> 발행됨</> : `청구서 발행하기 (${message.clientInvoiceDraft.length}건)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
