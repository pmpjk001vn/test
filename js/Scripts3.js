// ===== BÁO CÁO THỐNG KÊ =====
function showReport(type) {
  showPage('report');
  document.querySelector('input[name="reportType"][value="'+type+'"]').checked = true;
  if(!db.history) {
    document.getElementById('reportRevenueWrap').innerHTML = 'Đang tải dữ liệu...';
    loadHist(); 
    setTimeout(renderReport, 2000);
  } else {
    renderReport();
  }
}

function setReportDateMode(mode, btn) {
  reportDateMode = mode;
  document.querySelectorAll('.r-sdbtn').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  const cr = document.getElementById('reportCustomRange');
  cr.style.display = (mode === 'custom') ? 'flex' : 'none';
  if (mode !== 'custom') {
    document.getElementById('reportDateFrom').value = '';
    document.getElementById('reportDateTo').value = '';
  }
  // Bỏ auto-reset để tránh lỗi nhảy trang, chỉ reset khi người dùng chủ động bấm lọc ngày
  currentStorePage = 1;
  isViewingStoreDetail = false;
  renderReport();
}

function checkReportDate(orderDateMs) {
  const now = new Date();
  const d = new Date(orderDateMs);
  if (isNaN(d.getTime())) return false;
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;

  if (reportDateMode === 'all') return true;
  if (reportDateMode === 'today') {
    return orderDateMs >= startOfToday && orderDateMs <= endOfToday;
  }
  if (reportDateMode === 'yesterday') {
    const startYest = startOfToday - 86400000;
    const endYest = startYest + 86400000 - 1;
    return orderDateMs >= startYest && orderDateMs <= endYest;
  }
  if (reportDateMode === 'week') {
    const startWeek = startOfToday - (6 * 86400000);
    return orderDateMs >= startWeek && orderDateMs <= endOfToday;
  }
  if (reportDateMode === 'month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (reportDateMode === 'custom') {
    const from = document.getElementById('reportDateFrom').value;
    const to = document.getElementById('reportDateTo').value;
    if (from) {
      const f = new Date(from).getTime();
      if (orderDateMs < f) return false;
    }
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      if (orderDateMs > t.getTime()) return false;
    }
    return true;
  }
  return true;
}

function renderReport() {
  if (!db.history) return;
  const type = document.querySelector('input[name="reportType"]:checked').value;

  // Chỉ hiện thanh lọc nhóm hàng khi đang ở tab Sản Phẩm Bán Ra
  const gb = document.getElementById('reportGroupBar');
  if (gb) gb.style.display = (type === 'product') ? 'flex' : 'none';

  const revWrap = document.getElementById('reportRevenueWrap');
  const prodWrap = document.getElementById('reportProductWrap');
  const storeWrap = document.getElementById('reportStoreWrap'); 

  // Lấy toàn bộ đơn hoàn thành, không lọc sớm ở đây để Sản phẩm có thể tự bóc tách
  const allCompleted = db.historyHoanThanh || [];

  if (type === 'revenue') {
    revWrap.style.display = 'block';
    prodWrap.style.display = 'none';
    if(storeWrap) storeWrap.style.display = 'none';
    const revOrders = allCompleted.filter(o => checkReportDate(o.realDate));
    renderRevenueReport(revOrders);
  } else if (type === 'product') {
    revWrap.style.display = 'none';
    prodWrap.style.display = 'block';
    if(storeWrap) storeWrap.style.display = 'none';
    renderProductReport(allCompleted);
  } else if (type === 'store') {
    revWrap.style.display = 'none';
    prodWrap.style.display = 'none';
    if(storeWrap) storeWrap.style.display = 'block';
    const storeOrders = allCompleted.filter(o => checkReportDate(o.realDate));
    // Dùng currentStorePage thay vì reset về 1 để giữ nguyên trang khi Auto-Reload
    renderStoreReport(storeOrders, currentStorePage);
  }
}

