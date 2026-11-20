const HIST_UI = {
  search: "",
  dateFilter: "today",
  fromDate: "",
  toDate: "",
  statusFilter: "all",
  scopeFilter: "all",

  // State riêng cho Xử Lý Đơn Hàng
  procTab: "all", // "all" | "pending" | "completed" | "cancelled"
  procExactDate: "",
  procInvoiceCode: "",
  procSearch: "",
  procDateFilter: "all",
  procFromDate: "",
  procToDate: ""
};

function renderHistoryAndProcessTab(container, tab) {
  if (tab === "history") return renderOrderManagementView(container);
  if (tab === "xulydh") return renderProcessOrdersView(container);
  return renderCompletedInvoicesView(container);
}

function getDateFilterLabel(key) {
  const map = {
    today: "Hôm nay",
    yesterday: "Hôm qua",
    "7days": "7 ngày qua",
    thisMonth: "Tháng này",
    all: "Tất cả",
    custom: "Tùy chọn"
  };
  return map[key] || "Tất cả";
}

function matchExactDate(dateStr, yyyyMmDd) {
  if (!yyyyMmDd) return true;
  if (!dateStr) return false;
  const parts = yyyyMmDd.split("-"); // [yyyy, mm, dd]
  const ddMmYyyy = `${parts[2]}/${parts[1]}/${parts[0]}`;
  return String(dateStr).includes(ddMmYyyy) || String(dateStr).includes(yyyyMmDd);
}

