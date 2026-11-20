const FIN_UI = {
  debtSearch: "",
  payCust: null,
  payAmount: "",
  importCart: [],
  importQuery: "",
  reportDate: "thisMonth",
  searchQuery: ""
};

function renderFinanceWarehouseReportTab(container, tab) {
  if (tab === "lichSuCongNo") return renderDebtListView(container);
  if (tab === "thanhToan") return renderPaymentView(container);
  if (tab === "lichSuThanhToan") return renderPaymentHistoryView(container);
  if (tab === "import") return renderImportView(container);
  if (tab === "importHistory" || tab === "searchImport") return renderImportHistoryView(container, tab === "searchImport");
  if (tab === "searchCompleted" || tab === "searchHistory") return renderSearchHistoryView(container, tab);
  return renderReportView(container);
}

// --- CÔNG NỢ ---
function renderDebtListView(container) {
  const q = bodau(FIN_UI.debtSearch);
  const list = APP_STATE.data.customers
    .filter(c => !q || bodau(c.name).includes(q) || bodau(c.phone).includes(q))
    .sort((a, b) => Number(b.debt || 0) - Number(a.debt || 0));
  const totalDebt = list.reduce((s, c) => s + Number(c.debt || 0), 0);

  container.innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <h2 style="margin:0;color:var(--blue)">Danh Sách Công Nợ</h2>
      <div style="font-weight:700;color:var(--red)">Tổng nợ: ${formatMoney(totalDebt)} đ</div>
    </div>
    <input id="debt-q" type="text" class="input" value="${FIN_UI.debtSearch}" placeholder="Tìm tên khách hàng hoặc SĐT..." style="margin-bottom:10px" />
    <div class="table-wrap">
      <table><thead><tr><th>Khách hàng</th><th>SĐT</th><th class="text-right">Công nợ hiện tại</th><th>Thao tác</th></tr></thead>
      <tbody>${list.map((c, i) => `<tr>
        <td><b>${c.name}</b><div class="muted">${c.address || ""}</div></td>
        <td>${c.phone || "---"}</td>
        <td class="text-right"><b style="color:${Number(c.debt) > 0 ? "var(--red)" : "var(--green)"}">${formatMoney(c.debt)} đ</b></td>
        <td><button type="button" class="btn btn-success btn-sm debt-go-pay" data-i="${i}">Thu Nợ</button></td>
      </tr>`).join("")}</tbody></table>
    </div>
  </div>`;

  document.getElementById("debt-q").oninput = (e) => { FIN_UI.debtSearch = e.target.value; renderDebtListView(container); };
  document.querySelectorAll(".debt-go-pay").forEach(btn => {
    btn.onclick = () => {
      FIN_UI.payCust = list[Number(btn.getAttribute("data-i"))];
      switchTab("thanhToan");
    };
  });
}

function renderPaymentView(container) {
  const selected = FIN_UI.payCust;
  const oldDebt = Number(selected?.debt || 0);
  const paid = Number(FIN_UI.payAmount || 0);
  const remain = oldDebt - paid;

  container.innerHTML = `<div class="card">
    <h2 style="margin:0 0 12px;color:var(--blue)">Thanh Toán / Thu Nợ Khách Hàng</h2>
    <label class="muted"><b>Chọn khách hàng</b></label>
    <select id="pay-cust-sel" class="input" style="margin:4px 0 12px">
      <option value="">-- Chọn khách hàng --</option>
      ${APP_STATE.data.customers.map(c => `<option value="${c.name}" ${selected?.name === c.name ? "selected" : ""}>${c.name} (Nợ: ${formatMoney(c.debt)}đ)</option>`).join("")}
    </select>

    ${selected ? `<div class="grid-2" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--border);margin-bottom:12px">
      <div>Nợ cũ: <b style="color:var(--red)">${formatMoney(oldDebt)} đ</b></div>
      <div>Còn lại sau thu: <b style="color:var(--blue)">${formatMoney(remain)} đ</b></div>
    </div>` : ""}

    <label class="muted"><b>Số tiền khách trả (VNĐ)</b></label>
    <input id="pay-amt" type="number" class="input" value="${FIN_UI.payAmount}" placeholder="Nhập số tiền..." style="margin:4px 0 12px" />
    <button type="button" id="btn-save-pay" class="btn btn-success full-w">Xác Nhận Thu Nợ</button>
  </div>`;

  document.getElementById("pay-cust-sel").onchange = (e) => {
    FIN_UI.payCust = APP_STATE.data.customers.find(c => c.name === e.target.value) || null;
    renderPaymentView(container);
  };
  document.getElementById("pay-amt").oninput = (e) => {
    FIN_UI.payAmount = e.target.value;
    renderPaymentView(container);
    const inp = document.getElementById("pay-amt");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  };
  document.getElementById("btn-save-pay").onclick = async () => {
    if (!FIN_UI.payCust) return Swal.fire("Thiếu thông tin", "Vui lòng chọn khách hàng", "warning");
    const amt = Number(FIN_UI.payAmount || 0);
    if (amt <= 0) return Swal.fire("Số tiền không hợp lệ", "Vui lòng nhập số tiền > 0", "warning");
    const newDebt = Number(FIN_UI.payCust.debt || 0) - amt;
    try {
      await callApi("savePaymentRecord", [{
        customerName: FIN_UI.payCust.name,
        oldDebt: Number(FIN_UI.payCust.debt || 0),
        paidAmount: amt,
        newDebt: newDebt,
        collector: APP_STATE.user.fullName
      }]);
      await callApi("updateCustomerDebt", [FIN_UI.payCust.name, newDebt]);
      Swal.fire("Thành công", `Đã thu ${formatMoney(amt)} đ của ${FIN_UI.payCust.name}`, "success");
      FIN_UI.payAmount = "";
      FIN_UI.payCust = null;
      syncAllData(false);
    } catch (err) {
      Swal.fire("Lỗi", err.message, "error");
    }
  };
}

async function renderPaymentHistoryView(container) {
  container.innerHTML = `<div class="card muted">Đang tải lịch sử thanh toán...</div>`;
  try {
    const list = await callApi("getAllPaymentHistory");
    container.innerHTML = `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="margin:0;color:var(--blue)">Lịch Sử Thanh Toán (${(list || []).length})</h2>
        <button type="button" id="btn-exp-pay" class="btn btn-outline btn-sm">Xuất Excel</button>
      </div>
      <div class="table-wrap">
        <table><thead><tr><th>Ngày</th><th>Khách hàng</th><th class="text-right">Nợ cũ</th><th class="text-right">Đã thu</th><th class="text-right">Còn lại</th><th>Người thu</th></tr></thead>
        <tbody>${(list || []).map(r => `<tr>
          <td>${r.date}</td><td><b>${r.customerName}</b></td>
          <td class="text-right">${formatMoney(r.oldDebt)}</td>
          <td class="text-right" style="color:var(--green)"><b>${formatMoney(r.paidAmount)}</b></td>
          <td class="text-right" style="color:var(--red)">${formatMoney(r.newDebt)}</td>
          <td>${r.collector}</td>
        </tr>`).join("")}</tbody></table>
      </div>
    </div>`;
    document.getElementById("btn-exp-pay").onclick = () => exportExcelRows(list || [], "LichSuThanhToan.xlsx");
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--red)">Lỗi: ${err.message}</div>`;
  }
}