function renderRevenueReport(orders) {
  const wrap = document.getElementById('reportRevenueWrap');
  if (!orders.length) {
    wrap.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">Không có doanh thu trong thời gian này</div></div>';
    return;
  }

  let totalRev = 0;
  let saleStats = {};

  orders.forEach(o => {
    let amt = Number(o.total || 0);
    totalRev += amt;
    let saleName = (o.sale || 'Không rõ').trim();
    if (!saleStats[saleName]) saleStats[saleName] = { count: 0, total: 0 };
    saleStats[saleName].count += 1;
    saleStats[saleName].total += amt;
  });

  let html = `
    <div class="card" style="border-left:4px solid var(--fin); background:var(--fin-lt)">
      <div style="font-size:12px;font-weight:700;color:var(--fin);text-transform:uppercase">Tổng Doanh Thu</div>
      <div style="font-size:32px;font-weight:800;color:var(--fin)">${totalRev.toLocaleString()} VNĐ</div>
      <div style="font-size:12px;color:var(--muted)">Từ ${orders.length} hóa đơn hoàn thành</div>
    </div>
    <div class="card">
      <div class="sec-head"><i class="fas fa-users me-2 text-muted"></i>Doanh Thu Theo Nhân Viên</div>
      <table class="dtbl">
        <thead><tr><th>Nhân Viên</th><th style="text-align:center">Số Đơn</th><th style="text-align:right">Doanh Thu</th></tr></thead>
        <tbody>
  `;

  const sortedSales = Object.keys(saleStats).sort((a, b) => saleStats[b].total - saleStats[a].total);
  sortedSales.forEach(s => {
    html += `<tr>
      <td style="font-weight:700;color:var(--pri)">${s}</td>
      <td style="text-align:center;font-weight:600">${saleStats[s].count}</td>
      <td style="text-align:right;font-weight:700;color:var(--dan)">${saleStats[s].total.toLocaleString()}đ</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;
}

// ============================================================
// BÁO CÁO SẢN PHẨM BÁN RA + CỘT "NGÀY XUẤT" + POPUP PHIẾU XUẤT TRONG NGÀY
//
// CÁCH DÙNG:
//   1. XÓA hàm renderProductReport() cũ trong file của bạn.
//   2. Dán TOÀN BỘ nội dung file này vào cuối thẻ <script> (hoặc ngay chỗ hàm cũ).
// Không cần sửa gì thêm ở các hàm khác.
// ============================================================

// Dữ liệu ngày xuất của từng dòng sản phẩm đang hiển thị (index khớp với STT - 1)
let reportProdDayData = [];

const ngxPad2 = n => String(n).padStart(2, '0');

function ngxEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// CSS cho chip ngày (chèn 1 lần duy nhất)
function ngxEnsureStyle() {
  if (document.getElementById('ngxStyle')) return;
  const st = document.createElement('style');
  st.id = 'ngxStyle';
  st.textContent =
    '.ngx-days{display:flex;flex-wrap:wrap;gap:5px;justify-content:center}' +
    '.ngx-chip{background:var(--dan-lt);color:var(--dan);font-size:12px;font-weight:700;' +
      'padding:3px 9px;border-radius:6px;cursor:pointer;border:1px solid transparent;' +
      'transition:all .15s;user-select:none}' +
    '.ngx-chip:hover{background:var(--dan);color:#fff}';
  document.head.appendChild(st);
}

// ------------------------------------------------------------
// BÁO CÁO SẢN PHẨM BÁN RA (đã thêm cột Ngày Xuất)
// ------------------------------------------------------------
function renderProductReport(orders) {
  const wrap = document.getElementById('reportProductWrap');
  ngxEnsureStyle();

  let prodMap = {};
  let grandQty = 0;
  let grandAmt = 0;
  let hasItems = false;
  const monthSet = new Set();   // để biết báo cáo có trải dài nhiều tháng không
  const gm = getGroupMap();

  orders.forEach(o => {
    (o.items || []).forEach(item => {
      // Lọc theo nhóm hàng (Tất cả / Đồ Điện / Kim Khí / Khác)
      if (!itemInReportGroup(item.Ten_Hang, gm)) return;

      // Ngày hiệu lực của dòng hàng (giữ nguyên thuật toán cũ)
      let effectiveDate = (item.addDate && new Date(item.addDate).getTime() > new Date(o.realDate).getTime()) ? item.addDate : o.realDate;
      if (!checkReportDate(effectiveDate)) return;

      hasItems = true;
      let pName = String(item.Ten_Hang).trim();
      let sl = Number(item.SL || 0);
      let gia = Number(item.Gia || 0);
      let ck = Number(item.CK || 0);
      let thTien = Math.round(sl * gia * (1 - ck / 100));

      if (!prodMap[pName]) prodMap[pName] = { SL: 0, TT: 0, days: {} };
      prodMap[pName].SL += sl;
      prodMap[pName].TT += thTien;
      grandQty += sl;
      grandAmt += thTien;

      // ===== MỚI: gom theo NGÀY XUẤT =====
      const ed = new Date(effectiveDate);
      const dayKey = ed.getFullYear() + '-' + ngxPad2(ed.getMonth() + 1) + '-' + ngxPad2(ed.getDate());
      monthSet.add(dayKey.slice(0, 7));
      if (!prodMap[pName].days[dayKey]) prodMap[pName].days[dayKey] = [];
      prodMap[pName].days[dayKey].push({
        id: o.id,
        time: ed.getTime(),
        cust: String(o.cust || 'Khách lẻ').trim(),
        sl: sl
      });
    });
  });

  if (!hasItems) {
    reportProdDayData = [];
    wrap.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div class="empty-title">Không có sản phẩm bán ra trong thời gian này' + (reportGroup !== 'all' ? ' (nhóm ' + reportGroup + ')' : '') + '</div></div>';
    return;
  }

  let prodArr = Object.keys(prodMap).map(k => {
    let tonKho = 0;
    if (db.products) {
      const p = db.products.find(x => String(x.Ten_San_Pham).trim() === k);
      if (p) tonKho = Number(p.So_Luong || 0);
    }
    return { name: k, SL: prodMap[k].SL, TT: prodMap[k].TT, TonKho: tonKho, days: prodMap[k].days };
  });

  prodArr.sort((a, b) => b.SL - a.SL);
  reportProdDayData = prodArr;   // lưu lại để popup tra cứu theo index

  const multiMonth = monthSet.size > 1;  // nhiều tháng => chip hiện "dd/MM", 1 tháng => chỉ "dd"

  let html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="card" style="margin:0; border-left:4px solid var(--warn); background:var(--warn-lt)">
        <div style="font-size:11px;font-weight:700;color:var(--warn);text-transform:uppercase">Tổng SP Bán Ra</div>
        <div style="font-size:24px;font-weight:800;color:var(--warn)">${grandQty.toLocaleString()}</div>
      </div>
      <div class="card" style="margin:0; border-left:4px solid var(--dan); background:var(--dan-lt)">
        <div style="font-size:11px;font-weight:700;color:var(--dan);text-transform:uppercase">Tổng Tiền Hàng</div>
        <div style="font-size:24px;font-weight:800;color:var(--dan)">${grandAmt.toLocaleString()}đ</div>
      </div>
    </div>

    <div class="card">
      <table class="dtbl">
        <thead>
          <tr>
            <th width="5%">STT</th>
            <th width="22%">Tên Sản Phẩm</th>
            <th style="text-align:center" width="9%">Số Lượng</th>
            <th style="text-align:right" width="14%">Thành Tiền</th>
            <th style="text-align:center" width="8%">Tồn Kho</th>
            <th style="text-align:center" width="42%">Ngày Xuất</th>
          </tr>
        </thead>
        <tbody>
  `;

  prodArr.forEach((p, idx) => {
    let tkClass = p.TonKho <= 0 ? 'color:var(--dan)' : 'color:var(--suc)';

    // Chip ngày xuất: ngày gần nhất hiện trước, lùi dần về sau
    const chips = Object.keys(p.days).sort().reverse().map(k => {
      const parts = k.split('-'); // [yyyy, MM, dd]
      const label = multiMonth ? (parts[2] + '/' + parts[1]) : parts[2];
      const dayQty = p.days[k].reduce((s, r) => s + r.sl, 0);
      const tip = 'Ngày ' + parts[2] + '/' + parts[1] + '/' + parts[0] + ' — ' + dayQty.toLocaleString() + ' sản phẩm';
      return `<span class="ngx-chip" title="${tip}" onclick="showNgayXuatPopup(${idx}, '${k}')">${label}</span>`;
    }).join('');

    html += `<tr>
      <td style="color:var(--muted)">${idx + 1}</td>
      <td style="font-weight:700">${p.name}</td>
      <td style="text-align:center;font-weight:700;color:var(--pri);font-size:14px">${p.SL}</td>
      <td style="text-align:right;font-weight:700;color:var(--dan)">${p.TT.toLocaleString()}đ</td>
      <td style="text-align:center;font-weight:600;${tkClass}">${p.TonKho}</td>
      <td><div class="ngx-days">${chips}</div></td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;
}

// ------------------------------------------------------------
// POPUP "PHIẾU XUẤT TRONG NGÀY"
// ------------------------------------------------------------
function showNgayXuatPopup(prodIdx, dayKey) {
  const p = reportProdDayData[prodIdx];
  if (!p) return;
  const rows = (p.days[dayKey] || []).slice().sort((a, b) => a.time - b.time);
  if (!rows.length) return;

  const parts = dayKey.split('-');
  const dayLabel = parts[2] + '/' + parts[1] + '/' + parts[0];
  const totalQty = rows.reduce((s, r) => s + r.sl, 0);
  const custCount = new Set(rows.map(r => r.cust)).size;

  let body = '';
  rows.forEach(r => {
    const d = new Date(r.time);
    const timeStr = ngxPad2(d.getDate()) + '/' + ngxPad2(d.getMonth() + 1) + ' ' + ngxPad2(d.getHours()) + ':' + ngxPad2(d.getMinutes());
    body += `<tr>
      <td style="text-align:center;font-weight:700;color:var(--fin,#1a56db)">${ngxEsc(r.id)}</td>
      <td style="text-align:center;white-space:nowrap">${timeStr}</td>
      <td>${ngxEsc(r.cust)}</td>
      <td style="text-align:center;font-weight:700;color:var(--dan)">${r.sl.toLocaleString()}</td>
    </tr>`;
  });

  closeNgayXuatPopup();
  const m = document.createElement('div');
  m.id = 'ngayXuatModal';
  m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  m.onclick = function (e) { if (e.target === m) closeNgayXuatPopup(); };
  m.innerHTML = `
    <div style="background:#fff;border-radius:12px;width:100%;max-width:520px;max-height:88vh;overflow:auto;padding:22px 24px;box-shadow:0 10px 40px rgba(0,0,0,.25)">
      <div style="text-align:center;font-size:24px;font-weight:800;color:#4b5563;margin-bottom:16px">📦 Phiếu Xuất Trong Ngày</div>
      <div style="font-weight:800;font-size:13px;color:#374151">${ngxEsc(p.name)}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
        Ngày ${dayLabel} — Tổng: <b style="color:var(--dan)">${totalQty.toLocaleString()}</b> sản phẩm · ${custCount} khách hàng · ${rows.length} dòng xuất
      </div>
      <div style="overflow-x:auto">
        <table class="dtbl" style="width:100%">
          <thead>
            <tr>
              <th style="text-align:center">Mã Đơn</th>
              <th style="text-align:center">Thời gian</th>
              <th>Khách hàng</th>
              <th style="text-align:center">SL</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div style="text-align:center;margin-top:18px">
        <button type="button" onclick="closeNgayXuatPopup()"
                style="background:var(--fin,#1a56db);color:#fff;border:none;border-radius:8px;padding:10px 28px;font-weight:700;font-size:15px;cursor:pointer">Đóng</button>
      </div>
    </div>`;
  document.body.appendChild(m);
}

function closeNgayXuatPopup() {
  const m = document.getElementById('ngayXuatModal');
  if (m) m.remove();
}

// Nhấn Esc để đóng popup
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeNgayXuatPopup();
});

// ==========================================
// THỐNG KÊ DOANH THU CỬA HÀNG 
// ==========================================
let storeReportData = []; 
let filteredStoreData = []; // Mảng chứa kết quả sau khi tìm kiếm
let currentStorePage = 1;
const STORE_ITEMS_PER_PAGE = 15;

// Các biến trạng thái để fix lỗi "Tự động quay về"
let isViewingStoreDetail = false; 
let currentStoreSaleFilter = "ALL";
let currentDetailStoreName = "";
let currentStoreDetailPage = 1;

// Hàm trung gian để xử lý chuyển trang
function changeStorePage(page) {
  renderStoreReport(null, page);
}

// Hàm xử lý tìm kiếm (cả tên Cửa hàng & NV Sale)
function searchStoreReport() {
  const searchInp = document.getElementById('storeSearchInp');
  const saleSelect = document.getElementById('storeSaleFilter');
  
  const keyword = searchInp ? searchInp.value.toLowerCase().trim() : "";
  currentStoreSaleFilter = saleSelect ? saleSelect.value : "ALL";
  
  filteredStoreData = storeReportData.filter(s => {
    let matchName = true;
    let matchSale = true;
    
    if (keyword !== "") {
      matchName = bodau(s.name).includes(bodau(keyword));
    }
    if (currentStoreSaleFilter !== "ALL") {
      matchSale = (s.topSale === currentStoreSaleFilter);
    }
    return matchName && matchSale;
  });
  
  renderStoreReport(null, 1); 
}

// 1. Hàm render danh sách tổng (Các cửa hàng)
function renderStoreReport(orders = null, page = 1) {
  const wrap = document.getElementById('reportStoreWrap');
  currentStorePage = page;

  // Nếu orders truyền vào => Đang khởi tạo lại từ thay đổi Tab hoặc Load ngầm
  if (orders) {
    let storeMap = {};
    orders.forEach(o => {
      let name = String(o.cust || 'Khách lẻ').trim();
      if (!storeMap[name]) {
        storeMap[name] = { total: 0, count: 0, sales: {}, orders: [] };
      }
      storeMap[name].total += Number(o.total || 0);
      storeMap[name].count++;
      storeMap[name].orders.push(o);
      
      let sName = String(o.sale || 'Không rõ').trim();
      storeMap[name].sales[sName] = (storeMap[name].sales[sName] || 0) + 1;
    });

    storeReportData = Object.keys(storeMap).map(name => {
      let sMap = storeMap[name].sales;
      let topSale = Object.keys(sMap).reduce((a, b) => sMap[a] > sMap[b] ? a : b);
      let sortedOrders = storeMap[name].orders.sort((a,b) => b.realDate - a.realDate);
      return { name: name, total: storeMap[name].total, count: storeMap[name].count, topSale: topSale, orders: sortedOrders };
    });

    storeReportData.sort((a, b) => b.total - a.total);
    
    // Khôi phục bộ lọc hiện tại nếu có
    const keyword = document.getElementById('storeSearchInp')?.value.toLowerCase().trim() || "";
    filteredStoreData = storeReportData.filter(s => {
      let mN = keyword ? bodau(s.name).includes(bodau(keyword)) : true;
      let mS = currentStoreSaleFilter !== "ALL" ? (s.topSale === currentStoreSaleFilter) : true;
      return mN && mS;
    });

    // Chỉ tạo lại khung sườn nếu nó chưa tồn tại (giữ mượt UI, không mất focus chuột)
    if (!document.getElementById('storeMainView')) {
      wrap.innerHTML = `
        <div id="storeMainView">
          <div id="storeSearchWrap"></div>
          <div id="storeTableWrap"></div>
        </div>
        <div id="storeDetailView" style="display:none;"></div>
      `;
    }
  }

  // Khởi tạo các tùy chọn Nhân Viên
  let uniqueSales = [...new Set(storeReportData.map(s => s.topSale))].sort();
  let saleOptions = `<option value="ALL">-- Tất cả Nhân Viên --</option>`;
  uniqueSales.forEach(sale => {
    let selected = (sale === currentStoreSaleFilter) ? "selected" : "";
    saleOptions += `<option value="${sale}" ${selected}>${sale}</option>`;
  });

  const searchWrap = document.getElementById('storeSearchWrap');
  if (searchWrap && (!searchWrap.innerHTML || orders)) {
    searchWrap.innerHTML = `
      <div style="background: var(--bg); border: 1px solid var(--bdr); padding: 12px 15px; border-radius: 8px; margin-bottom: 15px;">
         <div style="display:flex; gap:15px; align-items:flex-end; flex-wrap:wrap;">
            <!-- Bộ lọc Tên NV Sale -->
            <div style="flex:1; min-width:200px;">
                <label style="font-size:11px; font-weight:800; color:var(--muted); text-transform:uppercase; margin-bottom:6px; display:block;"><i class="fas fa-user-tie me-1"></i> 1. Lọc theo NV Sale</label>
                <select id="storeSaleFilter" class="finput fselect" onchange="searchStoreReport()" style="padding: 8px 28px 8px 12px; font-size: 13px; font-weight:600; background-color:#fff;">
                   ${saleOptions}
                </select>
            </div>
            <!-- Bộ lọc Tên Cửa Hàng -->
            <div style="flex:2; min-width:250px;">
               <label style="font-size:11px; font-weight:800; color:var(--muted); text-transform:uppercase; margin-bottom:6px; display:block;"><i class="fas fa-store me-1"></i> 2. Tìm tên cửa hàng</label>
               <div style="position: relative;">
                  <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted);"></i>
                  <input type="text" id="storeSearchInp" class="finput" style="padding-left:36px; background-color:#fff;" 
                         placeholder="Nhập tên cửa hàng để tìm nhanh..." 
                         oninput="searchStoreReport()">
               </div>
            </div>
         </div>
      </div>
    `;
    // Phục hồi lại giá trị cũ của ô input nếu có
    const searchInp = document.getElementById('storeSearchInp');
    if (searchInp && typeof keyword !== 'undefined' && keyword) searchInp.value = keyword;
  }

  const tableWrap = document.getElementById('storeTableWrap');
  if (tableWrap) {
    if (filteredStoreData.length === 0) {
      tableWrap.innerHTML = '<div class="empty"><div class="empty-icon">🏪</div><div class="empty-title">Không tìm thấy cửa hàng nào khớp với bộ lọc</div></div>';
    } else {
      // Phân trang
      const totalItems = filteredStoreData.length;
      const totalPages = Math.ceil(totalItems / STORE_ITEMS_PER_PAGE);
      const startIndex = (currentStorePage - 1) * STORE_ITEMS_PER_PAGE;
      const pagedData = filteredStoreData.slice(startIndex, startIndex + STORE_ITEMS_PER_PAGE);

      let html = `
        <div class="card">
          <table class="dtbl">
            <thead>
              <tr>
                <th width="5%">STT</th>
                <th width="35%">Tên Cửa Hàng</th>
                <th width="25%" style="text-align:right">Tổng Doanh Thu</th>
                <th width="20%" style="text-align:center">NV Sale</th>
                <th width="15%" style="text-align:center">Tổng Số Hóa Đơn</th>
              </tr>
            </thead>
            <tbody>
      `;

      pagedData.forEach((store, index) => {
        let globalIndex = startIndex + index + 1;
        html += `
          <tr>
            <td style="color:var(--muted)">${globalIndex}</td>
            <td style="font-weight:700;color:var(--pri)">${store.name}</td>
            <td style="text-align:right;font-weight:700;color:var(--dan);font-size:14px">${store.total.toLocaleString()}đ</td>
            <td style="text-align:center;font-weight:600">${store.topSale}</td>
            <td style="text-align:center;">
               <button class="btn2 btn-info btn-sm2" style="background:var(--info-lt); color:var(--info); border:1px solid var(--info); font-weight:bold; border-radius:12px;" 
                       onclick="showStoreDetail('${store.name}', 1)">
                  ${store.count} 📄 (Xem)
               </button>
            </td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
      html += buildPagination(totalPages, currentStorePage, 'changeStorePage');
      html += `</div>`;
      tableWrap.innerHTML = html;
    }
  }

  // QUAN TRỌNG: Sửa lỗi tự văng trang - Khôi phục view nếu đang xem chi tiết
  if (isViewingStoreDetail) {
    document.getElementById('storeMainView').style.display = 'none';
    document.getElementById('storeDetailView').style.display = 'block';
    showStoreDetail(currentDetailStoreName, currentStoreDetailPage);
  } else {
    document.getElementById('storeMainView').style.display = 'block';
    document.getElementById('storeDetailView').style.display = 'none';
  }
}

// 2. Hàm render Chi tiết các hóa đơn của 1 Cửa Hàng
function showStoreDetail(storeName, page = 1) {
  isViewingStoreDetail = true; 
  
  const mainView = document.getElementById('storeMainView');
  const detailView = document.getElementById('storeDetailView');
  if(mainView) mainView.style.display = 'none';
  if(detailView) detailView.style.display = 'block';

  currentDetailStoreName = storeName;
  currentStoreDetailPage = page;

  let storeData = storeReportData.find(s => s.name === storeName);
  if (!storeData) return;

  let cData = db.customers.find(c => bodau(c.Ten_Khach) === bodau(storeName)) || {};
  let phone = cData.SDT || 'Không có SĐT';
  let addr = cData.Dia_Chi || 'Không có địa chỉ';

  const totalItems = storeData.orders.length;
  const totalPages = Math.ceil(totalItems / STORE_ITEMS_PER_PAGE);
  const startIndex = (currentStoreDetailPage - 1) * STORE_ITEMS_PER_PAGE;
  const pagedOrders = storeData.orders.slice(startIndex, startIndex + STORE_ITEMS_PER_PAGE);

  let html = `
    <div class="card" style="border-top:3px solid var(--info);">
      <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <button class="btn2 btn-out btn-sm2" onclick="closeStoreDetail()">
          <i class="fas fa-arrow-left me-1"></i> Quay lại trang Thống kê
        </button>
        <button class="btn2 btn-sm2" style="background:#0e9f6e;color:#fff;border:none" onclick="exportStoreDetailExcel('${storeName}')">
          <i class="fas fa-file-excel me-1"></i> Xuất Excel
        </button>
      </div>
      
      <div style="text-align:center; margin-bottom: 20px; padding-bottom:15px; border-bottom:1px dashed var(--bdr);">
         <h3 style="color:var(--info); font-weight:800; text-transform:uppercase; margin-bottom:5px;">${storeName}</h3>
         <div style="font-size:13px; color:var(--muted); margin-bottom:3px;"><i class="fas fa-map-marker-alt me-1"></i> ${addr}</div>
         <div style="font-size:13px; color:var(--muted); margin-bottom:3px;"><i class="fas fa-phone me-1"></i> ${phone}</div>
         <div style="font-size:13px; font-weight:600; color:var(--pri); margin-bottom:4px;"><i class="fas fa-user-tie me-1"></i> NV Sale: ${storeData.topSale}</div>
         <div style="font-size:14px; font-weight:700; color:var(--dan);"><i class="fas fa-money-bill-wave me-1"></i> Tổng doanh thu: ${storeData.total.toLocaleString()}đ</div>
      </div>

      <!-- BẮT ĐẦU: THÊM Ô TÌM KIẾM THEO TÊN SẢN PHẨM CÓ GỢI Ý -->
      <div style="margin-bottom: 12px; position: relative;">
        <i class="fas fa-search" style="position:absolute; left:12px; top:18px; transform:translateY(-50%); color:var(--muted); z-index: 10;"></i>
        <!-- Đã sửa oninput thành suggestStoreDetailProduct(this) -->
        <input type="text" id="storeDetailProductSearch" class="finput" style="padding-left:36px;" 
               placeholder="🔍 Nhập tên sản phẩm để lọc các hóa đơn có chứa sản phẩm này..." 
               oninput="suggestStoreDetailProduct(this)" autocomplete="off">
        
        <!-- THÊM MỚI: Khung chứa danh sách gợi ý -->
        <div id="storeDetailProductSuggest" style="position:absolute; width:100%; top:100%; left:0; z-index:100; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.15); border-radius:0 0 8px 8px; display:none; max-height:200px; overflow-y:auto;"></div>
      </div>
      <!-- KẾT THÚC: THÊM Ô TÌM KIẾM THEO TÊN SẢN PHẨM CÓ GỢI Ý -->

      <!-- ID cho bảng để dễ dàng cập nhật -->
      <div id="storeDetailTableWrapper"> 
  `;

  html += buildStoreDetailTableHTML(pagedOrders, startIndex); // Tách phần tạo bảng ra hàm riêng

  html += `</div>`; // Đóng storeDetailTableWrapper
  html += `<div id="storeDetailPaginationWrapper">`;
  html += buildPagination(totalPages, currentStoreDetailPage, 'changeStoreDetailPage');
  html += `</div></div>`; // Đóng card
  
  if(detailView) detailView.innerHTML = html;
}

// Hàm tắt chi tiết, quay lại danh sách
function closeStoreDetail() {
  isViewingStoreDetail = false;
  const mainView = document.getElementById('storeMainView');
  const detailView = document.getElementById('storeDetailView');
  if(mainView) mainView.style.display = 'block';
  if(detailView) detailView.style.display = 'none';
}

function changeStoreDetailPage(page) {
  showStoreDetail(currentDetailStoreName, page);
}

// 3. Hàm tạo Nút phân trang HTML dùng chung
function buildPagination(totalPages, currentPage, jsFunctionName) {
  if (totalPages <= 1) return '';
  let html = '<div style="display:flex; gap:6px; justify-content:center; margin-top:15px; flex-wrap:wrap;">';
  for(let i = 1; i <= totalPages; i++) {
    let btnStyle = i === currentPage 
      ? 'background:var(--info);color:#fff;border:1px solid var(--info);' 
      : 'background:var(--surf);color:var(--muted);border:1px solid var(--bdr);';
    html += `
      <button style="border-radius:6px; padding:5px 12px; cursor:pointer; font-weight:600; font-size:12px; ${btnStyle}" 
              onclick="${jsFunctionName}(${i})">
        ${i}
      </button>
    `;
  }
  html += '</div>';
  return html;
}

function getReportDateLabel() {
  if (reportDateMode === 'all') return 'Tất cả thời gian';
  if (reportDateMode === 'today') return 'Hôm nay';
  if (reportDateMode === 'yesterday') return 'Hôm qua';
  if (reportDateMode === 'week') return '7 ngày qua';
  if (reportDateMode === 'month') return 'Tháng này';
  if (reportDateMode === 'custom') {
    const f = document.getElementById('reportDateFrom').value;
    const t = document.getElementById('reportDateTo').value;
    if(f && t) return `Từ ${f.split('-').reverse().join('/')} đến ${t.split('-').reverse().join('/')}`;
    if(f) return `Từ ${f.split('-').reverse().join('/')}`;
    if(t) return `Đến ${t.split('-').reverse().join('/')}`;
  }
  return '';
}

function printReport() {
  const type = document.querySelector('input[name="reportType"]:checked').value;
  // UPDATE: Lấy tất cả để Sản phẩm có thể bóc tách từ các đơn cũ
  const allCompleted = db.historyHoanThanh || [];
  
  let printArea = document.getElementById('printBaoCaoArea');
  if (!printArea) { 
    printArea = document.createElement('div');
    printArea.id = 'printBaoCaoArea';
    printArea.className = 'print-area';
    printArea.style.display = 'none';
    document.body.appendChild(printArea);
  }

  let html = '<style>.bc-header{text-align:center;margin-bottom:20px;}.bc-header h2{margin:0;padding:0;}.bc-summary{display:flex;justify-content:space-between;margin-bottom:15px;font-size:16px;border-bottom:2px solid #000;padding-bottom:10px;}.bc-table{width:100%;border-collapse:collapse;}.bc-table th,.bc-table td{border:1px solid #000;padding:8px;}</style>';
  const originalLabel = getReportDateLabel();
  let dateLabel = originalLabel; 

  const today = new Date();
  const formatPrintDate = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const labelLower = (originalLabel || '').toLowerCase().trim();

  if (labelLower === 'hôm nay') {
    dateLabel = `Ngày ${formatPrintDate(today)}`;
  } else if (labelLower === 'hôm qua') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    dateLabel = `Ngày ${formatPrintDate(yesterday)}`;
  } else {
    dateLabel = originalLabel;
  }

    if (type === 'product') {
    let prodMap = {};
    let grandQty = 0; let grandAmt = 0;
    const gm = getGroupMap(); // MỚI
    allCompleted.forEach(o => {
      (o.items || []).forEach(item => {
        if (!itemInReportGroup(item.Ten_Hang, gm)) return; // MỚI: lọc nhóm hàng

        // Đồng bộ thuật toán cho chức năng IN BÁO CÁO
        let effectiveDate = (item.addDate && new Date(item.addDate).getTime() > new Date(o.realDate).getTime()) ? item.addDate : o.realDate;
        
        if (checkReportDate(effectiveDate)) {
          let pName = String(item.Ten_Hang).trim();
          let sl = Number(item.SL || 0);
          let gia = Number(item.Gia || 0);
          let ck = Number(item.CK || 0);
          let thTien = Math.round(sl * gia * (1 - ck / 100));
          if (!prodMap[pName]) prodMap[pName] = { SL: 0, TT: 0 };
          prodMap[pName].SL += sl;
          prodMap[pName].TT += thTien;
          grandQty += sl; grandAmt += thTien;
        }
      });
    });

    let prodArr = Object.keys(prodMap).map(k => {
      let tonKho = 0;
      if (db.products) {
        const p = db.products.find(x => String(x.Ten_San_Pham).trim() === k);
        if (p) tonKho = Number(p.So_Luong || 0);
      }
      return { name: k, SL: prodMap[k].SL, TT: prodMap[k].TT, TonKho: tonKho };
    });
    prodArr.sort((a, b) => b.SL - a.SL);

    html += `<div class="bc-header">
              <h2>BÁO CÁO SẢN PHẨM BÁN RA</h2>
              <p>Thời gian: ${dateLabel}</p>
            </div>
            <div class="bc-summary">
              <span>Tổng số lượng bán ra: <strong>${grandQty.toLocaleString()}</strong></span>
              <span>Tổng tiền hàng: <strong>${grandAmt.toLocaleString()}đ</strong></span>
            </div>
            <table class="bc-table">
              <thead>
                <tr>
                  <th width="5%">STT</th>
                  <th>Tên Sản Phẩm</th>
                  <th width="15%">Số Lượng</th>
                  <th width="20%">Thành Tiền</th>
                  <th width="15%">Tồn Kho</th>
                </tr>
              </thead>
              <tbody>`;
    prodArr.forEach((p, idx) => {
      html += `<tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td>${p.name}</td>
                <td style="text-align:center; font-weight:bold;">${p.SL}</td>
                <td style="text-align:right;">${p.TT.toLocaleString()}đ</td>
                <td style="text-align:center;">${p.TonKho}</td>
               </tr>`;
    });
    html += `</tbody></table>`;
  } else if (type === 'store') {
    // DOANH THU CỬA HÀNG IN
    let totalStoreRev = 0;
    let totalStoreOrders = 0;
    
    // Sử dụng filteredStoreData để in đúng những gì đang tìm kiếm
    filteredStoreData.forEach(s => {
      totalStoreRev += s.total;
      totalStoreOrders += s.count;
    });

    html += `<div class="bc-header">
              <h2>BÁO CÁO DOANH THU CỬA HÀNG</h2>
              <p>Thời gian: ${dateLabel}</p>
            </div>
            <div class="bc-summary">
              <span>Tổng doanh thu: <strong>${totalStoreRev.toLocaleString()}đ</strong></span>
              <span>Tổng số hóa đơn: <strong>${totalStoreOrders}</strong></span>
            </div>
            <table class="bc-table">
              <thead>
                <tr>
                  <th width="5%">STT</th>
                  <th width="35%">Tên Cửa Hàng</th>
                  <th width="20%">NV Sale (Nhiều nhất)</th>
                  <th width="15%">Số Đơn</th>
                  <th width="25%">Doanh Thu</th>
                </tr>
              </thead>
              <tbody>`;
    filteredStoreData.forEach((s, idx) => {
      html += `<tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><strong>${s.name}</strong></td>
                <td style="text-align:center;">${s.topSale}</td>
                <td style="text-align:center;">${s.count}</td>
                <td style="text-align:right; font-weight:bold;">${s.total.toLocaleString()}đ</td>
               </tr>`;
    });
    html += `</tbody></table>`;

  } else {
    // DOANH THU IN
    let totalRev = 0; let saleStats = {};
    const revOrders = allCompleted.filter(o => checkReportDate(o.realDate));
    revOrders.forEach(o => {
      let amt = Number(o.total || 0);
      totalRev += amt;
      let saleName = (o.sale || 'Không rõ').trim();
      if (!saleStats[saleName]) saleStats[saleName] = { count: 0, total: 0 };
      saleStats[saleName].count += 1; saleStats[saleName].total += amt;
    });

    html += `<div class="bc-header">
              <h2>BÁO CÁO DOANH THU</h2>
              <p>Thời gian: ${dateLabel}</p>
            </div>
            <div class="bc-summary">
              <span>Tổng doanh thu: <strong>${totalRev.toLocaleString()}đ</strong></span>
              <span>Số đơn hoàn thành: <strong>${revOrders.length}</strong></span>
            </div>
            <table class="bc-table">
              <thead>
                <tr>
                  <th width="10%">STT</th>
                  <th>Nhân Viên</th>
                  <th width="20%">Số Đơn</th>
                  <th width="30%">Doanh Thu</th>
                </tr>
              </thead>
              <tbody>`;
    const sortedSales = Object.keys(saleStats).sort((a, b) => saleStats[b].total - saleStats[a].total);
    sortedSales.forEach((s, idx) => {
      html += `<tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><strong>${s}</strong></td>
                <td style="text-align:center;">${saleStats[s].count}</td>
                <td style="text-align:right; font-weight:bold;">${saleStats[s].total.toLocaleString()}đ</td>
               </tr>`;
    });
    html += `</tbody></table>`;
  }

  printArea.innerHTML = html;
  printArea.style.display = 'block'; 
  window.print();
  
  setTimeout(() => { printArea.style.display = 'none'; }, 1000); 
}

