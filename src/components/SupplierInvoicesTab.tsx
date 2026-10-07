"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Printer, Upload, Download, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import {
  listenAllSupplierInvoices,
  markSupplierInvoicePaid,
  unmarkSupplierInvoicePaid,
} from "@/lib/firestore/supplierInvoices";
import { formatSupplierMoney } from "@/lib/firestore/supplierOrders";
import { createNotification } from "@/lib/firestore/notifications";
import { SupplierInvoice, SUPPLIER_INVOICE_STATUS_LABEL } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-600",
  paid: "bg-green-50 text-green-600",
};

export default function SupplierInvoicesTab() {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [selected, setSelected] = useState<SupplierInvoice | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => listenAllSupplierInvoices(setInvoices), []);

  useEffect(() => {
    if (!selected) return;
    const fresh = invoices.find((i) => i.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [invoices]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUploadReceipt(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    setUploadError("");
    setUploadProgress(0);
    try {
      await markSupplierInvoicePaid(selected.id, file, setUploadProgress);
      await createNotification({
        userId: selected.createdBy,
        type: "supplier_invoice_paid",
        supplierInvoiceId: selected.id,
        message: `청구서 ${selected.invoiceNumber} 건이 지급 완료 처리되었습니다.`,
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "영수증 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleUnmark() {
    if (!selected) return;
    if (!confirm("지급 완료 처리를 되돌릴까요? 첨부된 영수증도 함께 삭제됩니다.")) return;
    await unmarkSupplierInvoicePaid(selected);
  }

  const pending = invoices.filter((i) => i.status === "submitted");
  const done = invoices.filter((i) => i.status === "paid");

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-2">
        {pending.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">제출됨 ({pending.length})</p>}
        {pending.map((inv) => (
          <InvoiceCard key={inv.id} invoice={inv} selected={selected?.id === inv.id} onClick={() => setSelected(inv)} />
        ))}
        {done.length > 0 && (
          <button
            onClick={() => setShowDone((v) => !v)}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]"
          >
            {showDone ? "지급완료 숨기기" : `지급완료 ${done.length}건 숨겨짐 · 보기`}
            {showDone ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
        {showDone && done.map((inv) => (
          <InvoiceCard key={inv.id} invoice={inv} selected={selected?.id === inv.id} onClick={() => setSelected(inv)} />
        ))}
        {invoices.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
            제출된 청구서가 없습니다.
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-4 self-start rounded-3xl bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#1d1d1f]">{(selected.titleKo || selected.title) ?? selected.partnerName}</p>
              <p className="mt-0.5 text-xs text-[#86868b]">
                {(selected.titleKo || selected.title) ? `${selected.partnerName} · ` : ""}
                {selected.invoiceNumber} · {new Date(selected.submittedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[selected.status]}`}>
              {SUPPLIER_INVOICE_STATUS_LABEL[selected.status]}
            </span>
          </div>

          <div className="space-y-1.5 rounded-2xl bg-[#f5f5f7] p-3">
            {selected.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-[#1d1d1f]">{it.descriptionKo || it.description}</p>
                  {it.linkedProjectName && <p className="text-xs text-[#86868b]">{it.linkedProjectName}{it.soNumber ? ` · ${it.soNumber}` : ""}</p>}
                </div>
                <span className="shrink-0 font-medium text-[#1d1d1f]">{formatSupplierMoney(it.amount, selected.currency)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
            <span className="text-sm text-[#86868b]">합계</span>
            <span className="text-lg font-bold text-[#1d1d1f]">{formatSupplierMoney(selected.totalAmount, selected.currency)}</span>
          </div>

          {(selected.memoKo || selected.memo) && (
            <p className="rounded-xl bg-[#f5f5f7] px-3 py-2 text-xs text-[#86868b]">{selected.memoKo || selected.memo}</p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-[#f0f0f0] pt-4">
            <Link
              href={`/supplier-invoices/${selected.id}/print`}
              className="flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2 text-xs font-medium text-white transition hover:bg-black"
            >
              <Printer size={14} /> 청구서 보기 / PDF
            </Link>

            {selected.status === "submitted" ? (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]">
                <Upload size={13} /> {uploading ? `업로드 중... ${uploadProgress}%` : "영수증 첨부하고 지급완료 처리"}
                <input type="file" className="hidden" onChange={handleUploadReceipt} disabled={uploading} />
              </label>
            ) : (
              <>
                {selected.receiptUrl && (
                  <a
                    href={selected.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                  >
                    <Download size={13} /> {selected.receiptName ?? "영수증 보기"}
                  </a>
                )}
                <button
                  onClick={handleUnmark}
                  className="flex items-center gap-1.5 rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#86868b] transition hover:border-amber-500 hover:text-amber-600"
                >
                  <RotateCcw size={13} /> 지급완료 되돌리기
                </button>
              </>
            )}
          </div>
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        </div>
      )}
    </div>
  );
}

function InvoiceCard({ invoice, selected, onClick }: { invoice: SupplierInvoice; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-2xl p-4 text-left transition ${selected ? "bg-[#1d1d1f] text-white" : "bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-medium">{(invoice.titleKo || invoice.title) ?? invoice.partnerName}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${selected ? "bg-white/20 text-white" : STATUS_STYLE[invoice.status]}`}>
          {SUPPLIER_INVOICE_STATUS_LABEL[invoice.status]}
        </span>
      </div>
      <p className={`mt-1 text-xs ${selected ? "text-white/70" : "text-[#86868b]"}`}>
        {invoice.partnerName} · {invoice.invoiceNumber}
      </p>
      <p className={`mt-1.5 text-sm font-semibold ${selected ? "text-white" : "text-[#1d1d1f]"}`}>
        {formatSupplierMoney(invoice.totalAmount, invoice.currency)}
      </p>
    </button>
  );
}
