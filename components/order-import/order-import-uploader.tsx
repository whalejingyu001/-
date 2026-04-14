"use client";

import { useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { confirmOrderImportAction } from "@/app/actions/order-actions";

type SourceValue = "WMS_A" | "WMS_B" | "OVERSEAS_DAILY" | "MANUAL_TEMPLATE";

type CustomerOption = {
  id: string;
  name: string;
};

type ParsedRow = {
  rowNo: number;
  customerName: string;
  customerCode?: string;
  statDate: string;
  orderCount: number;
  orderNo?: string;
  warehouseSource?: string;
  mappedCustomerId?: string;
};

const SOURCE_OPTIONS: Array<{ value: SourceValue; label: string }> = [
  { value: "WMS_A", label: "WMS-A" },
  { value: "WMS_B", label: "WMS-B" },
  { value: "OVERSEAS_DAILY", label: "海外仓日报" },
  { value: "MANUAL_TEMPLATE", label: "人工模板" },
];

function readField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const matchedKey = Object.keys(record).find((k) => k.toLowerCase() === key.toLowerCase());
    if (!matchedKey) continue;
    const value = record[matchedKey];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function parseOrderDate(value: string) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function OrderImportUploader({ customers }: { customers: CustomerOption[] }) {
  const [source, setSource] = useState<SourceValue>("WMS_A");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((item) => map.set(item.name.trim().toLowerCase(), item.id));
    return map;
  }, [customers]);

  const unresolvedRows = rows.filter((row) => !row.mappedCustomerId);

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const parsed: ParsedRow[] = rawRows
      .map((item, index) => {
        const customerName = readField(item, ["客户名称", "客户名", "customerName", "customer"]);
        const customerCode = readField(item, ["客户编码", "customerCode", "code"]);
        const statDate = parseOrderDate(readField(item, ["日期", "下单日期", "orderDate", "date"]));
        const countRaw = readField(item, ["单量", "订单量", "orderCount", "数量", "qty"]);
        const orderCount = Number(countRaw);
        const orderNo = readField(item, ["订单号", "orderNo", "订单编号"]);
        const warehouseSource = readField(item, ["仓库来源", "仓库", "warehouse", "wms"]);
        const mappedCustomerId = customerMap.get(customerName.trim().toLowerCase()) ?? "";
        return {
          rowNo: index + 2,
          customerName,
          customerCode: customerCode || undefined,
          statDate,
          orderCount: Number.isFinite(orderCount) ? orderCount : NaN,
          orderNo: orderNo || undefined,
          warehouseSource: warehouseSource || undefined,
          mappedCustomerId,
        };
      })
      .filter((row) => row.customerName && row.statDate && Number.isFinite(row.orderCount) && row.orderCount >= 0);

    setRows(parsed);
    setMessage(`已解析 ${parsed.length} 行，可先预览再确认导入。`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <select value={source} onChange={(event) => setSource(event.target.value as SourceValue)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {SOURCE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            await handleFile(file);
          }}
        />
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">支持 Excel / CSV</div>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      {rows.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">预览解析结果（前 20 条）</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">客户名称</th>
                  <th className="px-3 py-2 text-left">日期</th>
                  <th className="px-3 py-2 text-left">单量</th>
                  <th className="px-3 py-2 text-left">系统客户映射</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 20).map((row, idx) => (
                  <tr key={`${row.rowNo}-${idx}`}>
                    <td className="px-3 py-2">{row.customerName}</td>
                    <td className="px-3 py-2">{row.statDate}</td>
                    <td className="px-3 py-2">{row.orderCount}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.mappedCustomerId ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setRows((prev) =>
                            prev.map((item) =>
                              item.rowNo === row.rowNo ? { ...item, mappedCustomerId: value || undefined } : item,
                            ),
                          );
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="">未匹配（请手动选择）</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unresolvedRows.length > 0 ? (
            <p className="mt-3 text-xs text-rose-600">仍有 {unresolvedRows.length} 行未匹配客户，导入后将计入失败条数。</p>
          ) : (
            <p className="mt-3 text-xs text-emerald-600">客户映射已完成，可直接确认导入。</p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const formData = new FormData();
                    formData.set("source", source);
                    formData.set("fileName", fileName || "import-file");
                    formData.set("rowsJson", JSON.stringify(rows));
                    const result = await confirmOrderImportAction(formData);
                    if (result.ok) {
                      setMessage(`导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`);
                    }
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "导入失败");
                  }
                });
              }}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {isPending ? "导入中..." : "确认导入"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

