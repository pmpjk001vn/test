import React, { useState, useMemo } from "react";
import { callApi } from "../services/api";
import { bodau, formatMoney, isDateInRange } from "../utils/helpers";
import { printInvoiceA5 } from "../utils/printTemplates";
import { Printer, CheckCircle, XCircle, Trash2, Search, Eye } from "lucide-react";
import Swal from "sweetalert2";

export default function ProcessOrderModule({ mode, appData, histories, invoiceConfig, onRefresh }) {
  const [quickId, setQuickId] = useState("");
  const [modalOrder, setModalOrder] = useState(null);
  const [viewInvoiceModal, setViewInvoiceModal] = useState(null);
  const [isEditingCompleted, setIsEditingCompleted] = useState(false);

  const [saleName, setSaleName] = useState("");
  const [items, setItems] = useState([]);
  const [directDiscount, setDirectDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [oldDebt, setOldDebt] = useState(0);
  const [addProdQuery, setAddProdQuery] = useState("");

  const [searchHistory, setSearchHistory] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const waitingOrders = useMemo(
    () => (histories.hoaDon || []).filter((o) => o.status === "Đã in"),
    [histories.hoaDon]
  );

  const openProcessModal = (order, completedMode = false) => {
    const cust = appData.customers.find((c) => c.name === order.customerName);
    setModalOrder(order);
    setIsEditingCompleted(completedMode);
    setSaleName(order.saleName || "");
    setItems((order.items || []).map((it) => ({ ...it })));
    setDirectDiscount(Number(order.directDiscount || 0));
    setPaidAmount(Number(order.paidAmount || 0));
    setOldDebt(completedMode ? Number(order.oldDebt || 0) : Number(cust?.debt || 0));
  };

  const handleQuickFind = (e) => {
    e.preventDefault();
    if (!quickId.trim()) return;
    let normalized = quickId.trim().toUpperCase();
    if (/^\d+$/.test(normalized)) {
      normalized = `HD${normalized.padStart(5, "0")}`;
    }
    const found = waitingOrders.find((o) => o.id.toUpperCase() === normalized);
    if (found) {
      openProcessModal(found, false);
      setQuickId("");
    } else {
      Swal.fire("Không tìm thấy", `Không có đơn chờ xử lý mã ${normalized}`, "warning");
    }
  };

  const handleKeyNav = (e, rowIdx, colName) => {
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      const next = document.querySelector(`[data-cell="${rowIdx + 1}-${colName}"]`);
      if (next) next.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = document.querySelector(`[data-cell="${rowIdx - 1}-${colName}"]`);
      if (prev) prev.focus();
    }
  };

  const subTotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.price) * (1 - Number(it.ck || 0) / 100) * Number(it.qty), 0),
    [items]
  );
  const grandTotal = subTotal - Number(directDiscount || 0) + Number(oldDebt || 0) - Number(paidAmount || 0);

  const handleCompleteAndPrint = async () => {
    const payload = {
      saleName,
      items,
      totalAmount: subTotal,
      directDiscount: Number(directDiscount || 0),
      oldDebt: Number(oldDebt || 0),
      paidAmount: Number(paidAmount || 0),
      grandTotal,
    };

    try {
      if (isEditingCompleted) {
        await callApi("updateCompletedOrder", [modalOrder.id, payload]);
      } else {
        await callApi("processOrder", [modalOrder.id, payload]);
      }

      const invoiceObj = { ...modalOrder, ...payload };
      printInvoiceA5(invoiceObj, invoiceConfig, appData.excludeMerge);
      setModalOrder(null);
      onRefresh();
    } catch (err) {
      Swal.fire("Lỗi xử lý", err.message, "error");
    }
  };

  const handleCancelCompleted = async (id) => {
    const ok = await Swal.fire({
      title: `Hủy toa hoàn thành ${id}?`,
      text: "Tồn kho và công nợ sẽ được hoàn tác!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xác nhận Hủy Toa",
    });
    if (!ok.isConfirmed) return;
    try {
      await callApi("adminDeleteCompletedOrder", [id]);
      Swal.fire("Đã hủy toa", "", "success");
      onRefresh();
    } catch (err) {
      Swal.fire("Lỗi", err.message, "error");
    }
  };

  const filteredInvoices = useMemo(() => {
    const q = bodau(searchHistory);
    return (histories.hoanThanh || []).filter((h) => {
      if (q && !bodau(h.customerName).includes(q) && !bodau(h.id).includes(q)) {
        return false;
      }
      return isDateInRange(h.date, dateFilter);
    });
  }, [histories.hoanThanh, searchHistory, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const pagedInvoices = useMemo(
    () => filteredInvoices.slice((page - 1) * pageSize, page * pageSize),
    [filteredInvoices, page]
  );

  if (mode === "lichSuHoaDon") {
    const rev = filteredInvoices.reduce((s, h) => s + Number(h.totalAmount || 0), 0);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border">
            <div className="text-xs text-slate-500">Tổng Doanh Thu Hóa Đơn</div>
            <div className="text-xl font-bold text-emerald-600">{formatMoney(rev)} đ</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border">
            <div className="text-xs text-slate-500">Số Hóa Đơn Hoàn Thành</div>
            <div className="text-xl font-bold text-slate-800">{filteredInvoices.length} HĐ</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border flex flex-wrap gap-3">
          <input
            type="text"
            value={searchHistory}
            onChange={(e) => { setSearchHistory(e.target.value); setPage(1); }}
            placeholder="Tìm khách hoặc mã HĐ..."
            className="p-2 border rounded-xl text-base flex-1"
          />
          <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} className="p-2 border rounded-xl text-base">
            <option value="all">Tất cả ngày</option>
            <option value="today">Hôm nay</option>
            <option value="7days">7 ngày qua</option>
            <option value="thisMonth">Tháng này</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3">Mã HĐ</th>
                <th className="p-3">Khách Hàng</th>
                <th className="p-3 text-right">Tiền Hàng</th>
                <th className="p-3 text-right">Nợ Cũ</th>
                <th className="p-3 text-right">Trả Trước</th>
                <th className="p-3 text-right">Tổng Toa</th>
                <th className="p-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedInvoices.map((h) => (
                <tr key={h.id}>
                  <td className="p-3 font-bold text-blue-700">{h.id}<div className="text-xs text-slate-400">{h.date}</div></td>
                  <td className="p-3">{h.customerName}</td>
                  <td className="p-3 text-right">{formatMoney(h.totalAmount)}</td>
                  <td className="p-3 text-right">{formatMoney(h.oldDebt)}</td>
                  <td className="p-3 text-right text-emerald-600">{formatMoney(h.paidAmount)}</td>
                  <td className="p-3 text-right font-bold">{formatMoney(h.grandTotal)} đ</td>
                  <td className="p-3 flex justify-end gap-1.5">
                    <button onClick={() => setViewInvoiceModal(h)} title="Xem chi tiết" className="p-2 bg-slate-100 rounded-lg">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => printInvoiceA5(h, invoiceConfig, appData.excludeMerge)} title="In lại A5" className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                      <Printer className="w-4 h-4" />
                    </button>
                    <button onClick={() => openProcessModal(h, true)} className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold">
                      Sửa
                    </button>
                    <button onClick={() => handleCancelCompleted(h.id)} className="p-2 bg-red-50 text-red-600 rounded-lg">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-xs">
              <span>Trang <b>{page}</b> / {totalPages} ({filteredInvoices.length} HĐ)</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 bg-white border rounded-lg disabled:opacity-40">Trước</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 bg-white border rounded-lg disabled:opacity-40">Sau</button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL XEM CHI TIẾT HÓA ĐƠN NHANH */}
        {viewInvoiceModal && (
          <div onClick={() => setViewInvoiceModal(null)} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-5 max-h-[88vh] overflow-y-auto space-y-3">
              <div className="flex justify-between items-center border-b pb-2.5">
                <h3 className="font-bold text-base sm:text-lg text-blue-700">Chi Tiết Hóa Đơn: {viewInvoiceModal.id}</h3>
                <button onClick={() => setViewInvoiceModal(null)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-semibold">Đóng</button>
              </div>
              <div className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 p-3 rounded-xl">
                <div>Khách hàng: <b>{viewInvoiceModal.customerName}</b></div>
                <div>Sale: <b>{viewInvoiceModal.saleName}</b></div>
                <div>Nợ cũ: <b>{formatMoney(viewInvoiceModal.oldDebt)} đ</b></div>
                <div>Trả trước: <b className="text-emerald-600">{formatMoney(viewInvoiceModal.paidAmount)} đ</b></div>
                <div className="sm:col-span-2 text-base">Tổng cộng toa: <b className="text-blue-700">{formatMoney(viewInvoiceModal.grandTotal)} đ</b></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 border">Tên SP</th>
                      <th className="p-2 border">SL</th>
                      <th className="p-2 border">Đơn Giá</th>
                      <th className="p-2 border">CK%</th>
                      <th className="p-2 border">Thành Tiền</th>
                      <th className="p-2 border">Ghi Chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewInvoiceModal.items || []).map((it, i) => {
                      const line = it.price * (1 - (it.ck || 0) / 100) * it.qty;
                      return (
                        <tr key={i}>
                          <td className="p-2 border font-medium">{it.name}</td>
                          <td className="p-2 border text-center">{it.qty}</td>
                          <td className="p-2 border text-right">{formatMoney(it.price)}</td>
                          <td className="p-2 border text-center">{it.ck || 0}%</td>
                          <td className="p-2 border text-right font-bold">{formatMoney(line)}</td>
                          <td className="p-2 border">{it.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleQuickFind} className="bg-white p-4 rounded-2xl border flex gap-3 items-center">
        <Search className="w-5 h-5 text-blue-600" />
        <input
          type="text"
          value={quickId}
          onChange={(e) => setQuickId(e.target.value)}
          placeholder="Gõ nhanh số HĐ (VD: 125 -> tự hiểu HD00125) rồi nhấn Enter..."
          className="flex-1 p-2 border rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl">
          OK / Mở
        </button>
      </form>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-3 bg-amber-50 font-bold text-amber-800 border-b">
          Đơn Chờ Xử Lý ({waitingOrders.length})
        </div>
        <div className="divide-y">
          {waitingOrders.map((o) => (
            <div key={o.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div>
                <div className="font-bold text-blue-700">{o.id} — {o.customerName}</div>
                <div className="text-xs text-slate-500">Sale: {o.saleName} | Tổng tạm: <b>{formatMoney(o.totalAmount)} đ</b></div>
              </div>
              <button
                onClick={() => openProcessModal(o, false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm"
              >
                Xử Lý & Xuất HĐ
              </button>
            </div>
          ))}
        </div>
      </div>

      {modalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-blue-700 text-white flex justify-between items-center">
              <div className="font-bold text-lg">
                {isEditingCompleted ? "Sửa Hóa Đơn Hoàn Thành:" : "Xử Lý Đơn:"} {modalOrder.id} — {modalOrder.customerName}
              </div>
              <button onClick={() => setModalOrder(null)} className="px-3 py-1 bg-blue-800 rounded-lg">Đóng</button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-3 rounded-xl">
                <div>
                  <label className="text-xs text-slate-500 block">Đổi nhân viên Sale</label>
                  <select
                    value={saleName}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setSaleName(val);
                      await callApi("quickUpdateOrderSale", [modalOrder.id, val]).catch(() => {});
                    }}
                    className="p-2 border rounded-lg bg-white text-sm font-semibold"
                  >
                    {appData.staffs.map((s) => (
                      <option key={s.fullName} value={s.fullName}>{s.fullName}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[240px]">
                  <label className="text-xs text-slate-500 block">Thêm sản phẩm bổ sung</label>
                  <input
                    type="text"
                    value={addProdQuery}
                    onChange={(e) => setAddProdQuery(e.target.value)}
                    placeholder="Gõ tên SP để thêm..."
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                  {addProdQuery && (
                    <div className="mt-1 bg-white border rounded-lg shadow max-h-36 overflow-y-auto">
                      {appData.products
                        .filter((p) => bodau(p.name).includes(bodau(addProdQuery)))
                        .slice(0, 10)
                        .map((p) => (
                          <button
                            key={p.code}
                            onClick={() => {
                              setItems((prev) => [...prev, { code: p.code, name: p.name, qty: 1, price: p.price, ck: 0, note: "" }]);
                              setAddProdQuery("");
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex justify-between"
                          >
                            <span>{p.name}</span>
                            <b>{formatMoney(p.price)}đ</b>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <table className="w-full text-sm border">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 border">Sản Phẩm</th>
                    <th className="p-2 border w-20">SL</th>
                    <th className="p-2 border w-28">Đơn Giá</th>
                    <th className="p-2 border w-20">CK%</th>
                    <th className="p-2 border">Ghi Chú</th>
                    <th className="p-2 border text-right w-28">Thành Tiền</th>
                    <th className="p-2 border w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lineTotal = it.price * (1 - (it.ck || 0) / 100) * it.qty;
                    return (
                      <tr key={idx}>
                        <td className="p-2 border font-medium">{it.name}</td>
                        <td className="p-1 border">
                          <input
                            data-cell={`${idx}-qty`}
                            onKeyDown={(e) => handleKeyNav(e, idx, "qty")}
                            type="number"
                            value={it.qty}
                            onChange={(e) => {
                              const cp = [...items];
                              cp[idx].qty = Number(e.target.value);
                              setItems(cp);
                            }}
                            className="w-full p-1 border rounded text-center"
                          />
                        </td>
                        <td className="p-1 border">
                          <input
                            data-cell={`${idx}-price`}
                            onKeyDown={(e) => handleKeyNav(e, idx, "price")}
                            type="number"
                            value={it.price}
                            onChange={(e) => {
                              const cp = [...items];
                              cp[idx].price = Number(e.target.value);
                              setItems(cp);
                            }}
                            className="w-full p-1 border rounded text-right"
                          />
                        </td>
                        <td className="p-1 border">
                          <input
                            data-cell={`${idx}-ck`}
                            onKeyDown={(e) => handleKeyNav(e, idx, "ck")}
                            type="number"
                            value={it.ck || 0}
                            onChange={(e) => {
                              const cp = [...items];
                              cp[idx].ck = Number(e.target.value);
                              setItems(cp);
                            }}
                            className="w-full p-1 border rounded text-center"
                          />
                        </td>
                        <td className="p-1 border">
                          <input
                            data-cell={`${idx}-note`}
                            onKeyDown={(e) => handleKeyNav(e, idx, "note")}
                            type="text"
                            value={it.note || ""}
                            onChange={(e) => {
                              const cp = [...items];
                              cp[idx].note = e.target.value;
                              setItems(cp);
                            }}
                            className="w-full p-1 border rounded"
                          />
                        </td>
                        <td className="p-2 border text-right font-bold">{formatMoney(lineTotal)}</td>
                        <td className="p-1 border text-center">
                          <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50/60 p-4 rounded-xl">
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold">Trừ chiết khấu trực tiếp (VNĐ)</label>
                    <input
                      type="number"
                      value={directDiscount}
                      onChange={(e) => setDirectDiscount(Number(e.target.value))}
                      className="w-full p-2 border rounded-lg bg-white text-base"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold">Khách thanh toán trước (VNĐ)</label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      className="w-full p-2 border rounded-lg bg-white text-base"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 text-right flex flex-col justify-center">
                  <div>Tổng tiền hàng: <b>{formatMoney(subTotal)} đ</b></div>
                  <div>Nợ cũ khách hàng: <b>{formatMoney(oldDebt)} đ</b></div>
                  <div className="text-xl font-bold text-blue-700 border-t pt-2">
                    TỔNG CỘNG TOA: {formatMoney(grandTotal)} đ
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setModalOrder(null)} className="px-4 py-2.5 rounded-xl border">Hủy</button>
              <button
                onClick={handleCompleteAndPrint}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-2 hover:bg-emerald-700"
              >
                <CheckCircle className="w-5 h-5" />
                In Hóa Đơn A5 & Hoàn Thành
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
