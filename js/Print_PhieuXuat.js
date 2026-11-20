function buildPhieuXuatKhoHTML(o, items, total, pPhone, sPhone, pDebt) {
  const timeStr = o.time || new Date().toLocaleString('vi-VN');
  
  let rows = items.map((it,i)=>{
    const sl = Number(it.SL)||0;
    const gia = Number(it.Gia)||0;
    const tt = sl*gia;
    return `<tr>
      <td style="text-align:center">${i+1}</td>
      <td style="text-align:left; font-size: 11px; line-height: 1.2; padding: 4px;">
        <div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">
          ${it.Ten_Hang}
        </div>
      </td>
      <td style="text-align:center;font-weight:bold">${sl}</td>
      <td style="text-align:center">${gia.toLocaleString()}</td>
      <td style="text-align:center;font-weight:bold">${tt.toLocaleString()}</td>
      <td style="text-align:center">${it.Ghi_Chu||''}</td>
    </tr>`;
  }).join('');

  // --- XỬ LÝ LOGIC GHI CHÚ BẢO HÀNH CẢ 2 LOẠI ---
  let noteHeader = "Ghi Chú:";
  let noteItemsText = "";
  
  // Dò tìm nếu có chữ Trả BHCH hoặc Hàng Bán Được hoặc Trừ Tiền BHCH
  if (o.note && (o.note.includes("Trả BHCH") || o.note.includes("Hàng Bán Được") || o.note.includes("Trừ Tiền BHCH") || o.note.includes("Trừ BHCH"))) {
    
    // Xét tiêu đề hiển thị cho phù hợp (Tự động dịch Hàng Bán Được -> Trừ Tiền)
    if (o.note.includes("Trả BHCH") && (o.note.includes("Hàng Bán Được") || o.note.includes("Trừ Tiền BHCH") || o.note.includes("Trừ BHCH"))) {
        noteHeader = "Ghi Chú: Trả BH & Trừ Tiền";
    } else if (o.note.includes("Hàng Bán Được") || o.note.includes("Trừ Tiền BHCH") || o.note.includes("Trừ BHCH")) {
        noteHeader = "Ghi Chú: Trừ Tiền BHCH";
    } else {
        noteHeader = "Ghi Chú: Trả BHCH";
    }

    // Lấy các dòng sản phẩm (bắt đầu bằng dấu gạch ngang)
    let lines = o.note.split('\n').filter(l => l.trim().startsWith('-'));
    
    noteItemsText = lines.map(l => {
      let idx = l.lastIndexOf('(SL:');
      let itemName = l;
      let qtyText = "";
      
      if (idx !== -1) {
         itemName = l.substring(1, idx).trim(); // Bỏ dấu "-" và lấy tên
         // SỬA TẠI ĐÂY: Quét lấy tất cả chữ và số bên trong ngoặc (VD: "1 x 150,000")
         let match = l.match(/\(SL:\s*(.+?)\)/);
         if (match) qtyText = match[1];
      } else {
         itemName = l.replace(/^-/, '').trim();
      }
      
      // Canh chỉnh 1 hàng có số lượng và giá
      return `<div style="display: flex; align-items: flex-start; margin-bottom: 2px; width: 100%;">
                <div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; min-width: 0; line-height: 1.3; flex: 1;">
                  ${itemName}
                </div>
                <div style="white-space: nowrap; flex-shrink: 0; line-height: 1.3; font-weight: bold;">
                  &nbsp;: ${qtyText}
                </div>
              </div>`;
    }).join('');
    
  } else {
    // Nếu là đơn thường, không có bảo hành
    noteItemsText = (o.note || "").replace(/\n/g, '<br>');
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Phiếu Xuất Kho ${o.id}</title>
<style>
  @page{size:A5 portrait;margin:10mm;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family: Arial, sans-serif;font-size:12px;color:#000; padding: 10px;}
  .title-com{text-align:center;font-size:22px;font-weight:bold;margin-top:10px;}
  .title-doc{text-align:center;font-size:14px; margin-top:5px; margin-bottom:15px; text-transform:uppercase;}
  
  .info-grid{display:flex; justify-content:space-between; margin-bottom:15px; font-size:11px;}
  .info-col{width:48%;}
  .info-line{margin-bottom:4px;}
  
  table{width:100%;border-collapse:collapse;margin-bottom:10px;}
  th,td{border:1px solid #000;padding:6px 4px;font-size:11px;}
  th{font-weight:bold;text-align:center;}

  /* --- FOOTER LAYOUT --- */
  .footer-container { margin-top: 5px; width: 100%; }
  .footer-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
  .footer-left { flex: 1; text-align: left; padding-right: 20px; overflow: hidden; }
  .footer-right { flex: 0 0 220px; text-align: right; }
  
  .note-label { font-size: 12px; font-weight: bold; }
  .total-label { font-size: 14px; font-weight: bold; text-transform: uppercase; }
  
  .note-content { font-size: 10px; font-style: italic; line-height: 1.3; }
  .debt-label { font-size: 13px; line-height: 1.3; }
</style>
</head>
<body onload="window.print();setTimeout(()=>window.close(),1000);">
  <div class="title-com">Công Ty Ánh Dương</div>
  <div class="title-doc">PHIẾU XUẤT KHO</div>

  <div class="info-grid">
    <div class="info-col">
      <div class="info-line"><strong>Mã đơn:</strong> ${o.id} | <strong>Ngày:</strong> ${timeStr}</div>
      <div class="info-line"><strong>Khách hàng:</strong> <span style="font-size:16px;font-weight:bold">${o.cust}</span></div>
      <div class="info-line"><strong>Địa chỉ:</strong> ${o.addr||'...'}</div>
      <div class="info-line"><strong>SĐT:</strong> ${pPhone||'...'}</div>
    </div>
    <div class="info-col" style="text-align:right;">
      <div class="info-line"><strong>Nhân viên:</strong> ${o.sale||''}</div>
      <div class="info-line"><strong>SĐT Sale:</strong> ${sPhone||'...'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th width="6%">STT</th>
        <th>Sản phẩm</th>
        <th width="8%">SL</th>
        <th width="15%">Giá</th>
        <th width="18%">Thành tiền</th>
        <th width="12%">Ghi chú</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer-container">
    <div class="footer-row">
      <div class="footer-left note-label">${noteHeader}</div>
      <div class="footer-right total-label">TỔNG CỘNG: ${total.toLocaleString()} VNĐ</div>
    </div>
    
    <div class="footer-row">
      <div class="footer-left note-content">
        ${noteItemsText}
      </div>
      <div class="footer-right debt-label">
        Công nợ cũ: <span style="font-weight:bold;">${pDebt > 0 ? pDebt.toLocaleString() + ' VNĐ' : '0 VNĐ'}</span>
      </div>
    </div>
  </div>

</body></html>`;
}

// FIX CHÍNH: Ép hàm này vào window để trình duyệt không báo "is not defined" nữa
window.printPhieuXuatKho = function(id) {
  const oHist = (db.history||[]).find(x=>String(x.id)===String(id));
  const oXuLy = (db.historyForXuLy||[]).find(x=>String(x.id)===String(id));
  const o = oHist || oXuLy;
  
  if(!o) { alert("Không tìm thấy đơn hàng!"); return; }
  
  const items=(o.items||[]);
  const total=items.reduce((s,i)=>s+Math.round(Number(i.SL)*Number(i.Gia)),0);
  
  let pPhone="", sPhone="", pDebt=0;
  if(db.customers){
    const m=db.customers.find(c=>String(c.Ten_Khach||'').trim().toLowerCase()===String(o.cust||'').trim().toLowerCase());
    if(m){
      pPhone=String(m.SDT||'').trim();if(pPhone&&!pPhone.startsWith('0'))pPhone='0'+pPhone;
      pDebt = Number(m.Cong_No||0);
    }
  }
  if(db.staffs){
    const m=db.staffs.find(s=>String(s.name||'').trim().toLowerCase()===String(o.sale||'').trim().toLowerCase());
    if(m){sPhone=String(m.phone||'').trim();if(sPhone&&!sPhone.startsWith('0'))sPhone='0'+sPhone;}
  }

  const html = buildPhieuXuatKhoHTML(o, items, total, pPhone, sPhone, pDebt);
  const w = window.open('','_blank');
  if(w){
    w.document.write(html);
    w.document.close();
  } else {
    alert("Cho phép popup để in!");
  }
  
  if(window.localPrintedIds && !window.localPrintedIds.includes(String(id))) {
     window.localPrintedIds.push(String(id));
  }
  
  if (oHist && oHist.status === "Chờ in") oHist.status = "Đã in";
  if (oXuLy && oXuLy.status === "Chờ in") oXuLy.status = "Đã in";

  if(typeof renderHistoryUI === 'function') renderHistoryUI();
  if(typeof renderXuLyUI === 'function') renderXuLyUI();
  if(typeof updateXuLyBadge === 'function') updateXuLyBadge();
  
  google.script.run.withSuccessHandler(()=>{}).markAsPrinted(id);
};
