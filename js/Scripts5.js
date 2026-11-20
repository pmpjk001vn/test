// =================================================================
// ===== FULL CHATBOT SYSTEM - ĐẠI LÝ VINAHOUSE (FINAL) =====
// =================================================================

let currentBotState = 'NORMAL'; 

function toggleChat() {
  const w = document.getElementById('chatWindow');
  w.classList.toggle('show');
  if(w.classList.contains('show') && document.getElementById('chatBody').innerHTML.trim() === '') appendMenu();
}

function appendChat(sender, text) {
  const body = document.getElementById('chatBody');
  body.innerHTML += `<div class="chat-msg ${sender}">${text}</div>`;
  body.scrollTop = body.scrollHeight;
}

function appendMenu() {
  currentBotState = 'NORMAL';
  const text = 'Chào bạn! Mình là trợ lý kho tự động. Hãy chọn chức năng bên dưới nhé:';
  const btnHtml = `<br>
    <span class="chat-btn" onclick="botAction('STOCK')">📦 Tra tồn kho</span>
    <span class="chat-btn" onclick="botAction('DEBT')">🧾 Công nợ khách</span>
    <span class="chat-btn" onclick="botAction('REPORT')">📊 Báo cáo ngày</span>
    <span class="chat-btn" onclick="botAction('PDF')">📥 Xuất PDF</span>
    <span class="chat-btn" onclick="botAction('FREE')">🤖 Chat tự do</span>`;
  appendChat('bot', text + btnHtml);
}

function appendBackToMenu() {
  const body = document.getElementById('chatBody');
  body.innerHTML += `<div style="margin-top:8px;"><span class="chat-btn menu" onclick="appendMenu()">🏠 Quay lại Menu chính</span></div>`;
  body.scrollTop = body.scrollHeight;
}

function botAction(action) {
  if (action === 'STOCK') { currentBotState = 'WAITING_STOCK'; appendChat('bot', '📦 Gõ tên hoặc mã SP để tra cứu:'); } 
  else if (action === 'DEBT') { currentBotState = 'WAITING_DEBT'; appendChat('bot', '🧾 Nhập tên khách hàng:'); } 
  else if (action === 'PDF') { currentBotState = 'WAITING_PDF'; appendChat('bot', '📥 Nhập mã hóa đơn cần xuất PDF (Ví dụ: HD001):'); }
  else if (action === 'REPORT') { runChatReport(''); appendBackToMenu(); } 
 else if (action === 'FREE') { 
    currentBotState = 'AI_CHAT'; // Đổi trạng thái thành chat với AI
    appendChat('bot', '🤖 Chế độ AI đã bật! Bạn muốn tán gẫu chuyện gì nào?'); 
  }
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if(!msg) return;
  document.getElementById('chatSuggestBox').style.display = 'none';
  if(msg.toLowerCase() === 'menu') { input.value = ''; appendMenu(); return; }
  appendChat('user', msg); input.value = '';
  setTimeout(() => { processChatLogic(msg); }, 400);
}

// AUTOCOMPLETE
function handleChatSuggest(val) {
  const suggestBox = document.getElementById('chatSuggestBox');
  if(!val.trim()) { suggestBox.style.display = 'none'; return; }
  const lowerVal = val.toLowerCase().trim();
  let matches = [];
  if (currentBotState === 'WAITING_STOCK') matches = (db.products || []).filter(p => (p.Ten_San_Pham || '').toLowerCase().includes(lowerVal) || (p.Ma_SP || '').toLowerCase().includes(lowerVal)).slice(0, 10);
  else if (currentBotState === 'WAITING_DEBT') matches = (db.customers || []).filter(c => (c.Ten_Khach || '').toLowerCase().includes(lowerVal)).slice(0, 10);
  
  if (matches.length > 0) {
    suggestBox.innerHTML = matches.map(item => {
      const name = item.Ten_San_Pham || item.Ten_Khach;
      return `<div style="padding:10px; cursor:pointer;" onclick="selectChatSuggest('${name.replace(/'/g,"\\'")}')">${name}</div>`;
    }).join('');
    suggestBox.style.display = 'block';
  } else suggestBox.style.display = 'none';
}

function selectChatSuggest(val) {
  document.getElementById('chatInput').value = val;
  document.getElementById('chatSuggestBox').style.display = 'none';
  sendChat();
}

