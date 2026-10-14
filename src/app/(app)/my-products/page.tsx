"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenClientProductInternalsByPartner } from "@/lib/firestore/productInternal";
import { listenSupplierProductsByPartner } from "@/lib/firestore/supplierProducts";
import { formatSupplierMoney } from "@/lib/firestore/supplierOrders";
import { ClientProductInternal, SupplierProduct, SupplierOrderKind, SupplierCurrency, SupplierPartItem, SUPPLIER_ORDER_KIND_LABEL } from "@/lib/types";
import { zh, usePartnerZh } from "@/lib/i18n";
import { toProxiedUrl } from "@/lib/storageProxy";

const KIND_ORDER: SupplierOrderKind[] = ["production", "development", "mold", "sample"];

interface Row {
  id: string;
  name: string;
  nameEn?: string;
  spec?: string;
  unit?: string;
  imageUrl?: string;
  purchasePrice?: number;
  purchaseCurrency: SupplierCurrency;
  orderKind?: SupplierOrderKind;
  clientName?: string;
  parts?: SupplierPartItem[];
}

// 협력사(파트너) 계정 전용 — 관리자가 구매 카탈로그(SupplierOrdersTab)에서 내 계정으로
// 연동해둔 제품의 매입 단가만 조회한다. 고객 판매 단가(clientProducts)는 이 화면 어디에도
// 등장하지 않는다 — clientProductInternal/supplierProducts 두 컬렉션 모두 매입 쪽 정보만
// 담고 있고, Firestore 규칙도 이 두 컬렉션만 partnerId로 열어둔다.
export default function MyProductsPage() {
  const { appUser } = useAuth();
  const isPartner = appUser?.role === "partner";
  const isZh = usePartnerZh();
  const [internals, setInternals] = useState<ClientProductInternal[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!appUser || !isPartner) return;
    let got1 = false;
    let got2 = false;
    const check = () => { if (got1 && got2) setLoaded(true); };
    const unsub1 = listenClientProductInternalsByPartner(
      appUser.uid,
      (list) => { setInternals(list); got1 = true; check(); },
      (e) => { setLoadError(e.message); got1 = true; check(); }
    );
    const unsub2 = listenSupplierProductsByPartner(
      appUser.uid,
      (list) => { setSupplierProducts(list); got2 = true; check(); },
      (e) => { setLoadError(e.message); got2 = true; check(); }
    );
    return () => { unsub1(); unsub2(); };
  }, [appUser, isPartner]);

  if (appUser && !isPartner) {
    return <p className="text-sm text-[#86868b]">{zh(isZh, "접근 권한이 없습니다.")}</p>;
  }

  const rows: Row[] = [
    ...internals
      .filter((i) => i.purchasePrice != null)
      .map((i) => ({
        id: i.id,
        name: i.productName || zh(isZh, "(품명 미입력)"),
        nameEn: i.nameEn,
        unit: i.productUnit,
        imageUrl: i.productImageUrl,
        purchasePrice: i.purchasePrice,
        purchaseCurrency: i.purchaseCurrency ?? "USD",
        orderKind: i.orderKind,
        parts: i.parts,
      })),
    ...supplierProducts.map((sp) => ({
      id: sp.id,
      name: sp.name,
      nameEn: sp.nameEn,
      spec: sp.spec,
      unit: sp.unit,
      imageUrl: sp.imageUrl,
      purchasePrice: sp.purchasePrice,
      purchaseCurrency: sp.purchaseCurrency ?? "USD",
      orderKind: sp.orderKind,
      clientName: sp.clientName,
      parts: sp.parts,
    })),
  ];

  const grouped: Record<SupplierOrderKind | "unset", Row[]> = { production: [], development: [], mold: [], sample: [], unset: [] };
  rows.forEach((r) => grouped[r.orderKind ?? "unset"].push(r));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
          <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
          {zh(isZh, "내 제품 단가")}
        </h1>
        <p className="mt-1 pl-4 text-sm text-[#86868b]">
          {zh(isZh, "관리자가 내 계정으로 연동해둔 제품의 매입 단가만 보여줍니다.")}
        </p>
      </div>

      {!loaded && <p className="text-sm text-[#86868b]">{zh(isZh, "불러오는 중...")}</p>}
      {loadError && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-600">{zh(isZh, "불러오지 못했습니다")}: {loadError}</p>
      )}

      {loaded && !loadError && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] bg-white py-16 text-center">
          <Tag size={32} className="mb-3 text-[#d1d1d6]" />
          <p className="text-sm text-[#86868b]">{zh(isZh, "아직 내 계정으로 연동된 제품이 없습니다.")}</p>
        </div>
      )}

      <div className="space-y-6">
        {[...KIND_ORDER, "unset" as const].map((kind) => {
          const list = grouped[kind];
          if (list.length === 0) return null;
          return (
            <div key={kind}>
              <p className="mb-2 px-1 text-sm font-semibold text-[#1d1d1f]">
                {kind === "unset" ? zh(isZh, "미지정") : zh(isZh, SUPPLIER_ORDER_KIND_LABEL[kind])}
              </p>
              <div className="overflow-hidden rounded-3xl bg-white">
                {list.map((r) => {
                  const namedParts = (r.parts ?? []).filter((p) => p.name.trim());
                  return (
                    <div key={r.id} className="border-b border-[#f5f5f7] px-5 py-3.5 last:border-b-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {r.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={toProxiedUrl(r.imageUrl)} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-[#e5e5e5] object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[#1d1d1f]">{r.name}</p>
                            <p className="mt-0.5 truncate text-xs text-[#86868b]">
                              {[r.nameEn, r.spec, r.clientName].filter(Boolean).join(" · ") || "-"}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-[#1d1d1f]">
                            {r.purchasePrice != null ? formatSupplierMoney(r.purchasePrice, r.purchaseCurrency) : "-"}
                          </p>
                          {r.unit && <p className="mt-0.5 text-xs text-[#d1d1d6]">/ {r.unit}</p>}
                        </div>
                      </div>
                      {namedParts.length > 0 && (
                        <details className="mt-2.5 rounded-2xl bg-[#f5f5f7] px-3 py-2.5">
                          <summary className="cursor-pointer text-[11px] font-semibold text-[#86868b]">
                            {zh(isZh, "부품별 단가")} ({namedParts.length})
                          </summary>
                          <div className="mt-2 space-y-2">
                            {namedParts.map((p, i) => (
                              <div key={i} className="flex items-start justify-between gap-3 text-xs text-[#1d1d1f]">
                                <span className="min-w-0 flex-1 break-words">{p.name}{p.nameEn ? ` · ${p.nameEn}` : ""}</span>
                                <span className="shrink-0 whitespace-nowrap text-[#86868b]">
                                  {formatSupplierMoney(p.unitPrice, r.purchaseCurrency)} × {p.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
