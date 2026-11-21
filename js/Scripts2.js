// ====================================================
// ===== MODULE NHẬP BẢO HÀNH (Dành riêng cho Admin) ====
// ====================================================

let bhCart = [];

function searchBaoHanh(){
  const v = document.getElementById('bhSearchP').value.toLowerCase();
  
  if(!v) { document.getElementById('bhResP').innerHTML=""; return; }
  
  const sn = bhCart.map(i => i.Ten_Hang);
  const f = (db.products||[]).filter(p => p.Ten_San_Pham && p.Ten_San_Pham.toLowerCase().includes(v) && !sn.includes(p.Ten_San_Pham)).slice(0,20);
  
  document.getElementById('bhResP').innerHTML = f.length ? '<div class="search-res">' + f.map(p => {
    const safe = (p.Ten_San_Pham||'').replace(/'/g,"\\'").replace(/"/g,'\\"');
    return '<div class="sr-item" onclick="addBhCart(\''+safe+'\')"><span><strong>'+p.Ten_San_Pham+'</strong></span></div>';
  }).join('') + '</div>' : '<div class="search-res"><div class="sr-item"><span><em>Không tìm thấy sản phẩm...</em></span></div></div>';
}

function addBhCart(n){
  bhCart.unshift({Ten_Hang:n, SL:1, daBH: false});
  document.getElementById('bhSearchP').value=""; 
  document.getElementById('bhResP').innerHTML=""; 
  updateBhUI(); 
}

function removeBhCart(idx){
  bhCart.splice(idx,1);
  updateBhUI();
}

function updateBhUI(){
  document.getElementById('bhCartList').innerHTML = bhCart.map((i,idx) => 
    '<div class="imp-item" style="border-left-color:var(--warn); display: flex; align-items: center;">' +
      '<span style="flex:1;font-weight:600;font-size:13px">'+i.Ten_Hang+'</span>' +
      '<input type="number" class="ci-inp me-2" value="'+i.SL+'" min="1" style="width:60px" onchange="bhCart['+idx+'].SL=Number(this.value)||1">' +
      '<label style="display:flex; align-items:center; margin:0; font-size:14px; font-weight:bold; color:var(--dark); cursor:pointer; user-select:none;">' +
        '<input type="checkbox" style="margin-right:6px; transform: scale(1.2);" '+(i.daBH ? 'checked' : '')+' onchange="bhCart['+idx+'].daBH=this.checked">' +
        'Đã BH' +
      '</label>' +
      '<button class="ci-rm ms-3" onclick="removeBhCart('+idx+')">×</button>' +
    '</div>'
  ).join('');
}

function submitBaoHanh(){
  const custName = document.getElementById('bhCustInp').value;
  
  if(!custName) { appAlert("Bạn chưa chọn khách hàng!", "warning"); return; }
  if(!bhCart.length) { appAlert("Chưa chọn sản phẩm nào để bảo hành!", "warning"); return; }
  
  const btn = document.getElementById('btnSubmitBaoHanh');
  btn.disabled = true;
  btn.textContent = "Đang lưu dữ liệu...";
  
  google.script.run.withSuccessHandler(()=>{
    appToast("Lưu phiếu bảo hành thành công!");
    bhCart = [];
    document.getElementById('bhCustInp').value = "";
    updateBhUI();
    btn.disabled = false;
    btn.textContent = "✔ LƯU BẢO HÀNH";
  }).saveBaoHanhData({
    customer: custName,
    items: bhCart
  });
}

// ====================================================
// ===== LỊCH SỬ BẢO HÀNH KHÔNG BÁN ĐƯỢC (DẠNG BẢNG) =====
// ====================================================

function loadLsBHKBD() {
  document.getElementById('tblLsBHKBD').innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin me-2"></i>Đang tải dữ liệu...</td></tr>';
  
  google.script.run.withSuccessHandler(renderLsBHKBD).withFailureHandler(err => {
    document.getElementById('tblLsBHKBD').innerHTML = `<tr><td colspan="8" style="text-align:center; color:red; padding: 20px;">Lỗi: ${err.message}</td></tr>`;
  }).getLsBHKBD();
}

