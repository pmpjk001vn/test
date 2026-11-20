const HIST_UI = {
  search: "",
  dateFilter: "all",
  fromDate: "",
  toDate: "",
  statusFilter: "all",
  procSearch: "",
  procFilter: "all"
};

function renderHistoryAndProcessTab(container, tab) {
  if (tab === "history") return renderOrderManagementView(container);
  if (tab === "xulydh") return renderProcessOrdersView(container);
  return renderCompletedInvoicesView(container);
}

function renderOrderManagementView(container) {
  const isAdmin = APP_STATE.user.role === "Admin" || APP_STATE.user.role === "SAdmin";
  const rows = (APP_STATE.histories.hoaDon || []).filter(h => {
    if (!isDateInRange(h.date, HIST_UI.dateFilter, HIST_UI.fromDate, HIST_UI.toDate)) return false;
    if (HIST_UI.statusFilter !== "all" && h.status !== HIST_UI.statusFilter) return false;
    const q = bodau(HIST_UI.search);
    if (!q) return true;
    return bodau(h.id).includes(q) || bodau(h.customerName).includes(q) || bodau(h.saleName).includes(q);
  });

  container.innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <h2 style="margin:0;color:var(--blue)">Quản Lý Đơn Hàng (${rows.length})</h2>
      <button type="button" id="btn-load-all-hist" class="btn btn-outline btn-sm">Tải toàn bộ lịch sử</button>
    </div>

    <div class="grid-2" style="margin-bottom:12px">
      <input id="hist-search" type="text" class="input" value="${HIST_UI.search}" placeholder="Tìm mã HĐ, khách hàng, Sale..." />
      <select id="hist-status" class="input">
        <option value="all" ${HIST_UI.statusFilter === "all" ? "selected" : ""}>Tất cả trạng thái</option>
        <option value="Chờ in" ${HIST_UI.statusFilter === "Chờ in" ? "selected" : ""}>Chờ in</option>
        <option value="Đã in" ${HIST_UI.statusFilter === "Đã in" ? "selected" : ""}>Đã in</option>
      </select>
      <select id="hist-date" class="input">
        <option value="all" ${HIST_UI.dateFilter === "all" ? "selected" : ""}>Mọi thời gian</option>
        <option value="today" ${HIST_UI.dateFilter === "today" ? "selected" : ""}>Hôm nay</option>
        <option value="yesterday" ${HIST_UI.dateFilter === "yesterday" ? "selected" : ""}>Hôm qua</option>
        <option value="7days" ${HIST_UI.dateFilter === "7days" ? "selected" : ""}>7 ngày qua</option>
        <option value="thisMonth" ${HIST_UI.dateFilter === "thisMonth" ? "selected" : ""}>Tháng này</option>
        <option value="custom" ${HIST_UI.dateFilter === "custom" ? "selected" : ""}>Tùy chọn ngày</option>
      </select>
      ${HIST_UI.dateFilter === "custom" ? `<div style="display:flex;gap:6px">
        <input id="hist-from" type="date" class="input" value="${HIST_UI.fromDate}" />
        <input id="hist-to" type="date" class="input" value="${HIST_UI.toDate}" />
      </div>` : ""}
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Mã HĐ</th><th>Ngày</th><th>Khách hàng</th><th>Sale</th><th class="text-right">Tổng tiền</th><th>Trạng thái</th><th>Thao tác</th>
        </tr></thead>
        <tbody>
          ${rows.map((h, i) => `<tr>
            <td><b>${h.id}</b></td>
            <td>${h.date}</td>
            <td><b>${h.customerName}</b></td>
            <td>${isAdmin ? `<select class="input hist-sale-sel" data-id="${h.id}" style="padding:4px 6px;font-size:13px">
              ${APP_STATE.data.staffs.map(s => `<option value="${s.fullName}" ${s.fullName === h.saleName ? "selected" : ""}>${s.fullName}</option>`).join("")}
            </select>` : h.saleName}</td>
            <td class="text-right"><b>${formatMoney(h.totalAmount)} đ</b></td>
            <td><span class="badge ${h.status === "Đã in" ? "red" : ""}">${h.status || "Chờ in"}</span></td>
            <td style="white-space:nowrap">
              <button type="button" class="btn btn-outline btn-sm hist-print" data-i="${i}">In A5</button>
              <button type="button" class="btn btn-primary btn-sm hist-edit" data-i="${i}">Sửa</button>
              <button type="button" class="btn btn-danger btn-sm hist-del" data-id="${h.id}">Xóa</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>`;

  document.getElementById("btn-load-all-hist").onclick = () => syncAllData(true);
  document.getElementById("hist-search").oninput = (e) => { HIST_UI.search = e.target.value; renderOrderManagementView(container); };
  document.getElementById("hist-status").onchange = (e) => { HIST_UI.statusFilter = e.target.value; renderOrderManagementView(container); };
  document.getElementById("hist-date").onchange = (e) => { HIST_UI.dateFilter = e.target.value; renderOrderManagementView(container); };
  if (document.getElementById("hist-from")) document.getElementById("hist-from").onchange = (e) => { HIST_UI.fromDate = e.target.value; renderOrderManagementView(container); };
  if (document.getElementById("hist-to")) document.getElementById("hist-to").onchange = (e) => { HIST_UI.toDate = e.target.value; renderOrderManagementView(container); };

  document.querySelectorAll(".hist-sale-sel").forEach(sel => {
    sel.onchange = async () => {
      await callApi("quickUpdateOrderSale", [sel.getAttribute("data-id"), sel.value]);
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: "Đã đổi Sale", timer: 1200, showConfirmButton: false });
      syncAllData(false);
    };
  });

  document.querySelectorAll(".hist-print").forEach(btn => {
    btn.onclick = async () => {
      const ord = rows[Number(btn.getAttribute("data-i"))];
      const cust = APP_STATE.data.customers.find(c => c.name === ord.customerName);
      printExportSlipA5(ord, cust?.debt || 0);
      await callApi("markAsPrinted", [ord.id]);
      syncAllData(false);
    };
  });

  document.querySelectorAll(".hist-edit").forEach(btn => {
    btn.onclick = () => {
      APP_STATE.editingOrder = Object.assign({}, rows[Number(btn.getAttribute("data-i"))], { isDraft: false });
      switchTab("order");
    };
  });

  document.querySelectorAll(".hist-del").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      const ok = await Swal.fire({ title: `Xóa đơn ${id}?`, icon: "warning", showCancelButton: true });
      if (!ok.isConfirmed) return;
      await callApi("deleteOrder", [id]);
      syncAllData(false);
    };
  });
}