// ==========================================
// XUẤT FILE EXCEL CHUẨN FORMAT (TỔNG CỘNG NẰM TRÊN, CĂN GIỮA ĐẸP)
// ==========================================
function exportBaoCaoExcel() {
  if (!db.history) return;
  const type = document.querySelector('input[name="reportType"]:checked').value;
  const allCompleted = db.historyHoanThanh || [];

  // --- LOGIC LẤY THỜI GIAN ---
  const originalLabel = getReportDateLabel();
  let dateLabel = originalLabel;
  const today = new Date();
  const formatPrintDate = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const labelLower = (originalLabel || '').toLowerCase().trim();
  if (labelLower === 'hôm nay') {
    dateLabel = `Ngày ${formatPrintDate(today)}`;
  } else if (labelLower === 'hôm qua') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    dateLabel = `Ngày ${formatPrintDate(yesterday)}`;
  } else {
    dateLabel = originalLabel;
  }

  // Khai báo cấu trúc XML Spreadsheet của Microsoft
  let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:html="http://www.w3.org/TR/REC-html40">' +
    '<Styles>' +
    '<Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Arial" ss:Size="11"/><Alignment ss:Vertical="Center"/></Style>' +
    '<Style ss:ID="ReportTitle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1"/></Style>' +
    '<Style ss:ID="ReportDate"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="11" ss:Italic="1"/></Style>' +
    '<Style ss:ID="SumLabelCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="14" ss:Bold="1" ss:Color="#000000"/></Style>' +
    '<Style ss:ID="SumValCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1" ss:Color="#e02424"/><NumberFormat ss:Format="#,##0"/></Style>' +
    '<Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1a56db" ss:Pattern="Solid"/></Style>' +
    '<Style ss:ID="CellString"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
    '<Style ss:ID="CellCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
    '<Style ss:ID="CellMoney"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><NumberFormat ss:Format="#,##0"/></Style>' +
    '</Styles>';

  // ===============================================
  // --- NẾU LÀ BÁO CÁO SẢN PHẨM ---
  if (type === 'product') {
    let prodMap = {};
    let grandQty = 0; let grandAmt = 0;
        let hasData = false;
    const gm = getGroupMap(); // MỚI
    
    allCompleted.forEach(o => {
      (o.items || []).forEach(item => {
        if (!itemInReportGroup(item.Ten_Hang, gm)) return; // MỚI: lọc nhóm hàng

        // Đồng bộ thuật toán cho chức năng XUẤT EXCEL
        let effectiveDate = (item.addDate && new Date(item.addDate).getTime() > new Date(o.realDate).getTime()) ? item.addDate : o.realDate;
        
        if (checkReportDate(effectiveDate)) {
          hasData = true;
          let pName = String(item.Ten_Hang).trim();
          let sl = Number(item.SL || 0);
          let gia = Number(item.Gia || 0);
          let ck = Number(item.CK || 0);
          let thTien = Math.round(sl * gia * (1 - ck / 100));
          if (!prodMap[pName]) prodMap[pName] = { SL: 0, TT: 0 };
          prodMap[pName].SL += sl;
          prodMap[pName].TT += thTien;
          grandQty += sl; grandAmt += thTien;
        }
      });
    });

    if (!hasData) {
      if(typeof appToast === 'function') appToast("Không có dữ liệu để xuất Excel!", "warning");
      else alert("Không có dữ liệu để xuất Excel!");
      return;
    }

    let prodArr = Object.keys(prodMap).map(k => {
      let tonKho = 0;
      if (db.products) {
        const p = db.products.find(x => String(x.Ten_San_Pham).trim() === k);
        if (p) tonKho = Number(p.So_Luong || 0);
      }
      return { name: k, SL: prodMap[k].SL, TT: prodMap[k].TT, TonKho: tonKho };
    });
    prodArr.sort((a, b) => b.SL - a.SL);

    xml += '<Worksheet ss:Name="BC_San_Pham"><Table>' +
           '<Column ss:Width="50"/><Column ss:Width="300"/><Column ss:Width="90"/><Column ss:Width="130"/><Column ss:Width="90"/>' +
           '<Row ss:Height="25"><Cell ss:MergeAcross="4" ss:StyleID="ReportTitle"><Data ss:Type="String">BÁO CÁO SẢN PHẨM BÁN RA' + getReportGroupLabel() + '</Data></Cell></Row>' +
           '<Row><Cell ss:MergeAcross="4" ss:StyleID="ReportDate"><Data ss:Type="String">Thời gian: '+dateLabel+'</Data></Cell></Row>' +
           '<Row></Row>' + 
           '<Row ss:Height="30">' +
             '<Cell ss:MergeAcross="1" ss:StyleID="SumLabelCenter"><Data ss:Type="String">Tổng số lượng bán ra:</Data></Cell>' +
             `<Cell ss:StyleID="SumValCenter"><Data ss:Type="Number">${grandQty}</Data></Cell>` +
             '<Cell ss:StyleID="SumLabelCenter"><Data ss:Type="String">Tổng tiền hàng:</Data></Cell>' +
             `<Cell ss:StyleID="SumValCenter"><Data ss:Type="Number">${grandAmt}</Data></Cell>` +
           '</Row>' +
           '<Row></Row>' + 
           '<Row>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">STT</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Tên Sản Phẩm</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Số Lượng</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Thành Tiền</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Tồn Kho</Data></Cell>' +
           '</Row>';

    prodArr.forEach((p, idx) => {
      xml += '<Row>' +
             `<Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>` +
             `<Cell ss:StyleID="CellString"><Data ss:Type="String">${p.name}</Data></Cell>` +
             `<Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${p.SL}</Data></Cell>` +
             `<Cell ss:StyleID="CellMoney"><Data ss:Type="Number">${p.TT}</Data></Cell>` +
             `<Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${p.TonKho}</Data></Cell>` +
             '</Row>';
    });
    
    xml += '</Table>';
           
  // ===============================================
  // --- NẾU LÀ BÁO CÁO DOANH THU CỬA HÀNG ---
  } else if (type === 'store') {
    if (!filteredStoreData || filteredStoreData.length === 0) {
      if(typeof appToast === 'function') appToast("Không có dữ liệu để xuất Excel!", "warning");
      else alert("Không có dữ liệu để xuất Excel!");
      return;
    }

    let totalStoreRev = 0;
    let totalStoreOrders = 0;
    filteredStoreData.forEach(s => {
      totalStoreRev += s.total;
      totalStoreOrders += s.count;
    });

    xml += '<Worksheet ss:Name="BC_Cua_Hang"><Table>' +
           '<Column ss:Width="50"/><Column ss:Width="250"/><Column ss:Width="120"/><Column ss:Width="80"/><Column ss:Width="130"/>' +
           '<Row ss:Height="25"><Cell ss:MergeAcross="4" ss:StyleID="ReportTitle"><Data ss:Type="String">BÁO CÁO DOANH THU CỬA HÀNG</Data></Cell></Row>' +
           '<Row><Cell ss:MergeAcross="4" ss:StyleID="ReportDate"><Data ss:Type="String">Thời gian: '+dateLabel+'</Data></Cell></Row>' +
           '<Row></Row>' + 
           '<Row ss:Height="30">' +
             '<Cell ss:MergeAcross="1" ss:StyleID="SumLabelCenter"><Data ss:Type="String">Tổng số hóa đơn:</Data></Cell>' +
             `<Cell ss:StyleID="SumValCenter"><Data ss:Type="Number">${totalStoreOrders}</Data></Cell>` +
             '<Cell ss:StyleID="SumLabelCenter"><Data ss:Type="String">Tổng doanh thu:</Data></Cell>' +
             `<Cell ss:StyleID="SumValCenter"><Data ss:Type="Number">${totalStoreRev}</Data></Cell>` +
           '</Row>' +
           '<Row></Row>' + 
           '<Row>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">STT</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Tên Cửa Hàng</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">NV Sale</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Số Đơn</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Doanh Thu</Data></Cell>' +
           '</Row>';

    filteredStoreData.forEach((s, idx) => {
      xml += '<Row>' +
             `<Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>` +
             `<Cell ss:StyleID="CellString"><Data ss:Type="String">${s.name}</Data></Cell>` +
             `<Cell ss:StyleID="CellCenter"><Data ss:Type="String">${s.topSale}</Data></Cell>` +
             `<Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${s.count}</Data></Cell>` +
             `<Cell ss:StyleID="CellMoney"><Data ss:Type="Number">${s.total}</Data></Cell>` +
             '</Row>';
    });

    xml += '</Table>';

  // ===============================================
  // --- NẾU LÀ BÁO CÁO DOANH THU NHÂN VIÊN ---
  } else {
    let totalRev = 0; let saleStats = {};
    const revOrders = allCompleted.filter(o => checkReportDate(o.realDate));
    
    if (!revOrders.length) {
      if(typeof appToast === 'function') appToast("Không có dữ liệu để xuất Excel!", "warning");
      else alert("Không có dữ liệu để xuất Excel!");
      return;
    }

    revOrders.forEach(o => {
      let amt = Number(o.total || 0);
      totalRev += amt;
      let saleName = (o.sale || 'Không rõ').trim();
      if (!saleStats[saleName]) saleStats[saleName] = { count: 0, total: 0 };
      saleStats[saleName].count += 1; saleStats[saleName].total += amt;
    });
    
    const sortedSales = Object.keys(saleStats).sort((a, b) => saleStats[b].total - saleStats[a].total);
    let totalOrders = sortedSales.reduce((sum, s) => sum + saleStats[s].count, 0);

    xml += '<Worksheet ss:Name="BC_Doanh_Thu"><Table>' +
           '<Column ss:Width="60"/><Column ss:Width="200"/><Column ss:Width="100"/><Column ss:Width="150"/>' +
           '<Row ss:Height="25"><Cell ss:MergeAcross="3" ss:StyleID="ReportTitle"><Data ss:Type="String">BÁO CÁO DOANH THU</Data></Cell></Row>' +
           '<Row><Cell ss:MergeAcross="3" ss:StyleID="ReportDate"><Data ss:Type="String">Thời gian: '+dateLabel+'</Data></Cell></Row>' +
           '<Row></Row>' + 
           '<Row ss:Height="30">' +
             '<Cell ss:StyleID="SumLabelCenter"><Data ss:Type="String">Số đơn:</Data></Cell>' +
             `<Cell ss:StyleID="SumValCenter"><Data ss:Type="Number">${totalOrders}</Data></Cell>` +
             '<Cell ss:StyleID="SumLabelCenter"><Data ss:Type="String">Tổng doanh thu:</Data></Cell>' +
             `<Cell ss:StyleID="SumValCenter"><Data ss:Type="Number">${totalRev}</Data></Cell>` +
           '</Row>' +
           '<Row></Row>' + 
           '<Row>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">STT</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Nhân Viên</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Số Đơn</Data></Cell>' +
             '<Cell ss:StyleID="Header"><Data ss:Type="String">Doanh Thu</Data></Cell>' +
           '</Row>';

    sortedSales.forEach((s, idx) => {
      xml += '<Row>' +
             `<Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>` +
             `<Cell ss:StyleID="CellString"><Data ss:Type="String">${s}</Data></Cell>` +
             `<Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${saleStats[s].count}</Data></Cell>` +
             `<Cell ss:StyleID="CellMoney"><Data ss:Type="Number">${saleStats[s].total}</Data></Cell>` +
             '</Row>';
    });

    xml += '</Table>';
  }

  xml += '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayGridLines/></WorksheetOptions></Worksheet></Workbook>';

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  // FIX tên file xuất Excel
  let fileName = type === 'product' ? "Bao_Cao_San_Pham.xls" : (type === 'store' ? "Bao_Cao_Cua_Hang.xls" : "Bao_Cao_Doanh_Thu.xls");
  
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof appToast === 'function') appToast("Đã xuất Excel thành công!");
}

