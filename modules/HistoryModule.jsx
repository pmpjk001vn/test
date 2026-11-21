import React, { useState, useMemo } from "react";
import { callApi } from "../services/api";
import { bodau, formatMoney, isDateInRange } from "../utils/helpers";
import { printExportSlip } from "../utils/printTemplates";
import { Printer, Edit, Trash2, Eye } from "lucide-react";
import Swal from "sweetalert2";

export default function HistoryModule({ user, appData, hoaDon, onEditOrder, onLoadAll, onRefresh }) {
  const isAdmin = user.role === "Admin" || user.role === "SAdmin";
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [searchCust, setSearchCust] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [viewOrder, setViewOrder] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const filtered = useMemo(() => {
    const q = bodau(searchCust);
    return hoaDon.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (scopeFilter === "mine" && o.saleName !== user.fullName) return false;
      if (staffFilter && o.saleName !== staffFilter) return false;
      if (q && !bodau(o.customerName).includes(q) && !bodau(o.id).includes(q)) {
        return false;
      }
      return isDateInRange(o.date, dateFilter, customFrom, customTo);
    });
  }, [hoaDon, statusFilter, scopeFilter, staffFilter, searchCust, dateFilter, customFrom, customTo, user.fullName]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedOrders = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page]
  );

  const stats = useMemo(() => {
    return {
      totalRev: filtered.reduce((s, o) => s + Number(o.totalAmount || 0), 0),
      count: filtered.length,
      waiting: hoaDon.filter((o) => o.status === "Chờ in").length,
      printed: hoaDon.filter((o) => o.status === "Đã in").length,
    };
  }, [filtered, hoaDon]);

  const handlePrintSlip = async (order) => {
    const cust = appData.customers.find((c) => c.name === order.customerName);
    printExportSlip(order, cust?.debt || 0);
    if (order.status === "Chờ in") {
      try {
        await callApi("markAsPrinted", [order.id]);
        onRefresh();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteOrder = async (id) => {
    const ok = await Swal.fire({
      title: `Xóa đơn ${id}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa vĩnh viễn",
    });
    if (!ok.isConfirmed) return;
    try {
      await callApi("deleteOrder", [id]);
      Swal.fire("Đã xóa", "", "success");
      onRefresh();
    } catch (err) {
      Swal.fire("Lỗi", err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          onClick={() => { setStatusFilter("all"); setPage(1); }}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-500"
        >
          <div className="text-xs text-slate-500">Doanh thu (theo lọc)</div>
          <div className="text-lg font-bold text-blue-700">{formatMoney(stats.totalRev)} đ</div>
        </div>
        <div
          onClick={() => { setStatusFilter("all"); setPage(1); }}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-500"
        >
          <div className="text-xs text-slate-500">Tổng số đơn</div>
          <div className="text-lg font-bold text-slate-800">{stats.count} đơn</div>
        </div>
        <div
          onClick={() => { setStatusFilter(statusFilter === "Chờ in" ? "all" : "Chờ in"); setPage(1); }}
          className={`p-3.5 rounded-2xl border cursor-pointer ${
            statusFilter === "Chờ in" ? "bg-amber-50 border-amber-500" : "bg-white border-slate-200"
          }`}
        >
          <div className="text-xs text-amber-700 font-medium">Chờ in</div>
          <div className="text-lg font-bold text-amber-600">{stats.waiting} đơn</div>
        </div>
        <div
          onClick={() => { setStatusFilter(statusFilter === "Đã in" ? "all" : "Đã in"); setPage(1); }}
          className={`p-3.5 rounded-2xl border cursor-pointer ${
            statusFilter === "Đã in" ? "bg-emerald-50 border-emerald-500" : "bg-white border-slate-200"
          }`}
        >
          <div className="text-xs text-emerald-700 font-medium">Đã in (Chờ xử lý)</div>
          <div className="text-lg font-bold text-emerald-600">{stats.printed} đơn</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="text"
          value={searchCust}
          onChange={(e) => { setSearchCust(e.target.value); setPage(1); }}
          placeholder="Tìm khách hoặc Mã HĐ..."
          className="p-2 border rounded-xl text-base"
        />
        <select value={scopeFilter} onChange={(e) => { setScopeFilter(e.target.value); setPage(1); }} className="p-2 border rounded-xl text-base">
          <option value="all">Tất cả đơn</option>
          <option value="mine">Đơn cá nhân tôi</option>
        </select>
        <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPage(1); }} className="p-2 border rounded-xl text-base">
          <option value="">-- Tất cả Sale --</option>
          {appData.staffs.map((s) => (
            <option key={s.fullName} value={s.fullName}>{s.fullName}</option>
          ))}
        </select>
        <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} className="p-2 border rounded-xl text-base">
          <option value="all">Tất cả ngày</option>
          <option value="today">Hôm nay</option>
          <option value="yesterday">Hôm qua</option>
          <option value="7days">7 ngày qua</option>
          <option value="thisMonth">Tháng này</option>
          <option value="custom">Tùy chọn Từ - Đến</option>
        </select>
        <button onClick={onLoadAll} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium">
          Hiện tất cả lịch sử
        </button>

        {dateFilter === "custom" && (
          <div className="sm:col-span-2 lg:col-span-5 flex gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="p-2 border rounded-xl text-base" />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="p-2 border rounded-xl text-base" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 border-b">
            <tr>
              <th className="p-3">Mã Đơn</th>
              <th className="p-3">Khách Hàng</th>
              <th className="p-3">Sale</th>
              <th className="p-3 text-right">Tổng Tiền</th>
              <th className="p-3 text-center">Trạng Thái</th>
              <th className="p-3 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedOrders.map((o) => {
              const canEdit = isAdmin || (o.saleName === user.fullName && o.status === "Chờ in");
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-blue-700">
                    {o.id}
                    <div className="text-xs font-normal text-slate-400">{o.date}</div>
                  </td>
                  <td className="p-3 font-medium">{o.customerName}</td>
                  <td className="p-3 text-slate-600">{o.saleName}</td>
                  <td className="p-3 text-right font-bold">{formatMoney(o.totalAmount)} đ</td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        o.status === "Chờ in"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setViewOrder(o)} title="Xem chi tiết" className="p-2 bg-slate-100 rounded-lg">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handlePrintSlip(o)} title="In Phiếu Xuất Kho A5" className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                        <Printer className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <button onClick={() => onEditOrder(o)} title="Sửa đơn" className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDeleteOrder(o.id)} title="Xóa đơn" className="p-2 bg-red-50 text-red-600 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-xs">
            <span>Trang <b>{page}</b> / {totalPages} ({filtered.length} đơn)</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 bg-white border rounded-lg disabled:opacity-40">Trước</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 bg-white border rounded-lg disabled:opacity-40">Sau</button>
            </div>
          </div>
        )}
      </div>

      {viewOrder && (
        <div onClick={() => setViewOrder(null)} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-5 max-h-[88vh] overflow-y-auto space-y-3">
            <div className="flex justify-between items-center border-b pb-2.5">
              <h3 className="font-bold text-base sm:text-lg text-blue-700">Chi Tiết Đơn: {viewOrder.id}</h3>
              <button onClick={() => setViewOrder(null)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-semibold">Đóng</button>
            </div>
            <div className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 p-3 rounded-xl">
              <div>Khách: <b>{viewOrder.customerName}</b></div>
              <div>Sale: <b>{viewOrder.saleName}</b></div>
              <div>Ngày: <b>{viewOrder.date}</b></div>
              <div>Tổng tiền: <b className="text-blue-700">{formatMoney(viewOrder.totalAmount)} đ</b></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 border">Mã SP</th>
                    <th className="p-2 border">Tên SP</th>
                    <th className="p-2 border">SL</th>
                    <th className="p-2 border">Giá</th>
                    <th className="p-2 border">CK%</th>
                    <th className="p-2 border">Thành tiền</th>
                    <th className="p-2 border">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewOrder.items || []).map((it, i) => {
                    const after = it.price * (1 - (it.ck || 0) / 100);
                    return (
                      <tr key={i}>
                        <td className="p-2 border">{it.code}</td>
                        <td className="p-2 border font-medium">{it.name}</td>
                        <td className="p-2 border text-center">{it.qty}</td>
                        <td className="p-2 border text-right">{formatMoney(it.price)}</td>
                        <td className="p-2 border text-center">{it.ck || 0}%</td>
                        <td className="p-2 border text-right font-bold">{formatMoney(after * it.qty)}</td>
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