// LOGIC XỬ LÝ
function processChatLogic(msg) {
  const lowerMsg = msg.toLowerCase();
  
  // Xử lý xuất PDF
  if (currentBotState === 'WAITING_PDF') {
    let o = (db.hoanThanh || []).find(x => x.id.toLowerCase() === lowerMsg);
    if (o) {
       appendChat('bot', `✅ Tìm thấy hóa đơn: <b>${o.id}</b>. Đang tạo file PDF...`);
       downloadPdfHoaDon(o.id);
    } else {
       appendChat('bot', '❌ Không tìm thấy mã hóa đơn này!');
    }
    appendBackToMenu();
    return;
  }

  // TÍNH NĂNG TÁN GẪU (DÙNG API GOOGLE GEMINI)
  if (currentBotState === 'AI_CHAT') {
    const body = document.getElementById('chatBody');
    const idS = 'typing_' + Date.now();
    body.innerHTML += `<div id="${idS}" class="chat-msg bot"><i>Đang suy nghĩ... 🤔</i></div>`;
    body.scrollTop = body.scrollHeight;

    google.script.run.withSuccessHandler(res => {
      const typingEl = document.getElementById(idS);
      if (typingEl) typingEl.remove();
      appendChat('bot', '✨ ' + res);
      appendBackToMenu();
    }).chatWithAI(msg);
    
    return; 
  }
  
  // 1. TÌM SẢN PHẨM (Tra tồn kho)
  if (currentBotState === 'WAITING_STOCK') {
        // Dùng lại lowerMsg gốc của con Bot để không bị lỗi
        let p = (db.products || []).find(x => (x.Ten_San_Pham || '').toLowerCase() === lowerMsg || (x.MSP || '').toLowerCase() === lowerMsg);
        
        if (p) { 
          // Form hiển thị 1-2-3-4 siêu nét
          let htmlKetQua = `📦 <b>${p.Ten_San_Pham}</b> (${p.Ma_SP || 'Chưa có mã'})<br>` +
                           `1. Đầu kỳ: ${p.So_Luong || 0}<br>` +
                           `2. Nhập kho: ${p.SL_Nhap || 0}<br>` +
                           `3. Bảo hành: ${p.BH_HBD || 0}<br>` +
                           `4. Xuất kho: ${p.SL_Xuat || 0}<br>` +
                           `📊 Tồn: <b style="color:red; font-size: 16px;">${p.Ton_Kho || 0}</b><br>` +
                           `💰 Giá: ${Number(p.Don_Gia || 0).toLocaleString()}đ`;
                           
          appendChat('bot', htmlKetQua); 
        } 
        else { appendChat('bot', '❌ Không tìm thấy sản phẩm!'); }
        
        appendBackToMenu(); 
        return;
      } 
  
  // 2. TÌM CÔNG NỢ
  if (currentBotState === 'WAITING_DEBT') {
        let c = (db.customers || []).find(x => (x.Ten_Khach || '').toLowerCase() === lowerMsg);
        
        if (c) { 
          // Căn chỉnh form 1-2-3-4 theo đúng chuẩn
          // Tui thêm các trường hợp dự phòng tên cột (Dia_Chi, Địa chỉ) để lỡ sheet có đổi tên cột nó vẫn móc ra được
          let diaChi = c.Dia_Chi || c['Địa chỉ'] || c['Địa Chỉ'] || 'Chưa cập nhật';
          let sdt = c.SDT || c['Số điện thoại'] || c['SĐT'] || 'Chưa cập nhật';
          
          let htmlKetQua = `👤 <b>Thông tin công nợ</b><br>` +
                           `1. Tên Khách: <b>${c.Ten_Khach}</b><br>` +
                           `2. Địa Chỉ: ${diaChi}<br>` +
                           `3. SĐT: ${sdt}<br>` +
                           `4. Công Nợ: <b style="color:red; font-size: 16px;">${Number(c.Cong_No || 0).toLocaleString()}đ</b>`;
                           
          appendChat('bot', htmlKetQua); 
        } 
        else { appendChat('bot', '❌ Không tìm thấy khách!'); }
        
        appendBackToMenu(); 
        return;
      }
  
  // 3. TÌM HÓA ĐƠN ĐỂ XUẤT PDF (Gõ: HD001)
  if (lowerMsg.startsWith('hd')) {
    let o = (db.hoanThanh || []).find(x => x.id.toLowerCase() === lowerMsg);
    if (o) {
       appendChat('bot', `✅ Tìm thấy Hóa đơn: <b>${o.id}</b><br>👤 Khách: ${o.cust}`);
       const body = document.getElementById('chatBody');
       body.innerHTML += `
         <div style="margin-top:8px;">
           <button class="chat-btn menu" style="background:#dc2626; color:#fff;" 
                   onclick="downloadPdfHoaDon('${o.id}')">
             📥 Xuất PDF: ${o.id}
           </button>
         </div>`;
       body.scrollTop = body.scrollHeight;
    } else {
       appendChat('bot', '❌ Không tìm thấy hóa đơn này!');
    }
    appendBackToMenu();
    return;
  }
  
  // 4. BÁO CÁO NGÀY
  if (lowerMsg.includes('báo cáo')) {
    runChatReport(lowerMsg.split('báo cáo')[1].trim());
    return; // Đã có appendBackToMenu trong hàm runChatReport hoặc sẽ xử lý riêng
  }
  
  // NẾU KHÔNG LỌT VÀO TRƯỜNG HỢP NÀO Ở TRÊN (Thay thế cho else cuối cùng)
  appendChat('bot', 'Mình chưa hiểu ý bạn.');
  appendBackToMenu();
}

