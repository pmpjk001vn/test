const APP_STATE = {
  user: null,
  activeTab: "order",
  syncing: false,
  syncTimer: null,
  data: {
    customers: [],
    products: [],
    staffs: [],
    strictStock: false,
    excludeMerge: []
  },
  histories: { hoaDon: [], hoanThanh: [], huyToa: [] },
  draftsCount: 0,
  invoiceConfig: Object.assign({}, DEFAULT_INVOICE_CONFIG),
  editingOrder: null,
  selectedDebtCustomer: null
};

const NAV_GROUPS = [
  {
    id: "grp-order",
    label: "Đặt Hàng",
    roles: ["Admin", "SAdmin", "Leader", "Sale"],
    items: [
      { id: "order", label: "Đặt Hàng Mới", roles: ["Admin", "SAdmin", "Leader", "Sale"] },
      { id: "drafts", label: "Đơn Lưu Tạm", roles: ["Admin", "SAdmin", "Leader", "Sale"], badgeKey: "drafts" },
      { id: "history", label: "Quản Lý Đơn Hàng", roles: ["Admin", "SAdmin", "Leader", "Sale"] }
    ]
  },
  {
    id: "grp-process",
    label: "Hóa Đơn",
    roles: ["Admin", "SAdmin"],
    items: [
      { id: "xulydh", label: "Xử Lý Đơn Hàng", roles: ["Admin", "SAdmin"], badgeKey: "pendingPrint" },
      { id: "lichSuHoaDon", label: "Lịch Sử Hóa Đơn", roles: ["Admin", "SAdmin"] }
    ]
  },
  {
    id: "grp-finance",
    label: "Công Nợ",
    roles: ["Admin", "SAdmin"],
    items: [
      { id: "lichSuCongNo", label: "Lịch Sử Công Nợ", roles: ["Admin", "SAdmin"] },
      { id: "thanhToan", label: "Thanh Toán / Thu Nợ", roles: ["Admin", "SAdmin"] },
      { id: "lichSuThanhToan", label: "Lịch Sử Thanh Toán", roles: ["Admin", "SAdmin"] }
    ]
  },
  {
    id: "grp-warehouse",
    label: "Kho Hàng",
    roles: ["Admin", "SAdmin"],
    items: [
      { id: "import", label: "Nhập Hàng Vào Kho", roles: ["Admin", "SAdmin"] },
      { id: "importHistory", label: "Lịch Sử Nhập Kho", roles: ["Admin", "SAdmin"] },
      { id: "searchImport", label: "Tra Cứu Phiếu Nhập", roles: ["Admin", "SAdmin"] },
      { id: "searchCompleted", label: "Tra Cứu Đơn Hoàn Thành", roles: ["Admin", "SAdmin"] }
    ]
  },
  {
    id: "grp-report",
    label: "Báo Cáo",
    roles: ["Admin", "SAdmin"],
    items: [
      { id: "searchHistory", label: "Tra Cứu Lịch Sử", roles: ["Admin", "SAdmin"] },
      { id: "report", label: "Báo Cáo Thống Kê", roles: ["Admin", "SAdmin"] }
    ]
  },
  {
    id: "grp-warranty",
    label: "Bảo Hành",
    roles: ["Admin", "SAdmin", "Leader", "Sale"],
    items: [
      { id: "baoHanh", label: "Bảo Hành (KBD)", roles: ["Admin", "SAdmin", "Leader", "Sale"] },
      { id: "lsBHKBD", label: "LS BH (KBD)", roles: ["Admin", "SAdmin", "Leader", "Sale"] },
      { id: "baoHanhBD", label: "Bảo Hành (+Kho)", roles: ["Admin", "SAdmin", "Leader", "Sale"] },
      { id: "lsBHBD", label: "LS BH (+Kho)", roles: ["Admin", "SAdmin", "Leader", "Sale"] }
    ]
  },
  {
    id: "grp-manage",
    label: "Quản Lý",
    roles: ["Admin", "SAdmin"],
    items: [
      { id: "customers", label: "Quản Lý Khách Hàng", roles: ["Admin", "SAdmin"] },
      { id: "products", label: "Quản Lý Sản Phẩm", roles: ["Admin", "SAdmin"] },
      { id: "admin", label: "Quản Trị & Cấu Hình", roles: ["Admin", "SAdmin"] }
    ]
  }
];