function renderLsBHKBD(data) {
  if (!data || data.length === 0) {
    document.getElementById('tblLsBHKBD').innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color:var(--muted);">Chưa có dữ liệu lịch sử nào.</td></tr>';
    return;
  }
  
  let html = '';
  data.forEach((r) => {
    let badgeStyle = r.status === 'Đã Bảo Hành' 
      ? 'background:#059669; color:#fff; padding:4px 8px; border-radius:12px; font-size:11px; white-space:nowrap;' 
      : 'background:#d97706; color:#fff; padding:4px 8px; border-radius:12px; font-size:11px; white-space:nowrap;';
    const safeName = (r.name || '').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '&quot;');

    html += `<tr>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:600; white-space:nowrap;">${r.id}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center; white-space:nowrap;">${r.date}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; color:var(--pri-dk); font-weight:500; white-space:nowrap;">${r.customer}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; color:var(--dark);">${r.name}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:bold;">${r.qty}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; font-style:italic;">${r.note || ''}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center; white-space:nowrap;">
        <span style="${badgeStyle}">${r.status}</span>
      </td>
      <td style="padding:6px 8px; border:1px solid #e5e7eb; text-align:center;">
        <button onclick="deleteBHKBDRow('${r.id}', '${safeName}', this)"
          style="background:#ef4444; color:#fff; border:none; border-radius:8px; width:28px; height:28px; font-size:16px; line-height:1; cursor:pointer; font-weight:bold;"
          title="Xóa dòng này">×</button>
      </td>
    </tr>`;
  });
  
  document.getElementById('tblLsBHKBD').innerHTML = html;
}

function deleteBHKBDRow(maHD, tenSP, btn) {
  if (!confirm(`Xác nhận xóa: [${maHD}] ${tenSP}?\nDữ liệu sẽ bị xóa vĩnh viễn khỏi sheet BH_KB!`)) return;
  btn.disabled = true;
  btn.textContent = '...';
  google.script.run
    .withSuccessHandler(() => {
      appToast('Đã xóa thành công!');
      loadLsBHKBD();
    })
    .withFailureHandler(err => {
      appAlert('Lỗi xóa: ' + err.message, 'danger');
      btn.disabled = false;
      btn.textContent = '×';
    })
    .deleteBHKBDRow(maHD, tenSP);
}

// ====================================================
// ===== MODULE BẢO HÀNH HÀNG BÁN ĐƯỢC (CỘNG KHO) =====
// ====================================================

let bhBDCart = [];

function searchBaoHanhBD(){
  const v = document.getElementById('bhBDSearchP').value.toLowerCase();
  if(!v) { document.getElementById('bhBDResP').innerHTML=""; return; }
  const sn = bhBDCart.map(i => i.Ten_Hang);
  const f = (db.products||[]).filter(p => p.Ten_San_Pham && p.Ten_San_Pham.toLowerCase().includes(v) && !sn.includes(p.Ten_San_Pham)).slice(0,20);
  document.getElementById('bhBDResP').innerHTML = f.length ? '<div class="search-res">' + f.map(p => {
    const safe = (p.Ten_San_Pham||'').replace(/'/g,"\\'").replace(/"/g,'\\"');
    return '<div class="sr-item" onclick="addBhCartBD(\''+safe+'\')"><span><strong>'+p.Ten_San_Pham+'</strong></span></div>';
  }).join('') + '</div>' : '';
}

function addBhCartBD(n){
  bhBDCart.unshift({Ten_Hang:n, SL:1, daBH: false});
  document.getElementById('bhBDSearchP').value=""; 
  document.getElementById('bhBDResP').innerHTML=""; 
  updateBhUI_BD(); 
}

