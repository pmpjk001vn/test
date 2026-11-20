const ADM_UI = {
  custSearch: "",
  prodSearch: ""
};

function renderWarrantyAndAdminTab(container, tab) {
  if (tab === "baoHanh" || tab === "baoHanhBD") return renderWarrantyFormView(container, tab === "baoHanhBD");
  if (tab === "lsBHKBD" || tab === "lsBHBD") return renderWarrantyListView(container, tab === "lsBHBD");
  if (tab === "customers") return renderCustomersManageView(container);
  if (tab === "products") return renderProductsManageView(container);
  return renderAdminConfigView(container);
}

// --- BẢO HÀNH ---
function renderWarrantyFormView(container, sellable) {
  container.innerHTML = `<div class="card">
    <h2 style="margin:0 0 12px;color:var(--blue)">${sellable ? "Tạo Phiếu Bảo Hành (+Kho / BH_BD)" : "Tạo Phiếu Bảo Hành (KBD / BH_KB)"}</h2>
    <label class="muted">Khách hàng</label>
    <input id="bh-cust" type="text" class="input" placeholder="Nhập tên khách hàng..." style="margin:4px 0 10px" />
    <label class="muted">Sản phẩm</label>
    <input id="bh-prod" type="text" class="input" placeholder="Nhập tên sản phẩm..." style="margin:4px 0 10px" />
    <label class="muted">Số lượng</label>
    <input id="bh-qty" type="number" class="input" value="1" style="margin:4px 0 10px" />
    <label class="checkbox-row" style="margin-bottom:12px"><input id="bh-done" type="checkbox" /> <span>Đã bảo hành xong</span></label>
    <button type="button" id="btn-save-bh" class="btn btn-primary full-w">Lưu Phiếu Bảo Hành</button>
  </div>`;

  document.getElementById("btn-save-bh").onclick = async () => {
    const rec = {
      customerName: document.getElementById("bh-cust").value.trim(),
      productName: document.getElementById("bh-prod").value.trim(),
      qty: Number(document.getElementById("bh-qty").value || 1),
      done: document.getElementById("bh-done").checked
    };
    if (!rec.customerName || !rec.productName) return Swal.fire("Thiếu thông tin", "Vui lòng nhập khách và sản phẩm", "warning");
    await callApi(sellable ? "saveBaoHanhBDData" : "saveBaoHanhData", [rec]);
    Swal.fire("Thành công", "Đã lưu phiếu bảo hành!", "success");
    switchTab(sellable ? "lsBHBD" : "lsBHKBD");
  };
}