function renderProcessOrdersView(container) {
  const q = bodau(HIST_UI.procSearch);
  const list = (APP_STATE.histories.hoaDon || []).filter(h => {
    if (HIST_UI.procFilter === "printed" && h.status !== "Đã in") return false;
    if (HIST_UI.procFilter === "unprinted" && h.status === "Đã in") return false;
    if (!q) return true;
    return bodau(h.id).includes(q) || bodau(h.customerName).includes(q);
  });

  container.innerHTML = `<div class="card">
    <h2 style="margin:0 0 10px;color:var(--blue)">Xử Lý Đơn Hàng (${list.length})</h2>
    <div class="grid-2" style="margin-bottom:12px">
      <input id="proc-search" type="text" class="input" value="${HIST_UI.procSearch}" placeholder="Tìm nhanh số HĐ hoặc tên khách..." />
      <select id="proc-filter" class="input">
        <option value="all" ${HIST_UI.procFilter === "all" ? "selected" : ""}>Tất cả</option>
        <option value="printed" ${HIST_UI.procFilter === "printed" ? "selected" : ""}>Đã in (Chờ duyệt)</option>
        <option value="unprinted" ${HIST_UI.procFilter === "unprinted" ? "selected" : ""}>Chờ in</option>
      </select>
    </div>

    ${list.map((h, idx) => {
      const cust = APP_STATE.data.customers.find(c => c.name === h.customerName);
      const oldDebt = Number(cust?.debt || 0);
      return `<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><b>${h.id}</b> — <b>${h.customerName}</b> <span class="badge ${h.status === "Đã in" ? "red" : ""}">${h.status || "Chờ in"}</span></div>
          <div>Tiền hàng: <b style="color:var(--blue)">${formatMoney(h.totalAmount)} đ</b> | Nợ cũ: <b style="color:var(--red)">${formatMoney(oldDebt)} đ</b></div>
        </div>
        <div class="muted" style="margin:4px 0">Ngày: ${h.date} | Sale: ${h.saleName}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button type="button" class="btn btn-outline btn-sm proc-print-inv" data-i="${idx}">In Hóa Đơn A5</button>
          <button type="button" class="btn btn-success btn-sm proc-approve" data-i="${idx}">Duyệt Hoàn Thành</button>
        </div>
      </div>`;
    }).join("")}
  </div>`;

  document.getElementById("proc-search").oninput = (e) => { HIST_UI.procSearch = e.target.value; renderProcessOrdersView(container); };
  document.getElementById("proc-filter").onchange = (e) => { HIST_UI.procFilter = e.target.value; renderProcessOrdersView(container); };

  document.querySelectorAll(".proc-print-inv").forEach(btn => {
    btn.onclick = async () => {
      const h = list[Number(btn.getAttribute("data-i"))];
      const cust = APP_STATE.data.customers.find(c => c.name === h.customerName);
      const invObj = Object.assign({}, h, {
        phone: h.phone || cust?.phone || "",
        address: h.address || cust?.address || "",
        oldDebt: Number(cust?.debt || 0),
        grandTotal: Number(h.totalAmount || 0) + Number(cust?.debt || 0)
      });
      printInvoiceA5(invObj, APP_STATE.invoiceConfig, APP_STATE.data.excludeMerge);
      await callApi("markAsPrinted", [h.id]);
      syncAllData(false);
    };
  });

  document.querySelectorAll(".proc-approve").forEach(btn => {
    btn.onclick = () => openApproveOrderModal(list[Number(btn.getAttribute("data-i"))]);
  });
}