function updateBhUI_BD(){
  document.getElementById('bhBDCartList').innerHTML = bhBDCart.map((i,idx) => 
    '<div class="imp-item" style="border-left-color:var(--suc); display: flex; align-items: center;">' +
      '<span style="flex:1;font-weight:600;font-size:13px">'+i.Ten_Hang+'</span>' +
      '<input type="number" class="ci-inp me-2" value="'+i.SL+'" min="1" style="width:60px" onchange="bhBDCart['+idx+'].SL=Number(this.value)||1">' +
      '<label style="display:flex; align-items:center; margin:0; font-size:12px; cursor:pointer;">' +
        '<input type="checkbox" style="margin-right:4px;" '+(i.daBH ? 'checked' : '')+' onchange="bhBDCart['+idx+'].daBH=this.checked">' +
        'Đã BH' +
      '</label>' +
      '<button class="ci-rm ms-3" onclick="bhBDCart.splice('+idx+',1);updateBhUI_BD()">×</button>' +
    '</div>'
  ).join('');
}

function submitBaoHanhBD(){
  const custName = document.getElementById('bhBDCustInp').value;
  if(!custName || !bhBDCart.length) { appAlert("Thiếu thông tin!", "warning"); return; }
  
  const btn = document.getElementById('btnSubmitBaoHanhBD');
  btn.disabled = true; btn.textContent = "Đang xử lý...";
  
  google.script.run.withSuccessHandler(()=>{
    appToast("Đã lưu và cộng vào kho!");
    bhBDCart = []; document.getElementById('bhBDCustInp').value = "";
    updateBhUI_BD(); btn.disabled = false; btn.textContent = "✔ LƯU & CỘNG KHO";
  }).saveBaoHanhBDData({ customer: custName, items: bhBDCart });
}

function loadLsBHBD() {
  document.getElementById('tblLsBHBD').innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin me-2"></i>Đang tải...</td></tr>';
  google.script.run
    .withSuccessHandler(renderLsBHBD)
    .withFailureHandler(err => {
      document.getElementById('tblLsBHBD').innerHTML = `<tr><td colspan="8" style="text-align:center; color:red; padding:20px;">Lỗi: ${err.message}</td></tr>`;
    })
    .getLsBHBD();
}