// ==========================================
// 3. HÀM XỬ LÝ TÍNH TOÁN BÁO CÁO KÈM XẾP HẠNG SALE
// ==========================================
function runChatReport(dateStr = '') {
  // Đọc từ dữ liệu Hoàn Thành thay vì Lịch sử chung
  if(!db.hoanThanh) {
    appendChat('bot', 'Dữ liệu lịch sử chưa tải xong, đợi 1 chút rồi thử lại nhé.');
    return;
  }
  
  let targetDate = new Date();
  
  // Nhận diện ngày gõ tự do (VD: 20/06/2026)
  if (dateStr) {
     let parts = dateStr.split(/[\/\-]/);
     if(parts.length >= 2) {
        let d = parseInt(parts[0]);
        let m = parseInt(parts[1]) - 1;
        let y = parts.length >= 3 ? parseInt(parts[2]) : targetDate.getFullYear();
        if(y < 100) y += 2000;
        
        targetDate = new Date(y, m, d);
        if(isNaN(targetDate.getTime())) { appendChat('bot', '❌ Định dạng ngày không hợp lệ. VD: 15/06'); return; }
     } else { appendChat('bot', '❌ Vui lòng nhập ngày theo dạng DD/MM.'); return; }
  }
  
  let startOfDay = new Date(targetDate).setHours(0,0,0,0);
  let endOfDay = new Date(targetDate).setHours(23,59,59,999);
  
  let dCount = 0;
  let sum = 0;
  let salesData = {}; // Object lưu dữ liệu gộp theo từng Sale

  // Quét vòng lặp toàn bộ dữ liệu HOÀN THÀNH
  db.hoanThanh.forEach(o => {
    let t = o.realDate || 0;
    
    // Kiểm tra xem đơn hàng có nằm trong ngày cần báo cáo không
    if(t >= startOfDay && t <= endOfDay) { 
      dCount++; 
      let orderTotal = Number(o.total || 0);
      sum += orderTotal; 
      
      // Gộp doanh thu và số phiếu theo Tên Sale
      let saleName = o.sale ? o.sale.trim() : 'Khác';
      if(!salesData[saleName]) salesData[saleName] = { rev: 0, count: 0 };
      salesData[saleName].rev += orderTotal;
      salesData[saleName].count++;
    }
  });
  
  let displayDate = ('0'+targetDate.getDate()).slice(-2)+'/'+('0'+(targetDate.getMonth()+1)).slice(-2)+'/'+targetDate.getFullYear();
  
  let reportHtml = `📊 <b>BÁO CÁO NGÀY ${displayDate}:</b><br>- Số hóa đơn hoàn thành: <b>${dCount}</b> phiếu<br>- Tổng doanh thu: <strong style="color:red">${sum.toLocaleString('vi-VN')}đ</strong>`;

  // Xếp hạng nếu có đơn hàng
  if (dCount > 0) {
    // Ép Object thành Array để sắp xếp
    let salesArray = Object.keys(salesData).map(k => ({ name: k, rev: salesData[k].rev, count: salesData[k].count }));
    
    // Thuật toán Sắp xếp (Sort) Doanh thu từ cao xuống thấp
    salesArray.sort((a, b) => b.rev - a.rev);
    
    // In ra màn hình Chat
    reportHtml += `<br><br>🏆 <b>DOANH THU THEO SALE:</b><br>`;
    salesArray.forEach((s, idx) => {
       reportHtml += `${idx + 1}. ${s.name}: <strong style="color:red">${s.rev.toLocaleString('vi-VN')}đ</strong> (${s.count} phiếu)<br>`;
    });
  } else {
    reportHtml += `<br><br><i>Chưa có đơn hàng hoàn thành nào trong ngày này.</i>`;
  }

  appendChat('bot', reportHtml);
}
function downloadPdfHoaDon(orderId) {
  const o = db.hoanThanh.find(x => x.id === orderId);
  if (!o) return;
  let pPhone="", sPhone="";
  if(db.customers){ const m = db.customers.find(c=>String(c.Ten_Khach||'').trim().toLowerCase() === String(o.cust||'').trim().toLowerCase()); if(m) pPhone = String(m.SDT||'').trim(); }
  if(db.staffs){ const m = db.staffs.find(s=>String(s.name||'').trim().toLowerCase() === String(o.sale||'').trim().toLowerCase()); if(m) sPhone = String(m.phone||'').trim(); }
  
  const htmlContent = buildInvoiceHTML(o, o.items, o.total, o.note || '', pPhone, sPhone, o.ck || 0, o.noCu || 0, o.prePaid || 0);

  google.script.run.withSuccessHandler(res => {
    // Tạo đường dẫn chứa dữ liệu PDF
    const pdfDataUrl = "data:application/pdf;base64," + res.pdfBase64;
    
    // Tạo một cái nút tải bọc trong thẻ <a> để quăng vào chat
    const btnHtml = `<br><br><a href="${pdfDataUrl}" download="HoaDon_${o.id}.pdf" class="chat-btn menu" style="background:var(--fin, #1a56db); color:#fff; text-decoration:none; display:inline-block;">📥 Bấm vào đây để tải/xem PDF</a>`;
    
    // Quăng thông báo kèm cái nút vào khung chat
    appendChat('bot', `✅ Đã tạo xong PDF cho Hóa đơn <b>${o.id}</b>! ${btnHtml}`);
    
    // Hiện lại menu chính bên dưới để tiện thao tác tiếp
    appendBackToMenu();
    
  }).createPDFBase64(htmlContent, "HoaDon_" + o.id);
}

