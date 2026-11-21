// ===== TIỆN ÍCH CHUẨN HÓA & ĐỊNH DẠNG =====
function normalizeProductName(str) {
  return String(str || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pad2(n) {
  return ('0' + n).slice(-2);
}

function toInputDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function fmtFullDate(ts, fallback) {
  if (!ts) return fallback || '';
  const d = new Date(ts);
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function safeFileName(s) {
  return String(s || '').replace(/[\\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
}

function filterProductSuggestions(v, colorVar, onSelectFn) {
  const matches = (db.products || []).filter(p =>
    (p.Ten_San_Pham && p.Ten_San_Pham.toLowerCase().includes(v)) ||
    (p.Ma_SP && String(p.Ma_SP).toLowerCase().includes(v))
  ).slice(0, 20);

  if (!matches.length) {
    return '<div class="search-res" style="padding:10px;text-align:center">Không tìm thấy sản phẩm</div>';
  }

  return `<div class="search-res">${matches.map(p => {
    const safeName = (p.Ten_San_Pham || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
    return `<div class="sr-item" onclick="${onSelectFn}('${safeName}')">
      <span><strong style="color:${colorVar}">[${p.Ma_SP || '---'}]</strong> <b>${p.Ten_San_Pham}</b></span>
    </div>`;
  }).join('')}</div>`;
}

// ====================================================
// ===== LỌC NGÀY + XUẤT EXCEL DÙNG CHUNG =====
// ====================================================
const SEARCH_FILTER_CFG = {
  completed: { from: 'inpCompletedFrom', to: 'inpCompletedTo', rerun: function () { rerunCompletedSearch(); } },
  import:    { from: 'inpImportFrom',    to: 'inpImportTo',    rerun: function () { rerunImportSearch(); } }
};

function getDateRangeMs(kind) {
  const cfg = SEARCH_FILTER_CFG[kind];
  const fEl = document.getElementById(cfg.from);
  const tEl = document.getElementById(cfg.to);
  let f = fEl ? fEl.value : '';
  let t = tEl ? tEl.value : '';
  if (f && t && f > t) { const x = f; f = t; t = x; fEl.value = f; tEl.value = t; }
  return {
    from: f ? new Date(f + 'T00:00:00').getTime() : null,
    to: t ? new Date(t + 'T23:59:59.999').getTime() : null,
    fromStr: f,
    toStr: t
  };
}

function inDateRange(ts, r) {
  if (r.from === null && r.to === null) return true;
  if (!ts) return false;
  if (r.from !== null && ts < r.from) return false;
  if (r.to !== null && ts > r.to) return false;
  return true;
}

function describeRange(r) {
  function vn(s) { const p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  if (!r.fromStr && !r.toStr) return 'Tất cả thời gian';
  if (r.fromStr && r.toStr) return 'Từ ' + vn(r.fromStr) + ' đến ' + vn(r.toStr);
  if (r.fromStr) return 'Từ ' + vn(r.fromStr);
  return 'Đến ' + vn(r.toStr);
}

function setQuickDateRange(kind, type) {
  const cfg = SEARCH_FILTER_CFG[kind];
  const now = new Date();
  let from = '', to = '';
  if (type === 'today') {
    from = to = toInputDate(now);
  } else if (type === '7d') {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    from = toInputDate(d); to = toInputDate(now);
  } else if (type === 'month') {
    from = toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
    to = toInputDate(now);
  } else if (type === 'lastmonth') {
    from = toInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    to = toInputDate(new Date(now.getFullYear(), now.getMonth(), 0));
  }
  const fEl = document.getElementById(cfg.from);
  const tEl = document.getElementById(cfg.to);
  if (fEl) fEl.value = from;
  if (tEl) tEl.value = to;
  cfg.rerun();
}

function exportRowsToExcel(opt) {
  const numCols = opt.numCols || [];
  const nCols = opt.headers.length;
  const bd = 'border:1px solid #000;';

  let head = '<tr><td colspan="' + nCols + '" style="border:none;text-align:center;font-weight:bold;font-size:16pt;">' + escHtml(opt.title) + '</td></tr>';
  (opt.infoLines || []).forEach(l => {
    const txt = (typeof l === 'object') ? l.text : l;
    const fs = (typeof l === 'object' && l.size) ? 'font-size:' + l.size + 'pt;' : '';
    head += '<tr><td colspan="' + nCols + '" style="border:none;text-align:center;font-weight:bold;' + fs + '">' + escHtml(txt) + '</td></tr>';
  });
  head += '<tr><td colspan="' + nCols + '" style="border:none;">&nbsp;</td></tr>';

  const th = opt.headers.map(h => '<th style="' + bd + 'text-align:center;font-weight:bold;background:#d1fae5;">' + escHtml(h) + '</th>').join('');
  const trs = opt.rows.map(r => '<tr>' + r.map((c, i) =>
    numCols.indexOf(i) >= 0
      ? '<td style="' + bd + 'text-align:right">' + (Number(c) || 0) + '</td>'
      : '<td style="' + bd + '">' + escHtml(c).replace(/\n/g, '<br>') + '</td>'
  ).join('') + '</tr>').join('');

  let footerHtml = '';
  if (opt.footer) {
    footerHtml = '<tr style="font-weight:bold;background:#fde68a">' +
      '<td colspan="' + opt.footer.labelColSpan + '" style="' + bd + 'text-align:right">' + escHtml(opt.footer.label) + '</td>' +
      '<td style="' + bd + 'text-align:right">' + (Number(opt.footer.value) || 0) + '</td>' +
      (opt.footer.trailing ? '<td colspan="' + opt.footer.trailing + '" style="' + bd + '"></td>' : '') +
      '</tr>';
  }

  const html = '<html><head><meta charset="UTF-8"></head><body>' +
    '<table cellspacing="0" cellpadding="4">' + head +
    '<thead><tr>' + th + '</tr></thead>' +
    '<tbody>' + trs + footerHtml + '</tbody></table></body></html>';

  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const now = new Date();
  link.download = opt.fileName + '_' + pad2(now.getDate()) + '-' + pad2(now.getMonth() + 1) + '-' + now.getFullYear() + '.xls';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ====================================================
// ===== MODULE TRA CỨU LỊCH SỬ NHẬP KHO =====
// ====================================================
let importSearchResults = [];
let currentImportProduct = '';

function initSearchImportPage() {
  if (!importHistoryData || importHistoryData.length === 0) {
    google.script.run
      .withSuccessHandler(function (data) {
        importHistoryData = data;
        if (currentImportProduct && data.length > 0) rerunImportSearch();
      })
      .withFailureHandler(function (err) {
        console.error("Lỗi tải lịch sử nhập kho:", err);
      })
      .getImportHistory();
  }
}

function searchProductForHistory() {
  const v = document.getElementById('inpSearchImportHistory').value.toLowerCase().trim();
  const resDiv = document.getElementById('resSearchImportHistory');
  const tbody = document.getElementById('tblSearchImportHistory');
  const summaryStats = document.getElementById('importSummaryStats');

  if (!v) {
    resDiv.innerHTML = '';
    currentImportProduct = '';
    importSearchResults = [];
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--muted);font-style:italic;"><i class="fas fa-box-open" style="font-size:24px;margin-bottom:8px;display:block;opacity:0.5;"></i>Vui lòng chọn tên sản phẩm để bắt đầu tra cứu</td></tr>';
    if (summaryStats) summaryStats.style.display = 'none';
    return;
  }

  resDiv.innerHTML = filterProductSuggestions(v, 'var(--info)', 'selectProductForHistory');
}

function selectProductForHistory(name) {
  document.getElementById('inpSearchImportHistory').value = name;
  document.getElementById('resSearchImportHistory').innerHTML = '';
  executeSearchImportHistory(name);
}

function rerunImportSearch() {
  if (currentImportProduct) executeSearchImportHistory(currentImportProduct);
}

function executeSearchImportHistory(productName) {
  currentImportProduct = productName;
  const kw = normalizeProductName(productName);
  const range = getDateRangeMs('import');
  const tbody = document.getElementById('tblSearchImportHistory');
  const summaryStats = document.getElementById('importSummaryStats');
  const elTotalQty = document.getElementById('sumTotalQty');
  const elReceipts = document.getElementById('sumReceipts');

  if (!importHistoryData || importHistoryData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--warn);"><i class="fas fa-exclamation-triangle me-2"></i>Hệ thống chưa tải xong hoặc chưa có dữ liệu lịch sử. Vui lòng tải lại trang.</td></tr>';
    if (summaryStats) summaryStats.style.display = 'none';
    return;
  }

  importSearchResults = [];
  let totalQty = 0;
  let receiptCount = 0;

  importHistoryData.forEach(record => {
    if (!record.items || !Array.isArray(record.items)) return;
    if (!inDateRange(record.ts, range)) return;

    const matchedItems = record.items.filter(item => normalizeProductName(item.Ten_Hang) === kw);
    if (matchedItems.length > 0) receiptCount++;

    matchedItems.forEach(foundItem => {
      totalQty += Number(foundItem.SL || 0);
      importSearchResults.push({
        id: record.id,
        time: record.time,
        ts: record.ts || 0,
        sl: foundItem.SL,
        note: foundItem.note || ''
      });
    });
  });

  if (importSearchResults.length === 0) {
    const hasRange = (range.from !== null || range.to !== null);
    const msg = hasRange ? 'Không có lịch sử nhập kho trong khoảng thời gian đã chọn!' : 'Không có lịch sử nhập kho cho sản phẩm này!';
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:25px;color:var(--dan);font-weight:600;"><i class="fas fa-times-circle me-2"></i>${msg}</td></tr>`;
    if (summaryStats) summaryStats.style.display = 'none';
    return;
  }

  tbody.innerHTML = importSearchResults.map(item => `<tr style="border-bottom:1px solid var(--bdr);">
    <td style="padding:10px;border:1px solid var(--bdr);text-align:center;font-weight:bold;color:var(--info);white-space:nowrap;">${escHtml(item.id)}</td>
    <td style="padding:10px;border:1px solid var(--bdr);text-align:center;white-space:nowrap;">${escHtml(item.time)}</td>
    <td style="padding:10px;border:1px solid var(--bdr);text-align:center;font-weight:bold;color:var(--pri);font-size:14px;">${escHtml(item.sl)}</td>
    <td style="padding:10px;border:1px solid var(--bdr);color:var(--txt);">${escHtml(item.note)}</td>
  </tr>`).join('');

  if (summaryStats) {
    summaryStats.style.display = 'flex';
    elTotalQty.innerText = totalQty.toLocaleString('vi-VN');
    elReceipts.innerText = receiptCount.toLocaleString('vi-VN');
  }
}

function downloadImportExcel() {
  if (!currentImportProduct || !importSearchResults.length) {
    appAlert("Chưa có dữ liệu để tải! Hãy chọn sản phẩm (và khoảng ngày) rồi tra cứu trước.", "warning");
    return;
  }
  const range = getDateRangeMs('import');
  const total = importSearchResults.reduce((s, x) => s + (Number(x.sl) || 0), 0);
  const slips = new Set(importSearchResults.map(x => x.id)).size;

  exportRowsToExcel({
    title: 'LỊCH SỬ NHẬP KHO',
    infoLines: [
      'Sản phẩm: ' + currentImportProduct,
      'Thời gian: ' + describeRange(range),
      { text: 'Tổng số phiếu: ' + slips + '     |     Tổng số lượng: ' + total.toLocaleString('vi-VN'), size: 13 }
    ],
    headers: ['MÃ NHẬP KHO', 'NGÀY', 'SỐ LƯỢNG', 'GHI CHÚ'],
    rows: importSearchResults.map(x => [x.id, fmtFullDate(x.ts, x.time), Number(x.sl) || 0, x.note]),
    numCols: [2],
    footer: { label: 'TỔNG CỘNG', labelColSpan: 2, value: total, trailing: 1 },
    fileName: 'LichSuNhapKho_' + safeFileName(currentImportProduct)
  });
}

// ====================================================
// ===== MODULE TRA CỨU LỊCH SỬ XUẤT HÀNG (20 DÒNG/TRANG) =====
// ====================================================
let completedHistoryData = [];
let completedSearchResults = [];
let currentCompletedPage = 1;
let currentCompletedProduct = '';
const completedItemsPerPage = 20;

function loadCompletedHistory() {
  google.script.run
    .withSuccessHandler(res => {
      if (res) {
        completedHistoryData = res;
        if (currentCompletedProduct && res.length > 0) rerunCompletedSearch();
      }
    })
    .getCompletedHistory();
}

function searchProductForCompleted() {
  const v = document.getElementById('inpSearchCompleted').value.toLowerCase().trim();
  const resDiv = document.getElementById('resSearchCompleted');
  const tbody = document.getElementById('tblSearchCompleted');
  const summaryDiv = document.getElementById('completedSummary');
  const paginationDiv = document.getElementById('completedPagination');

  if (!v) {
    resDiv.innerHTML = '';
    currentCompletedProduct = '';
    completedSearchResults = [];
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--muted);font-style:italic;"><i class="fas fa-check-circle" style="font-size:24px;margin-bottom:8px;display:block;opacity:0.5;"></i>Vui lòng chọn tên sản phẩm để bắt đầu tra cứu</td></tr>';
    if (summaryDiv) summaryDiv.style.display = 'none';
    if (paginationDiv) paginationDiv.innerHTML = '';
    return;
  }

  resDiv.innerHTML = filterProductSuggestions(v, 'var(--suc)', 'selectProductForCompleted');
}

function selectProductForCompleted(name) {
  document.getElementById('inpSearchCompleted').value = name;
  document.getElementById('resSearchCompleted').innerHTML = '';
  executeSearchCompleted(name);
}

function rerunCompletedSearch() {
  if (currentCompletedProduct) executeSearchCompleted(currentCompletedProduct);
}

function executeSearchCompleted(productName) {
  currentCompletedProduct = productName;
  const kw = normalizeProductName(productName);
  const range = getDateRangeMs('completed');
  const tbody = document.getElementById('tblSearchCompleted');
  const summaryDiv = document.getElementById('completedSummary');
  const slipsSpan = document.getElementById('completedTotalSlips');
  const qtySpan = document.getElementById('completedTotalQty');
  const paginationDiv = document.getElementById('completedPagination');

  if (!completedHistoryData || completedHistoryData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--warn);"><i class="fas fa-spinner fa-spin me-2"></i>Đang tải dữ liệu. Hãy thử lại trong vài giây...</td></tr>';
    if (summaryDiv) summaryDiv.style.display = 'none';
    if (paginationDiv) paginationDiv.innerHTML = '';
    loadCompletedHistory();
    return;
  }

  completedSearchResults = [];
  let totalQty = 0;
  let totalSlips = 0;

  completedHistoryData.forEach(record => {
    if (!record.items || !Array.isArray(record.items)) return;
    if (!inDateRange(record.ts, range)) return;

    const matchedItems = record.items.filter(item => normalizeProductName(item.Ten_Hang) === kw);
    if (matchedItems.length > 0) {
      totalSlips++;
      matchedItems.forEach(foundItem => {
        totalQty += Number(foundItem.SL) || 0;
        completedSearchResults.push({
          id: record.id,
          time: record.time,
          ts: record.ts || 0,
          cust: record.cust || 'Khách lẻ',
          sl: foundItem.SL,
          note: foundItem.Ghi_Chu || ''
        });
      });
    }
  });

  if (completedSearchResults.length === 0) {
    const hasRange = (range.from !== null || range.to !== null);
    const msg = hasRange ? 'Không có lịch sử xuất hàng trong khoảng thời gian đã chọn!' : 'Không có lịch sử xuất hàng (hoàn thành) cho sản phẩm này!';
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:25px;color:var(--dan);font-weight:600;"><i class="fas fa-times-circle me-2"></i>${msg}</td></tr>`;
    if (summaryDiv) summaryDiv.style.display = 'none';
    if (paginationDiv) paginationDiv.innerHTML = '';
  } else {
    if (summaryDiv) {
      summaryDiv.style.display = 'flex';
      slipsSpan.textContent = totalSlips.toLocaleString('vi-VN');
      qtySpan.textContent = totalQty.toLocaleString('vi-VN');
    }
    currentCompletedPage = 1;
    renderCompletedSearchPage();
  }
}

function renderCompletedPagination(totalPages) {
  const paginationDiv = document.getElementById('completedPagination');
  if (!paginationDiv) return;
  if (totalPages <= 1) { paginationDiv.innerHTML = ''; return; }

  let pagHtml = `<button onclick="changeCompletedPage(${currentCompletedPage - 1})" ${currentCompletedPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} class="btn2 btn-out" style="padding:4px 10px; border-radius:6px; font-size:12px;">« Trước</button>`;
  const startPage = Math.max(1, currentCompletedPage - 2);
  const endPage = Math.min(totalPages, currentCompletedPage + 2);

  if (startPage > 1) {
    pagHtml += `<button onclick="changeCompletedPage(1)" class="btn2 btn-out" style="padding:4px 10px; border-radius:6px; font-size:12px;">1</button>`;
    if (startPage > 2) pagHtml += `<span style="color:var(--muted); font-weight:bold;">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    pagHtml += i === currentCompletedPage
      ? `<button class="btn2 btn-suc" style="padding:4px 10px; border-radius:6px; font-size:12px; font-weight:bold;">${i}</button>`
      : `<button onclick="changeCompletedPage(${i})" class="btn2 btn-out" style="padding:4px 10px; border-radius:6px; font-size:12px;">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pagHtml += `<span style="color:var(--muted); font-weight:bold;">...</span>`;
    pagHtml += `<button onclick="changeCompletedPage(${totalPages})" class="btn2 btn-out" style="padding:4px 10px; border-radius:6px; font-size:12px;">${totalPages}</button>`;
  }

  pagHtml += `<button onclick="changeCompletedPage(${currentCompletedPage + 1})" ${currentCompletedPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} class="btn2 btn-out" style="padding:4px 10px; border-radius:6px; font-size:12px;">Sau »</button>`;
  paginationDiv.innerHTML = pagHtml;
}

function renderCompletedSearchPage() {
  const tbody = document.getElementById('tblSearchCompleted');
  if (!tbody) return;

  const totalPages = Math.max(1, Math.ceil(completedSearchResults.length / completedItemsPerPage));
  if (currentCompletedPage < 1) currentCompletedPage = 1;
  if (currentCompletedPage > totalPages) currentCompletedPage = totalPages;

  const startIdx = (currentCompletedPage - 1) * completedItemsPerPage;
  const pageData = completedSearchResults.slice(startIdx, startIdx + completedItemsPerPage);

  tbody.innerHTML = pageData.map(item => `<tr style="border-bottom:1px solid var(--bdr);">
    <td style="padding:10px;border:1px solid var(--bdr);text-align:center;font-weight:bold;color:var(--suc);white-space:nowrap;">${escHtml(item.id)}</td>
    <td style="padding:10px;border:1px solid var(--bdr);text-align:center;white-space:nowrap;">${escHtml(item.time)}</td>
    <td style="padding:10px;border:1px solid var(--bdr);font-weight:600;color:var(--txt);">${escHtml(item.cust)}</td>
    <td style="padding:10px;border:1px solid var(--bdr);text-align:center;font-weight:bold;color:var(--dan);font-size:14px;">${escHtml(item.sl)}</td>
    <td style="padding:10px;border:1px solid var(--bdr);color:var(--txt);">${escHtml(item.note)}</td>
  </tr>`).join('');

  renderCompletedPagination(totalPages);
}

function changeCompletedPage(newPage) {
  currentCompletedPage = newPage;
  renderCompletedSearchPage();
}

function downloadCompletedExcel() {
  if (!currentCompletedProduct || !completedSearchResults.length) {
    appAlert("Chưa có dữ liệu để tải! Hãy chọn sản phẩm (và khoảng ngày) rồi tra cứu trước.", "warning");
    return;
  }
  const range = getDateRangeMs('completed');
  const total = completedSearchResults.reduce((s, x) => s + (Number(x.sl) || 0), 0);
  const slips = new Set(completedSearchResults.map(x => x.id)).size;

  exportRowsToExcel({
    title: 'LỊCH SỬ XUẤT HÀNG (HOÀN THÀNH)',
    infoLines: [
      'Sản phẩm: ' + currentCompletedProduct,
      'Thời gian: ' + describeRange(range),
      { text: 'Tổng số phiếu: ' + slips + '     |     Tổng số lượng: ' + total.toLocaleString('vi-VN'), size: 13 }
    ],
    headers: ['MÃ ĐƠN', 'NGÀY XUẤT', 'KHÁCH HÀNG', 'SL ĐÃ GIAO', 'GHI CHÚ'],
    rows: completedSearchResults.map(x => [x.id, fmtFullDate(x.ts, x.time), x.cust, Number(x.sl) || 0, x.note]),
    numCols: [3],
    footer: { label: 'TỔNG CỘNG', labelColSpan: 3, value: total, trailing: 1 },
    fileName: 'LichSuXuatHang_' + safeFileName(currentCompletedProduct)
  });
}

function downloadCongNoExcel(){
  if(!db.customers){ appAlert("Chưa có dữ liệu khách hàng!","warning"); return; }

  const term = (document.getElementById('searchCongNo')?.value || '').toLowerCase().trim();
  const filtered = db.customers
    .filter(c => Number(c.Cong_No||0) !== 0 && c.Ten_Khach && bodau(c.Ten_Khach.toString()).includes(bodau(term)))
    .sort((a,b) => (Number(b.Cong_No)||0) - (Number(a.Cong_No)||0));

  if(!filtered.length){ appAlert("Không có dữ liệu công nợ để tải!","warning"); return; }

  const rows = filtered.map((c,i)=>{
    let phone = String(c.SDT||'').trim();
    if(phone && !phone.startsWith('0')) phone = '0'+phone;
    const debt = Number(c.Cong_No||0);
    const debtStyle = debt < 0 ? 'color:#dc2626;font-weight:bold' : 'color:#92400e;font-weight:bold';
    return `<tr>
      <td>${i+1}</td>
      <td>${escHtml(c.Ten_Khach||'')}</td>
      <td>${escHtml(phone)}</td>
      <td>${escHtml(c.Dia_Chi||'')}</td>
      <td style="text-align:right;${debtStyle}">${debt.toLocaleString('vi-VN')}</td>
    </tr>`;
  }).join('');

  const totalDebt = filtered.reduce((s,c)=>s+Number(c.Cong_No||0),0);
  const now = new Date();
  const html = `<html><head><meta charset="UTF-8"></head><body>
    <h3>DANH SÁCH CÔNG NỢ KHÁCH HÀNG</h3>
    <table border="1" cellspacing="0" cellpadding="4">
      <thead><tr style="background:#fef3c7;font-weight:bold;"><th>#</th><th>Khách Hàng</th><th>Số Điện Thoại</th><th>Địa Chỉ</th><th>Công Nợ (VNĐ)</th></tr></thead>
      <tbody>
        ${rows}
        <tr style="font-weight:bold;background:#fde68a"><td colspan="4" style="text-align:right">TỔNG CỘNG</td><td style="text-align:right">${totalDebt.toLocaleString('vi-VN')}</td></tr>
      </tbody>
    </table></body></html>`;

  const blob = new Blob(['\ufeff'+html], {type:'application/vnd.ms-excel'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'LichSuCongNo_' + pad2(now.getDate()) + '-' + pad2(now.getMonth() + 1) + '-' + now.getFullYear() + '.xls';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