// --- NHẬP KHO ---
function renderImportView(container) {
  const q = bodau(FIN_UI.importQuery);
  const matches = !q ? [] : APP_STATE.data.products.filter(p => bodau(p.name).includes(q) || bodau(p.code).includes(q)).slice(0, 30);

  container.innerHTML = `<div class="card">
    <h2 style="margin:0 0 10px;color:var(--blue)">Nhập Hàng Vào Kho</h2>
    <input id="imp-q" type="text" class="input" value="${FIN_UI.importQuery}" placeholder="Gõ tên hoặc mã SP cần nhập kho..." />
    ${FIN_UI.importQuery.trim() ? `<div class="dropdown-list">
      ${matches.map(p => `<div class="dropdown-item imp-add" data-code="${p.code}">
        <div><b>${p.name}</b> <span class="muted">(${p.code})</span></div>
        <span class="stock-pill stock-ok">Kho: ${p.stock}</span>
      </div>`).join("")}
    </div>` : ""}

    <div style="margin-top:14px">
      <h3>Danh sách nhập (${FIN_UI.importCart.length} món)</h3>
      ${FIN_UI.importCart.map((it, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;border:1px solid var(--border);padding:8px;border-radius:10px">
        <div style="flex:1"><b>${it.name}</b></div>
        <input type="number" class="input imp-qty" data-i="${i}" value="${it.qty}" style="width:90px" />
        <button type="button" class="btn btn-danger btn-sm imp-del" data-i="${i}">Xóa</button>
      </div>`).join("")}
      <button type="button" id="btn-save-imp" class="btn btn-primary full-w" style="margin-top:10px">Lưu Phiếu Nhập Kho</button>
    </div>
  </div>`;

  document.getElementById("imp-q").oninput = (e) => {
    FIN_UI.importQuery = e.target.value;
    renderImportView(container);
    const inp = document.getElementById("imp-q");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  };
  document.querySelectorAll(".imp-add").forEach(el => {
    el.onclick = () => {
      const p = APP_STATE.data.products.find(x => x.code === el.getAttribute("data-code"));
      if (p) {
        const ex = FIN_UI.importCart.find(x => x.code === p.code);
        if (ex) ex.qty += 1;
        else FIN_UI.importCart.push({ code: p.code, name: p.name, qty: 1 });
        renderImportView(container);
      }
    };
  });
  document.querySelectorAll(".imp-qty").forEach(el => {
    el.onchange = () => { FIN_UI.importCart[Number(el.getAttribute("data-i"))].qty = Number(el.value) || 0; };
  });
  document.querySelectorAll(".imp-del").forEach(el => {
    el.onclick = () => { FIN_UI.importCart.splice(Number(el.getAttribute("data-i")), 1); renderImportView(container); };
  });
  document.getElementById("btn-save-imp").onclick = async () => {
    if (!FIN_UI.importCart.length) return Swal.fire("Trống", "Chưa có sản phẩm nhập kho", "warning");
    await callApi("saveImportData", [FIN_UI.importCart]);
    Swal.fire("Thành công", "Đã lưu phiếu nhập kho!", "success");
    FIN_UI.importCart = [];
    FIN_UI.importQuery = "";
    syncAllData(false);
  };
}

async function renderImportHistoryView(container, isSearch) {
  container.innerHTML = `<div class="card muted">Đang tải lịch sử nhập kho...</div>`;
  try {
    const list = await callApi("getImportHistory");
    container.innerHTML = `<div class="card">
      <h2 style="margin:0 0 10px;color:var(--blue)">${isSearch ? "Tra Cứu Phiếu Nhập" : "Lịch Sử Nhập Kho"} (${(list || []).length})</h2>
      <div class="table-wrap">
        <table><thead><tr><th>Mã NK</th><th>Ngày</th><th>Chi tiết mặt hàng</th></tr></thead>
        <tbody>${(list || []).map(r => `<tr>
          <td><b>${r.id}</b></td>
          <td>${r.date}</td>
          <td>${(r.items || []).map(it => `${it.name} (x${it.qty})`).join(", ")}</td>
        </tr>`).join("")}</tbody></table>
      </div>
    </div>`;
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--red)">Lỗi: ${err.message}</div>`;
  }
}