function savePdfToDevice(base64Data, fileName) {
  const byteChars = atob(base64Data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  if (isIOS) {
    window.open(blobUrl, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
function autoGreeting() {
  // Chỉ chạy nếu khung chat đang đóng (để tránh bị đè nếu người dùng đã mở thủ công)
  const w = document.getElementById('chatWindow');
  if (w.classList.contains('show')) return; 

  // Tính doanh số cá nhân của Sale đang đăng nhập
  const today = new Date().setHours(0,0,0,0);
  const myName = (user && user.fullName) ? user.fullName : "Bạn";
  const mySales = (db.hoanThanh || []).filter(o => 
    o.realDate >= today && String(o.sale).trim() === String(myName).trim()
  ).reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Ngày tháng hôm nay (dạng DD/MM/YYYY)
  const now = new Date();
  const todayStr = ('0'+now.getDate()).slice(-2)+'/'+('0'+(now.getMonth()+1)).slice(-2)+'/'+now.getFullYear();

  // Danh sách các kiểu chào - mỗi lần load sẽ random 1 bộ (gồm 3 dòng: ngày + chào tên + hỏi tra cứu)
  const greetings = [
    `Hôm nay ngày ${todayStr}<br>Xin chào ${myName}, chúc bạn 1 ngày may mắn 🍀<br>Hello! Bạn cần tra cứu gì không?`,
    `Hôm nay ngày ${todayStr}<br>Xin chào ${myName}, chúc 1 ngày làm việc hiệu quả ✨<br>Bạn muốn tra tồn kho hay công nợ gì không?`,
    `Hôm nay ngày ${todayStr}<br>Chào buổi sáng ${myName}! Chúc 1 ngày bán hàng thuận lợi 🎉<br>Bạn cần tra cứu gì không?`,
    `Hôm nay ngày ${todayStr}<br>Xin chào ${myName}, hôm nay cũng là 1 ngày tuyệt vời để bứt phá 🔥<br>Helo, bạn cần tra cứu gì không?`,
    `Hôm nay ngày ${todayStr}<br>Xin chào ${myName}, chúc 1 ngày bùng nổ doanh số 💸<br>Hiện tại bạn đã bán được ${mySales.toLocaleString('vi-VN')}đ rồi đó!`
  ];
  const msg = greetings[Math.floor(Math.random() * greetings.length)];

  // Hiển thị tạm thời ở vị trí góc màn hình (hoặc bạn có thể dùng alert tùy ý)
  const body = document.getElementById('chatBody');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg bot';
  msgDiv.style.position = 'fixed'; // Để nó nổi lên
  msgDiv.style.bottom = '80px';
  msgDiv.style.right = '20px';
  msgDiv.style.zIndex = '9999';
  msgDiv.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
  msgDiv.innerHTML = `<i>${msg}</i>`;
  document.body.appendChild(msgDiv);

  // Tự mất sau 6 giây
  setTimeout(() => {
    msgDiv.style.transition = "opacity 0.5s";
    msgDiv.style.opacity = "0";
    setTimeout(() => document.body.removeChild(msgDiv), 500);
  }, 4000);
}
// Lưu ý: autoGreeting() giờ được gọi sau khi đăng nhập thành công (trong hàm login(), sau setupUI()),
// không còn tự chạy theo window load nữa để tránh báo khi chưa đăng nhập.