// === BỘ LỌC TRẠNG THÁI (NHẤP VÀO THẺ) ===
let histFilterStatus = 'all';

function setHistFilterStatus(status) {
  histFilterStatus = status;
  renderHistoryUI(); 
}

function renderHistoryUI(){
  if(!db.history)return;
  
  const fs = document.getElementById('historyStaffFilter') ? document.getElementById('historyStaffFilter').value : 'ALL';
  const searchInput = document.getElementById('historySearchInput');
  const searchKeyword = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  let count=0, total=0, doneCount=0, waitCount=0, html='', lastDate='';
  const getDDMM=d=>String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
  const todayStr=getDDMM(new Date());
  const yest=new Date(); yest.setDate(yest.getDate()-1);
  const yesterStr=getDDMM(yest);
  const getFr=s=>{
    const d=(s||'').split(' ')[0];
    if(d===todayStr)return"Hôm nay";
    if(d===yesterStr)return"Hôm qua";
    return d;
  };
  const role=(user.role||'').toLowerCase();

  db.history.forEach(i=>{
    if(histPersonalOnly&&i.sale!==user.fullName)return;
    if(!histPersonalOnly&&fs!=="ALL"&&i.sale!==fs)return;
    if(!checkHistDate(i.realDate))return; 
    if(searchKeyword && !(i.cust || '').toLowerCase().includes(searchKeyword)) return;
    if(i.status === 'Đã Hủy') return;

    count++;
    total += Number(i.total); 
    if(i.status==="Đã in") doneCount++;
    if(i.status==="Chờ in") waitCount++;
  });

  let filteredItems = [];
  db.history.forEach(i=>{
    if(histPersonalOnly&&i.sale!==user.fullName)return;
    if(!histPersonalOnly&&fs!=="ALL"&&i.sale!==fs)return;
    if(!checkHistDate(i.realDate))return; 
    if(searchKeyword && !(i.cust || '').toLowerCase().includes(searchKeyword)) return;
    if(histFilterStatus === 'wait' && i.status !== 'Chờ in') return;
    if(histFilterStatus === 'done' && i.status !== 'Đã in') return;

    filteredItems.push(i);
  });

  const weight = { 'Chờ in': 1, 'Đã in': 2, 'Hoàn thành': 3, 'Đã Hủy': 4 };
  filteredItems.sort((a, b) => {
    const dA = new Date(a.realDate).setHours(0,0,0,0);
    const dB = new Date(b.realDate).setHours(0,0,0,0);
    if (dA !== dB) return dB - dA; 
    const wA = weight[a.status] || 99;
    const wB = weight[b.status] || 99;
    if (wA !== wB) return wA - wB; 
    return b.realDate - a.realDate;
  });

  filteredItems.forEach(i => {
    const dl=getFr(i.time);
    if(dl!==lastDate){
      html+='<div style="text-align:center;margin:10px 0 8px">'+
            '<span style="background:var(--bg);border:1px solid var(--bdr);color:var(--muted);'+
            'font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px">'+dl+'</span></div>';
      lastDate=dl;
    }

    const first=i.items[0]||{Ten_Hang:'?',SL:0};
    const more=i.items.length-1;
    const preview='- '+first.Ten_Hang+' (x'+first.SL+')'+(more>0?'\n... và '+more+' sp khác':'');
    const isOwner=String(i.sale||'').trim()===String(user.fullName||'').trim();
    
    let bc, badge, actions='';
    
    if(i.status === 'Hoàn thành') {
      bc = 'fin';
      badge = '<span class="badge-s bfin">✔ Hoàn thành</span>';
    } else if(i.status === 'Đã Hủy') {
      bc = 'wait';
      badge = '<span style="color:var(--dan);font-weight:bold;font-size:11px">❌ Đã Hủy</span>';
    } else if(i.status === 'Đã in' || i.status === 'Chờ in'){
      bc = i.status === 'Đã in' ? 'done' : 'wait';
      badge = `<span class="badge-s ${bc === 'done' ? 'bdone' : 'bwait'}">${i.status}</span>`;
      
      if(role==='admin' || ((role==='sale'||role==='leader') && isOwner)){
        actions='<button type="button" class="btn2 btn-warn btn-sm2" onclick="event.stopPropagation();editOrder(\''+i.id+'\')">✏️ Sửa</button>'+
                '<button type="button" class="btn2 btn-pri btn-sm2" onclick="event.stopPropagation();printPhieuXuatKho(\''+i.id+'\')">🖨️ In Nháp</button>';
        if (role === 'admin') {
          actions += '<button type="button" class="btn2 btn-sm2" style="background:#0e9f6e;color:#fff;border:none" onclick="event.stopPropagation();markAsProcessedOnly(\''+i.id+'\')">✔️ Đã Gộp</button>';
        }
      }
    }

    html+='<div class="order-card '+bc+'" onclick="viewDetail(\''+i.id+'\')">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">' +
        '<div class="ocust" style="flex:1">'+i.cust+'</div>' +
        '<div style="display:flex;gap:6px;align-items:center">'+actions+'</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<div class="oid">'+i.id+'</div>' +
        '<div>'+badge+'</div>' +
      '</div>' +
      '<div class="oaddr">📍 '+(i.addr||'Chưa có địa chỉ')+'</div>' +
      '<div class="oprev">'+preview+'</div>' +
      '<div class="ofooter">' +
        '<span class="ometa">'+((i.time.split(' ')[1])||'')+' | '+(i.sale||'')+'</span>' +
        '<span class="ototl">'+Number(i.total).toLocaleString()+'đ</span>' +
      '</div></div>';
  });

  let statTitleText = 'Tất cả';
  if(histDateMode==='today') statTitleText='Hôm nay';
  else if(histDateMode==='yesterday') statTitleText='Hôm qua';
  else if(histDateMode==='week') statTitleText='7 ngày qua';
  else if(histDateMode==='month') statTitleText='Tháng này';
  else if(histDateMode==='all') statTitleText='Tất cả đơn';
  else {
    const f=document.getElementById('historyDateFrom').value;
    const t=document.getElementById('historyDateTo').value;
    if(f&&t) statTitleText='Từ '+f.split('-').reverse().join('/')+' - '+t.split('-').reverse().join('/');
    else if(f) statTitleText='Từ '+f.split('-').reverse().join('/');
    else if(t) statTitleText='Đến '+t.split('-').reverse().join('/');
    else statTitleText='Tùy chọn';
  }

  document.getElementById('statTitle').textContent=statTitleText;
  
  const elTotal = document.getElementById('statOrderTotal'); if(elTotal) elTotal.textContent=total.toLocaleString()+'đ';
  const elCount = document.getElementById('statOrderCount'); if(elCount) elCount.textContent=count;
  const elWaitCount = document.getElementById('statWaitCount'); if(elWaitCount) elWaitCount.textContent=waitCount;
  const elDoneCount = document.getElementById('statDoneCount'); if(elDoneCount) elDoneCount.textContent=doneCount;
  
  document.getElementById('histList').innerHTML=html||
    '<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">Không có đơn hàng nào khớp bộ lọc</div></div>';

  const cAll = document.getElementById('cardFilterAll');
  const cWait = document.getElementById('cardFilterWait');
  const cDone = document.getElementById('cardFilterDone');
  
  if(cAll) { cAll.style.opacity = (histFilterStatus === 'all' ? '1' : '0.4'); cAll.style.borderBottom = (histFilterStatus === 'all' ? '3px solid var(--dan)' : 'none'); }
  if(cWait) { cWait.style.opacity = (histFilterStatus === 'wait' ? '1' : '0.4'); cWait.style.borderBottom = (histFilterStatus === 'wait' ? '3px solid var(--warn)' : 'none'); }
  if(cDone) { cDone.style.opacity = (histFilterStatus === 'done' ? '1' : '0.4'); cDone.style.borderBottom = (histFilterStatus === 'done' ? '3px solid var(--suc)' : 'none'); }
}