// ==========================================
// 1. QUẢN LÝ ĐƠN HÀNG (LỊCH SỬ LÊN ĐƠN)
// ==========================================
function renderOrderManagementView(container) {
  const currentUserName = APP_STATE.user?.fullName || "";
  const q = bodau(HIST_UI.search);

  const baseRows = (APP_STATE.histories.hoaDon || []).filter(h => {
    if (HIST_UI.scopeFilter === "mine" && h.saleName !== currentUserName) return false;
    if (!isDateInRange(h.date, HIST_UI.dateFilter, HIST_UI.fromDate, HIST_UI.toDate)) return false;
    if (!q) return true;
    return bodau(h.id).includes(q) || bodau(h.customerName).includes(q) || bodau(h.saleName).includes(q);
  });

  const totalRevenue = baseRows.reduce((s, h) => s + Number(h.totalAmount || 0), 0);
  const totalOrders = baseRows.length;
  const waitingPrintCount = baseRows.filter(h => h.status !== "Đã in").length;
  const printedCount = baseRows.filter(h => h.status === "Đã in").length;

  const rows = baseRows.filter(h => {
    if (HIST_UI.statusFilter === "Chờ in") return h.status !== "Đã in";
    if (HIST_UI.statusFilter === "Đã in") return h.status === "Đã in";
    return true;
  });

  const dateBtns = [
    { id: "today", label: "Hôm nay" },
    { id: "yesterday", label: "Hôm qua" },
    { id: "7days", label: "7 ngày" },
    { id: "thisMonth", label: "Tháng này" },
    { id: "all", label: "Tất cả" },
    { id: "custom", label: "Tùy chọn" }
  ];

  container.innerHTML = `
    <div style="margin-bottom:10px">
      <button type="button" id="btn-hist-back" class="btn btn-outline btn-sm" style="border-radius:999px">← Quay lại</button>
    </div>

    <div class="grid-2" style="margin-bottom:12px">
      <div class="stat-card" style="cursor:default">
        <div class="muted" style="font-size:12px;font-weight:700">DOANH THU</div>
        <div class="stat-val" style="color:var(--blue);font-size:20px">${formatMoney(totalRevenue)}đ</div>
        <div class="muted" style="font-size:12px">${getDateFilterLabel(HIST_UI.dateFilter)}</div>
      </div>

      <div class="stat-card" id="stat-all" style="border-bottom:3px solid ${HIST_UI.statusFilter === "all" ? "var(--red)" : "transparent"}">
        <div class="muted" style="font-size:12px;font-weight:700">TỔNG ĐƠN</div>
        <div class="stat-val" style="color:var(--red);font-size:20px">${totalOrders}</div>
        <div class="muted" style="font-size:12px">phiếu</div>
      </div>

      <div class="stat-card" id="stat-wait" style="border-bottom:3px solid ${HIST_UI.statusFilter === "Chờ in" ? "var(--amber)" : "transparent"}">
        <div class="muted" style="font-size:12px;font-weight:700">CHỜ IN</div>
        <div class="stat-val" style="color:var(--amber);font-size:20px">${waitingPrintCount}</div>
        <div class="muted" style="font-size:12px">phiếu</div>
      </div>

      <div class="stat-card" id="stat-printed" style="border-bottom:3px solid ${HIST_UI.statusFilter === "Đã in" ? "var(--green)" : "transparent"}">
        <div class="muted" style="font-size:12px;font-weight:700">ĐÃ IN</div>
        <div class="stat-val" style="color:var(--green);font-size:20px">${printedCount}</div>
        <div class="muted" style="font-size:12px">phiếu</div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;color:var(--blue)">
          <input type="radio" name="hist-scope" value="all" ${HIST_UI.scopeFilter === "all" ? "checked" : ""} />
          <span>Tất cả đơn</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;color:var(--green)">
          <input type="radio" name="hist-scope" value="mine" ${HIST_UI.scopeFilter === "mine" ? "checked" : ""} />
          <span>Đơn cá nhân</span>
        </label>
      </div>

      <input id="hist-search" type="text" class="input" value="${HIST_UI.search.replace(/"/g, "&quot;")}"
        placeholder="Tìm nhanh tên khách hàng, mã HĐ, Sale..." style="margin-bottom:12px" />

      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:12px">
        <span class="muted" style="font-size:12px;font-weight:700;margin-right:4px">KHOẢNG THỜI GIAN:</span>
        ${dateBtns.map(b => `
          <button type="button" class="btn btn-sm hist-date-btn ${HIST_UI.dateFilter === b.id ? "btn-primary" : "btn-outline"}" data-date="${b.id}">
            ${b.label}
          </button>
        `).join("")}
        <button type="button" id="btn-load-all-hist" class="btn btn-outline btn-sm">👁 Hiện tất cả</button>
      </div>

      ${HIST_UI.dateFilter === "custom" ? `<div class="grid-2" style="margin-bottom:12px">
        <div><label class="muted">Từ ngày</label><input id="hist-from" type="date" class="input" value="${HIST_UI.fromDate}" /></div>
        <div><label class="muted">Đến ngày</label><input id="hist-to" type="date" class="input" value="${HIST_UI.toDate}" /></div>
      </div>` : ""}

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Mã HĐ</th><th>Ngày</th><th>Khách hàng</th><th>Sale</th><th class="text-right">Tổng tiền</th><th>Trạng thái</th><th>Thao tác</th>
          </tr></thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="7" class="text-center muted" style="padding:20px">Không có đơn hàng nào phù hợp bộ lọc</td></tr>` :
              rows.map((h, i) => `<tr>
                <td><b>${h.id || "---"}</b></td>
                <td>${h.date || "---"}</td>
                <td><b>${h.customerName}</b></td>
                <td>${h.saleName || "---"}</td>
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
    </div>
  `;

  document.getElementById("btn-hist-back").onclick = () => switchTab("order");
  document.getElementById("stat-all").onclick = () => { HIST_UI.statusFilter = "all"; renderOrderManagementView(container); };
  document.getElementById("stat-wait").onclick = () => { HIST_UI.statusFilter = "Chờ in"; renderOrderManagementView(container); };
  document.getElementById("stat-printed").onclick = () => { HIST_UI.statusFilter = "Đã in"; renderOrderManagementView(container); };

  document.querySelectorAll('input[name="hist-scope"]').forEach(r => {
    r.onchange = (e) => { HIST_UI.scopeFilter = e.target.value; renderOrderManagementView(container); };
  });

  document.getElementById("hist-search").oninput = (e) => {
    HIST_UI.search = e.target.value;
    renderOrderManagementView(container);
    const inp = document.getElementById("hist-search");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  };

  document.querySelectorAll(".hist-date-btn").forEach(btn => {
    btn.onclick = () => { HIST_UI.dateFilter = btn.getAttribute("data-date"); renderOrderManagementView(container); };
  });

  document.getElementById("btn-load-all-hist").onclick = () => {
    HIST_UI.dateFilter = "all";
    HIST_UI.statusFilter = "all";
    syncAllData(true);
  };

  if (document.getElementById("hist-from")) {
    document.getElementById("hist-from").onchange = (e) => { HIST_UI.fromDate = e.target.value; renderOrderManagementView(container); };
  }
  if (document.getElementById("hist-to")) {
    document.getElementById("hist-to").onchange = (e) => { HIST_UI.toDate = e.target.value; renderOrderManagementView(container); };
  }

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

// ==========================================
// 2. XỬ LÝ ĐƠN HÀNG (CHỜ XỬ LÝ / HOÀN THÀNH / HỦY TOA)
// ==========================================
function renderProcessOrdersView(container) {
  // Chỉ lấy đơn trạng thái "Đã in" từ Don_Hang đưa sang "Chờ xử lý"
  const pendingOrders = (APP_STATE.histories.hoaDon || [])
    .filter(h => h.status === "Đã in")
    .map(h => Object.assign({}, h, { _procType: "pending", _label: "Chờ xử lý" }));

  const completedOrders = (APP_STATE.histories.hoanThanh || [])
    .map(h => Object.assign({}, h, { _procType: "completed", _label: "Hoàn thành" }));

  const cancelledOrders = (APP_STATE.histories.huyToa || [])
    .map(h => Object.assign({}, h, { _procType: "cancelled", _label: "Hủy Toa" }));

  const totalCompletedRevenue = completedOrders.reduce((s, h) => s + Number(h.totalAmount || h.grandTotal || 0), 0);

  let combined = [];
  if (HIST_UI.procTab === "pending") combined = pendingOrders;
  else if (HIST_UI.procTab === "completed") combined = completedOrders;
  else if (HIST_UI.procTab === "cancelled") combined = cancelledOrders;
  else combined = [...pendingOrders, ...completedOrders, ...cancelledOrders];

  const q = bodau(HIST_UI.procSearch);
  const list = combined.filter(o => {
    if (HIST_UI.procExactDate && !matchExactDate(o.date, HIST_UI.procExactDate)) return false;
    if (!isDateInRange(o.date, HIST_UI.procDateFilter, HIST_UI.procFromDate, HIST_UI.procToDate)) return false;
    if (!q) return true;
    return bodau(o.id).includes(q) || bodau(o.customerName).includes(q) || bodau(o.saleName).includes(q);
  });

  const dateBtns = [
    { id: "all", label: "Tất cả" },
    { id: "today", label: "Hôm nay" },
    { id: "yesterday", label: "Hôm qua" },
    { id: "7days", label: "7 ngày" },
    { id: "thisMonth", label: "Tháng này" },
    { id: "custom", label: "Tùy chọn" }
  ];

  container.innerHTML = `
    <div style="margin-bottom:10px">
      <button type="button" id="btn-proc-back" class="btn btn-outline btn-sm" style="border-radius:999px">← Quay lại</button>
    </div>

    <div class="grid-4" style="margin-bottom:12px">
      <div class="stat-card text-center" id="pstat-pending" style="border-color:${HIST_UI.procTab === "pending" ? "var(--amber)" : "var(--border)"}">
        <div class="muted" style="font-size:12px;font-weight:700">CHỜ XỬ LÝ</div>
        <div class="stat-val" style="color:var(--amber)">${pendingOrders.length}</div>
        <div class="muted" style="font-size:11px">Đơn Đã In</div>
      </div>

      <div class="stat-card text-center" id="pstat-completed" style="border-color:${HIST_UI.procTab === "completed" ? "var(--blue)" : "var(--border)"}">
        <div class="muted" style="font-size:12px;font-weight:700">HOÀN THÀNH</div>
        <div class="stat-val" style="color:var(--blue)">${completedOrders.length}</div>
        <div class="muted" style="font-size:11px">Đã Xử Lý</div>
      </div>

      <div class="stat-card text-center" id="pstat-cancelled" style="background:${HIST_UI.procTab === "cancelled" ? "#fef2f2" : "#fff"};border-color:${HIST_UI.procTab === "cancelled" ? "var(--red)" : "var(--border)"}">
        <div class="muted" style="font-size:12px;font-weight:700;color:var(--red)">HỦY TOA</div>
        <div class="stat-val" style="color:var(--red)">${cancelledOrders.length}</div>
        <div class="muted" style="font-size:11px;color:var(--red)">đã hủy</div>
      </div>

      <div class="stat-card text-center" style="cursor:default">
        <div class="muted" style="font-size:12px;font-weight:700">DOANH THU</div>
        <div class="stat-val" style="color:var(--green)">${formatMoney(totalCompletedRevenue)}đ</div>
        <div class="muted" style="font-size:11px">Hoàn Thành</div>
      </div>
    </div>

    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      <button type="button" class="btn btn-sm proc-tab-btn ${HIST_UI.procTab === "all" ? "btn-primary" : "btn-outline"}" data-ptab="all">Tất cả</button>
      <button type="button" class="btn btn-sm proc-tab-btn ${HIST_UI.procTab === "pending" ? "btn-primary" : "btn-outline"}" data-ptab="pending">Chờ xử lý</button>
      <button type="button" class="btn btn-sm proc-tab-btn ${HIST_UI.procTab === "completed" ? "btn-primary" : "btn-outline"}" data-ptab="completed">Hoàn thành</button>
      <button type="button" class="btn btn-sm proc-tab-btn ${HIST_UI.procTab === "cancelled" ? "btn-primary" : "btn-outline"}" data-ptab="cancelled">Hủy Toa</button>
      <input id="proc-exact-date" type="date" class="input" value="${HIST_UI.procExactDate}" style="width:auto;padding:6px 10px" />
      ${HIST_UI.procExactDate ? `<button type="button" id="proc-clear-date" class="btn btn-outline btn-sm">✕</button>` : ""}
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px">
      <input id="proc-inv-code" type="text" class="input" value="${HIST_UI.procInvoiceCode}" placeholder="Nhập số HĐ (VD: HD03780)..." style="flex:1" />
      <button type="button" id="proc-inv-ok" class="btn btn-success" style="padding:0 22px">OK</button>
    </div>

    <div class="card">
      <input id="proc-search" type="text" class="input" value="${HIST_UI.procSearch.replace(/"/g, "&quot;")}"
        placeholder="Tìm nhanh tên khách hàng..." style="margin-bottom:10px" />
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
        <span class="muted" style="font-size:12px;font-weight:700;margin-right:4px">KHOẢNG THỜI GIAN:</span>
        ${dateBtns.map(b => `
          <button type="button" class="btn btn-sm proc-date-btn ${HIST_UI.procDateFilter === b.id ? "btn-primary" : "btn-outline"}" data-pdate="${b.id}">
            ${b.label}
          </button>
        `).join("")}
        <button type="button" id="proc-load-all" class="btn btn-outline btn-sm">👁 Hiện tất cả</button>
      </div>
      ${HIST_UI.procDateFilter === "custom" ? `<div class="grid-2" style="margin-top:10px">
        <div><label class="muted">Từ ngày</label><input id="proc-from" type="date" class="input" value="${HIST_UI.procFromDate}" /></div>
        <div><label class="muted">Đến ngày</label><input id="proc-to" type="date" class="input" value="${HIST_UI.procToDate}" /></div>
      </div>` : ""}
    </div>

    <div id="proc-list">
      ${list.length === 0 ? `<div class="card text-center muted">Không có đơn hàng nào trong mục này</div>` :
        list.slice(0, 100).map((o, idx) => {
          const borderCol = o._procType === "pending" ? "var(--green)" : o._procType === "completed" ? "var(--blue)" : "var(--red)";
          const firstItem = (o.items || [])[0];
          const moreCount = Math.max(0, (o.items || []).length - 1);
          const custObj = APP_STATE.data.customers.find(c => c.name === o.customerName);
          const addr = o.address || custObj?.address || "";

          return `<div class="card proc-card-open" data-i="${idx}" style="border-left:4px solid ${borderCol};cursor:pointer;padding:12px 14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div>
                <div style="font-weight:700;font-size:16px">${o.customerName || "Khách lẻ"}</div>
                <div class="muted" style="font-size:12px">${o.id || "---"}</div>
                ${addr ? `<div class="muted" style="font-size:12px;margin-top:2px">📍 ${addr}</div>` : ""}
              </div>
              <span class="btn btn-outline btn-sm" style="border-radius:999px;font-size:12px;border-color:${borderCol};color:${borderCol}">
                ⚙ ${o._label}
              </span>
            </div>

            ${firstItem ? `<div style="background:#f8fafc;border-radius:8px;padding:8px 10px;margin:8px 0;font-size:13px;color:#475569">
              <div>- ${firstItem.name} (x${firstItem.qty})</div>
              ${moreCount > 0 ? `<div class="muted" style="font-size:12px">... và ${moreCount} sp khác</div>` : ""}
            </div>` : ""}

            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
              <div class="muted" style="font-size:12px">${o.date || ""} | ${o.saleName || "---"}</div>
              <div style="font-weight:700;font-size:16px;color:var(--red)">${formatMoney(o.grandTotal || o.totalAmount)}đ</div>
            </div>
          </div>`;
        }).join("")}
    </div>
  `;

  document.getElementById("btn-proc-back").onclick = () => switchTab("order");
  document.getElementById("pstat-pending").onclick = () => { HIST_UI.procTab = "pending"; renderProcessOrdersView(container); };
  document.getElementById("pstat-completed").onclick = () => { HIST_UI.procTab = "completed"; renderProcessOrdersView(container); };
  document.getElementById("pstat-cancelled").onclick = () => { HIST_UI.procTab = "cancelled"; renderProcessOrdersView(container); };

  document.querySelectorAll(".proc-tab-btn").forEach(btn => {
    btn.onclick = () => { HIST_UI.procTab = btn.getAttribute("data-ptab"); renderProcessOrdersView(container); };
  });

  document.getElementById("proc-exact-date").onchange = (e) => {
    HIST_UI.procExactDate = e.target.value;
    renderProcessOrdersView(container);
  };
  if (document.getElementById("proc-clear-date")) {
    document.getElementById("proc-clear-date").onclick = () => {
      HIST_UI.procExactDate = "";
      renderProcessOrdersView(container);
    };
  }

  const openByCode = () => {
    const code = bodau(document.getElementById("proc-inv-code").value);
    if (!code) return;
    const found = [...pendingOrders, ...completedOrders].find(o => bodau(o.id) === code || bodau(o.id).endsWith(code));
    if (!found) return Swal.fire("Không tìm thấy", `Không tìm thấy hóa đơn "${code.toUpperCase()}"`, "warning");
    openApproveOrderModal(found);
  };

  document.getElementById("proc-inv-ok").onclick = openByCode;
  document.getElementById("proc-inv-code").onkeydown = (e) => {
    HIST_UI.procInvoiceCode = e.target.value;
    if (e.key === "Enter") openByCode();
  };

  document.getElementById("proc-search").oninput = (e) => {
    HIST_UI.procSearch = e.target.value;
    renderProcessOrdersView(container);
    const inp = document.getElementById("proc-search");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  };

  document.querySelectorAll(".proc-date-btn").forEach(btn => {
    btn.onclick = () => { HIST_UI.procDateFilter = btn.getAttribute("data-pdate"); renderProcessOrdersView(container); };
  });

  document.getElementById("proc-load-all").onclick = () => {
    HIST_UI.procDateFilter = "all";
    HIST_UI.procExactDate = "";
    syncAllData(true);
  };

  if (document.getElementById("proc-from")) {
    document.getElementById("proc-from").onchange = (e) => { HIST_UI.procFromDate = e.target.value; renderProcessOrdersView(container); };
  }
  if (document.getElementById("proc-to")) {
    document.getElementById("proc-to").onchange = (e) => { HIST_UI.procToDate = e.target.value; renderProcessOrdersView(container); };
  }

  document.querySelectorAll(".proc-card-open").forEach(card => {
    card.onclick = () => {
      const ord = list[Number(card.getAttribute("data-i"))];
      if (ord) openApproveOrderModal(ord);
    };
  });
}

// ==========================================
// 3. POPUP XỬ LÝ ĐƠN (GIỐNG HÌNH 3)
// ==========================================
function openApproveOrderModal(order) {
  const cust = APP_STATE.data.customers.find(c => c.name === order.customerName);
  const addr = order.address || cust?.address || "";
  const isCompleted = order._procType === "completed";

  const state = {
    saleName: order.saleName || "",
    items: (order.items || []).map(it => Object.assign({}, it)),
    directDiscount: Number(order.directDiscount || 0),
    oldDebt: Number(order.oldDebt !== undefined && isCompleted ? order.oldDebt : (cust?.debt || 0)),
    paidAmount: Number(order.paidAmount || 0),
    addQuery: ""
  };

  const redraw = () => {
    const sub = state.items.reduce((s, it) => {
      const afterCk = Number(it.price || 0) * (1 - Number(it.ck || 0) / 100);
      return s + afterCk * Number(it.qty || 0);
    }, 0);
    const grand = sub - state.directDiscount + state.oldDebt - state.paidAmount;

    const qAdd = bodau(state.addQuery);
    const addMatches = !qAdd
      ? []
      : APP_STATE.data.products.filter(p => bodau(p.name).includes(qAdd) || bodau(p.code).includes(qAdd)).slice(0, 15);

    openModal(`
      <div style="background:var(--blue);color:#fff;padding:12px 16px;margin:-16px -16px 14px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:700;font-size:16px">⚙ Xử lý đơn — ${order.id || "---"}</div>
        <button type="button" id="ap-close-x" class="icon-btn" style="padding:4px 10px">✕</button>
      </div>

      <div class="grid-2" style="margin-bottom:10px">
        <div style="border:1px solid var(--border);border-radius:10px;padding:10px">
          <div class="muted" style="font-size:11px;font-weight:700">MÃ ĐƠN</div>
          <div style="font-weight:700;color:var(--blue);font-size:16px">${order.id || "---"}</div>
        </div>
        <div style="border:1px solid var(--border);border-radius:10px;padding:10px">
          <div class="muted" style="font-size:11px;font-weight:700">THỜI GIAN</div>
          <div style="font-weight:700;font-size:15px">${order.date || "---"}</div>
        </div>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;margin-bottom:12px">
        <div style="font-weight:700;color:var(--blue);font-size:15px">${order.customerName || "Khách lẻ"}</div>
        ${addr ? `<div class="muted" style="font-size:13px;margin:2px 0 6px">📍 ${addr}</div>` : ""}
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <span class="muted" style="font-weight:700">NV:</span>
          <select id="ap-sale-sel" class="input" style="max-width:260px;padding:6px 10px">
            <option value="">-- Không chọn --</option>
            ${APP_STATE.data.staffs.map(s => `<option value="${s.fullName}" ${s.fullName === state.saleName ? "selected" : ""}>${s.fullName}</option>`).join("")}
          </select>
        </div>
      </div>

      <div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:6px">⊕ THÊM SẢN PHẨM VÀO ĐƠN</div>
        <input id="ap-add-inp" type="text" class="input" value="${state.addQuery.replace(/"/g, "&quot;")}" placeholder="Nhập tên sản phẩm để thêm..." />
        ${state.addQuery.trim() ? `<div class="dropdown-list">
          ${addMatches.length === 0 ? `<div class="dropdown-item muted">Không tìm thấy sản phẩm</div>` :
            addMatches.map(p => `<div class="dropdown-item ap-add-pick" data-code="${p.code}">
              <div><b>${p.name}</b> <span class="muted">(${formatMoney(p.price)}đ)</span></div>
              <span class="stock-pill stock-ok">Kho: ${p.stock}</span>
            </div>`).join("")}
        </div>` : ""}
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px">
        CHI TIẾT SẢN PHẨM <span style="color:var(--blue)">(CÓ THỂ CHỈNH SỬA)</span>
      </div>

      <div class="table-wrap" style="margin-bottom:12px">
        <table>
          <thead><tr>
            <th>SẢN PHẨM</th><th width="70">SL</th><th width="105">ĐƠN GIÁ</th><th width="65">CK%</th>
            <th class="text-right" width="90">SAU CK</th><th class="text-right" width="100">T.TIỀN</th><th width="120">GHI CHÚ</th><th width="40"></th>
          </tr></thead>
          <tbody>
            ${state.items.map((it, i) => {
              const afterCk = Number(it.price || 0) * (1 - Number(it.ck || 0) / 100);
              const lineTot = afterCk * Number(it.qty || 0);
              return `<tr>
                <td><b>${it.name}</b></td>
                <td><input type="number" step="any" class="input ap-q" data-i="${i}" value="${it.qty}" style="padding:5px;text-align:center" /></td>
                <td><input type="number" class="input ap-p" data-i="${i}" value="${it.price}" style="padding:5px;text-align:right;color:var(--red);font-weight:600" /></td>
                <td><input type="number" class="input ap-c" data-i="${i}" value="${it.ck || 0}" style="padding:5px;text-align:center" /></td>
                <td class="text-right" style="color:var(--green);font-weight:700">${formatMoney(afterCk)}</td>
                <td class="text-right" style="color:var(--blue);font-weight:700">${formatMoney(lineTot)}</td>
                <td><input type="text" class="input ap-n" data-i="${i}" value="${(it.note || "").replace(/"/g, "&quot;")}" placeholder="Ghi chú..." style="padding:5px" /></td>
                <td><button type="button" class="btn btn-danger btn-sm ap-del-row" data-i="${i}" style="padding:4px 8px">✕</button></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:10px;padding:10px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:700;color:#b45309">🏷 Trừ chiết khấu trực tiếp (VNĐ)</div>
          <div class="muted" style="font-size:12px">Trừ thẳng vào tổng tiền hàng</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <input id="ap-disc" type="number" class="input" value="${state.directDiscount}" style="width:150px;text-align:right;font-weight:700" />
          <b>đ</b>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom:12px">
        <div><label class="muted">Tiền hàng sau CK trực tiếp</label><div style="padding:8px;font-weight:700;color:var(--blue)">${formatMoney(sub - state.directDiscount)} đ</div></div>
        <div><label class="muted">Công nợ cũ</label><input id="ap-old-debt" type="number" class="input" value="${state.oldDebt}" /></div>
        <div><label class="muted">Khách trả trước / Thanh toán</label><input id="ap-paid" type="number" class="input" value="${state.paidAmount}" /></div>
        <div><label class="muted">TỔNG CỘNG TOA</label><div style="padding:8px;font-size:18px;font-weight:700;color:var(--red)">${formatMoney(grand)} đ</div></div>
      </div>

      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-top:10px;border-top:1px solid var(--border)">
        <button type="button" id="ap-print-a5" class="btn btn-outline">🖨 In Hóa Đơn A5</button>
        <div style="display:flex;gap:8px">
          <button type="button" id="ap-cancel" class="btn btn-outline">Đóng</button>
          <button type="button" id="ap-save" class="btn btn-success">${isCompleted ? "Lưu Cập Nhật" : "✓ Duyệt Hoàn Thành"}</button>
        </div>
      </div>
    `);

    document.getElementById("ap-close-x").onclick = closeModal;
    document.getElementById("ap-cancel").onclick = closeModal;
    document.getElementById("ap-sale-sel").onchange = (e) => { state.saleName = e.target.value; };

    const addInp = document.getElementById("ap-add-inp");
    addInp.oninput = (e) => {
      state.addQuery = e.target.value;
      redraw();
      const next = document.getElementById("ap-add-inp");
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    };

    document.querySelectorAll(".ap-add-pick").forEach(el => {
      el.onclick = () => {
        const p = APP_STATE.data.products.find(x => x.code === el.getAttribute("data-code"));
        if (p) {
          state.items.push({ code: p.code, name: p.name, qty: 1, price: Number(p.price || 0), ck: 0, note: "" });
          state.addQuery = "";
          redraw();
        }
      };
    });

    document.querySelectorAll(".ap-q").forEach(el => el.onchange = () => { state.items[Number(el.getAttribute("data-i"))].qty = Number(el.value) || 0; redraw(); });
    document.querySelectorAll(".ap-p").forEach(el => el.onchange = () => { state.items[Number(el.getAttribute("data-i"))].price = Number(el.value) || 0; redraw(); });
    document.querySelectorAll(".ap-c").forEach(el => el.onchange = () => { state.items[Number(el.getAttribute("data-i"))].ck = Number(el.value) || 0; redraw(); });
    document.querySelectorAll(".ap-n").forEach(el => el.onchange = () => { state.items[Number(el.getAttribute("data-i"))].note = el.value; });
    document.querySelectorAll(".ap-del-row").forEach(el => el.onclick = () => { state.items.splice(Number(el.getAttribute("data-i")), 1); redraw(); });

    document.getElementById("ap-disc").onchange = (e) => { state.directDiscount = Number(e.target.value) || 0; redraw(); };
    document.getElementById("ap-old-debt").onchange = (e) => { state.oldDebt = Number(e.target.value) || 0; redraw(); };
    document.getElementById("ap-paid").onchange = (e) => { state.paidAmount = Number(e.target.value) || 0; redraw(); };

    document.getElementById("ap-print-a5").onclick = () => {
      printInvoiceA5({
        id: order.id,
        date: order.date,
        customerName: order.customerName,
        phone: order.phone || cust?.phone || "",
        address: addr,
        saleName: state.saleName,
        totalAmount: sub,
        directDiscount: state.directDiscount,
        oldDebt: state.oldDebt,
        paidAmount: state.paidAmount,
        grandTotal: grand,
        items: state.items
      }, APP_STATE.invoiceConfig, APP_STATE.data.excludeMerge);
    };

    document.getElementById("ap-save").onclick = async () => {
      const payload = {
        saleName: state.saleName,
        totalAmount: sub,
        oldDebt: state.oldDebt,
        paidAmount: state.paidAmount,
        directDiscount: state.directDiscount,
        grandTotal: grand,
        items: state.items
      };
      try {
        if (isCompleted) {
          await callApi("updateCompletedOrder", [order.id, payload]);
          Swal.fire("Đã cập nhật", `Đã lưu chỉnh sửa hóa đơn ${order.id}`, "success");
        } else {
          await callApi("processOrder", [order.id, payload]);
          Swal.fire("Hoàn thành", `Đã duyệt hoàn thành đơn ${order.id}!`, "success");
        }
        closeModal();
        syncAllData(false);
      } catch (err) {
        Swal.fire("Lỗi", err.message, "error");
      }
    };
  };

  redraw();
}

// ==========================================
// 4. LỊCH SỬ HÓA ĐƠN HOÀN THÀNH
// ==========================================
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