// --- TRA CỨU & BÁO CÁO ---
function renderSearchHistoryView(container, tab) {
  const source = tab === "searchCompleted"
    ? (APP_STATE.histories.hoanThanh || [])
    : [...(APP_STATE.histories.hoaDon || []), ...(APP_STATE.histories.hoanThanh || [])];
  const q = bodau(FIN_UI.searchQuery);
  const filtered = source.filter(o => !q || bodau(o.id).includes(q) || bodau(o.customerName).includes(q) || bodau(o.saleName).includes(q));

  container.innerHTML = `<div class="card">
    <h2 style="margin:0 0 10px;color:var(--blue)">${tab === "searchCompleted" ? "Tra Cứu Đơn Hoàn Thành" : "Tra Cứu Lịch Sử Tổng Hợp"} (${filtered.length})</h2>
    <input id="srch-all-q" type="text" class="input" value="${FIN_UI.searchQuery}" placeholder="Tìm mã HĐ, khách hàng, Sale..." style="margin-bottom:10px" />
    <div class="table-wrap">
      <table><thead><tr><th>Mã HĐ</th><th>Ngày</th><th>Khách hàng</th><th>Sale</th><th class="text-right">Tổng tiền</th><th>Trạng thái</th></tr></thead>
      <tbody>${filtered.slice(0, 100).map(o => `<tr>
        <td><b>${o.id}</b></td><td>${o.date}</td><td><b>${o.customerName}</b></td><td>${o.saleName}</td>
        <td class="text-right"><b>${formatMoney(o.grandTotal || o.totalAmount)} đ</b></td>
        <td><span class="badge">${o.status}</span></td>
      </tr>`).join("")}</tbody></table>
    </div>
  </div>`;
  document.getElementById("srch-all-q").oninput = (e) => { FIN_UI.searchQuery = e.target.value; renderSearchHistoryView(container, tab); };
}