function markAsProcessedOnly(id) {
  appConfirm("Đánh dấu toa này là 'Đã Gộp'?\n\nHệ thống sẽ chuyển nó sang 'Hoàn thành' để dọn dẹp danh sách chờ, nhưng KHÔNG cộng thêm doanh thu hay làm thay đổi báo cáo của toa gốc.", () => {
    
    if(db.history) {
      const h = db.history.find(x => x.id === id);
      if(h) h.status = 'Hoàn thành';
    }
    if(db.historyForXuLy) {
      const hx = db.historyForXuLy.find(x => x.id === id);
      if(hx) hx.status = 'Hoàn thành';
    }
    
    renderHistoryUI();
    if(typeof updateXuLyBadge === 'function') updateXuLyBadge();
    
    if(typeof appToast === 'function') appToast("Đang xử lý đồng bộ...");

    google.script.run
      .withSuccessHandler(() => {
        if(typeof appToast === 'function') appToast("✅ Đã gộp toa thành công!");
        if(typeof loadHist === 'function') loadHist();
        if(typeof loadData === 'function') loadData();
      })
      .withFailureHandler(err => {
        appAlert("Lỗi: " + err.message, "error");
      })
      .markOrderAsProcessedOnly(id);
  });
}

let xlDateMode = 'all';

