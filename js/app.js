import React, { useState, useEffect, useCallback, useRef } from "react";
import { callApi } from "./services/api";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import OrderModule from "./modules/OrderModule";
import DraftsModule from "./modules/DraftsModule";
import HistoryModule from "./modules/HistoryModule";
import ProcessOrderModule from "./modules/ProcessOrderModule";
import DebtPaymentModule from "./modules/DebtPaymentModule";
import WarehouseModule from "./modules/WarehouseModule";
import ReportModule from "./modules/ReportModule";
import WarrantyModule from "./modules/WarrantyModule";
import AdminManageModule from "./modules/AdminManageModule";
import { DEFAULT_INVOICE_CONFIG } from "./config";

function normalizeBaseData(raw) {
  if (!raw) return { customers: [], products: [], staffs: [], strictStock: false, excludeMerge: [] };

  const customers = (raw.customers || []).map((c) => {
    if (Array.isArray(c)) {
      return { name: c[0] || "", phone: c[1] || "", address: c[2] || "", debt: Number(c[3] || 0) };
    }
    return {
      ...c,
      name: c.name || c.Ten_KH || c.tenKH || c.ten || c.Khach_Hang || c.customerName || "",
      phone: c.phone || c.SDT || c.sdt || c.Dien_Thoai || c.soDienThoai || "",
      address: c.address || c.Dia_Chi || c.diaChi || c.DC || "",
      debt: Number(c.debt ?? c.Cong_No ?? c.congNo ?? c.No_Cu ?? c.noCu ?? 0),
    };
  });

  const products = (raw.products || []).map((p, idx) => {
    if (Array.isArray(p)) {
      return {
        code: p[0] || `SP${idx + 1}`,
        name: p[1] || p[0] || "",
        price: Number(p[2] || 0),
        stock: Number(p[3] || 0),
        category: p[4] || "Khác",
      };
    }
    return {
      ...p,
      code: p.code || p.Ma_SP || p.maSP || p.ma || p.id || `SP${idx + 1}`,
      name: p.name || p.Ten_SP || p.tenSP || p.ten || p.San_Pham || "",
      price: Number(p.price ?? p.Don_Gia ?? p.donGia ?? p.Gia_Ban ?? p.gia ?? 0),
      stock: Number(p.stock ?? p.Ton_Kho ?? p.tonKho ?? p.SL_Ton ?? p.ton ?? 0),
      category: p.category || p.Nhom_Hang || p.nhomHang || p.loai || "Khác",
    };
  });

  const staffs = (raw.staffs || []).map((s) => {
    if (Array.isArray(s)) {
      return { username: s[0] || "", fullName: s[2] || s[0] || "", role: s[3] || "Sale", phone: s[4] || "" };
    }
    return {
      ...s,
      fullName: s.fullName || s.Ho_Ten || s.hoTen || s.Ten_NV || s.ten || s.username || "",
      role: s.role || s.Quyen || s.quyen || s.Vai_Tro || "Sale",
      phone: s.phone || s.SDT || s.sdt || "",
    };
  });

  return {
    customers,
    products,
    staffs,
    strictStock: Boolean(raw.strictStock),
    excludeMerge: raw.excludeMerge || [],
  };
}