function getBadges() {
  const pendingPrint = (APP_STATE.histories.hoaDon || []).filter(h => h.status === "Đã in").length;
  return { drafts: APP_STATE.draftsCount || 0, pendingPrint: pendingPrint };
}

function renderNavigation() {
  const role = APP_STATE.user?.role || "Sale";
  const isAdmin = role === "Admin" || role === "SAdmin";
  const badges = getBadges();

  const deskNav = document.getElementById("desktop-nav");
  const sideBtn = document.getElementById("btn-sidebar");
  if (isAdmin) {
    deskNav.classList.add("show-admin");
    sideBtn.classList.add("hide-desktop");
  } else {
    deskNav.classList.remove("show-admin");
    sideBtn.classList.remove("hide-desktop");
  }

  deskNav.innerHTML = NAV_GROUPS.filter(g => g.roles.includes(role)).map(grp => {
    const visibleItems = grp.items.filter(it => it.roles.includes(role));
    const grpBadge = visibleItems.reduce((sum, it) => sum + (it.badgeKey ? badges[it.badgeKey] || 0 : 0), 0);
    return `<div class="nav-dd">
      <button type="button" class="nav-dd-btn">${grp.label} ${grpBadge > 0 ? `<span class="badge red">${grpBadge}</span>` : ""} ▾</button>
      <div class="nav-dd-menu">
        ${visibleItems.map(it => {
          const b = it.badgeKey ? badges[it.badgeKey] || 0 : 0;
          return `<button type="button" class="nav-dd-item" data-tab="${it.id}">
            <span>${it.label}</span>
            ${b > 0 ? `<span class="badge ${it.badgeKey === "pendingPrint" ? "red" : ""}">${b}</span>` : ""}
          </button>`;
        }).join("")}
      </div>
    </div>`;
  }).join("");

  const sb = document.getElementById("mobile-sidebar");
  sb.innerHTML = `<div style="font-weight:700;padding:6px 4px;border-bottom:1px solid #e2e8f0">MENU HỆ THỐNG</div>` +
    NAV_GROUPS.filter(g => g.roles.includes(role)).map(grp => {
      const visibleItems = grp.items.filter(it => it.roles.includes(role));
      return `<div>
        <button type="button" class="sb-group-title">${grp.label} ▾</button>
        <div>
          ${visibleItems.map(it => {
            const b = it.badgeKey ? badges[it.badgeKey] || 0 : 0;
            const active = APP_STATE.activeTab === it.id ? "active" : "";
            return `<button type="button" class="sb-item ${active}" data-tab="${it.id}">
              <span>${it.label}</span>
              ${b > 0 ? `<span class="badge">${b}</span>` : ""}
            </button>`;
          }).join("")}
        </div>
      </div>`;
    }).join("");

  document.querySelectorAll("[data-tab]").forEach(el => {
    el.onclick = () => {
      switchTab(el.getAttribute("data-tab"));
      closeSidebar();
    };
  });
}

function switchTab(tabId) {
  APP_STATE.activeTab = tabId;
  renderNavigation();
  renderCurrentTab();
}

function openSidebar() {
  document.getElementById("sidebar-backdrop").classList.remove("hidden");
  document.getElementById("mobile-sidebar").classList.remove("hidden");
}

function closeSidebar() {
  document.getElementById("sidebar-backdrop").classList.add("hidden");
  document.getElementById("mobile-sidebar").classList.add("hidden");
}

