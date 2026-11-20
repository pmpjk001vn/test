function buildInvoiceHTML(o, items, total, note, pPhone, sPhone, globalCK, oldDebt, prePaid = 0, config = null) {
  if (typeof prePaid === 'object' && prePaid !== null) {
    config = prePaid;
    prePaid = 0;
  }

  const getS = (key, defaultVal) => config ? (config[key] || defaultVal) : (localStorage.getItem(key) || defaultVal);
  
  const v_logoUrl = getS('is_logoUrl', 'https://i.postimg.cc/mZ0B69QB/logo-AD.png');
  const v_logoW = getS('is_logoW', '160');
  const v_logoH = getS('is_logoH', '60'); 
  
  const v_comNameSize = getS('is_comNameSize', '13');
  const v_comAddrSize = getS('is_comAddrSize', '10');

  const v_shdSize = getS('is_shdSize', '11');
  const v_shdMt = getS('is_shdMt', '0');
  const v_shdAlign = getS('is_shdAlign', 'right');

  const v_titleSize = getS('is_titleSize', '20');
  const v_titleColor = getS('is_titleColor', '#000000');
  const v_titleMt = getS('is_titleMt', '5'); 
  const v_titleMb = getS('is_titleMb', '10'); 
  
  const v_custNameSize = getS('is_custNameSize', '20');
  const v_custNameColor = getS('is_custNameColor', '#000000');
  
  const v_custInfoSize = getS('is_custInfoSize', '13');
  const v_custInfoMb = getS('is_custInfoMb', '8');
  
  const v_phoneSize = getS('is_phoneSize', '11');
  const v_phoneMt = getS('is_phoneMt', '4');
  
  const v_thSize = getS('is_thSize', '12');
  const v_tdSize = getS('is_tdSize', '12');
  const v_thBg = getS('is_thBg', '#ffffff');
  const v_thColor = getS('is_thColor', '#000000');
  const v_tdPad = getS('is_tdPad', '5');
  const v_borderC = getS('is_borderColor', '#000000');
  const v_borderW = getS('is_borderW', '1.5');
  
  const th0 = getS('is_th0', 'STT');
  const th1 = getS('is_th1', 'TÊN HÀNG');
  const th2 = getS('is_th2', 'SL');
  const th3 = getS('is_th3', 'ĐƠN GIÁ');
  const th4 = getS('is_th4', 'CK');
  const th5 = getS('is_th5', 'ĐƠN GIÁ CK');
  const th6 = getS('is_th6', 'THÀNH TIỀN');
  const th7 = getS('is_th7', 'GHI CHÚ');
  
  const v_ttSize = getS('is_ttSize', '14');
  const v_tcSize = getS('is_tcSize', '15');
  const v_ncSize = getS('is_ncSize', '13');
  const v_padLR = getS('is_padLR', '15');
  const v_padTB = getS('is_padTB', '12');

  // --- TÍNH TOÁN TIỀN ---
  const subtotal = Math.round(items.reduce((s,i) => {
    const ck = Number(i.CK) || 0;
    const gia = Number(i.Gia) || 0;
    const sl = Number(i.SL) || 0;
    return s + (sl * gia * (1 - ck / 100));
  }, 0));

  const gck = Number(globalCK) || 0;
  let finalTotal = subtotal - gck;
  const no = Number(oldDebt) || 0;
  const pPaid = Number(prePaid) || 0;
  const tongCong = finalTotal + no - pPaid;

  // ✅ FIX NGÀY IN:
  // - xlPrintAndFinish (Hoàn Thành lần đầu): o.realDate đã bị override = Date.now() trước khi gọi hàm này
  // - xlUpdateAndPrintFin (Sửa & In lại):    o.realDate giữ nguyên = ngày hoàn thành gốc từ server
  // - xlPrintInvoiceOnly (In lại):            o.realDate giữ nguyên = ngày hoàn thành gốc từ server
  const today = (o && o.realDate) ? new Date(o.realDate) : new Date();
  const dayStr = String(today.getDate()).padStart(2, '0') + ' Tháng ' + String(today.getMonth() + 1).padStart(2, '0') + ' Năm ' + today.getFullYear();

  let totalQty = 0;
  
  // Gộp hàng khi in
  let mergedItems = [];
  items.forEach(it => {
    let pName = String(it.Ten_Hang).trim();
    let gia = Number(it.Gia) || 0;
    let ck = Number(it.CK) || 0;
    let sl = Number(it.SL) || 0;
    
    let existing = mergedItems.find(m => String(m.Ten_Hang).trim() === pName && m.Gia === gia && m.CK === ck);
    if (existing) {
      existing.SL += sl;
      if (it.Ghi_Chu && !String(existing.Ghi_Chu).includes(it.Ghi_Chu)) {
        existing.Ghi_Chu = existing.Ghi_Chu ? existing.Ghi_Chu + ", " + it.Ghi_Chu : it.Ghi_Chu;
      }
    } else {
      mergedItems.push({...it, SL: sl, Gia: gia, CK: ck});
    }
  });

  let rows = mergedItems.map((it,i)=>{
    const ck=Number(it.CK)||0;
    const gia=Number(it.Gia)||0;
    const sl=Number(it.SL)||0;
    const giaSauCk=Math.round(gia*(1-ck/100)); 
    const tt=Math.round(sl*gia*(1-ck/100));   
    totalQty+=sl;
    return `<tr>
      <td style="text-align:center">${i+1}</td>
      <td style="text-align:left; line-height: 1.2;">
        <div style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;">
          ${it.Ten_Hang}
        </div>
      </td>
      <td style="text-align:center">${sl}</td>
      <td style="text-align:right">${gia.toLocaleString()}</td>
      <td style="text-align:center">${ck}%</td>
      <td style="text-align:right">${giaSauCk.toLocaleString()}</td>
      <td style="text-align:right">${tt.toLocaleString()}</td>
      <td style="text-align:center;font-weight:bold">${it.Ghi_Chu||''}</td>
    </tr>`;
  }).join('');

  const bodyTag = config ? '<body>' : '<body onload="window.print();setTimeout(()=>window.close(),1000);">';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Hóa đơn ${o.id}</title>
<style>
  @page { size: A5 portrait; margin: ${v_padTB}mm ${v_padLR}mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 13px; background: #fff; color: #000; }
  
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0px; }
  .com-info { width: 62%; text-align: left; }
  .com-name { font-size: ${v_comNameSize}px; font-weight: bold; margin-bottom: 4px; line-height: 1.3; }
  .com-addr { font-size: ${v_comAddrSize}px; font-weight: bold; line-height: 1.3; }
  .phone-line { font-size: ${v_phoneSize}px; font-weight: bold; white-space: nowrap; margin-top: ${v_phoneMt}px; }
  
  .logo-area { width: 23%; text-align: center; }
  .logo-img { width: ${v_logoW}px; height: ${v_logoH}px; object-fit: fill; margin-bottom: 5px; }
  
  .shd-area { width: 15%; text-align: ${v_shdAlign}; font-size: ${v_shdSize}px; font-weight: bold; margin-top: ${v_shdMt}px; line-height: 1.2; }
  
  .inv-title { text-align: center; font-size: ${v_titleSize}px; color: ${v_titleColor}; font-weight: bold; margin-top: ${v_titleMt}px; margin-bottom: ${v_titleMb}px; }
  
  .cust-table { width: 100%; border-collapse: collapse; font-size: ${v_custInfoSize}px; }
  .cust-table td { padding: 2px 0; }
  .lbl-fit { width: 1%; white-space: nowrap; padding-right: 5px; } 
  .cust-name-val { font-size: ${v_custNameSize}px; color: ${v_custNameColor}; font-weight: bold; padding-left: 5px; line-height: 1.1; width: auto; }
  
  .prod-table { width: 100%; border-collapse: collapse; border: ${v_borderW}px solid ${v_borderC}; margin-bottom: 10px; }
  .prod-table th, .prod-table td { border: 1px solid ${v_borderC}; padding: ${v_tdPad}px 4px; font-size: ${v_tdSize}px; }
  .prod-table th { font-weight: bold; text-align: center; vertical-align: middle; background: ${v_thBg}; color: ${v_thColor}; font-size: ${v_thSize}px; }
  
  .footer-flex { display: flex; justify-content: space-between; margin-top: 5px; }
  .note-col{width:40%;font-weight:bold;font-size:12px;text-transform:uppercase;padding-top:5px;white-space:pre-wrap;word-break:break-word;}
  .total-col { width: 58%; }
  .total-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .total-table td { padding: 3px 0; }
  .tt-lbl { text-align: left; }
  .tt-val { text-align: right; }
  .txt-b { font-weight: bold; }
  .date-line { text-align: right; font-style: italic; font-size: 11px; margin: 5px 0 10px; }
  .sign-grid { display: flex; justify-content: space-between; text-align: center; font-size: 11px; font-weight: bold; }
  .sign-box { width: 33%; }
  .sign-name { margin-top: 55px; font-weight: normal; }
  .disclaimer { text-align: center; font-weight: bold; font-size: 10px; margin-top: 15px; }
  
  @media print { thead { display: table-row-group; } }
</style>
</head>
${bodyTag}
  <div class="header">
    <div class="com-info">
      <div class="com-name">CÔNG TY TNHH THIẾT BỊ KIM KHÍ<br><div style="text-align:center; font-size:14px; font-weight:bold;">ÁNH DƯƠNG</div></div>
      <div class="com-addr">
        Đ/C: 241A, KV Thạnh Hòa, P.Cái răng, TP Cần Thơ.<br>
        STK: 911776868 - Techcombank - Chi Nhánh Cần Thơ<br>
        CÔNG TY TNHH THIẾT BỊ KIM KHÍ ÁNH DƯƠNG
      </div>
      <div class="phone-line">ĐT: 0907224123 - 0939911154</div>
    </div>
    <div class="logo-area">
      <img src="${v_logoUrl}" alt="Logo" class="logo-img">
    </div>
    <div class="shd-area">SHĐ<br>${o.id.replace('HD','')}</div>
  </div>
  
  <div class="inv-title">HÓA ĐƠN BÁN HÀNG</div>

  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: ${v_custInfoMb}px;">
    <div style="flex: 1; padding-right: 15px;">
      <table class="cust-table">
        <tr>
          <td class="lbl-fit" style="vertical-align: middle;">Khách hàng:</td>
          <td class="cust-name-val" style="vertical-align: middle;">${o.cust}</td>
        </tr>
        <tr>
          <td class="lbl-fit" style="vertical-align: top;">Địa chỉ:</td>
          <td style="padding-left: 5px; vertical-align: top;">${o.addr||'...'}</td>
        </tr>
        <tr>
          <td class="lbl-fit" style="vertical-align: top;">SĐT:</td>
          <td style="padding-left: 5px; vertical-align: top;">${pPhone||'...'}</td>
        </tr>
      </table>
    </div>
    <div style="flex: none; white-space: nowrap; text-align: right; border-left: 1px dashed #ccc; padding-left: 15px; font-size: 12px; line-height: 1.4;">
      <div style="color: #444;">Saler: <strong style="color: #000; font-size: 13px;">${o.sale||''}</strong></div>
      <div style="color: #444; margin-top: 2px;">SĐT: <strong style="color: #000;">${sPhone||'...'}</strong></div>
    </div>
  </div>

  <table class="prod-table">
    <thead>
      <tr>
        <th width="3%">${th0}</th>
        <th width="43%">${th1}</th>
        <th width="4%">${th2}</th>
        <th width="10%">${th3}</th>
        <th width="4%">${th4}</th>
        <th width="11%">${th5}</th>
        <th width="13%">${th6}</th>
        <th width="10%">${th7}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer-flex">
    <div class="note-col">GHI CHÚ: ${(note||'').replace(/\n/g,'<br>')}</div>
    <div class="total-col">
      <table class="total-table">
        <tr><td class="tt-lbl">Tổng Số Lượng:</td><td class="tt-val">${totalQty}</td></tr>
        <tr><td class="tt-lbl">Tổng Tiền Hàng:</td><td class="tt-val">${subtotal.toLocaleString()}</td></tr>
        ${gck>0?`<tr><td class="tt-lbl">Trừ Chiết Khấu:</td><td class="tt-val">-${gck.toLocaleString()}</td></tr>`:''}
        <tr><td class="tt-lbl txt-b" style="font-size:${v_ttSize}px;border-top:1px solid #000;padding-top:4px">TỔNG THANH TOÁN:</td><td class="tt-val txt-b" style="font-size:${v_ttSize}px;border-top:1px solid #000;padding-top:4px">${finalTotal.toLocaleString()}</td></tr>
        <tr><td class="tt-lbl txt-b" style="color:#c00;font-size:${v_ncSize}px">Nợ Cũ:</td><td class="tt-val" style="color:#c00;font-size:${v_ncSize}px">${no.toLocaleString()}</td></tr>
        <tr><td class="tt-lbl txt-b" style="color:#1a56db;">Khách Thanh Toán Trước:</td><td class="tt-val txt-b" style="color:#1a56db;">-${pPaid.toLocaleString()}</td></tr>
        <tr><td class="tt-lbl txt-b" style="font-size:${v_tcSize}px">TỔNG CỘNG:</td><td class="tt-val txt-b" style="font-size:${v_tcSize}px">${tongCong.toLocaleString()}</td></tr>
      </table>
      <div class="date-line">Ngày ${dayStr}</div>
    </div>
  </div>

  <div class="sign-grid">
    <div class="sign-box">Khách hàng<div class="sign-name">${o.cust}</div></div>
    <div class="sign-box">Giao hàng</div>
    <div class="sign-box">Người làm toa<div class="sign-name"></div></div>
  </div>
  <div class="disclaimer">(Hóa đơn có giá trị khiếu nại trong 03 ngày)<br>Nhận đổi trả hàng hóa trong 30 ngày</div>
</body></html>`;
}

function xlPrintAndFinish(id){
  const all=db.historyForXuLy||[];
  const o=all.find(x=>x.id===id);if(!o)return;

  const now = Date.now();
  const rawItems = xlEditItems[id] || o.items.map(i=>({...i,CK:Number(i.CK)||0}));
  
  let oldItemsUnmatched = JSON.parse(JSON.stringify(o.items || []));
  
  const items = rawItems.map(item => {
      if (item.addDate) return { ...item };
      const oldIdx = oldItemsUnmatched.findIndex(old => old.Ten_Hang === item.Ten_Hang);
      if (oldIdx !== -1) {
          let matchedOld = oldItemsUnmatched.splice(oldIdx, 1)[0]; 
          return { ...item, addDate: matchedOld.addDate || o.realDate };
      }
      return { ...item, addDate: now };
  });
  
  const gck=xlGlobalCK[id]||0;
  const subtotal=xlCalcSubtotal(items);
  const finalTotal=xlCalcFinalTotal(items,gck);

  const noEl=document.getElementById('xlOldDebt_'+id);
  const oldDebt=noEl?Number(noEl.getAttribute('data-debt'))||0:Number(o.noCu!==undefined?o.noCu:(o.oldDebt||0));
  
  const ppEl = document.getElementById('xlPrePaid_'+id);
  const prePaid = ppEl ? Number(ppEl.value) || 0 : 0;

  const noteEl=document.getElementById('xlNote_'+id);
  const note=noteEl?noteEl.value:o.note||'';
  let pPhone="",sPhone="";
  if(db.customers){const m=db.customers.find(c=>bodau(c.Ten_Khach)===bodau(o.cust));if(m){pPhone=String(m.SDT||'').trim();if(pPhone&&!pPhone.startsWith('0'))pPhone='0'+pPhone;}}
  if(db.staffs){const m=db.staffs.find(s=>String(s.name||'').trim().toLowerCase()===String(o.sale||'').trim().toLowerCase());if(m){sPhone=String(m.phone||'').trim();if(sPhone&&!sPhone.startsWith('0'))sPhone='0'+sPhone;}}
  
  o.realDate = now;

  const html=buildInvoiceHTML(o,items,finalTotal,note,pPhone,sPhone,gck,oldDebt, prePaid);
  const w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}else{alert("Vui lòng cho phép popup để in!");}
  
  const processData={items:items,note:note,total:finalTotal,origTotal:subtotal,globalCK:gck,oldDebt:oldDebt, prePaid: prePaid, addr:o.addr||''};
  
  google.script.run
    .withSuccessHandler((res)=>{
      // ✅ FIX: server trả về noCu/prePaid chuẩn -> đồng bộ lại local ngay, không cần đợi loadHist() 10s
      console.log("Đã lưu đơn " + id + " trên server thành công", res);
      if(res && res.success){
        const finalNoCu = (res.noCu !== undefined) ? Number(res.noCu) : oldDebt;
        const target = (db.historyForXuLy||[]).find(x=>x.id===id);
        if(target) target.noCu = finalNoCu;
        const ho = (db.history||[]).find(x=>x.id===id);
        if(ho) ho.noCu = finalNoCu;
      } else if (res && res.success === false) {
        appAlert("⚠️ Lỗi lưu server: " + res.msg, "error");
      }
    })
    .withFailureHandler(err=>{
      alert("⚠️ Cảnh báo: Lỗi khi lưu trạng thái lên máy chủ: "+err.message+"\nVui lòng tải lại trang (F5) để kiểm tra.");
    })
    .processOrder(id,processData);
  try {
    // ✅ FIX: dùng đúng field "noCu" (không phải "oldDebt") để đồng bộ với renderXlModalContent
    o.items=items;o.total=finalTotal;o.note=note;o.noCu=oldDebt;o.prePaid=prePaid;o.status='Hoàn thành';
    delete xlEditItems[id];delete xlGlobalCK[id];
    
    // ✅ FIX: cập nhật luôn công nợ khách hàng local để các toa xử lý tiếp theo
    // trong cùng phiên (trước khi loadData() reload) tính đúng "Nợ Cũ"
    if(db.customers){
      const cust = db.customers.find(c=>bodau(c.Ten_Khach)===bodau(o.cust));
      if(cust) cust.Cong_No = oldDebt + finalTotal - prePaid;
    }
    
    closeXlModal(); 
    updateXuLyBadge();
    renderXuLyUI();
    
    if(db.history){const ho=db.history.find(x=>x.id===id);if(ho){ho.status='Hoàn thành';ho.items=items;ho.total=finalTotal;ho.note=note;ho.noCu=oldDebt;ho.prePaid=prePaid;}}
    renderHistoryUI();
    if(typeof renderLichSuHoaDon==='function'){
      if(document.getElementById('pLichSuHoaDon')&&document.getElementById('pLichSuHoaDon').style.display!=='none')renderLichSuHoaDon();
    }
  } catch(err) {
    console.error("Lỗi cập nhật giao diện:", err);
    closeXlModal();
  }
}

function xlPrintInvoiceOnly(id){
  const all=db.historyForXuLy||[];
  const o=all.find(x=>x.id===id);if(!o)return;
  const items=(xlEditItems[id]||o.items).map(i=>({...i,CK:Number(i.CK)||0}));
  const gck=xlGlobalCK[id]||0;
  const finalTotal=xlCalcFinalTotal(items,gck);

  const noEl=document.getElementById('xlOldDebt_'+id);
  // ✅ FIX: fallback đọc cả o.noCu lẫn o.oldDebt (tên field cũ) để không bị hụt dữ liệu
  const oldDebt=noEl?Number(noEl.getAttribute('data-debt'))||0:Number(o.noCu!==undefined?o.noCu:(o.oldDebt||0));
  
  const ppEl = document.getElementById('xlPrePaid_'+id);
  let prePaid = 0;
  if (ppEl) {
    prePaid = Number(ppEl.value) || 0;
  } else if (typeof xlPrePaid !== 'undefined' && xlPrePaid[id] !== undefined) {
    prePaid = xlPrePaid[id];
  } else {
    prePaid = Number(o.prePaid) || 0;
  }
  
  let pPhone="",sPhone="";
  if(db.customers){const m=db.customers.find(c=>bodau(c.Ten_Khach)===bodau(o.cust));if(m){pPhone=String(m.SDT||'').trim();if(pPhone&&!pPhone.startsWith('0'))pPhone='0'+pPhone;}}
  if(db.staffs){const m=db.staffs.find(s=>String(s.name||'').trim().toLowerCase()===String(o.sale||'').trim().toLowerCase());if(m){sPhone=String(m.phone||'').trim();if(sPhone&&!sPhone.startsWith('0'))sPhone='0'+sPhone;}}
  
  const html=buildInvoiceHTML(o,items,finalTotal,o.note||'',pPhone,sPhone,gck,oldDebt, prePaid);
  const w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}else{alert("Vui lòng cho phép popup để in!");}
}

function xlUpdateAndPrintFin(id) {
  let items = xlEditItems[id]; 
  if(!items || items.some(i => i.SL === "" || i.SL <= 0)) { 
    appAlert("Vui lòng nhập số lượng hợp lệ!", "warning"); 
    return; 
  }

  const o = (db.historyForXuLy||[]).find(x=>x.id===id);
  if(!o) return;

  const now = Date.now();
  let oldItemsUnmatched = JSON.parse(JSON.stringify(o.items || []));
  
  items = items.map(item => {
      if (item.addDate) return { ...item };
      const oldIdx = oldItemsUnmatched.findIndex(old => old.Ten_Hang === item.Ten_Hang);
      if (oldIdx !== -1) {
          let matchedOld = oldItemsUnmatched.splice(oldIdx, 1)[0]; 
          return { ...item, addDate: matchedOld.addDate || o.realDate };
      }
      return { ...item, addDate: now };
  });

  const gck = xlGlobalCK[id] || 0;
  const origTotal = xlCalcSubtotal(items);
  const finalTotal = xlCalcFinalTotal(items, gck);
  const noteEl = document.getElementById('xlNote_'+id);
  const finalNote = noteEl ? noteEl.value.trim() : "";

  let campaignName = "";
  document.querySelectorAll('select').forEach(sel => {
    if (sel.innerHTML.includes("Phú Quốc") || sel.innerHTML.includes("Côn Đảo")) {
      campaignName = sel.value;
    }
  });

  const noEl = document.getElementById('xlOldDebt_'+id);
  const oldDebt = noEl ? Number(noEl.getAttribute('data-debt'))||0 : Number(o.noCu)||0;

  const ppEl = document.getElementById('xlPrePaid_'+id);
  const prePaid = ppEl ? Number(ppEl.value) || 0 : Number(o.prePaid) || 0;

  let pPhone="", sPhone="";
  if(db.customers){const m=db.customers.find(c=>String(c.Ten_Khach||'').trim().toLowerCase()===String(o.cust||'').trim().toLowerCase());if(m){pPhone=String(m.SDT||'').trim();if(pPhone&&!pPhone.startsWith('0'))pPhone='0'+pPhone;}}
  if(db.staffs){const m=db.staffs.find(s=>String(s.name||'').trim().toLowerCase()===String(o.sale||'').trim().toLowerCase());if(m){sPhone=String(m.phone||'').trim();if(sPhone&&!sPhone.startsWith('0'))sPhone='0'+sPhone;}}

  // ✅ o.realDate giữ nguyên = ngày hoàn thành gốc từ server → in ra đúng ngày gốc
  const html = buildInvoiceHTML(o, items, finalTotal, finalNote, pPhone, sPhone, gck, oldDebt, prePaid);
  const w = window.open('', '_blank');
  if(w){ w.document.write(html); w.document.close(); }
  else { alert("Vui lòng cho phép popup để in!"); }

  const btn = document.querySelector('#xlModalFoot .btn-fin');
  if(btn){ btn.disabled = true; btn.textContent = 'Đang cập nhật...'; }

  const ckText = (gck > 0 ? "-" + gck + "đ" : "0");
  const payload = { items, origTotal, total: finalTotal, globalCK: gck, note: finalNote, campaign: campaignName, prePaid: prePaid };

  const o1 = (db.historyForXuLy||[]).find(x=>x.id===id);
  if(o1){ o1.items=items; o1.total=finalTotal; o1.note=finalNote; o1.statusCK=ckText; o1.ck=ckText; o1.noCu=oldDebt; o1.prePaid=prePaid; o1.campaign=campaignName; }
  const o2 = (db.history||[]).find(x=>x.id===id);
  if(o2){ o2.items=items; o2.total=finalTotal; o2.note=finalNote; o2.statusCK=ckText; o2.ck=ckText; o2.noCu=oldDebt; o2.prePaid=prePaid; o2.campaign=campaignName; }

  if(db.products){
    items.forEach(newItem => {
      const prod = db.products.find(p => String(p.Ten_San_Pham).trim() === String(newItem.Ten_Hang).trim());
      if(prod){ prod.So_Luong = Math.max(0, (Number(prod.So_Luong)||0) - (Number(newItem.SL)||0)); }
    });
  }

  let cust = db.customers ? db.customers.find(c => String(c.Ten_Khach).trim() === String(o.cust).trim()) : null;
  if(cust){
    setTimeout(() => {
      cust.Cong_No = oldDebt + finalTotal - prePaid; 
      if(document.getElementById('pLichSuCongNo')&&document.getElementById('pLichSuCongNo').style.display!=='none') renderCongNoList();
      if(document.getElementById('pCustomers')&&document.getElementById('pCustomers').style.display!=='none') renderCustomerList();
    }, 300);
  }

  setTimeout(() => {
    if(xlFinEditMode) delete xlFinEditMode[id];
    delete xlEditItems[id];
    delete xlGlobalCK[id];
    renderAllHistoryPages();
    closeXlModal();
  }, 1500);

  google.script.run
  .withSuccessHandler(res => {
    if (res && res.success === false) {
      appAlert("⚠️ Lỗi lưu server: " + res.msg, "error");
      return;
    }
    loadHist();
    loadData();
  })
  .withFailureHandler(err => {
    appAlert("⚠️ Lỗi kết nối server: " + err.message, "error");
  })
  .updateCompletedOrder(id, payload);
}
