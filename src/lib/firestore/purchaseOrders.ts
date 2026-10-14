import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { isCnProxyOn, uploadFileViaProxy } from "@/lib/storageProxy";
import { PaymentInstallment, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, PURCHASE_ORDER_STATUS_LABEL } from "@/lib/types";
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
    completedAt: data.completedAt?.toMillis ? data.completedAt.toMillis() : data.completedAt,
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
    const sigPath = `purchaseOrders/${ref.id}/signature.png`;
    if (isCnProxyOn()) {
      signatureUrl = await uploadFileViaProxy(sigPath, input.signatureBlob, "image/png");
    } else {
      const sigRef = storageRef(storage, sigPath);
      await uploadBytes(sigRef, input.signatureBlob);
      signatureUrl = await getDownloadURL(sigRef);
    }
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
      const totalSummary = [
        totals.hasKrw ? formatMoney(totals.krwTotal, "KRW") : null,
        totals.hasUsd ? formatMoney(totals.usdTotal, "USD") : null,
      ].filter(Boolean).join(" + ");
      const details = items.map((it) => `${it.productName} × ${it.quantity}${it.unit || "개"} — ${formatMoney(it.unitPrice * it.quantity, it.currency)}`);
      const admins = await getAdmins();
      await Promise.all(
        admins.map((u) =>
          createNotification({
            userId: u.uid,
            type: "purchase_order",
            orderId: ref.id,
            message: `${input.clientName}에서 새 발주(${poNumber})를 넣었습니다. 합계 ${totalSummary}`,
            details,
          })
        )
      );
    } catch (e) {
      console.error("발주 알림 발송 실패:", e);
    }
  }

  return ref;
}

// 모든 회차가 끝나 completedAt이 찍힌 발주는 전부 읽기 전용이다 — 기록을 고쳐야 할 일이
// 생기면 완료 처리 자체를 되돌리는 것부터 해야 한다(지금은 그 되돌리기 기능 자체를 일부러
// 안 만들었다 — 실수로 눌렀을 때 바로 고치라는 목적이지, 완료된 기록을 다시 여는 용도가 아니다).
function assertNotCompleted(order: PurchaseOrder) {
  if (order.completedAt) throw new Error("완료 처리된 발주는 수정할 수 없습니다.");
}

export async function updatePurchaseOrderStatus(order: PurchaseOrder, status: PurchaseOrderStatus) {
  assertNotCompleted(order);
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
      message: `발주(${order.poNumber}) 상태가 "${PURCHASE_ORDER_STATUS_LABEL[status]}"(으)로 변경되었습니다.`,
      details: order.items.map((it) => `${it.productName} × ${it.quantity}${it.unit || "개"}`),
    });
  } catch (e) {
    console.error("발주 상태 변경 알림 발송 실패:", e);
  }
}

export async function requestOrderCancel(order: PurchaseOrder, reason?: string) {
  assertNotCompleted(order);
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
          details: order.items.map((it) => `${it.productName} × ${it.quantity}${it.unit || "개"}`),
        })
      )
    );
  } catch (e) {
    console.error("취소 요청 알림 발송 실패:", e);
  }
}

export async function dismissCancelRequest(order: PurchaseOrder) {
  assertNotCompleted(order);
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
      details: order.items.map((it) => `${it.productName} × ${it.quantity}${it.unit || "개"}`),
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
  assertNotCompleted(order);
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
  assertNotCompleted(order);
  return updateDoc(doc(db, "purchaseOrders", order.id), {
    linkedProjectId: input.projectId ?? null,
    linkedTaskId: input.taskId ?? null,
    linkedTaskName: input.taskName ?? null,
    updatedAt: serverTimestamp(),
  });
}