function normalizeHistories(rawHist) {
  if (!rawHist) return { hoaDon: [], hoanThanh: [], huyToa: [] };
  const mapOrder = (o) => ({
    ...o,
    id: o.id || o.Ma_HD || o.maHD || o.Ma_Don || "",
    date: o.date || o.Ngay || o.ngay || o.Thoi_Gian || "",
    customerName: o.customerName || o.Ten_KH || o.Khach_Hang || o.khachHang || "",
    saleName: o.saleName || o.Ten_Sale || o.Sale || o.Nhan_Vien || "",
    phone: o.phone || o.SDT || "",
    address: o.address || o.Dia_Chi || "",
    totalAmount: Number(o.totalAmount ?? o.Tong_Tien ?? o.Tien_Hang ?? 0),
    oldDebt: Number(o.oldDebt ?? o.No_Cu ?? 0),
    paidAmount: Number(o.paidAmount ?? o.Thanh_Toan ?? o.Tra_Truoc ?? 0),
    directDiscount: Number(o.directDiscount ?? o.Chiet_Khau ?? 0),
    grandTotal: Number(o.grandTotal ?? o.Tong_Cong ?? o.totalAmount ?? 0),
    status: o.status || o.Trang_Thai || "Chờ in",
    items: (o.items || []).map((it) => ({
      ...it,
      code: it.code || it.Ma_SP || "",
      name: it.name || it.Ten_SP || "",
      qty: Number(it.qty ?? it.SL ?? it.So_Luong ?? 0),
      price: Number(it.price ?? it.Don_Gia ?? 0),
      ck: Number(it.ck ?? it.CK ?? 0),
      note: it.note || it.Ghi_Chu || "",
    })),
  });

  return {
    hoaDon: (rawHist.hoaDon || []).map(mapOrder),
    hoanThanh: (rawHist.hoanThanh || []).map(mapOrder),
    huyToa: (rawHist.huyToa || []).map(mapOrder),
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("order");
  const [syncing, setSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const [appData, setAppData] = useState({
    customers: [],
    products: [],
    staffs: [],
    strictStock: false,
    excludeMerge: [],
  });
  const [histories, setHistories] = useState({ hoaDon: [], hoanThanh: [], huyToa: [] });
  const [draftsCount, setDraftsCount] = useState(0);
  const [invoiceConfig, setInvoiceConfig] = useState(DEFAULT_INVOICE_CONFIG);

  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedDebtCustomer, setSelectedDebtCustomer] = useState(null);

  const syncAllData = useCallback(async (currentUser = user, loadAllHistory = false) => {
    if (!currentUser || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncing(true);
    try {
      const [base, hist, drafts, invCfg] = await Promise.all([
        callApi("getDataForApp"),
        callApi("getAllHistories", [currentUser.fullName, currentUser.role, loadAllHistory]),
        currentUser.role === "Admin" || currentUser.role === "SAdmin"
          ? callApi("getAllDrafts")
          : callApi("getMyDrafts", [currentUser.fullName]),
        callApi("loadInvoiceConfig").catch(() => null),
      ]);

      if (base) setAppData(normalizeBaseData(base));
      if (hist) setHistories(normalizeHistories(hist));
      if (Array.isArray(drafts)) setDraftsCount(drafts.length);
      if (invCfg) setInvoiceConfig((prev) => ({ ...prev, ...invCfg }));
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      isSyncingRef.current = false;
      setSyncing(false);
    }
  }, [user]);

  // Chỉ tải dữ liệu 1 lần khi đăng nhập (không chạy ngầm 30s làm đứng máy giữa chừng)
  useEffect(() => {
    if (!user) return;
    syncAllData(user);
  }, [user, syncAllData]);

  const handleLogout = async () => {
    if (user?.token) {
      callApi("logoutUser", [user.token]).catch(() => {});
    }
    localStorage.removeItem("ad_auth");
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  const pendingPrintCount = (histories.hoaDon || []).filter((h) => h.status === "Đã in").length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        badges={{ drafts: draftsCount, pendingPrint: pendingPrintCount }}
        onLogout={handleLogout}
        onManualSync={() => syncAllData(user)}
        syncing={syncing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        {activeTab === "order" && (
          <OrderModule
            user={user}
            appData={appData}
            editingOrder={editingOrder}
            clearEditingOrder={() => setEditingOrder(null)}
            onOrderSaved={() => syncAllData(user)}
          />
        )}

        {activeTab === "drafts" && (
          <DraftsModule
            user={user}
            onLoadDraft={(draftData) => {
              setEditingOrder({ ...draftData, isDraft: true });
              setActiveTab("order");
            }}
            onRefresh={() => syncAllData(user)}
          />
        )}

        {activeTab === "history" && (
          <HistoryModule
            user={user}
            appData={appData}
            hoaDon={histories.hoaDon || []}
            onEditOrder={(order) => {
              setEditingOrder({ ...order, isDraft: false });
              setActiveTab("order");
            }}
            onLoadAll={() => syncAllData(user, true)}
            onRefresh={() => syncAllData(user)}
          />
        )}

        {(activeTab === "xulydh" || activeTab === "lichSuHoaDon") && (
          <ProcessOrderModule
            mode={activeTab}
            user={user}
            appData={appData}
            histories={histories}
            invoiceConfig={invoiceConfig}
            onRefresh={() => syncAllData(user)}
          />
        )}

        {(activeTab === "lichSuCongNo" || activeTab === "thanhToan" || activeTab === "lichSuThanhToan") && (
          <DebtPaymentModule
            mode={activeTab}
            user={user}
            customers={appData.customers}
            initialCustomer={selectedDebtCustomer}
            onGoToPayment={(cust) => {
              setSelectedDebtCustomer(cust);
              setActiveTab("thanhToan");
            }}
            onRefresh={() => syncAllData(user)}
          />
        )}

        {(activeTab === "import" || activeTab === "importHistory" || activeTab === "searchImport" || activeTab === "searchCompleted") && (
          <WarehouseModule
            mode={activeTab}
            user={user}
            products={appData.products}
            onRefresh={() => syncAllData(user)}
          />
        )}

        {(activeTab === "searchHistory" || activeTab === "report") && (
          <ReportModule
            mode={activeTab}
            user={user}
            appData={appData}
            histories={histories}
          />
        )}

        {(activeTab === "baoHanh" || activeTab === "lsBHKBD" || activeTab === "baoHanhBD" || activeTab === "lsBHBD") && (
          <WarrantyModule
            mode={activeTab}
            user={user}
            customers={appData.customers}
            products={appData.products}
            onRefresh={() => syncAllData(user)}
          />
        )}

        {(activeTab === "customers" || activeTab === "products" || activeTab === "admin") && (
          <AdminManageModule
            mode={activeTab}
            user={user}
            appData={appData}
            invoiceConfig={invoiceConfig}
            onUpdateInvoiceConfig={setInvoiceConfig}
            onRefresh={() => syncAllData(user)}
          />
        )}
      </main>
    </div>
  );
}