function setXlDateMode(mode, btn) {
  xlDateMode = mode;
  document.querySelectorAll('.xl-sdbtn').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  document.getElementById('xlCustomRange').style.display = (mode === 'custom') ? 'flex' : 'none';
  renderXuLyUI();
}

function xlGetFilteredOrders(orders) {
  const custQ = (document.getElementById('xl_custFilter')?.value || '').toLowerCase().trim();
  const today = new Date(); today.setHours(0,0,0,0);

  return orders.filter(o => {
    if (custQ) {
      const name = (o.tenKhach || o.customerName || '').toLowerCase();
      if (!name.includes(custQ)) return false;
    }

    if (xlDateMode !== 'all') {
      const orderDate = new Date(o.createdAt || o.ngayTao || 0);
      orderDate.setHours(0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      const weekAgo   = new Date(today); weekAgo.setDate(today.getDate() - 6);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      if (xlDateMode === 'today'     && orderDate.getTime() !== today.getTime()) return false;
      if (xlDateMode === 'yesterday' && orderDate.getTime() !== yesterday.getTime()) return false;
      if (xlDateMode === 'week'      && orderDate < weekAgo) return false;
      if (xlDateMode === 'month'     && orderDate < monthStart) return false;
      if (xlDateMode === 'custom') {
        const from = document.getElementById('xl_dateFrom')?.value;
        const to   = document.getElementById('xl_dateTo')?.value;
        if (from && orderDate < new Date(from)) return false;
        if (to   && orderDate > new Date(to))   return false;
      }
    }
    return true;
  });
}
// ==========================================
// XUẤT EXCEL CHI TIẾT HÓA ĐƠN CỦA 1 CỬA HÀNG
// ==========================================
function exportStoreDetailExcel(storeName) {
  let storeData = storeReportData.find(s => s.name === storeName);
  if (!storeData || !storeData.orders.length) {
    if (typeof appToast === 'function') appToast("Không có dữ liệu để xuất Excel!", "warning");
    else alert("Không có dữ liệu để xuất Excel!");
    return;
  }

  let cData = db.customers.find(c => bodau(c.Ten_Khach) === bodau(storeName)) || {};
  let phone = cData.SDT || 'Không có SĐT';
  let addr = cData.Dia_Chi || 'Không có địa chỉ';
  const dateLabel = getReportDateLabel();

  let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:html="http://www.w3.org/TR/REC-html40">' +
    '<Styles>' +
    '<Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Arial" ss:Size="11"/><Alignment ss:Vertical="Center"/></Style>' +
    '<Style ss:ID="ReportTitle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1"/></Style>' +
    '<Style ss:ID="ReportSub"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="11"/></Style>' +
    '<Style ss:ID="SumLabelCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="14" ss:Bold="1" ss:Color="#000000"/></Style>' +
    '<Style ss:ID="SumValCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1" ss:Color="#e02424"/><NumberFormat ss:Format="#,##0"/></Style>' +
    '<Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1a56db" ss:Pattern="Solid"/></Style>' +
    '<Style ss:ID="CellString"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
    '<Style ss:ID="CellCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
    '<Style ss:ID="CellMoney"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><NumberFormat ss:Format="#,##0"/></Style>' +
    '</Styles>';

  xml += '<Worksheet ss:Name="Chi_Tiet_Cua_Hang"><Table>' +
         '<Column ss:Width="50"/><Column ss:Width="150"/><Column ss:Width="120"/><Column ss:Width="130"/>' +
         `<Row ss:Height="25"><Cell ss:MergeAcross="3" ss:StyleID="ReportTitle"><Data ss:Type="String">${storeName}</Data></Cell></Row>` +
         `<Row><Cell ss:MergeAcross="3" ss:StyleID="ReportSub"><Data ss:Type="String">Địa chỉ: ${addr} | SĐT: ${phone}</Data></Cell></Row>` +
         `<Row><Cell ss:MergeAcross="3" ss:StyleID="ReportSub"><Data ss:Type="String">NV Sale: ${storeData.topSale} | Thời gian: ${dateLabel}</Data></Cell></Row>` +
         '<Row></Row>' +
         '<Row ss:Height="30">' +
           '<Cell ss:MergeAcross="1" ss:StyleID="SumLabelCenter"><Data ss:Type="String">Tổng số hóa đơn:</Data></Cell>' +
           `<Cell ss:StyleID="SumValCenter"><Data ss:Type="Number">${storeData.count}</Data></Cell>` +
         '</Row>' +
         '<Row ss:Height="30">' +
           '<Cell ss:MergeAcross="1" ss:StyleID="SumLabelCenter"><Data ss:Type="String">Tổng doanh thu:</Data></Cell>' +
           `<Cell ss:StyleID="SumValCenter"><Data ss:Type="Number">${storeData.total}</Data></Cell>` +
         '</Row>' +
         '<Row></Row>' +
         '<Row>' +
           '<Cell ss:StyleID="Header"><Data ss:Type="String">STT</Data></Cell>' +
           '<Cell ss:StyleID="Header"><Data ss:Type="String">Số HĐ</Data></Cell>' +
           '<Cell ss:StyleID="Header"><Data ss:Type="String">Ngày</Data></Cell>' +
           '<Cell ss:StyleID="Header"><Data ss:Type="String">Tiền</Data></Cell>' +
         '</Row>';

  storeData.orders.forEach((o, idx) => {
    xml += '<Row>' +
           `<Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>` +
           `<Cell ss:StyleID="CellString"><Data ss:Type="String">${o.id}</Data></Cell>` +
           `<Cell ss:StyleID="CellCenter"><Data ss:Type="String">${o.time}</Data></Cell>` +
           `<Cell ss:StyleID="CellMoney"><Data ss:Type="Number">${Number(o.total || 0)}</Data></Cell>` +
           '</Row>';
  });

  xml += '</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayGridLines/></WorksheetOptions></Worksheet></Workbook>';

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  const safeFileName = storeName.replace(/[^\wÀ-ỹ ]/g, '').trim().replace(/\s+/g, '_');

  link.setAttribute("href", url);
  link.setAttribute("download", "Chi_Tiet_" + safeFileName + ".xls");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof appToast === 'function') appToast("Đã xuất Excel thành công!");
}
// --- CÁC HÀM MỚI CHO TÍNH NĂNG LỌC SẢN PHẨM TRONG CHI TIẾT CỬA HÀNG ---