function openApproveOrderModal(order) {
  const cust = APP_STATE.data.customers.find(c => c.name === order.customerName);
  const defaultDebt = Number(cust?.debt || 0);
  const items = (order.items || []).map(it => Object.assign({}, it));

  const redraw = () => {
    const sub = items.reduce((s, it) => s + Number(it.price || 0) * (1 - Number(it.ck || 0) / 100) * Number(it.qty || 0), 0);
    const oldD = Number(document.getElementById("ap-old-debt")?.value ?? defaultDebt) || 0;
    const paid = Number(document.getElementById("ap-paid")?.value ?? 0) || 0;
    const disc = Number(document.getElementById("ap-disc")?.value ?? 0) || 0;
    const grand = sub + oldD - paid - disc;

    openModal(`
      <h3 style="margin-top:0;color:var(--blue)">Duyệt Hoàn Thành Đơn: ${order.id}</h3>
      <div class="muted">Khách: <b>${order.customerName}</b> | Sale: <b>${order.saleName}</b></div>
      <div class="table-wrap" style="margin:10px 0">
        <table><thead><tr><th>Mặt hàng</th><th width="80">SL</th><th width="110">Đơn giá</th><th width="70">CK%</th></tr></thead>
        <tbody>${items.map((it, i) => `<tr>
          <td>${it.name}</td>
          <td><input type="number" step="any" class="input ap-q" data-i="${i}" value="${it.qty}" style="padding:4px" /></td>
          <td><input type="number" class="input ap-p" data-i="${i}" value="${it.price}" style="padding:4px" /></td>
          <td><input type="number" class="input ap-c" data-i="${i}" value="${it.ck || 0}" style="padding:4px" /></td>
        </tr>`).join("")}</tbody></table>
      </div>
      <div class="grid-2">
        <div><label class="muted">Tiền hàng</label><div style="padding:8px;font-weight:700">${formatMoney(sub)} đ</div></div>
        <div><label class="muted">Nợ cũ</label><input id="ap-old-debt" type="number" class="input ap-calc" value="${oldD}" /></div>
        <div><label class="muted">Thanh toán / Trả trước</label><input id="ap-paid" type="number" class="input ap-calc" value="${paid}" /></div>
        <div><label class="muted">Chiết khấu trực tiếp</label><input id="ap-disc" type="number" class="input ap-calc" value="${disc}" /></div>
      </div>
      <div style="margin-top:12px;font-size:18px;font-weight:700;color:var(--blue);text-align:right">Tổng cộng toa: ${formatMoney(grand)} đ</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button type="button" id="ap-cancel" class="btn btn-outline">Hủy</button>
        <button type="button" id="ap-save" class="btn btn-success">Xác Nhận Hoàn Thành</button>
      </div>
    `);

    document.getElementById("ap-cancel").onclick = closeModal;
    document.querySelectorAll(".ap-q").forEach(el => el.onchange = () => { items[Number(el.getAttribute("data-i"))].qty = Number(el.value) || 0; redraw(); });
    document.querySelectorAll(".ap-p").forEach(el => el.onchange = () => { items[Number(el.getAttribute("data-i"))].price = Number(el.value) || 0; redraw(); });
    document.querySelectorAll(".ap-c").forEach(el => el.onchange = () => { items[Number(el.getAttribute("data-i"))].ck = Number(el.value) || 0; redraw(); });
    document.querySelectorAll(".ap-calc").forEach(el => el.onchange = redraw);

    document.getElementById("ap-save").onclick = async () => {
      try {
        await callApi("processOrder", [order.id, {
          saleName: order.saleName,
          totalAmount: sub,
          oldDebt: oldD,
          paidAmount: paid,
          directDiscount: disc,
          grandTotal: grand,
          items: items
        }]);
        closeModal();
        Swal.fire("Hoàn thành", `Đã chuyển đơn ${order.id} sang Hoan_Thanh!`, "success");
        syncAllData(false);
      } catch (err) {
        Swal.fire("Lỗi", err.message, "error");
      }
    };
  };

  redraw();
}