function renderLsBHBD(data) {
  if (!data || !data.length) {
    document.getElementById('tblLsBHBD').innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--muted);">Trống</td></tr>';
    return;
  }
  let html = data.map(r => {
    let badge = r.status === 'Đã Bảo Hành'
      ? 'background:#059669; color:#fff; padding:4px 8px; border-radius:12px; font-size:11px; white-space:nowrap;'
      : 'background:#d97706; color:#fff; padding:4px 8px; border-radius:12px; font-size:11px; white-space:nowrap;';
    const safeName = (r.name || '').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `<tr>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:600; white-space:nowrap;">${r.id}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center; white-space:nowrap;">${r.date}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; color:var(--pri-dk); font-weight:500; white-space:nowrap;">${r.customer}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb;">${r.name}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:bold;">${r.qty}</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; font-style:italic;">Trừ Tiền BHCH</td>
      <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">
        <span style="${badge}">${r.status}</span>
      </td>
      <td style="padding:6px 8px; border:1px solid #e5e7eb; text-align:center;">
        <button onclick="deleteBHBDRow('${r.id}', '${safeName}', this)"
          style="background:#ef4444; color:#fff; border:none; border-radius:8px; width:28px; height:28px; font-size:16px; line-height:1; cursor:pointer; font-weight:bold;"
          title="Xóa dòng này">×</button>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('tblLsBHBD').innerHTML = html;
}

function deleteBHBDRow(maHD, tenSP, btn) {
  if (!confirm(`Xác nhận xóa: [${maHD}] ${tenSP}?\nDữ liệu sẽ bị xóa vĩnh viễn khỏi sheet BH_BD!`)) return;
  btn.disabled = true;
  btn.textContent = '...';
  google.script.run
    .withSuccessHandler(() => {
      appToast('Đã xóa thành công!');
      loadLsBHBD();
    })
    .withFailureHandler(err => {
      appAlert('Lỗi xóa: ' + err.message, 'danger');
      btn.disabled = false;
      btn.textContent = '×';
    })
    .deleteBHBDRow(maHD, tenSP);
}

// ====================================================
// ===== XUẤT EXCEL DANH MỤC SẢN PHẨM =================
// ====================================================
function downloadProductsExcel() {
  appToast("Đang kết nối máy chủ để tải tệp gốc...", "info");
  
  google.script.run
    .withSuccessHandler(function(rawData) {
      if (!rawData || rawData.length === 0) {
        appAlert("Không tìm thấy dữ liệu cấu trúc gốc trên trang tính!", "error");
        return;
      }
      
      const headers = rawData[0];
      const borderXML = 
        '  <Borders>' +
        '    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>' +
        '    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>' +
        '    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>' +
        '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>' +
        '  </Borders>';
      
      let xml = '<?xml version="1.0" encoding="utf-8"?>' +
                '<?mso-application progid="Excel.Sheet"?>' +
                '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
                'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
                'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
                'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ' +
                'xmlns:html="http://www.w3.org/TR/REC-html40">' +
                '<Styles>' +
                '<Style ss:ID="Default"><Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#111827"/></Style>' +
                '<Style ss:ID="HeaderStyle">' +
                '  <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>' +
                '  <Interior ss:Color="#1A56DB" ss:Pattern="Solid"/>' +
                '  <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>' +
                borderXML +
                '</Style>' +
                '<Style ss:ID="TextLeft">' +
                '  <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>' +
                borderXML +
                '</Style>' +
                '<Style ss:ID="TextCenter">' +
                '  <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>' +
                '  <Font ss:FontName="Segoe UI" ss:Bold="1"/>' +
                borderXML +
                '</Style>' +
                '<Style ss:ID="NumberRight">' +
                '  <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>' +
                '  <NumberFormat ss:Format="#,##0"/>' +
                borderXML +
                '</Style>' +
                '</Styles>' +
                '<Worksheet ss:Name="Danh Mục Sản Phẩm">' +
                '<Table>';
      
      headers.forEach((h, idx) => {
        let headerName = String(h).toLowerCase();
        if (headerName.includes("tên") || headerName.includes("san_pham") || headerName.includes("sản phẩm")) {
          xml += '<Column ss:Width="320"/>';
        } else if (idx === 0 || headerName.includes("mã")) {
          xml += '<Column ss:Width="85"/>';
        } else {
          xml += '<Column ss:Width="75"/>';
        }
      });
      
      xml += '<Row ss:Height="26">';
      headers.forEach(h => {
        xml += `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${h}</Data></Cell>`;
      });
      xml += '</Row>';
      
      for (let i = 1; i < rawData.length; i++) {
        if (!rawData[i] || rawData[i].join("").trim() === "") continue;

        xml += '<Row ss:Height="22">';
        rawData[i].forEach((cellValue, colIdx) => {
          let hName = String(headers[colIdx] || "").toLowerCase();
          if (typeof cellValue === 'number' && !hName.includes("tên") && !hName.includes("mã") && colIdx !== 0) {
            xml += `<Cell ss:StyleID="NumberRight"><Data ss:Type="Number">${cellValue}</Data></Cell>`;
          } else {
            let style = (colIdx === 0 || hName.includes("mã")) ? "TextCenter" : "TextLeft";
            xml += `<Cell ss:StyleID="${style}"><Data ss:Type="String">${cellValue === null ? "" : cellValue}</Data></Cell>`;
          }
        });
        xml += '</Row>';
      }
      
      xml += '</Table>' +
             '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">' +
             '  <Selected/>' +
             '  <ProtectObjects>False</ProtectObjects>' +
             '  <ProtectScenarios>False</ProtectScenarios>' +
             '  <DisplayGridLines/>' +
             '</WorksheetOptions>' +
             '</Worksheet></Workbook>';
      
      const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", "Danh_Muc_Goc_Chuan_Hoa.xls");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      appToast("Đã tải xuống file danh mục chuẩn hóa thành công!");
    })
    .withFailureHandler(function(err) {
      appAlert("Lỗi hệ thống không thể tải file: " + err.message, "error");
    })
    .getRawExcelData();
}

// ==========================================
// CÀI ĐẶT GIAO DIỆN HÓA ĐƠN & LIVE PREVIEW
// ==========================================

function openInvoiceSettings() {
  document.getElementById('set_inv_logo').value = localStorage.getItem('inv_logo_url') || '';
  document.getElementById('set_inv_logo_w').value = localStorage.getItem('inv_logo_width') || '120';
  document.getElementById('set_inv_logo_h').value = localStorage.getItem('inv_logo_height') || '50';
  document.getElementById('set_inv_title_size').value = localStorage.getItem('inv_title_size') || '18';
  document.getElementById('set_inv_font_size').value = localStorage.getItem('inv_font_size') || '14';
  
  const modal = new bootstrap.Modal(document.getElementById('modalInvoiceSettings'));
  modal.show();
}

const INVOICE_SETTINGS_KEYS = [
  'is_logoUrl', 'is_logoW', 'is_logoH',
  'is_comNameSize', 'is_comAddrSize',
  'is_shdSize', 'is_shdMt', 'is_shdAlign',
  'is_titleSize', 'is_titleColor', 'is_titleMt', 'is_titleMb',
  'is_custNameSize', 'is_custNameColor',
  'is_custInfoSize', 'is_custInfoMb',
  'is_phoneSize', 'is_phoneMt',
  'is_thSize', 'is_tdSize', 'is_thBg', 'is_thColor', 'is_tdPad', 'is_borderColor', 'is_borderW',
  'is_th0', 'is_th1', 'is_th2', 'is_th3', 'is_th4', 'is_th5', 'is_th6', 'is_th7',
  'is_ttSize', 'is_tcSize', 'is_ncSize', 'is_padLR', 'is_padTB'
];

let previewEventsAttached = false;

document.addEventListener("DOMContentLoaded", function() {
  google.script.run
    .withSuccessHandler((jsonStr) => {
      if(jsonStr) {
        try {
          const config = JSON.parse(jsonStr);
          for(let key in config) {
            localStorage.setItem(key, config[key]);
          }
        } catch(e){}
      }
    })
    .loadInvoiceConfig();
});

function openInvoiceSettingsModal() {
  INVOICE_SETTINGS_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    const el = document.getElementById(key);
    if (el && val !== null) {
      el.value = val;
      const spanEl = document.getElementById(key + 'V');
      if (spanEl) spanEl.textContent = val;
    }
  });
  
  document.getElementById('invoiceSettingsModal').style.display = 'flex';

  if (!previewEventsAttached) {
    INVOICE_SETTINGS_KEYS.forEach(key => {
      const el = document.getElementById(key);
      if (el) {
        el.addEventListener('input', updateInvoicePreview);
        el.addEventListener('change', updateInvoicePreview);
      }
    });
    previewEventsAttached = true;
  }
  
  updateInvoicePreview();
}

function closeInvoiceSettingsModal() {
  document.getElementById('invoiceSettingsModal').style.display = 'none';
}

function saveInvoiceSettings() {
  let config = {};
  
  INVOICE_SETTINGS_KEYS.forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      localStorage.setItem(key, el.value);
      config[key] = el.value;
    }
  });
  
  closeInvoiceSettingsModal();
  if (typeof appToast === 'function') appToast("Đang đồng bộ cài đặt lên hệ thống...");
  
  google.script.run
    .withSuccessHandler(() => {
      if (typeof appToast === 'function') appToast("✅ Đã lưu cài đặt vĩnh viễn thành công!");
      else alert("Đã lưu cài đặt vĩnh viễn trên toàn hệ thống!");
    })
    .withFailureHandler(() => {
      alert("⚠️ Lỗi: Không thể lưu lên máy chủ, vui lòng kiểm tra mạng.");
    })
    .saveInvoiceConfig(JSON.stringify(config));
}

function resetInvoiceSettings() {
  if(!confirm("Bạn có chắc muốn đặt lại toàn bộ thiết kế về mặc định?")) return;
  INVOICE_SETTINGS_KEYS.forEach(key => localStorage.removeItem(key));
  openInvoiceSettingsModal(); 
  if (typeof appToast === 'function') appToast("Đã khôi phục mặc định.");
}

function updateInvoicePreview() {
  const config = {};
  INVOICE_SETTINGS_KEYS.forEach(key => {
    const el = document.getElementById(key);
    if (el) config[key] = el.value;
  });

  const dummyO = { id: 'HD_MẪU', cust: 'CÔNG TY KHÁCH HÀNG MẪU', sale: 'Nhân viên 1', addr: 'Số 1, Phường 2, Cần Thơ' };
  const dummyItems = [
    { Ten_Hang: 'Sản phẩm thử nghiệm (Tên rất dài để xem tự động ngắt dòng)', SL: 10, Gia: 150000, CK: 5, Ghi_Chu: '' },
    { Ten_Hang: 'Sản phẩm thứ hai', SL: 2, Gia: 300000, CK: 0, Ghi_Chu: 'VIP' }
  ];
  
  const html = buildInvoiceHTML(dummyO, dummyItems, 0, 'Giao hàng trong ngày', '0901234567', '0987654321', 0, 0, config);
  const padTB = config['is_padTB'] || '12';
  const padLR = config['is_padLR'] || '15';

  const iframe = document.getElementById('invoicePreviewFrame');
  if (iframe) {
    const doc = iframe.contentWindow.document;
    doc.open();
    let previewHtml = html.replace('</head>', `
      <style>
        @media screen {
          html { background: transparent; display: flex; justify-content: center; padding: 20px 0; }
          body { 
            width: 148mm !important;
            min-height: 210mm !important;
            margin: 0 !important; 
            padding: ${padTB}mm ${padLR}mm !important; 
            box-sizing: border-box !important;
            box-shadow: 0 5px 25px rgba(0,0,0,0.6) !important;
            background: #fff;
            transform-origin: top center;
            transform: scale(0.95);
          }
        }
      </style>
      </head>
    `);
    doc.write(previewHtml);
    doc.close();
  }
}

// ===== GỢI Ý KHÁCH HÀNG DÙNG CHUNG CHO BH/BHBD =====
function searchCustSuggest(inputEl, suggestDivId) {
  const v = bodau(inputEl.value.trim());
  const box = document.getElementById(suggestDivId);
  if (!v || !box) { if(box) box.innerHTML = ''; return; }

  const matches = (db.customers || [])
    .filter(c => c.Ten_Khach && bodau(c.Ten_Khach).includes(v))
    .slice(0, 15);

  if (!matches.length) { box.innerHTML = ''; return; }

  const inputId = inputEl.id;
  box.innerHTML = '<div class="search-res">' +
    matches.map(c => {
      const safe = (c.Ten_Khach || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
      let phone = String(c.SDT || '').trim();
      if (phone && !phone.startsWith('0')) phone = '0' + phone;
      return '<div class="sr-item" onmousedown="event.preventDefault();' +
             'document.getElementById(\'' + inputId + '\').value=\'' + safe + '\';' +
             'document.getElementById(\'' + suggestDivId + '\').innerHTML=\'\';">' +
             '<strong>' + c.Ten_Khach + '</strong>' +
             (phone ? '<span style="font-size:11px;color:var(--muted);margin-left:8px">' + phone + '</span>' : '') +
             '</div>';
    }).join('') +
  '</div>';
}

document.addEventListener('click', function(e) {
  ['bhCustSuggestions', 'bhBDCustSuggestions'].forEach(function(id) {
    const box = document.getElementById(id);
    if (box && !box.contains(e.target) &&
        e.target.id !== 'bhCustInp' && e.target.id !== 'bhBDCustInp') {
      box.innerHTML = '';
    }
  });
});

// =========================================================================
// MODULE TÌM KIẾM & PHÂN TRANG LỊCH SỬ BẢO HÀNH (20 DÒNG/TRANG)
// =========================================================================

let globalDataLsBHKBD = [];
let globalDataLsBHBD = [];
let currentPageBHKBD = 1;
let currentPageBHBD = 1;
const BH_ITEMS_PER_PAGE = 20;

function drawBaoHanhPagination(totalPages, current, containerId, tableId, callback, activeColor) {
  let pagContainer = document.getElementById(containerId);
  if (!pagContainer) {
    pagContainer = document.createElement('div');
    pagContainer.id = containerId;
    pagContainer.style.cssText = "display:flex; justify-content:center; align-items:center; gap:6px; margin-top:16px; padding-bottom:10px; flex-wrap:wrap;";
    document.getElementById(tableId).parentElement.parentElement.appendChild(pagContainer);
  }
  
  if (totalPages <= 1) {
    pagContainer.innerHTML = '';
    return;
  }
  
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    let activeStyle = i === current 
      ? `background:${activeColor}; color:#fff; border-color:${activeColor}; box-shadow:0 2px 4px rgba(0,0,0,0.1);` 
      : 'background:#fff; color:var(--muted); border-color:#cbd5e1;';
    html += `<button class="pag-btn-${containerId}" data-page="${i}" style="padding:6px 14px; border-radius:6px; border:1px solid; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s; ${activeStyle}">${i}</button>`;
  }
  pagContainer.innerHTML = html;

  document.querySelectorAll(`.pag-btn-${containerId}`).forEach(btn => {
    btn.onclick = function() {
      callback(parseInt(this.getAttribute('data-page')));
      const tableTop = document.getElementById(tableId).parentElement.parentElement.offsetTop;
      window.scrollTo({ top: tableTop - 120, behavior: 'smooth' });
    };
  });
}

