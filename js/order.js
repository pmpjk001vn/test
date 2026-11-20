const ORDER_UI = {
  saleName: "",
  saleInitialized: false,
  customer: null,
  custQuery: "",
  showCustList: false,
  prodQuery: "",
  multiChecked: {},
  cart: [],
  draftId: null,
  orderId: null,
  draftsList: []
};

function renderOrderOrDraftTab(container, tab) {
  const u = APP_STATE.user;
  if (!ORDER_UI.saleInitialized) {
    ORDER_UI.saleName = u.role === "Sale" ? u.fullName : "";
    ORDER_UI.saleInitialized = true;
  }

  if (APP_STATE.editingOrder) {
    const ed = APP_STATE.editingOrder;
    const found = APP_STATE.data.customers.find(c => c.name === ed.customerName);
    ORDER_UI.customer = found || {
      name: ed.customerName || "",
      phone: ed.phone || "",
      address: ed.address || "",
      debt: 0
    };
    ORDER_UI.custQuery = ORDER_UI.customer.name;
    ORDER_UI.cart = (ed.items || []).map(it => Object.assign({}, it));
    ORDER_UI.saleName = ed.saleName || "";
    if (ed.isDraft) {
      ORDER_UI.draftId = ed.draftId || ed.id;
      ORDER_UI.orderId = null;
    } else {
      ORDER_UI.orderId = ed.id;
      ORDER_UI.draftId = null;
    }
    APP_STATE.editingOrder = null;
  }

  if (tab === "drafts") {
    renderDraftsView(container);
    return;
  }
  renderOrderView(container);
}