// index === 0(첫 회차, 통상 선금) 입금 확인 시에만 연결 업무를 자동 착수 처리한다.
//
// order 파라미터는 화면에 떠 있던 시점의 스냅샷이라, 관리자 두 명(또는 탭 두 개)이 서로
// 다른 회차를 거의 동시에 확인하면 installments 배열 전체를 각자 오래된 상태 기준으로
// 덮어써서 먼저 저장된 확인 기록이 사라지는 문제가 있었다 — 트랜잭션으로 서버의 최신
// installments를 다시 읽어와서 그 위에 이번 회차만 반영하도록 바꿔 이 경합을 없앤다.
export async function markInstallmentPaid(order: PurchaseOrder, index: number, actor: { uid: string; name: string }) {
  const ref = doc(db, "purchaseOrders", order.id);
  const now = Date.now();

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = fromDoc(snap);
    assertNotCompleted(current);
    if (!current.payment) return null;
    const installments = current.payment.installments.map((it, i) => (i === index ? { ...it, paid: true, paidAt: now } : it));
    const label = installments[index].label;

    // "발주 없이 직접 등록"(청구서)은 실제 생산·출고 과정이 없는 순수 청구 건이라, 회차가
    // 전부 발행되고 입금까지 전부 확인되면 그 자체로 할 일이 끝난 것이다 — 매번 관리자가
    // 따로 "출고완료" 처리를 눌러줄 필요 없이 자동으로 완료 상태(shipped, 목록에서 "출고완료"로
    // 묶여 숨겨지는 그 상태)로 넘긴다. 실제 클라이언트 발주는 물리적인 생산/출고가 남아있을 수
    // 있으므로 이 자동완료 대상이 아니다.
    const allSettled = installments.every((it) => it.paid && it.issuedAt);
    const autoShip = current.createdByAdmin && allSettled && current.status !== "shipped";

    // 발주 종류와 무관하게, 모든 회차의 입금·발행이 다 끝나는 순간(보통 마지막 회차인
    // 잔금 입금확인) 발주 전체를 완료 처리해 아카이브로 보낸다 — 더 이상 손댈 일이 없는
    // 건이라, 발행취소·수정 전부 잠그고 목록에서도 빠지게 한다.
    const justCompleted = allSettled && !current.completedAt;

    tx.update(ref, {
      payment: { installments: installments.map(serializeInstallment), note: current.payment.note ?? "" },
      ...(autoShip ? { status: "shipped" as PurchaseOrderStatus } : {}),
      ...(justCompleted ? { completedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
    return { label };
  });

  if (!result) return;
  const { label } = result;

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

// "입금 확인"을 잘못 눌렀을 때 되돌리는 용도 — 알림 발송이나 연결 업무 착수 같은
// markInstallmentPaid의 부수효과는 일부러 되돌리지 않는다(관리자가 실수를 바로잡는 것이지,
// 그 사이 이미 진행된 업무 착수·발송된 알림까지 자동으로 취소하는 건 오히려 위험하다).
export async function unmarkInstallmentPaid(order: PurchaseOrder, index: number) {
  const ref = doc(db, "purchaseOrders", order.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = fromDoc(snap);
    assertNotCompleted(current);
    if (!current.payment) return;
    const installments = current.payment.installments.map((it, i) => (i === index ? { ...it, paid: false, paidAt: undefined } : it));
    tx.update(ref, {
      payment: { installments: installments.map(serializeInstallment), note: current.payment.note ?? "" },
      updatedAt: serverTimestamp(),
    });
  });
}

export async function issueInstallmentInvoice(order: PurchaseOrder, index: number) {
  const ref = doc(db, "purchaseOrders", order.id);
  const now = Date.now();

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = fromDoc(snap);
    assertNotCompleted(current);
    if (!current.payment) return null;
    const installments = current.payment.installments.map((it, i) => (i === index ? { ...it, issuedAt: now } : it));
    const installment = installments[index];

    // markInstallmentPaid와 동일한 이유 — 순서 상관없이(입금확인을 먼저 하고 나중에 발행하는
    // 경우도 있으므로) 여기서도 전부 갖춰졌는지 확인해서 자동완료 처리한다.
    const allSettled = installments.every((it) => it.paid && it.issuedAt);
    const autoShip = current.createdByAdmin && allSettled && current.status !== "shipped";
    const justCompleted = allSettled && !current.completedAt;

    tx.update(ref, {
      payment: { installments: installments.map(serializeInstallment), note: current.payment.note ?? "" },
      ...(autoShip ? { status: "shipped" as PurchaseOrderStatus } : {}),
      ...(justCompleted ? { completedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
    return { label: installment.label };
  });

  if (!result) return;

  try {
    await createNotification({
      userId: order.orderedBy,
      type: "order_status_change",
      orderId: order.id,
      invoiceIndex: index,
      message: `발주(${order.poNumber}) ${result.label} 청구서가 발행되었습니다. 링크를 통해 청구서를 확인해주세요.`,
    });
  } catch (e) {
    console.error("청구서 발행 알림 발송 실패:", e);
  }
}

// "청구서/영수증 발행"을 잘못 눌렀거나 내용을 고쳐서 다시 발행해야 할 때 되돌리는 용도.
// 입금확인 취소와 달리 이건 고객에게 알림을 보낸다 — 발행 시점에 이미 "확인해달라"는
// 링크를 보냈으므로, 취소됐다는 것도 알려야 옛 문서를 계속 참고하는 걸 막을 수 있다.
// (취소 즉시 invoice 페이지 자체가 issuedAt 없음을 이유로 접근을 막으므로 별도 처리는 불필요.)
export async function unissueInstallmentInvoice(order: PurchaseOrder, index: number) {
  const ref = doc(db, "purchaseOrders", order.id);

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = fromDoc(snap);
    assertNotCompleted(current);
    if (!current.payment) return null;
    const installment = current.payment.installments[index];
    const installments = current.payment.installments.map((it, i) => (i === index ? { ...it, issuedAt: undefined } : it));

    tx.update(ref, {
      payment: { installments: installments.map(serializeInstallment), note: current.payment.note ?? "" },
      updatedAt: serverTimestamp(),
    });
    return { label: installment.label, paid: installment.paid };
  });

  if (!result) return;

  try {
    await createNotification({
      userId: order.orderedBy,
      type: "order_status_change",
      orderId: order.id,
      message: `발주(${order.poNumber}) ${result.label} ${result.paid ? "영수증" : "청구서"} 발행이 취소되었습니다.`,
    });
  } catch (e) {
    console.error("발행취소 알림 발송 실패:", e);
  }
}

export async function updatePurchaseOrderMemo(id: string, memo: string) {
  return updateDoc(doc(db, "purchaseOrders", id), { memo, updatedAt: serverTimestamp() });
}

export async function deletePurchaseOrder(id: string) {
  return deleteDoc(doc(db, "purchaseOrders", id));
}