function renderCompletedInvoicesView(container) {
  const q = bodau(HIST_UI.search);
  const list = (APP_STATE.histories.hoanThanh || []).filter(h => {
    if (!isDateInRange(h.date, HIST_UI.dateFilter, HIST_UI.fromDate, HIST_UI.toDate)) return false;
    if (!q) return true;
    return bodau(h.id).includes(q) || bodau(h.customerName).includes(q) || bodau(h.saleName).includes(q);
  });

  container.innerHTML = `<div class="card">
    <h2 style="margin:0 0 10px;color:var(--blue)">Lịch Sử Hóa Đơn Hoàn Thành (${list.length})</h2>
    <div class="grid-2" style="margin-bottom:12px">
      <input id="done-q" type="text" class="input" value="${HIST_UI.search}" placeholder="Tìm mã HĐ, khách hàng, Sale..." />
      <select id="done-d" class="input">
        <option value="all" ${HIST_UI.dateFilter === "all" ? "selected" : ""}>Mọi thời gian</option>
        <option value="today" ${HIST_UI.dateFilter === "today" ? "selected" : ""}>Hôm nay</option>
        <option value="thisMonth" ${HIST_UI.dateFilter === "thisMonth" ? "selected" : ""}>Tháng này</option>
      </select>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>Mã HĐ</th><th>Ngày</th><th>Khách hàng</th><th>Sale</th><th class="text-right">Tổng cộng</th><th>Thao tác</th></tr></thead>
      <tbody>${list.map((h, i) => `<tr>
        <td><b>${h.id}</b></td>
        <td>${h.date}</td>
        <td><b>${h.customerName}</b></td>
        <td>${h.saleName}</td>
        <td class="text-right"><b>${formatMoney(h.grandTotal || h.totalAmount)} đ</b></td>
        <td style="white-space:nowrap">
          <button type="button" class="btn btn-outline btn-sm done-print" data-i="${i}">In HĐ</button>
          <button type="button" class="btn btn-danger btn-sm done-del" data-id="${h.id}">Xóa</button>
        </td>
      </tr>`).join("")}</tbody></table>
    </div>
  </div>`;

  document.getElementById("done-q").oninput = (e) => { HIST_UI.search = e.target.value; renderCompletedInvoicesView(container); };
  document.getElementById("done-d").onchange = (e) => { HIST_UI.dateFilter = e.target.value; renderCompletedInvoicesView(container); };
  document.querySelectorAll(".done-print").forEach(btn => {
    btn.onclick = () => printInvoiceA5(list[Number(btn.getAttribute("data-i"))], APP_STATE.invoiceConfig, APP_STATE.data.excludeMerge);
  });
  document.querySelectorAll(".done-del").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      const ok = await Swal.fire({ title: `Xóa hóa đơn ${id}?`, icon: "warning", showCancelButton: true });
      if (!ok.isConfirmed) return;
      await callApi("adminDeleteCompletedOrder", [id]);
      syncAllData(false);
    };
  });
}