// 1. TÌM KIẾM & PHÂN TRANG BẢNG: KHÔNG BÁN ĐƯỢC
const originalRenderLsBHKBD = renderLsBHKBD;
renderLsBHKBD = function(data, isFiltering = false) {
  if (!isFiltering) {
    globalDataLsBHKBD = data || []; 
    currentPageBHKBD = 1;
  }
  let displayData = isFiltering ? data : globalDataLsBHKBD;
  
  const totalPages = Math.ceil(displayData.length / BH_ITEMS_PER_PAGE);
  if (currentPageBHKBD > totalPages) currentPageBHKBD = totalPages;
  if (currentPageBHKBD < 1) currentPageBHKBD = 1;
  
  const startIndex = (currentPageBHKBD - 1) * BH_ITEMS_PER_PAGE;
  const pagedData = displayData.slice(startIndex, startIndex + BH_ITEMS_PER_PAGE);
  
  originalRenderLsBHKBD(pagedData);
  
  drawBaoHanhPagination(totalPages, currentPageBHKBD, 'pagLsBHKBD', 'tblLsBHKBD', function(page) {
    currentPageBHKBD = page;
    const kw = document.getElementById('filterLsBHKBDInp').value;
    renderLsBHKBD(kw ? globalDataLsBHKBD.filter(r => bodau(r.name).includes(bodau(kw))) : globalDataLsBHKBD, true);
  }, 'var(--info)');
};