function renderOrderView(container) {
  const isAdmin = APP_STATE.user.role === "Admin" || APP_STATE.user.role === "SAdmin";
  const saleObj = ORDER_UI.saleName
    ? APP_STATE.data.staffs.find(s => s.fullName === ORDER_UI.saleName)
    : null;

  const qCust = bodau(ORDER_UI.custQuery);
  const custMatches = !qCust
    ? APP_STATE.data.customers.slice(0, 25)
    : APP_STATE.data.customers
        .filter(c => bodau(c.name).includes(qCust) || bodau(c.phone).includes(qCust))
        .slice(0, 30);

  const qProd = bodau(ORDER_UI.prodQuery);
  const prodMatches = !qProd
    ? []
    : APP_STATE.data.products
        .filter(p => bodau(p.name).includes(qProd) || bodau(p.code).includes(qProd))
        .slice(0, 40);

  const totalCart = ORDER_UI.cart.reduce((sum, it) => {
    return sum + Number(it.price || 0) * (1 - Number(it.ck || 0) / 100) * Number(it.qty || 0);
  }, 0);

  const checkedCodes = Object.keys(ORDER_UI.multiChecked).filter(k => ORDER_UI.multiChecked[k]);

  container.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="margin:0;color:var(--blue)">${ORDER_UI.orderId ? `Sửa Đơn Hàng: ${ORDER_UI.orderId}` : "Đặt Hàng Mới"}</h2>
        ${ORDER_UI.orderId ? `<button type="button" id="btn-cancel-edit-order" class="btn btn-outline btn-sm">Hủy sửa</button>` : ""}
      </div>

      ${isAdmin ? `<div class="grid-2" style="background:#eff6ff;padding:10px;border-radius:10px;margin-bottom:12px">
        <div>
          <label class="muted"><b>Nhân viên Sale lên đơn</b></label>
          <div style="display:flex;gap:6px;margin-top:4px;align-items:center">
            <select id="ord-sale-select" class="input" style="flex:1">
              <option value="" ${!ORDER_UI.saleName ? "selected" : ""}>-- Không chọn Sale --</option>
              ${APP_STATE.data.staffs.map(s => `<option value="${s.fullName}" ${s.fullName === ORDER_UI.saleName ? "selected" : ""}>${s.fullName} (${s.role})</option>`).join("")}
            </select>
            ${ORDER_UI.saleName ? `<button type="button" id="btn-clear-sale" class="btn btn-outline btn-sm" title="Bỏ chọn Sale" style="padding:10px 12px;color:var(--red)">✕</button>` : ""}
          </div>
        </div>
        <div style="display:flex;align-items:flex-end;padding-bottom:6px">
          <div>SĐT Sale: <b style="color:var(--blue)">${saleObj?.phone || (ORDER_UI.saleName ? "Chưa cập nhật" : "---")}</b></div>
        </div>
      </div>` : ""}

      <div style="position:relative">
        <label class="muted"><b>Khách hàng *</b></label>
        <div style="display:flex;gap:6px;margin-top:4px;align-items:center">
          <input id="ord-cust-input" type="text" class="input" style="flex:1"
            value="${ORDER_UI.custQuery.replace(/"/g, "&quot;")}"
            placeholder="Gõ tên khách hàng hoặc SĐT (không dấu)..." autocomplete="off" />
          ${ORDER_UI.custQuery || ORDER_UI.customer ? `<button type="button" id="btn-clear-cust" class="btn btn-outline btn-sm" title="Xóa chọn khách" style="padding:10px 12px;color:var(--red)">✕</button>` : ""}
        </div>

        ${ORDER_UI.showCustList ? `<div id="ord-cust-dropdown" class="dropdown-list">
          ${APP_STATE.data.customers.length === 0
            ? `<div class="dropdown-item muted">Chưa tải được dữ liệu khách hàng (kiểm tra tên cột sheet Khach_Hang)</div>`
            : custMatches.length === 0
            ? `<div class="dropdown-item muted">Không tìm thấy khách hàng phù hợp</div>`
            : custMatches.map((c, idx) => `<div class="dropdown-item" data-cidx="${idx}">
                <div>
                  <div><b>${c.name}</b></div>
                  <div class="muted">${c.phone || ""} ${c.address ? " - " + c.address : ""}</div>
                </div>
                <div style="color:var(--red);font-weight:700;white-space:nowrap">Nợ: ${formatMoney(c.debt)}đ</div>
              </div>`).join("")}
        </div>` : ""}
      </div>

      ${ORDER_UI.customer ? `<div class="grid-2" style="background:#f8fafc;padding:10px;border-radius:10px;border:1px solid var(--border);margin-top:10px">
        <div><span class="muted">SĐT:</span> <b>${ORDER_UI.customer.phone || "---"}</b></div>
        <div><span class="muted">ĐC:</span> <b>${ORDER_UI.customer.address || "---"}</b></div>
        <div><span class="muted">Công nợ cũ:</span> <b style="color:${Number(ORDER_UI.customer.debt) > 0 ? "var(--red)" : "var(--green)"}">${formatMoney(ORDER_UI.customer.debt)} đ</b></div>
      </div>` : ""}
    </div>

    <div class="card">
      <div style="display:flex;gap:6px;align-items:center">
        <input id="ord-prod-input" type="text" class="input" style="flex:1"
          value="${ORDER_UI.prodQuery.replace(/"/g, "&quot;")}"
          placeholder="Gõ tên sản phẩm hoặc mã SP để tìm (hỗ trợ không dấu)..." autocomplete="off" />
        ${ORDER_UI.prodQuery ? `<button type="button" id="btn-clear-prod" class="btn btn-outline btn-sm" title="Đóng tìm kiếm" style="padding:10px 12px;color:var(--red)">✕</button>` : ""}
      </div>

      ${ORDER_UI.prodQuery.trim() ? `<div class="dropdown-list">
        ${prodMatches.length === 0 ? `<div class="dropdown-item muted">Không tìm thấy sản phẩm phù hợp</div>` :
          prodMatches.map(p => {
            const st = Number(p.stock || 0);
            const pillCls = st <= 0 ? "stock-out" : st < 10 ? "stock-low" : "stock-ok";
            const checked = ORDER_UI.multiChecked[p.code] ? "checked" : "";
            return `<div class="dropdown-item">
              <input type="checkbox" class="ord-multi-cb" data-code="${p.code}" ${checked} style="width:18px;height:18px" />
              <div class="ord-add-prod" data-code="${p.code}" style="flex:1;min-width:0">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
                <div style="margin-top:3px;font-size:13px">
                  <b style="color:var(--blue)">${formatMoney(p.price)} đ</b>
                  <span class="stock-pill ${pillCls}">Kho: ${st}</span>
                </div>
              </div>
              <button type="button" class="btn btn-primary btn-sm ord-add-prod" data-code="${p.code}">+ Thêm</button>
            </div>`;
          }).join("")}
      </div>` : ""}
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Giỏ Hàng (${ORDER_UI.cart.length} món)</h3>
        <div style="font-size:18px;font-weight:700;color:var(--blue)">Tổng: ${formatMoney(totalCart)} đ</div>
      </div>

      ${ORDER_UI.cart.length === 0 ? `<div class="muted text-center" style="padding:20px">Chưa có sản phẩm nào trong giỏ</div>` :
        ORDER_UI.cart.map((it, idx) => {
          const line = Number(it.price || 0) * (1 - Number(it.ck || 0) / 100) * Number(it.qty || 0);
          return `<div style="border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:10px;background:#f8fafc">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <b>${it.name}</b>
              <button type="button" class="btn btn-danger btn-sm ord-del-item" data-idx="${idx}">Xóa</button>
            </div>
            <div class="grid-2" style="margin-top:8px">
              <div><label class="muted">Số lượng</label><input type="number" step="any" class="input ord-item-qty" data-idx="${idx}" value="${it.qty}" /></div>
              <div><label class="muted">Đơn giá</label><input type="number" class="input ord-item-price" data-idx="${idx}" value="${it.price}" /></div>
              <div><label class="muted">CK (%)</label><input type="number" class="input ord-item-ck" data-idx="${idx}" value="${it.ck || 0}" /></div>
              <div><label class="muted">Thành tiền</label><div style="padding:10px 4px;font-weight:700;color:var(--blue)">${formatMoney(line)} đ</div></div>
            </div>
            <div style="margin-top:8px">
              <button type="button" class="btn btn-outline btn-sm ord-note-btn" data-idx="${idx}">✎ ${it.note ? it.note : "Thêm ghi chú..."}</button>
            </div>
          </div>`;
        }).join("")}

      <div class="grid-2" style="margin-top:12px">
        <button type="button" id="btn-save-draft" class="btn btn-warning">Lưu Tạm</button>
        <button type="button" id="btn-confirm-order" class="btn btn-primary">${ORDER_UI.orderId ? "Cập Nhật Đơn" : "Xác Nhận Lưu Đơn"}</button>
      </div>
    </div>

    ${checkedCodes.length > 0 ? `<button type="button" id="fab-multi-ok" class="fab-ok">OK - Thêm (${checkedCodes.length}) SP</button>` : ""}
  `;

  bindOrderEvents(custMatches);
}

function addProdByCode(code, keepSearch = false) {
  const prod = APP_STATE.data.products.find(p => p.code === code);
  if (!prod) return;
  const stock = Number(prod.stock || 0);
  if (APP_STATE.data.strictStock && stock <= 0) {
    return Swal.fire("Hết hàng", `Sản phẩm "${prod.name}" đã hết tồn kho!`, "warning");
  }
  const idx = ORDER_UI.cart.findIndex(it => it.code === prod.code && !it.note);
  if (idx > -1) {
    const nextQ = Number(ORDER_UI.cart[idx].qty || 0) + 1;
    if (APP_STATE.data.strictStock && nextQ > stock) {
      return Swal.fire("Vượt tồn kho", `Tồn kho chỉ còn ${stock}`, "warning");
    }
    ORDER_UI.cart[idx].qty = nextQ;
  } else {
    ORDER_UI.cart.push({
      code: prod.code,
      name: prod.name,
      price: Number(prod.price || 0),
      qty: 1,
      ck: 0,
      note: "",
      maxStock: stock
    });
  }
  if (!keepSearch) {
    ORDER_UI.prodQuery = "";
    renderOrderView(document.getElementById("main-view"));
  }
}

function bindOrderEvents(custMatches) {
  const saleSel = document.getElementById("ord-sale-select");
  if (saleSel) {
    saleSel.onchange = (e) => {
      ORDER_UI.saleName = e.target.value;
      renderOrderView(document.getElementById("main-view"));
    };
  }

  const clearSaleBtn = document.getElementById("btn-clear-sale");
  if (clearSaleBtn) {
    clearSaleBtn.onclick = () => {
      ORDER_UI.saleName = "";
      renderOrderView(document.getElementById("main-view"));
    };
  }

  const cancelEdit = document.getElementById("btn-cancel-edit-order");
  if (cancelEdit) {
    cancelEdit.onclick = () => {
      ORDER_UI.orderId = null;
      ORDER_UI.cart = [];
      renderOrderView(document.getElementById("main-view"));
    };
  }

  const custInp = document.getElementById("ord-cust-input");
  custInp.onfocus = () => {
    if (!ORDER_UI.showCustList) {
      ORDER_UI.showCustList = true;
      renderOrderView(document.getElementById("main-view"));
      const nextInp = document.getElementById("ord-cust-input");
      if (nextInp) {
        nextInp.focus();
        nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
      }
    }
  };
  custInp.oninput = (e) => {
    ORDER_UI.custQuery = e.target.value;
    ORDER_UI.showCustList = true;
    renderOrderView(document.getElementById("main-view"));
    const nextInp = document.getElementById("ord-cust-input");
    if (nextInp) {
      nextInp.focus();
      nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
    }
  };

  const clearCustBtn = document.getElementById("btn-clear-cust");
  if (clearCustBtn) {
    clearCustBtn.onclick = () => {
      ORDER_UI.customer = null;
      ORDER_UI.custQuery = "";
      ORDER_UI.showCustList = false;
      renderOrderView(document.getElementById("main-view"));
    };
  }

  document.querySelectorAll("[data-cidx]").forEach(el => {
    el.onmousedown = (e) => {
      e.preventDefault();
      const c = custMatches[Number(el.getAttribute("data-cidx"))];
      if (c) {
        ORDER_UI.customer = c;
        ORDER_UI.custQuery = c.name;
        ORDER_UI.showCustList = false;
        renderOrderView(document.getElementById("main-view"));
      }
    };
  });

  const prodInp = document.getElementById("ord-prod-input");
  prodInp.oninput = (e) => {
    ORDER_UI.prodQuery = e.target.value;
    renderOrderView(document.getElementById("main-view"));
    const nextInp = document.getElementById("ord-prod-input");
    if (nextInp) {
      nextInp.focus();
      nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
    }
  };

  const clearProdBtn = document.getElementById("btn-clear-prod");
  if (clearProdBtn) {
    clearProdBtn.onclick = () => {
      ORDER_UI.prodQuery = "";
      renderOrderView(document.getElementById("main-view"));
    };
  }

  document.querySelectorAll(".ord-multi-cb").forEach(cb => {
    cb.onchange = (e) => {
      ORDER_UI.multiChecked[cb.getAttribute("data-code")] = e.target.checked;
      renderOrderView(document.getElementById("main-view"));
    };
  });

  document.querySelectorAll(".ord-add-prod").forEach(el => {
    el.onclick = () => addProdByCode(el.getAttribute("data-code"), false);
  });

  const fabOk = document.getElementById("fab-multi-ok");
  if (fabOk) {
    fabOk.onclick = () => {
      Object.keys(ORDER_UI.multiChecked).forEach(code => {
        if (ORDER_UI.multiChecked[code]) addProdByCode(code, true);
      });
      ORDER_UI.multiChecked = {};
      ORDER_UI.prodQuery = "";
      renderOrderView(document.getElementById("main-view"));
    };
  }

  document.querySelectorAll(".ord-del-item").forEach(btn => {
    btn.onclick = () => {
      ORDER_UI.cart.splice(Number(btn.getAttribute("data-idx")), 1);
      renderOrderView(document.getElementById("main-view"));
    };
  });

  document.querySelectorAll(".ord-item-qty").forEach(inp => {
    inp.onchange = (e) => {
      const i = Number(inp.getAttribute("data-idx"));
      let v = Math.max(0.1, Number(e.target.value) || 0);
      if (APP_STATE.data.strictStock && ORDER_UI.cart[i].maxStock && v > ORDER_UI.cart[i].maxStock) {
        Swal.fire("Vượt tồn kho", `Tối đa ${ORDER_UI.cart[i].maxStock}`, "warning");
        v = ORDER_UI.cart[i].maxStock;
      }
      ORDER_UI.cart[i].qty = v;
      renderOrderView(document.getElementById("main-view"));
    };
  });

  document.querySelectorAll(".ord-item-price").forEach(inp => {
    inp.onchange = (e) => {
      ORDER_UI.cart[Number(inp.getAttribute("data-idx"))].price = Math.max(0, Number(e.target.value) || 0);
      renderOrderView(document.getElementById("main-view"));
    };
  });

  document.querySelectorAll(".ord-item-ck").forEach(inp => {
    inp.onchange = (e) => {
      ORDER_UI.cart[Number(inp.getAttribute("data-idx"))].ck = Math.max(0, Number(e.target.value) || 0);
      renderOrderView(document.getElementById("main-view"));
    };
  });

  document.querySelectorAll(".ord-note-btn").forEach(btn => {
    btn.onclick = async () => {
      const i = Number(btn.getAttribute("data-idx"));
      const { value } = await Swal.fire({
        title: "Ghi chú sản phẩm",
        input: "text",
        inputValue: ORDER_UI.cart[i].note || "",
        showCancelButton: true
      });
      if (value !== undefined) {
        ORDER_UI.cart[i].note = value;
        renderOrderView(document.getElementById("main-view"));
      }
    };
  });

  document.getElementById("btn-save-draft").onclick = async () => {
    if (!ORDER_UI.customer) return Swal.fire("Chưa chọn khách", "Vui lòng chọn khách hàng", "warning");
    if (!ORDER_UI.cart.length) return Swal.fire("Giỏ trống", "Vui lòng chọn sản phẩm", "warning");
    try {
      await callApi("saveDraftToSheet", [
        ORDER_UI.saleName || APP_STATE.user.fullName,
        ORDER_UI.customer.name,
        JSON.stringify({ customer: ORDER_UI.customer, items: ORDER_UI.cart, saleName: ORDER_UI.saleName }),
        ORDER_UI.draftId || ""
      ]);
      Swal.fire("Đã lưu", "Đã lưu đơn vào Toa_Tam!", "success");
      ORDER_UI.cart = [];
      ORDER_UI.draftId = null;
      syncAllData(false);
    } catch (err) {
      Swal.fire("Lỗi", err.message, "error");
    }
  };

  document.getElementById("btn-confirm-order").onclick = async () => {
    if (!ORDER_UI.customer) return Swal.fire("Chưa chọn khách", "Vui lòng chọn khách hàng", "warning");
    if (!ORDER_UI.cart.length) return Swal.fire("Giỏ trống", "Vui lòng chọn sản phẩm", "warning");
    try {
      if (ORDER_UI.orderId) {
        await callApi("updateOrder", [ORDER_UI.orderId, { customer: ORDER_UI.customer, items: ORDER_UI.cart }]);
        Swal.fire("Thành công", `Đã cập nhật đơn ${ORDER_UI.orderId}`, "success");
      } else {
        await callApi("saveOrder", [{
          customer: ORDER_UI.customer,
          saleFullName: ORDER_UI.saleName,
          items: ORDER_UI.cart
        }]);
        Swal.fire("Thành công", "Đã lưu đơn hàng mới!", "success");
      }
      ORDER_UI.cart = [];
      ORDER_UI.orderId = null;
      ORDER_UI.draftId = null;
      ORDER_UI.customer = null;
      ORDER_UI.custQuery = "";
      syncAllData(false);
    } catch (err) {
      Swal.fire("Lỗi", err.message, "error");
    }
  };
}

async function renderDraftsView(container) {
  container.innerHTML = `<div class="card muted">Đang tải danh sách đơn lưu tạm...</div>`;
  try {
    const u = APP_STATE.user;
    const isAdmin = u.role === "Admin" || u.role === "SAdmin";
    const list = await callApi(isAdmin ? "getAllDrafts" : "getMyDrafts", isAdmin ? [] : [u.fullName]);
    ORDER_UI.draftsList = list || [];
    APP_STATE.draftsCount = ORDER_UI.draftsList.length;
    renderNavigation();

    container.innerHTML = `<div class="card">
      <h2 style="margin:0 0 12px;color:var(--blue)">Đơn Lưu Tạm (${ORDER_UI.draftsList.length})</h2>
      ${ORDER_UI.draftsList.length === 0 ? `<div class="muted">Không có đơn tạm nào.</div>` :
        ORDER_UI.draftsList.map((d, i) => {
          let parsed = {};
          try { parsed = JSON.parse(d.cartJson || "{}"); } catch (e) {}
          const cnt = (parsed.items || []).length;
          return `<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <div>
              <div><b>${d.custName || "Khách lẻ"}</b> — <span class="badge">${cnt} món</span></div>
              <div class="muted">Sale: ${d.saleName || ""} | Mã: ${d.draftId}</div>
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn btn-primary btn-sm draft-load" data-i="${i}">Nạp vào đơn</button>
              <button type="button" class="btn btn-danger btn-sm draft-del" data-i="${i}">Xóa</button>
            </div>
          </div>`;
        }).join("")}
    </div>`;

    document.querySelectorAll(".draft-load").forEach(btn => {
      btn.onclick = () => {
        const d = ORDER_UI.draftsList[Number(btn.getAttribute("data-i"))];
        let parsed = {};
        try { parsed = JSON.parse(d.cartJson || "{}"); } catch (e) {}
        APP_STATE.editingOrder = {
          isDraft: true,
          draftId: d.draftId,
          customerName: parsed.customer?.name || d.custName,
          phone: parsed.customer?.phone || "",
          address: parsed.customer?.address || "",
          saleName: parsed.saleName || d.saleName,
          items: parsed.items || []
        };
        switchTab("order");
      };
    });

    document.querySelectorAll(".draft-del").forEach(btn => {
      btn.onclick = async () => {
        const d = ORDER_UI.draftsList[Number(btn.getAttribute("data-i"))];
        const ok = await Swal.fire({ title: "Xóa đơn tạm?", icon: "warning", showCancelButton: true });
        if (!ok.isConfirmed) return;
        await callApi("deleteDraftFromSheet", [d.saleName, d.draftId]);
        renderDraftsView(container);
      };
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--red)">Lỗi tải đơn tạm: ${err.message}</div>`;
  }
}