async function syncAllData(loadAllHistory = false) {
  if (!APP_STATE.user || APP_STATE.syncing) return;
  APP_STATE.syncing = true;
  const syncBtn = document.getElementById("btn-sync");
  if (syncBtn) syncBtn.textContent = "⏳";

  try {
    const u = APP_STATE.user;
    const isAdmin = u.role === "Admin" || u.role === "SAdmin";
    const [base, hist, drafts, invCfg] = await Promise.all([
      callApi("getDataForApp"),
      callApi("getAllHistories", [u.fullName, u.role, loadAllHistory]),
      isAdmin ? callApi("getAllDrafts") : callApi("getMyDrafts", [u.fullName]),
      callApi("loadInvoiceConfig").catch(() => null)
    ]);

    if (base) {
  APP_STATE.data = {
    customers: (base.customers || []).map(c => ({
      name: c.name || c.Ten_Khach || c.Ten_KH || "",
      phone: c.phone || c.SDT || "",
      address: c.address || c.Dia_Chi || "",
      debt: Number(c.debt ?? c.Cong_No ?? 0)
    })),
    products: (base.products || []).map((p, i) => ({
      code: p.code || p.Ma_SP || p.MSP || ("SP" + (i + 1)),
      name: p.name || p.Ten_San_Pham || p.Ten_SP || "",
      price: Number(p.price ?? p.Don_Gia ?? 0),
      stock: Number(p.stock ?? p.Ton_Kho ?? p.So_Luong ?? 0),
      category: p.category || p.Nhom || "Khác"
    })),
    staffs: (base.staffs || []).map(s => ({
      username: s.username || s.id || "",
      fullName: s.fullName || s.name || "",
      role: s.role || "Sale",
      phone: s.phone || ""
    })),
    strictStock: Boolean(base.strictStock),
    excludeMerge: base.excludeMerge || []
  };
}
    if (hist) APP_STATE.histories = hist;
    if (Array.isArray(drafts)) APP_STATE.draftsCount = drafts.length;
    if (invCfg) APP_STATE.invoiceConfig = Object.assign({}, DEFAULT_INVOICE_CONFIG, invCfg);

    renderNavigation();
    renderCurrentTab();
  } catch (err) {
    console.error("Sync lỗi:", err);
  } finally {
    APP_STATE.syncing = false;
    if (syncBtn) syncBtn.textContent = "↻";
  }
}

function renderCurrentTab() {
  const main = document.getElementById("main-view");
  const tab = APP_STATE.activeTab;

  if (tab === "order" || tab === "drafts") {
    renderOrderOrDraftTab(main, tab);
  } else if (tab === "history" || tab === "xulydh" || tab === "lichSuHoaDon") {
    renderHistoryAndProcessTab(main, tab);
  } else if (
    tab === "lichSuCongNo" || tab === "thanhToan" || tab === "lichSuThanhToan" ||
    tab === "import" || tab === "importHistory" || tab === "searchImport" || tab === "searchCompleted" ||
    tab === "searchHistory" || tab === "report"
  ) {
    renderFinanceWarehouseReportTab(main, tab);
  } else {
    renderWarrantyAndAdminTab(main, tab);
  }
}

function startApp(userObj) {
  APP_STATE.user = userObj;
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  document.getElementById("user-name").textContent = userObj.fullName;
  document.getElementById("role-badge").textContent = userObj.role;

  renderNavigation();
  renderCurrentTab();
  syncAllData(false);

  if (APP_STATE.syncTimer) clearInterval(APP_STATE.syncTimer);
  APP_STATE.syncTimer = setInterval(() => {
    if (!document.hidden) syncAllData(false);
  }, 30000);
}

document.getElementById("btn-sidebar").onclick = openSidebar;
document.getElementById("sidebar-backdrop").onclick = closeSidebar;
document.getElementById("modal-backdrop").onclick = (e) => {
  if (e.target.id === "modal-backdrop") closeModal();
};
document.getElementById("brand-home").onclick = () => switchTab("order");
document.getElementById("btn-sync").onclick = () => syncAllData(false);
document.getElementById("btn-logout").onclick = async () => {
  if (APP_STATE.user?.token) callApi("logoutUser", [APP_STATE.user.token]).catch(() => {});
  clearAuthSession();
  if (APP_STATE.syncTimer) clearInterval(APP_STATE.syncTimer);
  APP_STATE.user = null;
  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
};

initAuth((userObj) => startApp(userObj));