function suggestFilterLsBHKBD(inputEl) {
  currentPageBHKBD = 1;
  const v = bodau(inputEl.value.trim());
  const box = document.getElementById('suggestLsBHKBDBox');
  
  if (!v) {
    box.innerHTML = '';
    renderLsBHKBD(globalDataLsBHKBD, true);
    return;
  }

  const matches = (db.products || []).filter(p => p.Ten_San_Pham && bodau(p.Ten_San_Pham).includes(v)).slice(0, 20);
  box.innerHTML = matches.length ? '<div class="search-res" style="max-height: 250px; overflow-y: auto; border:none;">' +
    matches.map(p => `<div class="sr-item" onmousedown="event.preventDefault(); applyFilterLsBHKBD('${(p.Ten_San_Pham || '').replace(/'/g, "\\'").replace(/"/g, '\\"')}')"><span><strong>${p.Ten_San_Pham}</strong></span></div>`).join('') + '</div>' : '';

  renderLsBHKBD(globalDataLsBHKBD.filter(r => bodau(r.name).includes(v)), true);
}

function applyFilterLsBHKBD(productName) {
  currentPageBHKBD = 1;
  document.getElementById('filterLsBHKBDInp').value = productName;
  document.getElementById('suggestLsBHKBDBox').innerHTML = '';
  renderLsBHKBD(globalDataLsBHKBD.filter(r => bodau(r.name) === bodau(productName)), true);
}