function renderReportView(container) {
  const done = (APP_STATE.histories.hoanThanh || []).filter(h => isDateInRange(h.date, FIN_UI.reportDate));
  const rev = done.reduce((s, h) => s + Number(h.totalAmount || 0), 0);
  const totalDebt = APP_STATE.data.customers.reduce((s, c) => s + Number(c.debt || 0), 0);
  const lowStock = APP_STATE.data.products.filter(p => Number(p.stock || 0) <= 5).length;

  container.innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <h2 style="margin:0;color:var(--blue)">Báo Cáo Thống Kê</h2>
      <div style="display:flex;gap:8px">
        <select id="rep-date" class="input" style="width:auto">
          <option value="today" ${FIN_UI.reportDate === "today" ? "selected" : ""}>Hôm nay</option>
          <option value="7days" ${FIN_UI.reportDate === "7days" ? "selected" : ""}>7 ngày qua</option>
          <option value="thisMonth" ${FIN_UI.reportDate === "thisMonth" ? "selected" : ""}>Tháng này</option>
          <option value="all" ${FIN_UI.reportDate === "all" ? "selected" : ""}>Tất cả</option>
        </select>
        <button type="button" id="btn-exp-rep" class="btn btn-outline btn-sm">Xuất Excel</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="stat-card"><div class="muted">Đơn hoàn thành</div><div class="stat-val" style="color:var(--blue)">${done.length}</div></div>
      <div class="stat-card"><div class="muted">Doanh thu hàng</div><div class="stat-val" style="color:var(--green)">${formatMoney(rev)} đ</div></div>
      <div class="stat-card"><div class="muted">Tổng công nợ</div><div class="stat-val" style="color:var(--red)">${formatMoney(totalDebt)} đ</div></div>
      <div class="stat-card"><div class="muted">SP sắp hết (≤5)</div><div class="stat-val" style="color:var(--amber)">${lowStock}</div></div>
    </div>
  </div>`;

  document.getElementById("rep-date").onchange = (e) => { FIN_UI.reportDate = e.target.value; renderReportView(container); };
  document.getElementById("btn-exp-rep").onclick = () => exportExcelRows(done, "BaoCao_DoanhThu.xlsx");
}
