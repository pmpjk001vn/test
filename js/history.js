const HIST_UI = {
  search: "",
  dateFilter: "today",
  fromDate: "",
  toDate: "",
  statusFilter: "all",
  scopeFilter: "all", // "all" | "mine"
  procSearch: "",
  procFilter: "all"
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

function renderOrderManagementView(container) {
  const currentUserName = APP_STATE.user?.fullName || "";
  const q = bodau(HIST_UI.search);

  // Lọc theo phạm vi (Tất cả / Cá nhân), thời gian và từ khóa tìm kiếm trước để tính số liệu 4 hộp thống kê
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

  // Lọc tiếp theo trạng thái khi bấm vào các hộp thống kê
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
      <div class="stat-card" id="stat-rev" style="cursor:default">
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
    r.onchange = (e) => {
      HIST_UI.scopeFilter = e.target.value;
      renderOrderManagementView(container);
    };
  });

  document.getElementById("hist-search").oninput = (e) => {
    HIST_UI.search = e.target.value;
    renderOrderManagementView(container);
    const inp = document.getElementById("hist-search");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  };

  document.querySelectorAll(".hist-date-btn").forEach(btn => {
    btn.onclick = () => {
      HIST_UI.dateFilter = btn.getAttribute("data-date");
      renderOrderManagementView(container);
    };
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