// 2. TÌM KIẾM & PHÂN TRANG BẢNG: BÁN ĐƯỢC
const originalRenderLsBHBD = renderLsBHBD;
renderLsBHBD = function(data, isFiltering = false) {
  if (!isFiltering) {
    globalDataLsBHBD = data || [];
    currentPageBHBD = 1;
  }
  let displayData = isFiltering ? data : globalDataLsBHBD;
  
  const totalPages = Math.ceil(displayData.length / BH_ITEMS_PER_PAGE);
  if (currentPageBHBD > totalPages) currentPageBHBD = totalPages;
  if (currentPageBHBD < 1) currentPageBHBD = 1;
  
  const startIndex = (currentPageBHBD - 1) * BH_ITEMS_PER_PAGE;
  const pagedData = displayData.slice(startIndex, startIndex + BH_ITEMS_PER_PAGE);
  
  originalRenderLsBHBD(pagedData);
  
  drawBaoHanhPagination(totalPages, currentPageBHBD, 'pagLsBHBD', 'tblLsBHBD', function(page) {
    currentPageBHBD = page;
    const kw = document.getElementById('filterLsBHBDInp').value;
    renderLsBHBD(kw ? globalDataLsBHBD.filter(r => bodau(r.name).includes(bodau(kw))) : globalDataLsBHBD, true);
  }, 'var(--suc)');
};