async function renderWarrantyListView(container, sellable) {
  container.innerHTML = `<div class="card muted">Đang tải lịch sử bảo hành...</div>`;
  try {
    const list = await callApi(sellable ? "getLsBHBD" : "getLsBHKBD");
    container.innerHTML = `<div class="card">
      <h2 style="margin:0 0 10px;color:var(--blue)">${sellable ? "Lịch Sử BH (+Kho / BH_BD)" : "Lịch Sử BH (KBD / BH_KB)"} (${(list || []).length})</h2>
      <div class="table-wrap">
        <table><thead><tr><th>Ngày</th><th>Khách hàng</th><th>Sản phẩm</th><th>SL</th><th>Trạng thái</th><th>Xóa</th></tr></thead>
        <tbody>${(list || []).map(r => `<tr>
          <td>${r.date}</td><td><b>${r.customerName}</b></td><td>${r.productName}</td><td>${r.qty}</td>
          <td><span class="badge">${r.done ? "Đã BH" : "Chờ"}</span></td>
          <td><button type="button" class="btn btn-danger btn-sm bh-del" data-row="${r.rowIndex}">Xóa</button></td>
        </tr>`).join("")}</tbody></table>
      </div>
    </div>`;

    document.querySelectorAll(".bh-del").forEach(btn => {
      btn.onclick = async () => {
        const ok = await Swal.fire({ title: "Xóa dòng bảo hành này?", icon: "warning", showCancelButton: true });
        if (!ok.isConfirmed) return;
        await callApi(sellable ? "deleteBHBDRow" : "deleteBHKBDRow", [Number(btn.getAttribute("data-row"))]);
        renderWarrantyListView(container, sellable);
      };
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--red)">Lỗi: ${err.message}</div>`;
  }
}

// --- QUẢN LÝ KHÁCH HÀNG ---
function renderCustomersManageView(container) {
  const q = bodau(ADM_UI.custSearch);
  const list = APP_STATE.data.customers.filter(c => !q || bodau(c.name).includes(q) || bodau(c.phone).includes(q));

  container.innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h2 style="margin:0;color:var(--blue)">Quản Lý Khách Hàng (${list.length})</h2>
      <button type="button" id="btn-add-cust" class="btn btn-primary btn-sm">+ Thêm Khách</button>
    </div>
    <input id="adm-cust-q" type="text" class="input" value="${ADM_UI.custSearch}" placeholder="Tìm tên hoặc SĐT khách hàng..." style="margin-bottom:10px" />
    <div class="table-wrap">
      <table><thead><tr><th>Tên khách hàng</th><th>SĐT</th><th>Địa chỉ</th><th class="text-right">Công nợ</th><th>Xóa</th></tr></thead>
      <tbody>${list.map(c => `<tr>
        <td><b>${c.name}</b></td><td>${c.phone || ""}</td><td>${c.address || ""}</td>
        <td class="text-right">${formatMoney(c.debt)} đ</td>
        <td><button type="button" class="btn btn-danger btn-sm adm-del-cust" data-name="${c.name}">Xóa</button></td>
      </tr>`).join("")}</tbody></table>
    </div>
  </div>`;

  document.getElementById("adm-cust-q").oninput = (e) => { ADM_UI.custSearch = e.target.value; renderCustomersManageView(container); };
  document.getElementById("btn-add-cust").onclick = async () => {
    const { value } = await Swal.fire({
      title: "Thêm khách hàng mới",
      html: `<input id="sw-cn" class="swal2-input" placeholder="Tên khách hàng *">
             <input id="sw-cp" class="swal2-input" placeholder="Số điện thoại">
             <input id="sw-ca" class="swal2-input" placeholder="Địa chỉ">`,
      showCancelButton: true,
      preConfirm: () => ({
        name: document.getElementById("sw-cn").value.trim(),
        phone: document.getElementById("sw-cp").value.trim(),
        address: document.getElementById("sw-ca").value.trim(),
        debt: 0
      })
    });
    if (value && value.name) {
      await callApi("addNewCustomer", [value]);
      syncAllData(false);
    }
  };
  document.querySelectorAll(".adm-del-cust").forEach(btn => {
    btn.onclick = async () => {
      const name = btn.getAttribute("data-name");
      const ok = await Swal.fire({ title: `Xóa khách "${name}"?`, icon: "warning", showCancelButton: true });
      if (!ok.isConfirmed) return;
      await callApi("deleteCustomer", [name]);
      syncAllData(false);
    };
  });
}

// --- QUẢN LÝ SẢN PHẨM ---
function renderProductsManageView(container) {
  const q = bodau(ADM_UI.prodSearch);
  const list = APP_STATE.data.products.filter(p => !q || bodau(p.name).includes(q) || bodau(p.code).includes(q));

  container.innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <h2 style="margin:0;color:var(--blue)">Quản Lý Sản Phẩm (${list.length})</h2>
      <div style="display:flex;gap:8px">
        <button type="button" id="btn-add-prod" class="btn btn-primary btn-sm">+ Thêm SP</button>
        <button type="button" id="btn-exp-prod" class="btn btn-outline btn-sm">Xuất Excel</button>
      </div>
    </div>
    <input id="adm-prod-q" type="text" class="input" value="${ADM_UI.prodSearch}" placeholder="Tìm tên hoặc mã SP..." style="margin-bottom:10px" />
    <div class="table-wrap">
      <table><thead><tr><th>Mã SP</th><th>Tên sản phẩm</th><th class="text-right">Đơn giá</th><th class="text-right">Tồn kho</th><th>Nhóm</th><th>Xóa</th></tr></thead>
      <tbody>${list.slice(0, 120).map(p => `<tr>
        <td><b>${p.code}</b></td><td>${p.name}</td>
        <td class="text-right">${formatMoney(p.price)} đ</td>
        <td class="text-right"><b>${p.stock}</b></td>
        <td>${p.category || ""}</td>
        <td><button type="button" class="btn btn-danger btn-sm adm-del-prod" data-code="${p.code}">Xóa</button></td>
      </tr>`).join("")}</tbody></table>
    </div>
  </div>`;

  document.getElementById("adm-prod-q").oninput = (e) => { ADM_UI.prodSearch = e.target.value; renderProductsManageView(container); };
  document.getElementById("btn-exp-prod").onclick = () => exportExcelRows(list, "DanhMuc_SanPham.xlsx");
  document.getElementById("btn-add-prod").onclick = async () => {
    const nextCode = await callApi("getNextMaSP").catch(() => "HH001");
    const { value } = await Swal.fire({
      title: "Thêm sản phẩm mới",
      html: `<input id="sw-pc" class="swal2-input" value="${nextCode}" placeholder="Mã SP">
             <input id="sw-pn" class="swal2-input" placeholder="Tên sản phẩm *">
             <input id="sw-pp" type="number" class="swal2-input" placeholder="Đơn giá">
             <input id="sw-ps" type="number" class="swal2-input" placeholder="Số lượng ban đầu">
             <input id="sw-pg" class="swal2-input" placeholder="Nhóm hàng">`,
      showCancelButton: true,
      preConfirm: () => ({
        code: document.getElementById("sw-pc").value.trim(),
        name: document.getElementById("sw-pn").value.trim(),
        price: Number(document.getElementById("sw-pp").value || 0),
        stock: Number(document.getElementById("sw-ps").value || 0),
        category: document.getElementById("sw-pg").value.trim() || "Khác"
      })
    });
    if (value && value.name) {
      await callApi("addQuickProducts", [[value]]);
      syncAllData(false);
    }
  };
  document.querySelectorAll(".adm-del-prod").forEach(btn => {
    btn.onclick = async () => {
      const code = btn.getAttribute("data-code");
      const ok = await Swal.fire({ title: `Xóa sản phẩm ${code}?`, icon: "warning", showCancelButton: true });
      if (!ok.isConfirmed) return;
      await callApi("deleteProduct", [code]);
      syncAllData(false);
    };
  });
}

// --- QUẢN TRỊ & CẤU HÌNH ---
function renderAdminConfigView(container) {
  const cfg = APP_STATE.invoiceConfig;
  container.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 10px;color:var(--blue)">Cấu Hình Hệ Thống</h2>
      <label class="checkbox-row">
        <input id="cfg-strict" type="checkbox" ${APP_STATE.data.strictStock ? "checked" : ""} />
        <span>Chặn bán hàng khi tồn kho không đủ</span>
      </label>
    </div>

    <div class="card">
      <h3 style="margin:0 0 10px;color:var(--blue)">Cấu Hình Mẫu In Hóa Đơn A5</h3>
      <div class="grid-2">
        <div><label class="muted">Tiêu đề hóa đơn</label><input id="inv-title" class="input" value="${cfg.title || ""}" /></div>
        <div><label class="muted">Cỡ chữ (px)</label><input id="inv-size" type="number" class="input" value="${cfg.fontSize || 12}" /></div>
        <div><label class="muted">Màu chủ đạo</label><input id="inv-color" type="color" class="input" value="${cfg.headerColor || "#1a56db"}" style="height:44px" /></div>
        <div><label class="muted">Ghi chú cuối hóa đơn</label><input id="inv-note" class="input" value="${cfg.footerNote || ""}" /></div>
      </div>
      <button type="button" id="btn-save-inv-cfg" class="btn btn-primary" style="margin-top:10px">Lưu Cấu Hình Hóa Đơn</button>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="margin:0;color:var(--blue)">Quản Lý Nhân Viên (${APP_STATE.data.staffs.length})</h3>
        <button type="button" id="btn-add-staff" class="btn btn-primary btn-sm">+ Thêm NV</button>
      </div>
      <div class="table-wrap">
        <table><thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Quyền</th><th>SĐT</th><th>Xóa</th></tr></thead>
        <tbody>${APP_STATE.data.staffs.map(s => `<tr>
          <td>${s.username}</td><td><b>${s.fullName}</b></td><td><span class="badge">${s.role}</span></td><td>${s.phone || ""}</td>
          <td><button type="button" class="btn btn-danger btn-sm adm-del-st" data-name="${s.fullName}">Xóa</button></td>
        </tr>`).join("")}</tbody></table>
      </div>
    </div>
  `;

  document.getElementById("cfg-strict").onchange = async (e) => {
    await callApi("toggleStockSetting", [e.target.checked]);
    syncAllData(false);
  };
  document.getElementById("btn-save-inv-cfg").onclick = async () => {
    const nextCfg = Object.assign({}, APP_STATE.invoiceConfig, {
      title: document.getElementById("inv-title").value.trim(),
      fontSize: Number(document.getElementById("inv-size").value || 12),
      headerColor: document.getElementById("inv-color").value,
      footerNote: document.getElementById("inv-note").value.trim()
    });
    await callApi("saveInvoiceConfig", [nextCfg]);
    APP_STATE.invoiceConfig = nextCfg;
    Swal.fire("Đã lưu", "Đã cập nhật mẫu in A5!", "success");
  };
  document.getElementById("btn-add-staff").onclick = async () => {
    const { value } = await Swal.fire({
      title: "Thêm nhân viên",
      html: `<input id="sw-su" class="swal2-input" placeholder="Username *">
             <input id="sw-sp" class="swal2-input" placeholder="Password *">
             <input id="sw-sn" class="swal2-input" placeholder="Họ tên *">
             <input id="sw-sr" class="swal2-input" value="Sale" placeholder="Quyền (Admin/Leader/Sale)">
             <input id="sw-st" class="swal2-input" placeholder="SĐT">`,
      showCancelButton: true,
      preConfirm: () => ({
        username: document.getElementById("sw-su").value.trim(),
        password: document.getElementById("sw-sp").value.trim(),
        fullName: document.getElementById("sw-sn").value.trim(),
        role: document.getElementById("sw-sr").value.trim() || "Sale",
        phone: document.getElementById("sw-st").value.trim()
      })
    });
    if (value && value.username && value.fullName) {
      await callApi("addNewStaff", [value]);
      syncAllData(false);
    }
  };
  document.querySelectorAll(".adm-del-st").forEach(btn => {
    btn.onclick = async () => {
      const name = btn.getAttribute("data-name");
      const ok = await Swal.fire({ title: `Xóa nhân viên "${name}"?`, icon: "warning", showCancelButton: true });
      if (!ok.isConfirmed) return;
      await callApi("deleteStaff", [name]);
      syncAllData(false);
    };
  });
}
