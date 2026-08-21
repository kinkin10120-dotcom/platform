import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { PaymentInstallment, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from "@/lib/types";
import { calcOrderTotals, formatMoney } from "@/lib/orderCalc";
import { createNotification } from "@/lib/firestore/notifications";
import { getAdmins } from "@/lib/firestore/users";
import { getTask, updateTaskStatus } from "@/lib/firestore/tasks";
import { addComment } from "@/lib/firestore/comments";

const colRef = collection(db, "purchaseOrders");

function fromDoc(d: any): PurchaseOrder {
  const data = d.data();
  const payment = data.payment
    ? {
        installments: (data.payment.installments ?? []).map((it: any) => ({
          label: it.label,
          amount: it.amount ?? 0,
          paid: !!it.paid,
          paidAt: it.paidAt?.toMillis ? it.paidAt.toMillis() : it.paidAt,
          issuedAt: it.issuedAt?.toMillis ? it.issuedAt.toMillis() : it.issuedAt,
        })),
        note: data.payment.note,
      }
    : undefined;
  return {
    id: d.id,
    poNumber: data.poNumber,
    clientId: data.clientId,
    clientName: data.clientName,
    orderedBy: data.orderedBy,
    orderedByName: data.orderedByName,
    items: data.items ?? [],
    totalAmount: data.totalAmount ?? 0,
    status: data.status ?? "received",
    confirmedAt: data.confirmedAt?.toMillis ? data.confirmedAt.toMillis() : data.confirmedAt,
    createdByAdmin: !!data.createdByAdmin,
    payment,
    linkedProjectId: data.linkedProjectId ?? undefined,
    linkedTaskId: data.linkedTaskId ?? undefined,
    linkedTaskName: data.linkedTaskName ?? undefined,
    signatureUrl: data.signatureUrl ?? undefined,
    signedByName: data.signedByName ?? undefined,
    cancelRequested: !!data.cancelRequested,
    cancelRequestedAt: data.cancelRequestedAt?.toMillis ? data.cancelRequestedAt.toMillis() : data.cancelRequestedAt,
    cancelReason: data.cancelReason ?? undefined,
    memo: data.memo,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
  };
}

export function listenAllPurchaseOrders(cb: (orders: PurchaseOrder[]) => void) {
  const q = query(colRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
}

export function listenMyPurchaseOrders(clientId: string, cb: (orders: PurchaseOrder[]) => void) {
  const q = query(colRef, where("clientId", "==", clientId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
}

export function listenPurchaseOrder(id: string, cb: (order: PurchaseOrder | null) => void) {
  return onSnapshot(doc(db, "purchaseOrders", id), (snap) => cb(snap.exists() ? fromDoc(snap) : null));
}

export async function createPurchaseOrder(input: {
  clientId: string;
  clientName: string;
  orderedBy: string;
  orderedByName: string;
  items: PurchaseOrderItem[];
  memo?: string;
  signatureBlob?: Blob;
  createdByAdmin?: boolean;
}) {
  const totalAmount = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  // Firestore는 배열 안 객체 필드값으로 undefined를 허용하지 않으므로 선택 필드는 값이 있을 때만 넣는다.
  const items = input.items.map((it) => ({
    productId: it.productId,
    productName: it.productName,
    unitPrice: it.unitPrice,
    currency: it.currency,
    quantity: it.quantity,
    ...(it.productImageUrl ? { productImageUrl: it.productImageUrl } : {}),
    ...(it.vatApplicable ? { vatApplicable: it.vatApplicable } : {}),
    ...(it.unit ? { unit: it.unit } : {}),
  }));

  // 문서 ID를 미리 만들어 poNumber·서명 이미지 경로에 쓰고, 생성 한 번(setDoc)으로 끝낸다.
  // (addDoc 후 updateDoc으로 poNumber를 붙이면, 발주 생성 규칙은 클라이언트도 허용하지만
  // update는 관리자 전용이라 클라이언트가 만든 발주는 두 번째 쓰기에서 권한 오류가 났다.)
  const ref = doc(colRef);
  // "발주 없이 직접 등록"(관리자가 발주 대신 청구서를 만드는 기능)으로 생성된 건은
  // 클라이언트가 발주한 게 아니라 우리가 청구하는 것이라 PO(purchase order) 번호 체계를
  // 그대로 쓰면 헷갈린다 — INV(invoice)로 구분한다.
  const poNumber = `${input.createdByAdmin ? "INV" : "PO"}-${dateStr}-${ref.id.slice(0, 4).toUpperCase()}`;

  let signatureUrl: string | undefined;
  if (input.signatureBlob) {
    const sigRef = storageRef(storage, `purchaseOrders/${ref.id}/signature.png`);
    await uploadBytes(sigRef, input.signatureBlob);
    signatureUrl = await getDownloadURL(sigRef);
  }

  // "발주 없이 직접 등록"도 결제 정보는 자동으로 미리 채워두지 않고, 일반 발주와 똑같이
  // 관리자가 "결제 정보 설정 (회차별 금액)"을 직접 눌러 시작하게 한다 — 특별 취급 없이
  // 발주서와 같은 흐름으로 맞추는 게 헷갈리지 않는다.
  await setDoc(ref, {
    poNumber,
    clientId: input.clientId,
    clientName: input.clientName,
    orderedBy: input.orderedBy,
    orderedByName: input.orderedByName,
    items,
    totalAmount,
    status: (input.createdByAdmin ? "confirmed" : "received") as PurchaseOrderStatus,
    ...(input.createdByAdmin ? { confirmedAt: serverTimestamp(), createdByAdmin: true } : {}),
    memo: input.memo ?? "",
    ...(signatureUrl ? { signatureUrl, signedByName: input.orderedByName } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 관리자가 직접 등록한 발주는 관리자 본인이 만든 것이므로 신규 발주 알림을 보내지 않는다.
  if (!input.createdByAdmin) {
    try {
      const totals = calcOrderTotals(items);
      const itemSummary = items.map((it) => it.productName).join(", ");
      const totalSummary = [
        totals.hasKrw ? formatMoney(totals.krwTotal, "KRW") : null,
        totals.hasUsd ? formatMoney(totals.usdTotal, "USD") : null,
      ].filter(Boolean).join(" + ");
      const admins = await getAdmins();
      await Promise.all(
        admins.map((u) =>
          createNotification({
            userId: u.uid,
            type: "purchase_order",
            orderId: ref.id,
            message: `${input.clientName}에서 새 발주(${poNumber})를 넣었습니다. 품목: ${itemSummary} · 합계 ${totalSummary}`,
          })
        )
      );
    } catch (e) {
      console.error("발주 알림 발송 실패:", e);
    }
  }

  return ref;
}

export async function updatePurchaseOrderStatus(order: PurchaseOrder, status: PurchaseOrderStatus) {
  await updateDoc(doc(db, "purchaseOrders", order.id), {
    status,
    ...(status === "confirmed" ? { confirmedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });

  try {
    await createNotification({
      userId: order.orderedBy,
      type: "order_status_change",
      orderId: order.id,
      message: `발주(${order.poNumber}) 상태가 변경되었습니다.`,
    });
  } catch (e) {
    console.error("발주 상태 변경 알림 발송 실패:", e);
  }
}

export async function requestOrderCancel(order: PurchaseOrder, reason?: string) {
  await updateDoc(doc(db, "purchaseOrders", order.id), {
    cancelRequested: true,
    cancelRequestedAt: serverTimestamp(),
    cancelReason: reason ?? "",
    updatedAt: serverTimestamp(),
  });

  try {
    const admins = await getAdmins();
    await Promise.all(
      admins.map((u) =>
        createNotification({
          userId: u.uid,
          type: "order_cancel_request",
          orderId: order.id,
          message: `${order.clientName}에서 발주(${order.poNumber}) 취소를 요청했습니다.${reason ? ` (사유: ${reason})` : ""}`,
        })
      )
    );
  } catch (e) {
    console.error("취소 요청 알림 발송 실패:", e);
  }
}

export async function dismissCancelRequest(order: PurchaseOrder) {
  await updateDoc(doc(db, "purchaseOrders", order.id), {
    cancelRequested: false,
    updatedAt: serverTimestamp(),
  });

  try {
    await createNotification({
      userId: order.orderedBy,
      type: "order_status_change",
      orderId: order.id,
      message: `발주(${order.poNumber}) 취소 요청이 반려되었습니다.`,
    });
  } catch (e) {
    console.error("취소 반려 알림 발송 실패:", e);
  }
}

function serializeInstallment(it: PaymentInstallment) {
  return {
    label: it.label,
    amount: it.amount,
    paid: it.paid,
    ...(it.paidAt ? { paidAt: it.paidAt } : {}),
    ...(it.issuedAt ? { issuedAt: it.issuedAt } : {}),
  };
}

// 회차 수(2회=선금/잔금, 3회=선금/중도금/잔금 등)는 자유롭게 나눌 수 있다 — 저장할 때마다
// 전체 회차를 새로 구성하고 입금 상태는 초기화한다(기존 결제 정보 재설정과 동일한 동작).
export async function setPurchaseOrderInstallments(
  order: PurchaseOrder,
  input: { installments: { label: string; amount: number }[]; note?: string }
) {
  const installments: PaymentInstallment[] = input.installments.map((it) => ({
    label: it.label,
    amount: it.amount,
    paid: false,
  }));

  // 회차 설정은 내부적으로 결제 조건을 세팅하는 단계라 이 시점엔 고객에게 알릴 필요가
  // 없다 — 실제로 청구서를 발행할 때(issueInstallmentInvoice)만 알림/이메일을 보낸다.
  // 예전엔 여기서도 알림을 보내서, 회차 설정 직후 발행까지 하면 이메일이 두 번(결제 정보
  // 등록 + 청구서 발행) 나가는 문제가 있었다.
  await updateDoc(doc(db, "purchaseOrders", order.id), {
    payment: {
      installments: installments.map(serializeInstallment),
      note: input.note ?? "",
    },
    updatedAt: serverTimestamp(),
  });
}

export async function setPurchaseOrderLinkedTask(
  order: PurchaseOrder,
  input: { projectId?: string; taskId?: string; taskName?: string }
) {
  return updateDoc(doc(db, "purchaseOrders", order.id), {
    linkedProjectId: input.projectId ?? null,
    linkedTaskId: input.taskId ?? null,
    linkedTaskName: input.taskName ?? null,
    updatedAt: serverTimestamp(),
  });
}

// index === 0(첫 회차, 통상 선금) 입금 확인 시에만 연결 업무를 자동 착수 처리한다.
export async function markInstallmentPaid(order: PurchaseOrder, index: number, actor: { uid: string; name: string }) {
  if (!order.payment) return;
  const now = Date.now();
  const installments = order.payment.installments.map((it, i) => (i === index ? { ...it, paid: true, paidAt: now } : it));
  const label = installments[index].label;

  // "발주 없이 직접 등록"(청구서)은 실제 생산·출고 과정이 없는 순수 청구 건이라, 회차가
  // 전부 발행되고 입금까지 전부 확인되면 그 자체로 할 일이 끝난 것이다 — 매번 관리자가
  // 따로 "출고완료" 처리를 눌러줄 필요 없이 자동으로 완료 상태(shipped, 목록에서 "출고완료"로
  // 묶여 숨겨지는 그 상태)로 넘긴다. 실제 클라이언트 발주는 물리적인 생산/출고가 남아있을 수
  // 있으므로 이 자동완료 대상이 아니다.
  const allSettled = installments.every((it) => it.paid && it.issuedAt);
  const autoComplete = order.createdByAdmin && allSettled && order.status !== "shipped";

  await updateDoc(doc(db, "purchaseOrders", order.id), {
    payment: { installments: installments.map(serializeInstallment), note: order.payment.note ?? "" },
    ...(autoComplete ? { status: "shipped" as PurchaseOrderStatus } : {}),
    updatedAt: serverTimestamp(),
  });

  try {
    await createNotification({
      userId: order.orderedBy,
      type: "order_status_change",
      orderId: order.id,
      message: `발주(${order.poNumber}) ${label} 입금이 확인되었습니다.`,
    });
  } catch (e) {
    console.error("입금 확인 알림 발송 실패:", e);
  }

  if (index === 0 && order.linkedTaskId) {
    try {
      const task = await getTask(order.linkedTaskId);
      if (task) {
        if (task.status === "todo" || task.status === "pending") {
          await updateTaskStatus(task, "in_progress", actor.name);
        }
        await addComment(
          order.linkedTaskId,
          actor.uid,
          actor.name,
          "admin",
          `[발주 시스템] 발주(${order.poNumber}) ${label} 입금이 확인되어 업무가 착수 처리되었습니다.`
        );
      }
    } catch (e) {
      console.error("연결 업무 착수 처리 실패:", e);
    }
  } else if (order.linkedTaskId) {
    try {
      await addComment(
        order.linkedTaskId,
        actor.uid,
        actor.name,
        "admin",
        `[발주 시스템] 발주(${order.poNumber}) ${label} 입금이 확인되었습니다.`
      );
    } catch (e) {
      console.error("연결 업무 코멘트 기록 실패:", e);
    }
  }
}

export async function issueInstallmentInvoice(order: PurchaseOrder, index: number) {
  if (!order.payment) return;
  const now = Date.now();
  const installments = order.payment.installments.map((it, i) => (i === index ? { ...it, issuedAt: now } : it));
  const installment = installments[index];

  // markInstallmentPaid와 동일한 이유 — 순서 상관없이(입금확인을 먼저 하고 나중에 발행하는
  // 경우도 있으므로) 여기서도 전부 갖춰졌는지 확인해서 자동완료 처리한다.
  const allSettled = installments.every((it) => it.paid && it.issuedAt);
  const autoComplete = order.createdByAdmin && allSettled && order.status !== "shipped";

  await updateDoc(doc(db, "purchaseOrders", order.id), {
    payment: { installments: installments.map(serializeInstallment), note: order.payment.note ?? "" },
    ...(autoComplete ? { status: "shipped" as PurchaseOrderStatus } : {}),
    updatedAt: serverTimestamp(),
  });

  try {
    await createNotification({
      userId: order.orderedBy,
      type: "order_status_change",
      orderId: order.id,
      invoiceIndex: index,
      message: `발주(${order.poNumber}) ${installment.label} 청구서가 발행되었습니다. 링크를 통해 청구서를 확인해주세요.`,
    });
  } catch (e) {
    console.error("청구서 발행 알림 발송 실패:", e);
  }
}

export async function updatePurchaseOrderMemo(id: string, memo: string) {
  return updateDoc(doc(db, "purchaseOrders", id), { memo, updatedAt: serverTimestamp() });
}

export async function deletePurchaseOrder(id: string) {
  return deleteDoc(doc(db, "purchaseOrders", id));
}