// Hàm tạo HTML cho bảng danh sách hóa đơn (để tái sử dụng khi lọc)
function buildStoreDetailTableHTML(orders, startIndex) {
  if (!orders || orders.length === 0) {
    return `<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">Không có hóa đơn nào phù hợp.</div></div>`;
  }

  let html = `
    <table class="dtbl">
      <thead>
        <tr style="background:var(--info-lt);">
          <th width="10%">STT</th>
          <th width="30%">Số HĐ</th>
          <th width="30%" style="text-align:center">Ngày</th>
          <th width="30%" style="text-align:right">Tiền</th>
        </tr>
      </thead>
      <tbody>
  `;

  orders.forEach((o, index) => {
    let globalIndex = startIndex + index + 1;
    html += `
      <tr>
        <td style="color:var(--muted)">${globalIndex}</td>
        <td style="font-weight:700;">
          <span onclick="event.stopPropagation(); viewLichSuHoaDonDetail('${o.id}')" style="cursor:pointer; color:var(--fin); background:var(--fin-lt); padding:4px 10px; border-radius:6px; border:1px solid rgba(37, 99, 235, 0.2); transition:all 0.2s ease; display:inline-flex; align-items:center;" onmouseover="this.style.background='var(--fin)'; this.style.color='#fff';" onmouseout="this.style.background='var(--fin-lt)'; this.style.color='var(--fin)';">
            <i class="fas fa-file-invoice" style="margin-right:4px;"></i> ${o.id}
          </span>
        </td>
        <td style="text-align:center;">${o.time}</td>
        <td style="text-align:right; font-weight:700; color:var(--dan); font-size:13.5px">${Number(o.total || 0).toLocaleString()}đ</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  return html;
}

// Biến lưu trữ từ khóa tìm kiếm sản phẩm
let currentStoreDetailProductFilter = "";

// Hàm được gọi khi gõ vào ô tìm kiếm
function filterStoreDetailOrders(storeName) {
  const searchInp = document.getElementById('storeDetailProductSearch');
  currentStoreDetailProductFilter = searchInp ? searchInp.value.toLowerCase().trim() : "";
  
  // Reset về trang 1 khi lọc
  currentStoreDetailPage = 1; 
  updateStoreDetailView(storeName);
}

// Hàm cập nhật lại bảng và phân trang dựa trên bộ lọc
function updateStoreDetailView(storeName) {
  let storeData = storeReportData.find(s => s.name === storeName);
  if (!storeData) return;

  let filteredOrders = storeData.orders;

  // Lọc theo tên sản phẩm nếu có từ khóa
  if (currentStoreDetailProductFilter !== "") {
    filteredOrders = storeData.orders.filter(order => {
      if (!order.items || !Array.isArray(order.items)) return false;
      // Kiểm tra xem trong đơn hàng có item nào khớp tên không
      return order.items.some(item => {
        const itemName = (item.Ten_Hang || "").toLowerCase();
        // Dùng hàm bodau để lọc không dấu
        return bodau(itemName).includes(bodau(currentStoreDetailProductFilter));
      });
    });
  }

  // Phân trang lại trên danh sách đã lọc
  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / STORE_ITEMS_PER_PAGE);
  const startIndex = (currentStoreDetailPage - 1) * STORE_ITEMS_PER_PAGE;
  const pagedOrders = filteredOrders.slice(startIndex, startIndex + STORE_ITEMS_PER_PAGE);

  // Cập nhật lại HTML của bảng
  const tableWrapper = document.getElementById('storeDetailTableWrapper');
  if (tableWrapper) {
    tableWrapper.innerHTML = buildStoreDetailTableHTML(pagedOrders, startIndex);
  }

  // Cập nhật lại HTML của phân trang
  const paginationWrapper = document.getElementById('storeDetailPaginationWrapper');
  if (paginationWrapper) {
    paginationWrapper.innerHTML = buildPagination(totalPages, currentStoreDetailPage, 'changeStoreDetailPage');
  }
}

// Ghi đè lại hàm changeStoreDetailPage để giữ lại bộ lọc khi chuyển trang
function changeStoreDetailPage(page) {
    currentStoreDetailPage = page;
    updateStoreDetailView(currentDetailStoreName);
}

// Cập nhật hàm closeStoreDetail để xóa bộ lọc khi đóng
const originalCloseStoreDetail = closeStoreDetail;
closeStoreDetail = function() {
    currentStoreDetailProductFilter = ""; // Xóa bộ lọc
    originalCloseStoreDetail();
};
// --- BẮT ĐẦU: CÁC HÀM XỬ LÝ GỢI Ý SẢN PHẨM TRONG CHI TIẾT CỬA HÀNG ---

// Hàm hiển thị gợi ý khi người dùng gõ
function suggestStoreDetailProduct(inputEl) {
  const keyword = inputEl.value.trim().toLowerCase();
  const suggestBox = document.getElementById('storeDetailProductSuggest');
  
  if (!keyword || !db.products || db.products.length === 0) {
    suggestBox.style.display = 'none';
    suggestBox.innerHTML = '';
    
    // Nếu xóa hết chữ, gọi hàm lọc để hiển thị lại toàn bộ hóa đơn
    if (keyword === "") {
        filterStoreDetailOrders(currentDetailStoreName);
    }
    return;
  }

  // Lọc sản phẩm từ db.products
  const cleanKeyword = bodau(keyword);
  const matchedProducts = db.products.filter(p => {
    return bodau(p.Ten_San_Pham).includes(cleanKeyword) || 
           (p.Ma_SP && bodau(p.Ma_SP).includes(cleanKeyword));
  }).slice(0, 10); // Giới hạn hiển thị 10 kết quả

  if (matchedProducts.length === 0) {
    suggestBox.innerHTML = '<div style="padding:10px 12px; color:var(--muted); font-size:12px; font-style:italic;">Không tìm thấy sản phẩm...</div>';
    suggestBox.style.display = 'block';
    return;
  }

  // Tạo HTML cho danh sách gợi ý
  let html = '';
  matchedProducts.forEach(p => {
    // Escape dấu nháy đơn để tránh lỗi khi truyền vào hàm onclick
    const safeName = String(p.Ten_San_Pham).replace(/'/g, "\\'");
    html += `
      <div onclick="selectStoreDetailProduct('${safeName}')" 
           style="padding:10px 12px; border-bottom:1px solid var(--bdr); cursor:pointer; font-size:13px; font-weight:600; color:var(--pri); transition:background 0.2s;"
           onmouseover="this.style.background='var(--pri-lt)'" 
           onmouseout="this.style.background='transparent'">
        ${p.Ten_San_Pham} ${p.Ma_SP ? `<span style="color:var(--muted); font-size:11px; font-weight:normal;">(${p.Ma_SP})</span>` : ''}
      </div>
    `;
  });

  suggestBox.innerHTML = html;
  suggestBox.style.display = 'block';
}

// Hàm được gọi khi click chọn một sản phẩm từ gợi ý
function selectStoreDetailProduct(productName) {
  const inputEl = document.getElementById('storeDetailProductSearch');
  const suggestBox = document.getElementById('storeDetailProductSuggest');
  
  if (inputEl) {
    inputEl.value = productName; // Gán tên sản phẩm vào ô input
  }
  if (suggestBox) {
    suggestBox.style.display = 'none'; // Ẩn khung gợi ý
  }
  
  // Kích hoạt hàm lọc hóa đơn ngay lập tức
  filterStoreDetailOrders(currentDetailStoreName);
}

// --- Ẩn gợi ý khi click ra ngoài ---
document.addEventListener('click', function(event) {
  const suggestBox = document.getElementById('storeDetailProductSuggest');
  const searchInput = document.getElementById('storeDetailProductSearch');
  
  if (suggestBox && suggestBox.style.display === 'block') {
    if (!searchInput.contains(event.target) && !suggestBox.contains(event.target)) {
      suggestBox.style.display = 'none';
    }
  }
});
// --- KẾT THÚC: CÁC HÀM XỬ LÝ GỢI Ý ---
let reportGroup = 'all';

function setReportGroup(g, btn) {
  reportGroup = g;
  document.querySelectorAll('.r-grpbtn').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  renderReport();
}

// Map: tên SP (không dấu) -> nhóm (không dấu), lấy từ Danh_Muc cột I
function getGroupMap() {
  const m = {};
  (db.products || []).forEach(p => { m[bodau(p.Ten_San_Pham)] = bodau(p.Nhom || ''); });
  return m;
}
function itemInReportGroup(tenHang, gm) {
  if (reportGroup === 'all') return true;
  return gm[bodau(tenHang)] === bodau(reportGroup);
}
function getReportGroupLabel() {
  return reportGroup === 'all' ? '' : ' - ' + reportGroup;
}