function suggestFilterLsBHBD(inputEl) {
  currentPageBHBD = 1;
  const v = bodau(inputEl.value.trim());
  const box = document.getElementById('suggestLsBHBDBox');
  
  if (!v) {
    box.innerHTML = '';
    renderLsBHBD(globalDataLsBHBD, true);
    return;
  }

  const matches = (db.products || []).filter(p => p.Ten_San_Pham && bodau(p.Ten_San_Pham).includes(v)).slice(0, 20);
  box.innerHTML = matches.length ? '<div class="search-res" style="max-height: 250px; overflow-y: auto; border:none;">' +
    matches.map(p => `<div class="sr-item" onmousedown="event.preventDefault(); applyFilterLsBHBD('${(p.Ten_San_Pham || '').replace(/'/g, "\\'").replace(/"/g, '\\"')}')"><span><strong>${p.Ten_San_Pham}</strong></span></div>`).join('') + '</div>' : '';

  renderLsBHBD(globalDataLsBHBD.filter(r => bodau(r.name).includes(v)), true);
}

function applyFilterLsBHBD(productName) {
  currentPageBHBD = 1;
  document.getElementById('filterLsBHBDInp').value = productName;
  document.getElementById('suggestLsBHBDBox').innerHTML = '';
  renderLsBHBD(globalDataLsBHBD.filter(r => bodau(r.name) === bodau(productName)), true);
}

document.addEventListener('click', function(e) {
  ['suggestLsBHKBDBox', 'suggestLsBHBDBox'].forEach(id => {
    const box = document.getElementById(id);
    if (box && !box.contains(e.target) && e.target.id !== 'filterLsBHKBDInp' && e.target.id !== 'filterLsBHBDInp') {
      box.innerHTML = '';
    }
  });
});
