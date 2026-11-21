// ===== SWEETALERT2 HELPERS - GIAO DIỆN HIỆN ĐẠI =====
const appToast = (msg, type = 'success') => {
  Swal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    text: msg,
    icon: type,
    customClass: { popup: 'rounded-4' }
  });
};

const appConfirm = (msg, callback) => {
  Swal.fire({
    text: msg,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#1a56db',
    cancelButtonColor: '#dc2626',
    confirmButtonText: 'Đồng ý',
    cancelButtonText: 'Hủy',
    width: '320px',
    customClass: { popup: 'rounded-4' }
  }).then((result) => {
    if (result.isConfirmed) {
      callback();
    }
  });
};

// ===== STATE & BIẾN GLOBAL =====
let user={}, db={}, cart=[], importCart=[], selectedAddr="", selectedDebt=0;
let autoReloadTimer=null, isFirstLoadHistory=true, currentMapAddr="";
let pageHistoryStack = [];
let currentPageActive = 'order';
let currentCustPage=1, currentProdPage=1, currentCongNoPage=1, editingOrderId=null, currentDraftId=null;
let histPersonalOnly=false;
let xlFilter='all', xlCurrentId=null, xlEditItems={};
let shDateMode='all';
let xlGlobalCK={};
let xlFinEditMode={}; // Lưu trạng thái đang sửa đơn hoàn thành
let reportDateMode='today';
const ITEMS_PER_PAGE=15;
window.localPrintedIds=window.localPrintedIds||[];
// ==========================================
// HÀM LỘT DẤU TIẾNG VIỆT (DÙNG CHUNG CHO TOÀN BỘ GIAO DIỆN)
// ==========================================
function bodau(str) {
  if (str === null || str === undefined) return '';
  // Bước 1: Normalize về NFC trước để gom các ký tự tổ hợp lại
  // Bước 2: Rồi mới NFKD để phân giải và lột dấu
  return String(str)
    .normalize('NFC')   // ← Gom lại trước
    .normalize('NFKD')  // ← Rồi mới tách ra lột dấu
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// ===== SIDEBAR =====
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('show');document.getElementById('overlay').classList.toggle('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('show');document.getElementById('overlay').classList.remove('show');}

function toggleSbGrp(groupId) {
  const chev = document.getElementById('sbChev-' + groupId);
  const items = document.getElementById('sbItems-' + groupId);
  if (chev) chev.classList.toggle('open');
  if (items) items.classList.toggle('open');
}

// ===== ADMIN TOP MENU FUNCTIONS =====
function toggleAdminDropdown(btn) {
  const parent = btn.parentElement;
  const isOpen = parent.classList.contains('show');
  closeAllAdminDropdowns();
  if (!isOpen) parent.classList.add('show');
}

function closeAllAdminDropdowns() {
  document.querySelectorAll('.admin-dropdown').forEach(dd => dd.classList.remove('show'));
}

window.addEventListener('click', function(e) {
  if (!e.target.matches('.admin-menu-btn') && !e.target.closest('.admin-menu-btn')) closeAllAdminDropdowns();
});

// CÀI ĐẶT ON/OFF TỒN KHO
function toggleStrictStock(el) {
  const isStrict = el.checked;
  el.disabled = true;
  google.script.run.withSuccessHandler(()=>{
    db.strictStock = isStrict;
    el.disabled = false;
    appToast("Đã cập nhật cài đặt Tồn Kho!");
  }).toggleStockSetting(isStrict);
}

// ===== INIT & SETUP UI =====
// ── IndexedDB Helper (bền nhất trên iOS Web Clip) ──
const _DB_NAME = 'vnh_auth', _DB_VER = 1, _STORE = 'session';
function _openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(_DB_NAME, _DB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(_STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e);
  });
}
function _dbSet(key, val) {
  return _openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(_STORE, 'readwrite');
    tx.objectStore(_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e);
  }));
}
function _dbGet(key) {
  return _openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(_STORE, 'readonly');
    const req = tx.objectStore(_STORE).get(key);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e);
  }));
}
function _dbDel(key) {
  return _openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(_STORE, 'readwrite');
    tx.objectStore(_STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e);
  }));
}

// ── Khởi động app ──────────────────────────────────
window.onload = function() {
  initQuickProdForm();

  // Ưu tiên 1: Auto-login qua URL (dành cho shortcut APK)
  if (AUTO_U && AUTO_P) {
    document.getElementById('u').value = AUTO_U;
    document.getElementById('p').value = AUTO_P;
    setTimeout(login, 100);
    return;
  }

  // Ưu tiên 2: Kiểm tra token đã lưu trong IndexedDB
  _dbGet('vnh_token').then(token => {
    if (token) {
      // Có token → xác thực với server
      document.getElementById('mainApp').style.display = 'none';
      document.getElementById('loginBox').style.display = 'block';
      
      google.script.run
  .withSuccessHandler(function(res) {
    if (res && res.success) {
      user = res;
      setupUI();
    } else {
      _dbDel('vnh_token'); // Xóa token cũ/hết hạn khỏi máy
      if (res && res.expired) {
        // Thông báo nhẹ nhàng thay vì im lặng
        appToast("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại", "warning");
      }
      _checkRemembered(); // Thử Remember Me
    }
  })
  .checkToken(token);
    } else {
      // Không có token → kiểm tra Remember Me
      _checkRemembered();
    }
  }).catch(() => {
    _checkRemembered();
  });
};

function _checkRemembered() {
  _dbGet('vnh_rem_u').then(su => {
    _dbGet('vnh_rem_p').then(sp => {
      if (su && sp) {
        document.getElementById('u').value = su;
        document.getElementById('p').value = sp;
        document.getElementById('remMe').checked = true;
        setTimeout(login, 100);
      } else {
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginBox').style.display = 'block';
      }
    });
  }).catch(() => {
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginBox').style.display = 'block';
  });
}

function togglePass(){
  const p=document.getElementById('p'),e=document.getElementById('passEye');
  if(p.type==='password'){p.type='text';e.className='fas fa-eye-slash';}
  else{p.type='password';e.className='fas fa-eye';}
}

function login(){
  const u=document.getElementById('u').value.trim().toLowerCase(),p=document.getElementById('p').value,remMe=document.getElementById('remMe').checked,btn=document.getElementById('loginBtn');
  if(!u||!p){appAlert("Vui lòng nhập ID và Mật khẩu!", "warning");return;}
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> ĐANG XÁC THỰC...';btn.disabled=true;
  google.script.run.withSuccessHandler(res=>{
    btn.innerHTML='<i class="fas fa-sign-in-alt"></i> ĐĂNG NHẬP HỆ THỐNG';btn.disabled=false;
    if(res.success){
      user=res;
      _dbSet('vnh_token', res.token);
      if(remMe){_dbSet('vnh_rem_u',u);_dbSet('vnh_rem_p',p);}
      else{_dbDel('vnh_rem_u');_dbDel('vnh_rem_p');}
      setupUI();
      // Đợi 1.5 giây để setupUI() dựng xong UI/dữ liệu (db) trước khi chào
     // setTimeout(autoGreeting, 1500);
    }else{appAlert(res.msg||"Sai tài khoản hoặc mật khẩu!", "error");}
  }).withFailureHandler(err=>{btn.innerHTML='<i class="fas fa-sign-in-alt"></i> ĐĂNG NHẬP HỆ THỐNG';btn.disabled=false;appAlert("Lỗi kết nối: "+err.message, "error");}).checkLogin(u,p);
}
// ===== KHAI BÁO ID CỦA SADMIN (SỬA LẠI TÊN ID ĐĂNG NHẬP CỦA BẠN VÀO ĐÂY) =====
const SADMIN_IDS = ["admin","ketoanad","kimxuyen"]; // Ví dụ: Điền ID của bạn (viết thường)

function changeStaffRole(id,cr){
  // Kiểm tra xem user hiện tại có phải là SAdmin không
  const isSadmin = (user.userId && user.userId.toLowerCase() === SADMIN_IDS.toLowerCase());
  
  if(!isSadmin && (cr||'').toLowerCase() === 'admin'){
     alert("Không thể thay đổi quyền của Admin nếu bạn không phải SAdmin!");
     return;
  }
  
  const promptText = isSadmin ? "Nhập quyền mới (Sale, Leader, hoặc Admin):" : "Nhập quyền mới (Sale hoặc Leader):";
  const nr = prompt(promptText, cr);
  
  if(nr){
    const r = nr.trim().toLowerCase();
    const allowedRoles = isSadmin ? ['sale', 'leader', 'admin'] : ['sale', 'leader'];
    
    if(allowedRoles.includes(r)){
       const displayRole = r === 'sale' ? 'Sale' : (r === 'leader' ? 'Leader' : 'Admin');
       google.script.run.withSuccessHandler(()=>{
           alert("Đã cập nhật!"); loadData();
       }).updateStaffRole(id, displayRole);
    } else { 
       alert("Quyền không hợp lệ hoặc bạn không có quyền cấp chức vụ này!");
    }
  }
}

// ==================== SETUP UI ====================
function setupUI(){
  histLoadAll = false;
  histLoadedAll = false;
  histUpdateAllBtns(false);
  document.getElementById('loginBox').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('userDisplay').textContent=user.fullName+" ("+user.role+")";
  document.getElementById('sbUserInfo').textContent=user.fullName+" • "+user.role;
  
  const role = (user.role || '').toLowerCase();
  const isAdmin = (role === 'admin');
  const isLeader = (role === 'leader');
  
  const adminTopMenu = document.getElementById('adminTopMenu');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  
  if(adminTopMenu) adminTopMenu.style.display = isAdmin ? 'flex' : 'none';
  if(hamburgerBtn) hamburgerBtn.style.display = isAdmin ? 'none' : 'flex';
  
  const sectionXuLy = document.getElementById('sbSectionXuLy');
  if(sectionXuLy) sectionXuLy.style.display = isAdmin ? 'block' : 'none';
  
  const sbThanhToan = document.getElementById('sbThanhToan');
  const sbLSThanhToan = document.getElementById('sbLSThanhToan');
  if(sbThanhToan) sbThanhToan.style.display = isAdmin ? 'flex' : 'none';
  if(sbLSThanhToan) sbLSThanhToan.style.display = isAdmin ? 'flex' : 'none';
  
  const sbReportMenu = document.getElementById('sbReportMenu');
  if(sbReportMenu) sbReportMenu.style.display = (isAdmin || isLeader) ? 'flex' : 'none';

  document.getElementById('sbSectionQuanLy').style.display = 'block';
  document.getElementById('sbAdmin').style.display = isAdmin ? 'flex' : 'none';
  const sbBaoHanh = document.getElementById('sbSectionBaoHanh');
  if(sbBaoHanh) sbBaoHanh.style.display = isAdmin ? 'block' : 'none';
  
  const adminSaleWrap = document.getElementById('adminSaleSelectWrap');
  if(adminSaleWrap) adminSaleWrap.style.display = isAdmin ? 'flex' : 'none';
  if(isAdmin) populateAdminSaleSelect();
  
  showPage('order');
  if (typeof initMascot === 'function') initMascot();
  initQuickProdForm();
  
  loadData(); 
  loadHist(); 
  updateDraftBadge(); 

  if (isAdmin) {
    startPrintPolling();
  }
}

// ==================== LẮNG NGHE LỆNH IN TỪ TELEGRAM ====================
let printPollingTimer = null;

function startPrintPolling() {
  // Tính năng tự động lắng nghe lệnh in từ Telegram hiện đang tắt.
  // Hàm checkPendingPrint() chưa được triển khai trong Code.gs.
  // Để bật lại: implement checkPendingPrint() trong Code.gs rồi uncomment đoạn dưới:
  /*
  if (printPollingTimer) clearInterval(printPollingTimer);
  printPollingTimer = setInterval(() => {
    google.script.run.withSuccessHandler(res => {
      if (res && res !== '') {
        let historyPrinted = sessionStorage.getItem("Printed_Req") || "";
        if (res !== historyPrinted) {
          sessionStorage.setItem("Printed_Req", res);
          const orderId = res.split("_")[0];
          if (typeof printPhieuXuatKho === 'function') {
            if (document.getElementById('pHistory').style.display === 'none') {
              showPage('history');
            }
            printPhieuXuatKho(orderId);
          }
        }
      }
    }).checkPendingPrint();
  }, 3000);
  */
}

// ==================== SHOW PAGE ====================
function showPage(p, isBack = false){
  closeAllAdminDropdowns();

  const role=(user.role||'').toLowerCase();
  const adminOnly=['xulydh','import','importHistory','admin','thanhToan','lichSuThanhToan','baoHanh','lsBHKBD','searchCompleted'];
  if(adminOnly.includes(p)&&role!=='admin'){
    appAlert("Bạn không có quyền truy cập trang này!", "error");
    return;
  }
  if(p==='report' && role!=='admin' && role!=='leader'){
     appAlert("Chỉ Leader và Admin mới được xem Báo Cáo!", "warning"); return;
  }

  if (!isBack && p !== currentPageActive) {
    pageHistoryStack.push(currentPageActive);
  }
  currentPageActive = p;
  
  const backBtn = document.getElementById('globalBackBtn');
  if (backBtn) {
    backBtn.style.display = (pageHistoryStack.length > 0) ? 'block' : 'none';
  }

  document.querySelectorAll('.page').forEach(d=>d.style.display='none');
  document.querySelectorAll('.sb-item').forEach(t=>t.classList.remove('active'));

  const pageEl=document.getElementById('p'+p.charAt(0).toUpperCase()+p.slice(1));
  if(pageEl) pageEl.style.display='block';

  const tabEl=document.querySelector('[data-tab="'+p+'"]');
  if(tabEl) tabEl.classList.add('active');

  if(p==='drafts') renderDraftsPage(); 
  
  if(p==='history') {
    renderHistoryUI(); 
    loadHist();        
  }
  if(p==='lichSuHoaDon') {
    if(db.history) renderLichSuHoaDon(); 
    loadHist(); 
  }
  if(p==='thanhToan'){
    const si=document.getElementById('ttSearchInp');if(si)si.value='';
    const sr=document.getElementById('ttSearchRes');if(sr)sr.innerHTML='';
    const tr=document.getElementById('ttResult');if(tr)tr.style.display='none';
    const te=document.getElementById('ttEmpty');if(te)te.style.display='block';
    ttCurrentCust=null;
  }
  if(p==='lichSuThanhToan'){
    const si=document.getElementById('lsttSearchGlobalInp'); if(si) si.value='';
    loadAllPaymentHistory();
  }
  if(p==='lichSuCongNo'){currentCongNoPage=1;renderCongNoList();}
  if(p==='xulydh') {
    if(db.historyForXuLy) renderXuLyUI(); 
    loadHistForXuLy(); 
  }
  if(p==='importHistory') loadImportHist();
  if(p==='customers'){currentCustPage=1;renderCustomerList();}
  if(p==='products'){currentProdPage=1;renderProductList();}
  if(p==='searchHistory') clearSearchHistory();
  if(p === 'lsBHKBD') loadLsBHKBD();
  if(p === 'lsBHBD') loadLsBHBD();
  if(p === 'searchImport') initSearchImportPage(); // ✅ Load dữ liệu tra cứu nhập kho
    if(p==='admin'){
    renderStaffManagement();
    initQuickProdFields();
    const t = document.getElementById('strictStockToggle');
    if(t) t.checked = (db.strictStock !== false);
    const ex = document.getElementById('excludeMergeToggle');
    if(ex) ex.checked = !!db.excludeMerge;
    updateExcludeBtnState();
  }

  // 👇 THÊM MỚI TỪ ĐÂY: Xử lý cho 2 trang Tra Cứu Xuất Kho & Hoàn Thành 👇
    if (p === 'searchCompleted') {
    const searchInp = document.getElementById('inpSearchCompleted');
    if (searchInp) {
      searchInp.value = ''; 
      document.getElementById('resSearchCompleted').innerHTML = ''; 
      document.getElementById('tblSearchCompleted').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--muted);font-style:italic;"><i class="fas fa-check-circle" style="font-size:24px;margin-bottom:8px;display:block;opacity:0.5;"></i>Vui lòng chọn tên sản phẩm để bắt đầu tra cứu</td></tr>'; 
      const summaryDiv = document.getElementById('completedSummary');
      if (summaryDiv) summaryDiv.style.display = 'none';
      // Tải dữ liệu nếu mảng chưa có gì
      if (typeof completedHistoryData !== 'undefined' && completedHistoryData.length === 0) {
          if (typeof loadCompletedHistory === 'function') loadCompletedHistory();
      }
      setTimeout(() => { searchInp.focus(); }, 100);
    }
  }
}

function goBack() {
  if (pageHistoryStack.length > 0) {
    const prevPage = pageHistoryStack.pop();
    showPage(prevPage, true);
  }
}

function logout(){
  appConfirm("Bạn có chắc chắn muốn thoát?", () => {
    _dbGet('vnh_token').then(token => {
      _dbDel('vnh_token');
      _dbDel('vnh_rem_u');
      _dbDel('vnh_rem_p');
      if(token) google.script.run.logoutUser(token);
    }).catch(()=>{});
    if(autoReloadTimer) clearTimeout(autoReloadTimer);
    document.getElementById('mainApp').style.display='none';document.getElementById('loginBox').style.display='block';
    user={};cart=[];closeSidebar();
    if (typeof removeMascot === 'function') removeMascot();
    
    pageHistoryStack = []; 
    currentPageActive = 'order';
    const backBtn = document.getElementById('globalBackBtn');
    if (backBtn) backBtn.style.display = 'none';
  });
}

function refreshCurrentData(btn){
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;

  let pending = 2; // Đếm số tác vụ cần chờ
  const done = () => { if(--pending <= 0){ btn.innerHTML=origHtml; btn.disabled=false; } };

  // Tác vụ 1: Reload dữ liệu nền
  google.script.run.withSuccessHandler(d => {
    db = d;
    document.getElementById('custDl').innerHTML = 
      d.customers.map(c=>'<option value="'+c.Ten_Khach+'">').join('');
    if(document.getElementById('pCustomers').style.display!=='none') renderCustomerList();
    if(document.getElementById('pProducts').style.display!=='none') renderProductList();
    if(document.getElementById('pAdmin').style.display!=='none'){
      renderStaffManagement();
      const t=document.getElementById('strictStockToggle');
      if(t) t.checked=(db.strictStock!==false);
    }
    if(document.getElementById('pLichSuCongNo').style.display!=='none') renderCongNoList();
    if(document.getElementById('pThanhToan').style.display!=='none' && ttCurrentCust){
      selectThanhToanCust(ttCurrentCust.Ten_Khach);
    }
    done();
  }).getDataForApp();

  // Tác vụ 2: Reload lịch sử đơn hàng
  if(autoReloadTimer) clearTimeout(autoReloadTimer);
  const reqAllRefresh = histLoadAll; // ghi nhớ chế độ lúc gửi yêu cầu
  google.script.run.withSuccessHandler(res => {
    if (reqAllRefresh !== histLoadAll) { done(); return; } // người dùng đã đổi chế độ → bỏ kết quả cũ
    histLoadedAll = reqAllRefresh;
    // Xử lý giống loadHist nhưng callback riêng
    db.history = res.hoaDon;
    db.historyHoanThanh = res.hoanThanh;
    db.historyHuyToa = res.huyToa || [];

    const huyToaIds = new Set((res.huyToa||[]).map(x=>x.id));
    db.history.forEach(item=>{
      if(huyToaIds.has(item.id) && item.status!=='Đã Hủy') item.status='Đã Hủy';
    });

    db.historyForXuLy = [
      ...res.hoaDon.filter(o=>o.status==='Đã in'),
      ...res.hoanThanh,
      ...(res.huyToa||[])
    ];
    db.fullHistory = [
      ...res.hoaDon.filter(o=>o.status!=='Hoàn thành'),
      ...res.hoanThanh,
      ...(res.huyToa||[])
    ];

    renderAllHistoryPages();

    // Reload thêm các trang đặc biệt nếu đang mở
    if(document.getElementById('pLichSuThanhToan').style.display!=='none') loadAllPaymentHistory();
    if(document.getElementById('pImportHistory').style.display!=='none') loadImportHist();
    if(document.getElementById('pDrafts').style.display!=='none') renderDraftsPage();
    if(document.getElementById('pReport').style.display!=='none') renderReport();

    autoReloadTimer = setTimeout(loadHist, reqAllRefresh ? 30000 : 10000);
    done();
  }).getAllHistories(user.fullName, user.role, reqAllRefresh);
}

function loadData() {
  google.script.run.withSuccessHandler(d => { 
    db = d;
    const custDl = document.getElementById('custDl');
    if (custDl) {
      custDl.innerHTML = d.customers.map(c => '<option value="' + c.Ten_Khach + '">').join('');
    }
    // Update: Đổ list nhân viên
    const saleSel = document.getElementById('adminSaleSelect');
    if (saleSel && d.staffs) {
      saleSel.innerHTML = '<option value="">-- Chọn Nhân Viên --</option>' + d.staffs.map(s => '<option value="'+s.name+'" data-phone="'+(s.phone||'')+'">'+s.name+'</option>').join('');
    }
    if (currentPageActive === 'products') {
      renderProductList(d.products);
    }
  }).getDataForApp();
}

// ===== ADMIN: ĐẶT HÀNG DÙM CHO SALE =====
let adminSelectedSale = null; // {name, phone} hoặc null nếu admin tự đặt

function populateAdminSaleSelect(){
  const sel = document.getElementById('adminSaleSelect');
  if(!sel || !db.staffs) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Đặt hàng dùm cho Sale... --</option>' +
    db.staffs.map(s => '<option value="'+s.name+'" data-phone="'+(s.phone||'')+'">'+s.name+'</option>').join('');
  if(cur && db.staffs.some(s=>s.name===cur)) sel.value = cur;
}

function onAdminSaleChange(){
  const sel = document.getElementById('adminSaleSelect');
  const phoneEl = document.getElementById('adminSalePhone');
  if(!sel.value){
    adminSelectedSale = null;
    if(phoneEl) phoneEl.textContent = '';
    return;
  }
  const opt = sel.options[sel.selectedIndex];
  const phone = opt.getAttribute('data-phone') || '';
  adminSelectedSale = { name: sel.value, phone: phone };
  if(phoneEl) phoneEl.textContent = phone ? '📞 '+phone : '';
}


// ===== ORDER PAGE =====
function onCustChange(){
  const name=document.getElementById('custInp').value;
  const v=bodau(name.trim());
  const addrEl=document.getElementById('addrDisplay');
  const debtEl=document.getElementById('debtH');
  const sugg=document.getElementById('custSuggestions');

  const match=db.customers?db.customers.find(c=>bodau(c.Ten_Khach)===v):null;
  if(match){
    selectedAddr=match.Dia_Chi;
    selectedDebt=Number(match.Cong_No||0);
    addrEl.style.display='block';
    addrEl.innerHTML='📍 <strong>'+match.Ten_Khach+'</strong><br>'+selectedAddr+(match.SDT?'<br>📞 '+match.SDT:'');
    if(debtEl) {
      if(selectedDebt < 0) debtEl.textContent = '⚠️ Âm: ' + selectedDebt.toLocaleString() + 'đ';
      else debtEl.textContent = selectedDebt.toLocaleString() + 'đ';
    }
    if(sugg) sugg.style.display='none';
    return;
  }

  selectedAddr=""; selectedDebt=0; addrEl.style.display='none';
  if(debtEl) debtEl.textContent='0đ';

  if(!sugg) return;
  if(!v){ sugg.style.display='none'; return; }

  const matches=(db.customers||[]).filter(c=>bodau(c.Ten_Khach).includes(v)).slice(0,15);
  if(!matches.length){ sugg.style.display='none'; return; }

  sugg.innerHTML='<div class="search-res">'+
    matches.map(c=>{
      const safe=c.Ten_Khach.replace(/'/g,"\\'").replace(/"/g,'\\"');
      return '<div class="sr-item" onmousedown="selectCust(\''+safe+'\')">'+
        '<strong>'+c.Ten_Khach+'</strong>'+
        (c.SDT?'<span style="font-size:11px;color:var(--muted);margin-left:8px">'+c.SDT+'</span>':'')+
        '</div>';
    }).join('')+'</div>';
  sugg.style.display='block';
}

function selectCust(name){
  document.getElementById('custInp').value=name;
  const sugg=document.getElementById('custSuggestions');
  if(sugg) sugg.style.display='none';
  onCustChange();
}

let _msItems = {};
 
function search() {
  const v = document.getElementById('searchP').value.toLowerCase().trim();
  const sn = cart.map(i => i.Ten_Hang);
 
  if (!v) {
    _renderDropdown([], sn, true);
    return;
  }
 
  const f = (db.products || [])
    .filter(p => p.Ten_San_Pham && p.Ten_San_Pham.toLowerCase().includes(v))
    .slice(0, 20);
 
  _renderDropdown(f, sn, false);
}
 
function _renderDropdown(products, cartNames, isEmpty) {
  const selectedCount = Object.keys(_msItems).length;
 
  let rows = '';
 
  if (isEmpty || products.length === 0) {
    if (selectedCount === 0) {
      document.getElementById('resP').innerHTML = '';
      _removeFloatOK();
      return;
    }
    rows = `<div style="padding:12px 14px;font-size:12px;color:#6b7280;font-weight:600">
      <i class="fas fa-search" style="margin-right:6px"></i>Tiếp tục gõ để tìm thêm sản phẩm...
    </div>`;
  } else {
    rows = products.map(p => {
      const stk = Number(p.So_Luong || 0);
      const isDisabled = db.strictStock !== false && stk <= 0;
      const isSelected = !!_msItems[p.Ten_San_Pham];
      const alreadyInCart = cartNames.includes(p.Ten_San_Pham);
      const safe = (p.Ten_San_Pham || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
      const maxQ = (db.strictStock === false || stk <= 0) ? 999999 : stk;
 
      let stkBadge = stk <= 0
        ? `<span class="stk stk-out">Hết hàng</span>`
        : stk < 10
          ? `<span class="stk stk-low">Kho: ${stk}</span>`
          : `<span class="stk stk-ok">Kho: ${stk}</span>`;
 
      let checkIcon = isSelected
        ? `<svg width="18" height="18" viewBox="0 0 18 18"><rect width="18" height="18" rx="5" fill="#1a56db"/><path d="M4 9l4 4 6-6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 18 18"><rect x=".75" y=".75" width="16.5" height="16.5" rx="4.25" stroke="#d1d5db" stroke-width="1.5" fill="none"/></svg>`;
 
      let qtyInput = isSelected
        ? `<input
             type="number"
             class="ms-qty"
             value="${_msItems[p.Ten_San_Pham].qty}"
             min="1" max="${maxQ}"
             placeholder="SL"
             onclick="event.stopPropagation()"
             oninput="_msQty(this,'${safe}',${stk})"
             onkeydown="event.stopPropagation();if(event.key==='Enter')_msConfirm()"
           >`
        : '';
 
      const bg = isSelected ? '#eff6ff' : '#fff';
      const cursor = (isDisabled || alreadyInCart) ? 'default' : 'pointer';
      const opacity = (isDisabled || alreadyInCart) ? '0.55' : '1';
      
      const onRowClick = (isDisabled || alreadyInCart) ? '' : `_quickAdd('${safe}',${p.Don_Gia},${stk})`;
      const onCheckClick = (isDisabled || alreadyInCart) ? '' : `event.stopPropagation(); _msToggle('${safe}',${p.Don_Gia},${stk})`;

      return `
        <div onclick="${onRowClick}"
             style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                    cursor:${cursor};border-bottom:1px solid #e5e7eb;
                    background:${bg};opacity:${opacity};transition:background .12s;user-select:none">
          <span onclick="${onCheckClick}" style="flex-shrink:0;display:flex;align-items:center;line-height:0;padding:5px;margin:-5px;cursor:pointer;">${checkIcon}</span>
          <span style="flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:5px">
            <strong style="font-size:13px;font-weight:700;color:#111827">${p.Ten_San_Pham}</strong>
            <em style="font-style:normal;font-size:12px;color:#1a56db;font-weight:600;white-space:nowrap">${Number(p.Don_Gia).toLocaleString()}đ</em>
            ${alreadyInCart ? `<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:10px;font-weight:700">✓ Đã có trong giỏ</span>` : ''}
          </span>
          <span style="display:flex;align-items:center;gap:7px;flex-shrink:0">
            ${stkBadge}
            ${qtyInput}
          </span>
        </div>`;
    }).join('');
  }
 
  document.getElementById('resP').innerHTML =
    `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow-y:auto;max-height:55vh;margin-top:4px;box-shadow:0 4px 16px rgba(0,0,0,.1)">${rows}</div>`;
 
  _updateFloatOK(selectedCount);
 
  if (selectedCount > 0) {
    const inputs = document.querySelectorAll('.ms-qty');
    const empty = [...inputs].find(el => !el.value);
    if (empty) setTimeout(() => { empty.focus(); empty.select(); }, 30);
  }
}

function _quickAdd(name, price, maxStock) {
  if (db.strictStock !== false && maxStock <= 0) { appAlert("Sản phẩm này đã hết hàng!", "error"); return; }
  if (cart.some(i => i.Ten_Hang === name)) { appToast("Sản phẩm này đã có trong giỏ!", "warning"); return; }
  
  cart.unshift({ Ten_Hang: name, Gia: price, SL: 1, CK: '', Ghi_Chu: '', Ton_Kho: maxStock });
  
  if (_msItems[name]) { delete _msItems[name]; }
  
  document.getElementById('searchP').value = '';
  document.getElementById('resP').innerHTML = '';
  _removeFloatOK();
  updateUI();
}
 
function _updateFloatOK(selectedCount) {
  const old = document.getElementById('msFloatOK');
  if (old) old.remove();
 
  if (selectedCount === 0) return;
 
  const totalQty = Object.values(_msItems).reduce((s, i) => s + (Number(i.qty) || 0), 0);
 
  const btn = document.createElement('button');
  btn.id = 'msFloatOK';
  btn.onclick = _msConfirm;
 
  btn.style.cssText = `
    position: absolute !important;
    right: 14px !important;
    top: 10px !important;
    z-index: 100 !important;
    width: 50px !important;
    height: 50px !important;
    border-radius: 50% !important;
    border: none !important;
    cursor: pointer !important;
    padding: 0 !important;
    margin: 0 !important;
    background: linear-gradient(145deg, #2563eb, #1a40c0) !important;
    color: #fff !important;
    box-shadow: 0 4px 12px rgba(26,86,219,.45), 0 2px 4px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.25) !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 1px !important;
    -webkit-tap-highlight-color: transparent !important;
    transform: scale(1) !important;
    transition: transform .15s, box-shadow .15s !important;
    outline: none !important;
    overflow: visible !important;
    font-family: inherit !important;
  `;
 
  btn.innerHTML = `
    <span style="
      position:absolute;top:-4px;right:-4px;
      background:#ef4444;color:#fff;
      font-size:11px;font-weight:800;
      min-width:20px;height:20px;
      border-radius:10px;
      display:flex;align-items:center;justify-content:center;
      padding:0 4px;border:2px solid #fff;
      box-shadow:0 2px 4px rgba(0,0,0,.2);
      line-height:1;font-family:inherit;
    ">${selectedCount}</span>
    <span style="font-size:14px;font-weight:900;letter-spacing:-.5px;line-height:1;margin-top:2px">OK</span>
    ${totalQty > 0
      ? `<span style="font-size:10px;font-weight:700;color:rgba(255,255,255,.85);line-height:1;background:rgba(0,0,0,.18);padding:1px 4px;border-radius:8px">${totalQty}</span>`
      : ''}
  `;
 
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05) !important';
    btn.style.boxShadow = '0 6px 16px rgba(26,86,219,.55), 0 2px 6px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.25) !important';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1) !important';
    btn.style.boxShadow = '0 4px 12px rgba(26,86,219,.45), 0 2px 4px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.25) !important';
  });
  btn.addEventListener('mousedown', () => { btn.style.transform = 'scale(0.93) !important'; });
  btn.addEventListener('mouseup',   () => { btn.style.transform = 'scale(1) !important'; });
 
  const orderCard = document.querySelector('#pOrder .card');
  if (orderCard) {
    orderCard.style.position = 'relative'; 
    orderCard.appendChild(btn);
  } else {
    document.body.appendChild(btn);
  }
}
 
function _removeFloatOK() {
  const btn = document.getElementById('msFloatOK');
  if (btn) btn.remove();
}
 
function _msToggle(name, price, maxStock) {
  if (db.strictStock !== false && maxStock <= 0) { appAlert("Sản phẩm này đã hết hàng!", "error"); return; }
  if (_msItems[name]) { delete _msItems[name]; } else { _msItems[name] = { price, maxStock, qty: '' }; }
 
  const sn = cart.map(i => i.Ten_Hang);
  const v = document.getElementById('searchP').value.toLowerCase().trim();
  const f = (db.products || []).filter(p => p.Ten_San_Pham && p.Ten_San_Pham.toLowerCase().includes(v)).slice(0, 20);
  _renderDropdown(f, sn, false);
}
 
function _msQty(input, name, maxStock) {
  let val = input.value === '' ? '' : parseInt(input.value) || 0;
  if (val !== '' && val < 1) val = 1;
  const limit = (db.strictStock === false || maxStock <= 0) ? 999999 : maxStock;
  if (val !== '' && val > limit) { val = limit; input.value = limit; showStockAlert(name, limit); }
  if (_msItems[name]) _msItems[name].qty = val;
 
  const selectedCount = Object.keys(_msItems).length;
  const totalQty = Object.values(_msItems).reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const btn = document.getElementById('msFloatOK');
  if (btn) {
    btn.innerHTML = `
      <span style="
        position:absolute;top:-4px;right:-4px;
        background:#ef4444;color:#fff;
        font-size:11px;font-weight:800;
        min-width:20px;height:20px;
        border-radius:10px;
        display:flex;align-items:center;justify-content:center;
        padding:0 4px;border:2px solid #fff;
        box-shadow:0 2px 4px rgba(0,0,0,.2);
        line-height:1;font-family:inherit;
      ">${selectedCount}</span>
      <span style="font-size:14px;font-weight:900;letter-spacing:-.5px;line-height:1;margin-top:2px">OK</span>
      ${totalQty > 0
        ? `<span style="font-size:10px;font-weight:700;color:rgba(255,255,255,.85);line-height:1;background:rgba(0,0,0,.18);padding:1px 4px;border-radius:8px">${totalQty}</span>`
        : ''}
    `;
  }
}
 
function _msConfirm() {
  const entries = Object.entries(_msItems);
  if (!entries.length) return;
 
  const missing = entries.filter(([, v]) => v.qty === '' || Number(v.qty) <= 0);
  if (missing.length > 0) {
    appAlert("Chưa nhập số lượng cho:\n" + missing.map(([k]) => '• ' + k).join('\n'), "warning");
    const inputs = document.querySelectorAll('.ms-qty');
    const emptyInput = [...inputs].find(el => !el.value || Number(el.value) <= 0);
    if (emptyInput) emptyInput.focus();
    return;
  }
 
  let added = 0;
  [...entries].reverse().forEach(([name, info]) => {
    if (cart.some(i => i.Ten_Hang === name)) return;
    cart.unshift({ Ten_Hang: name, Gia: info.price, SL: Number(info.qty), CK: '', Ghi_Chu: '', Ton_Kho: info.maxStock });
    added++;
  });
 
  _msItems = {};
  _removeFloatOK();
  document.getElementById('searchP').value = '';
  document.getElementById('resP').innerHTML = '';
  updateUI();
 
  if (added === 0) appToast("Các sản phẩm đã có sẵn trong giỏ!", "info");
}

function updateCartQty(idx, val){
  const item = cart[idx];
  let newQty = val === "" ? "" : parseInt(val);
  if(newQty !== "" && newQty < 1) newQty = 1;
  let maxStock = item.Ton_Kho || 999999;
  if(db.products){
    const prod = db.products.find(p=>p.Ten_San_Pham===item.Ten_Hang);
    if(prod) maxStock = Number(prod.So_Luong || 0);
  }
  
  if(db.strictStock !== false && newQty !== "" && newQty > maxStock && maxStock > 0){
    newQty = maxStock;
    const inputs = document.querySelectorAll('.ci-inp-qty');
    if(inputs[idx]) inputs[idx].value = maxStock;
    showStockAlert(item.Ten_Hang, maxStock);
  }
  cart[idx].SL = newQty;
  updateUI();
}

let _stockAlertTimer = null;
function showStockAlert(name, max){
  clearTimeout(_stockAlertTimer);
  let el = document.getElementById('stockAlertBar');
  if(!el){
    el = document.createElement('div');
    el.id = 'stockAlertBar';
    el.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:.3s';
    document.body.appendChild(el);
  }
  el.textContent = '⚠️ Tồn kho ' + name + ' chỉ còn ' + max + ' — đã tự điều chỉnh';
  el.style.opacity='1';
  _stockAlertTimer = setTimeout(()=>{el.style.opacity='0';},2500);
}

function removeFromCart(idx) {
  appConfirm("Xóa sản phẩm này khỏi đơn?", () => {
    cart.splice(idx, 1);
    updateUI();
  });
}

function updateUI(){
  let total=0;
  const hEl=document.getElementById('cartHeader'),tbEl=document.getElementById('totalBar');
  
  const btnSaveDraft = document.getElementById('btnSaveDraft');
  if(btnSaveDraft) btnSaveDraft.style.display = (cart.length > 0 && !editingOrderId) ? 'inline-flex' : 'none';

  if(cart.length>0){hEl.style.display='grid';tbEl.style.display='block';}
  document.getElementById('cartList').innerHTML=cart.map((item,idx)=>{
    let maxStock=item.Ton_Kho||999999;
    if(db.products){const prod=db.products.find(p=>p.Ten_San_Pham===item.Ten_Hang);if(prod)maxStock=Number(prod.So_Luong||0);}
    
    const inputMax = db.strictStock === false ? 999999 : maxStock;

    item.Thanh_Tien=(Number(item.SL)||0)*item.Gia*(1-(Number(item.CK)||0)/100);total+=item.Thanh_Tien;
    return '<div class="cart-item">' +
      '<button class="ci-rm" style="position:absolute;right:10px;top:10px" onclick="removeFromCart('+idx+')">×</button>'+
      '<div class="ci-name">'+item.Ten_Hang+'</div>'+
      (maxStock<10&&maxStock>0?'<div class="stk-warn">⚠️ Tồn kho thấp: còn '+maxStock+'</div>':'')+
      (maxStock<=0?'<div class="stk-err">❌ Hàng Này Đang Hết</div>':'')+
      '<div class="ci-grid">'+
      '<input type="number" class="ci-inp ci-inp-qty" value="'+item.SL+'" min="1" max="'+inputMax+'" '+
      'style="touch-action:manipulation;padding:6px 2px;" placeholder="SL" '+
      'onchange="updateCartQty('+idx+',this.value)" '+
      'oninput="cart['+idx+'].SL=(this.value===\'\'?\'\':Math.min(parseInt(this.value)||0,'+inputMax+'));updateCartQtyDisplay('+idx+',this)">'+
      '<input type="number" class="ci-inp" value="'+item.Gia+'" style="color:var(--dan);padding:6px 4px;" onchange="cart['+idx+'].Gia=Number(this.value)||0;updateUI()">'+
      '<input type="number" class="ci-inp" value="'+(item.CK||'')+'" placeholder="%" style="color:var(--warn);padding:6px 2px;" onchange="cart['+idx+'].CK=Number(this.value)||0;updateUI()">'+
      '<input type="text" class="ci-inp" id="ci-note-'+idx+'" style="color:var(--txt);font-weight:400;text-align:left" placeholder="Ghi chú..." value="'+String(item.Ghi_Chu||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'" onfocus="openNoteModal('+idx+',this)" onchange="cart['+idx+'].Ghi_Chu=this.value">'+
      '<span class="ci-price" id="ci-price-'+idx+'">'+Math.round(item.Thanh_Tien).toLocaleString()+'đ</span></div></div>';
  }).join('');
  document.getElementById('totalH').textContent=Math.round(total).toLocaleString()+'đ';
  document.getElementById('btnSubmitOrder').disabled=false;
  document.getElementById('btnSubmitOrder').style.opacity='1';
}
// ===== POPUP NHẬP GHI CHÚ TRÊN ĐIỆN THOẠI (BẢN MỀM MẠI) =====
function _injectNoteCss() {
  if (document.getElementById('noteModalCss')) return;
  const s = document.createElement('style');
  s.id = 'noteModalCss';
  s.textContent = `
    @keyframes noteIn  { from { opacity:0; transform:translateY(24px) scale(.96); } to { opacity:1; transform:none; } }
    @keyframes noteOut { from { opacity:1; transform:none; } to { opacity:0; transform:translateY(16px) scale(.97); } }
    .note-in  { animation: noteIn .28s cubic-bezier(.2,.8,.2,1) both !important; }
    .note-out { animation: noteOut .2s ease both !important; }

    .note-pop { border-radius:26px !important; padding:0 !important; overflow:hidden;
                box-shadow:0 24px 60px rgba(26,86,219,.28), 0 4px 14px rgba(0,0,0,.08) !important; }
    .note-pop .swal2-html-container { margin:0 !important; padding:0 !important; overflow:visible; }

    .note-head { background:linear-gradient(135deg,#1a56db 0%,#4f8df7 100%); padding:18px; color:#fff;
                 display:flex; align-items:center; gap:12px; text-align:left; }
    .note-ico  { width:44px; height:44px; border-radius:15px; background:rgba(255,255,255,.2);
                 display:flex; align-items:center; justify-content:center; font-size:21px; flex-shrink:0;
                 box-shadow:inset 0 1px 0 rgba(255,255,255,.35); }
    .note-ttl  { font-size:10.5px; font-weight:700; letter-spacing:.7px; text-transform:uppercase; opacity:.85; }
    .note-prod { font-size:15px; font-weight:700; line-height:1.3; margin-top:2px; word-break:break-word; }

    .note-body { padding:16px 18px 4px; background:#fff; text-align:left; }
    .note-ta   { width:100%; min-height:140px; resize:none; border:1.5px solid #e3e8f2; border-radius:16px;
                 background:#f7f9fd; padding:13px 14px; font-size:16px; line-height:1.55; color:#111827;
                 font-family:inherit; outline:none; transition:.2s; }
    .note-ta::placeholder { color:#a6aebf; }
    .note-ta:focus { border-color:#4f8df7; background:#fff; box-shadow:0 0 0 4px rgba(79,141,247,.15); }
    .note-meta { display:flex; justify-content:space-between; align-items:center; margin-top:8px;
                 font-size:11.5px; color:#8a93a6; font-weight:600; }
    .note-clear { background:none; border:none; color:#e02424; font-size:12px; font-weight:700;
                  cursor:pointer; padding:2px 6px; border-radius:8px; }
    .note-clear:active { background:#fde8e8; }

    .note-pop .swal2-actions { margin:14px 18px 18px !important; width:auto !important; gap:10px; flex-wrap:nowrap; }
    .note-pop .swal2-actions button { flex:1; border-radius:14px !important; padding:12px 0 !important;
                                      font-size:15px !important; font-weight:700 !important; margin:0 !important; }
    .note-pop .swal2-confirm { background:linear-gradient(135deg,#0e9f6e,#34c38f) !important;
                               box-shadow:0 6px 16px rgba(14,159,110,.35) !important; }
    .note-pop .swal2-cancel  { background:#eef1f7 !important; color:#5b6477 !important; box-shadow:none !important; }
  `;
  document.head.appendChild(s);
}

function openNoteModal(idx, el) {
  if (window.innerWidth > 768) return;   // máy tính: gõ trực tiếp như cũ
  if (el) el.blur();

  const item = cart[idx];
  if (!item) return;
  _injectNoteCss();

  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const oldVal = item.Ghi_Chu || '';

  Swal.fire({
    html:
      '<div class="note-head">' +
        '<div class="note-ico">📝</div>' +
        '<div style="min-width:0">' +
          '<div class="note-ttl">Ghi chú sản phẩm</div>' +
          '<div class="note-prod">' + esc(item.Ten_Hang) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="note-body">' +
        '<textarea id="noteTa" class="note-ta" placeholder="Nhập ghi chú cho sản phẩm này...">' + esc(oldVal) + '</textarea>' +
        '<div class="note-meta">' +
          '<span><span id="noteCnt">' + oldVal.length + '</span> ký tự</span>' +
          '<button type="button" class="note-clear" id="noteClear">Xóa hết</button>' +
        '</div>' +
      '</div>',
    showCancelButton: true,
    confirmButtonText: '✓ OK',
    cancelButtonText: 'Hủy',
    buttonsStyling: true,
    width: '92%',
    padding: 0,
    customClass: { popup: 'note-pop' },
    showClass: { popup: 'note-in' },
    hideClass: { popup: 'note-out' },
    didOpen: () => {
      const ta = document.getElementById('noteTa');
      const cnt = document.getElementById('noteCnt');
      ta.addEventListener('input', () => { cnt.textContent = ta.value.length; });
      document.getElementById('noteClear').onclick = () => { ta.value = ''; cnt.textContent = 0; ta.focus(); };
      setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 200);
    },
    preConfirm: () => document.getElementById('noteTa').value.trim()
  }).then(r => {
    if (r.isConfirmed) {
      cart[idx].Ghi_Chu = r.value || '';
      const inp = document.getElementById('ci-note-' + idx);
      if (inp) inp.value = r.value || '';
    }
  });
}

function updateCartQtyDisplay(idx, el){
  const item = cart[idx];
  let maxStock=item.Ton_Kho||999999;
  if(db.products){const prod=db.products.find(p=>p.Ten_San_Pham===item.Ten_Hang);if(prod)maxStock=Number(prod.So_Luong||0);}
  
  const inputMax = db.strictStock === false ? 999999 : (maxStock>0?maxStock:999999);
  const qty = el.value === "" ? "" : Math.min(parseInt(el.value)||0, inputMax);
  
  const priceEl = document.getElementById('ci-price-'+idx);
  if(priceEl) priceEl.textContent = Math.round((Number(qty)||0) * item.Gia * (1-(Number(item.CK)||0)/100)).toLocaleString()+'đ';
  let total=0;
  cart.forEach((it,i)=>{
    const q=(i===idx)?(Number(qty)||0):(Number(it.SL)||0);
    total+=q*it.Gia*(1-(Number(it.CK)||0)/100);
  });
  document.getElementById('totalH').textContent=Math.round(total).toLocaleString()+'đ';
}

function cancelEdit(){
  clearCartAndDraftState();
  const btn=document.getElementById('btnSubmitOrder');
  btn.textContent="✔ XÁC NHẬN LƯU ĐƠN";btn.className='btn2 btn-suc btn-full';
  document.getElementById('btnCancelEdit').style.display='none';
}

function submitOrder(){
  if(!cart.length||!document.getElementById('custInp').value){appAlert("Thiếu sản phẩm hoặc chưa chọn khách hàng!", "warning");return;}
  if(cart.some(i => i.SL === "" || i.SL <= 0)) { appAlert("Vui lòng điền số lượng lớn hơn 0 cho tất cả sản phẩm!", "warning"); return; }

  const btn=document.getElementById('btnSubmitOrder');btn.disabled=true;btn.textContent="Đang lưu...";
  if(editingOrderId){
    google.script.run.withSuccessHandler(()=>{appToast("Đã cập nhật toa thành công!");cancelEdit();loadHist();showPage('history');btn.disabled=false;})
      .updateOrder(editingOrderId,{customer:document.getElementById('custInp').value,items:cart});
  }else{
    const custName=document.getElementById('custInp').value;
    const isAdmin=(user.role||'').toLowerCase()==='admin';
    const saleNameToUse=(isAdmin && adminSelectedSale && adminSelectedSale.name) ? adminSelectedSale.name : user.fullName;
    google.script.run.withSuccessHandler((savedId)=>{
      // Đã bỏ thông báo để thao tác trơn tru hơn
      if(currentDraftId) {
         const draftIdToDelete = currentDraftId;
         if(_draftsCache) _draftsCache = _draftsCache.filter(x => x.id !== draftIdToDelete);
         _setDraftsBadge((_draftsCache||[]).length);
         google.script.run.deleteDraftFromSheet(user.fullName, draftIdToDelete);
      }
      
      clearCartAndDraftState();
      showPage('history');
      btn.disabled=false; btn.textContent="✔ XÁC NHẬN LƯU ĐƠN";
      loadHist(); 
    }).saveOrder({customer:custName,saleFullName:saleNameToUse,items:cart});
  }
}

function editOrder(id){
  const o=(db.history||[]).find(x=>x.id===id);if(!o)return;
  const role=(user.role||'').toLowerCase();
  const isOwner=String(o.sale||'').trim()===String(user.fullName||'').trim();
  if(role!=='admin'){
    if(!isOwner){appAlert("Bạn chỉ có thể sửa đơn hàng của chính mình!", "error");return;}
    if(o.status!=='Chờ in'){appAlert("Chỉ có thể sửa đơn 'Chờ in'!\nĐang ở trạng thái: "+o.status, "warning");return;}
  }
  
  appConfirm("Bưng toa "+id+" vào giỏ hàng để sửa?", () => {
    editingOrderId=id;
    cart=JSON.parse(JSON.stringify(o.items)).map(item=>{
      let maxStock=999999;
      if(db.products){const prod=db.products.find(p=>p.Ten_San_Pham===item.Ten_Hang);if(prod)maxStock=Number(prod.So_Luong||0);}
      return {...item, Ton_Kho:maxStock};
    });
    document.getElementById('custInp').value=o.cust;selectedAddr=o.addr||"";
    const addrEl=document.getElementById('addrDisplay');addrEl.style.display='block';
    addrEl.innerHTML='📍 <strong>'+o.cust+'</strong><br>'+selectedAddr;updateUI();
    const btn=document.getElementById('btnSubmitOrder');btn.textContent="Cập nhật toa "+id;btn.className='btn2 btn-warn btn-full';
    document.getElementById('btnCancelEdit').style.display='block';showPage('order');
  });
}

// ===== ẨN / HIỆN TẤT CẢ DỮ LIỆU LỊCH SỬ =====
// false = chỉ tải 500 dòng cuối mỗi sheet (mặc định, load nhanh)
// true  = tải toàn bộ dữ liệu
let histLoadAll = false;     // chế độ người dùng đang chọn
let histLoadedAll = false;   // chế độ của dữ liệu đã tải thành công gần nhất

function toggleHistLoadAll() {
  histLoadAll = !histLoadAll;
  histUpdateAllBtns(true);   // hiện "Đang tải..."
  loadHist();
}

function histUpdateAllBtns(loading) {
  document.querySelectorAll('.hist-all-btn').forEach(b => {
    b.disabled = !!loading;
    if (loading) {
      b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
      return;
    }
    if (histLoadAll) {
      b.innerHTML = '<i class="fas fa-eye-slash"></i> Ẩn (chỉ 500 cuối)';
      b.classList.add('on');
      b.title = 'Đang hiển thị toàn bộ dữ liệu — bấm để chỉ giữ 500 dòng gần nhất';
    } else {
      b.innerHTML = '<i class="fas fa-eye"></i> Hiện tất cả';
      b.classList.remove('on');
      b.title = 'Đang hiển thị 500 dữ liệu gần nhất — bấm để tải tất cả';
    }
  });
}

function loadHist(){
  if(autoReloadTimer)clearTimeout(autoReloadTimer);
  const reqAll = histLoadAll; // ghi nhớ chế độ lúc gửi yêu cầu
  google.script.run.withSuccessHandler(res=>{
    if (reqAll !== histLoadAll) return;   // người dùng đã đổi chế độ → bỏ kết quả cũ
    histLoadedAll = reqAll;
    if(window.localPrintedIds&&window.localPrintedIds.length>0) {
        res.hoaDon.forEach(item=>{
          if(window.localPrintedIds.includes(item.id) && item.status==="Chờ in") 
            item.status="Đã in";
        });
    }
    
    db.history = res.hoaDon;
    if (res.hoaDon && res.hoaDon.length > 0) { res.hoaDon.filter(o => o.status === "Chờ in").forEach(o => { console.log(["APK_ORDER_CHECK", o.id + "_" + o.total, o.sale, o.cust, Number(o.total).toLocaleString("vi-VN") + "đ", o.status].join("|")); }); }
    db.historyHoanThanh = res.hoanThanh; 
    
    // CẬP NHẬT MỚI DÀNH CHO CHATBOT: Khai báo thêm biến db.hoanThanh 
    db.hoanThanh = res.hoanThanh; 
    
    db.historyHuyToa = res.huyToa || [];

    // === FIX: Đồng bộ trạng thái "Đã Hủy" từ huyToa vào db.history ===
    // Trường hợp: admin hủy toa → sheet Hoa_Don đã cập nhật "Đã Hủy"
    // getAllHistories đọc lại nên db.history đã có status "Đã Hủy" từ server
    // Nhưng cần đảm bảo các đơn trong huyToa cũng được sync vào history để Sale thấy
    const huyToaIds = new Set((res.huyToa || []).map(x => x.id));
    db.history.forEach(item => {
      if (huyToaIds.has(item.id) && item.status !== 'Đã Hủy') {
        item.status = 'Đã Hủy';
      }
    });
    
    db.historyForXuLy = [
      ...res.hoaDon.filter(o => o.status === 'Đã in'),
      ...res.hoanThanh,
      ...(res.huyToa || []) 
    ];
    
    db.fullHistory = [
      ...res.hoaDon.filter(o => o.status !== 'Hoàn thành'),
      ...res.hoanThanh,
      ...(res.huyToa || []) 
    ];
    
    if(isFirstLoadHistory){
      const di=document.getElementById('historyDateFilter');
      if(di)di.value='';
      isFirstLoadHistory=false;
    }

    const role=(user.role||'').toLowerCase();
    if(role==='admin'||role==='leader'||role==='sale'){
      const sel=document.getElementById('historyStaffFilter');
      if(sel) {
        sel.parentElement.style.display='block';
        const cur=sel.value;
        const staffs=[...new Set(res.hoaDon.map(i=>i.sale))].filter(Boolean);
        sel.innerHTML='<option value="ALL">Tất cả nhân viên</option>'+
          staffs.map(s=>'<option value="'+s+'">'+s+'</option>').join('');
        if(staffs.includes(cur))sel.value=cur;
      }
    }
    
    renderAllHistoryPages();
    histUpdateAllBtns(false);
  
    // Khi đang xem "Hiện tất cả" (3.000+ đơn), KHÔNG tự tải lại toàn bộ mỗi 30s để tránh giật lag
if (!reqAll) {
  autoReloadTimer = setTimeout(loadHist, 15000);
}
  }).withFailureHandler(err=>{
    if (reqAll !== histLoadAll) return;
    // Chỉ báo lỗi + trả chế độ về như cũ khi lỗi xảy ra do người dùng vừa bấm nút
    if (reqAll !== histLoadedAll) {
      histLoadAll = histLoadedAll;
      appToast("Không tải được dữ liệu: " + (err && err.message ? err.message : err), "error");
    }
    histUpdateAllBtns(false);
    autoReloadTimer=setTimeout(loadHist,10000);
  }).getAllHistories(user.fullName,user.role,reqAll);
}

let histDateMode = 'today';

function setHistDateMode(mode, btn) {
  histDateMode = mode;
  document.querySelectorAll('.hist-sdbtn').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  const cr = document.getElementById('histCustomRange');
  if(cr) cr.style.display = (mode === 'custom') ? 'flex' : 'none';
  if (mode !== 'custom') {
    document.getElementById('historyDateFrom').value = '';
    document.getElementById('historyDateTo').value = '';
  }
  renderHistoryUI();
}

function checkHistDate(orderDateMs) {
  const now = new Date();
  const d = new Date(orderDateMs);
  if (isNaN(d.getTime())) return false;
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;

  if (histDateMode === 'all') return true;
  if (histDateMode === 'today') {
    return orderDateMs >= startOfToday && orderDateMs <= endOfToday;
  }
  if (histDateMode === 'yesterday') {
    const startYest = startOfToday - 86400000;
    const endYest = startYest + 86400000 - 1;
    return orderDateMs >= startYest && orderDateMs <= endYest;
  }
  if (histDateMode === 'week') {
    const startWeek = startOfToday - (6 * 86400000);
    return orderDateMs >= startWeek && orderDateMs <= endOfToday;
  }
  if (histDateMode === 'month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (histDateMode === 'custom') {
    const from = document.getElementById('historyDateFrom').value;
    const to = document.getElementById('historyDateTo').value;
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



function viewDetail(id){
  const o=(db.history||[]).find(x=>String(x.id).trim()===String(id).trim());if(!o)return;
  const role=(user.role||'').toLowerCase();
  document.getElementById('modalDynContent').innerHTML='';
  document.getElementById('orderHeaderDisplay').style.display='block';
  
  const tbl = document.getElementById('orderTable');
  tbl.style.display='table';
  tbl.style.width='100%';
  tbl.style.tableLayout='fixed';
  tbl.style.minWidth='';
  const wrap = tbl.parentElement;
  if(wrap && !wrap.classList.contains('table-responsive')) {
    wrap.classList.add('table-responsive');
  }
  wrap.style.overflowX='hidden';

  // Luôn dùng 9 cột — CSS media query sẽ tự ẩn cột 2,6,7 trên mobile
  const thead = tbl.querySelector('thead');
  if(thead) {
    thead.innerHTML = `<tr>
      <th width="4%">#</th>
      <th width="7%" style="text-align:center">Mã SP</th>
      <th width="22%">Sản phẩm</th>
      <th width="7%" style="text-align:center">SL</th>
      <th width="12%" style="text-align:right">Giá</th>
      <th width="6%" style="text-align:center">CK%</th>
      <th width="11%" style="text-align:right;color:var(--info)">Sau CK</th>
      <th width="13%" style="text-align:right">T.Tiền</th>
      <th width="18%">Ghi chú</th>
    </tr>`;
  }

  document.getElementById('totalTextLabel').textContent='TỔNG CỘNG';
  document.getElementById('detailId').textContent=o.id;
  document.getElementById('detailTime').textContent=o.time;
  document.getElementById('detailCust').textContent=o.cust;
  
  let addr=o.addr; let debt=0;
  if(db.customers){
    const m=db.customers.find(c=>String(c.Ten_Khach).trim().toLowerCase()===String(o.cust).trim().toLowerCase());
    if(m){
      if(!addr||addr==='N/A') addr=m.Dia_Chi;
      debt=Number(m.Cong_No||0);
    }
  }
  document.getElementById('detailAddr').textContent=addr||'Chưa có địa chỉ';
  const debtCont = document.getElementById('detailDebtContainer');
  if(debtCont) {
    debtCont.style.display = 'block';
    const debtDisplay = debt < 0 ? '⚠️ Âm: ' + debt.toLocaleString() + ' VNĐ' : (debt > 0 ? debt.toLocaleString() + ' VNĐ' : '0 VNĐ');
    document.getElementById('detailDebt').textContent = debtDisplay;
    document.getElementById('detailDebt').style.color = debt < 0 ? 'var(--suc)' : '';
  }
  
  // Luôn render đủ 9 cột — không phân biệt mobile/desktop
  document.getElementById('detailTableBody').innerHTML=(o.items||[]).map((it,i)=>{
    let msp = '';
    if(db.products){
      let p = db.products.find(x => String(x.Ten_San_Pham).trim() === String(it.Ten_Hang).trim());
      if(p) msp = p.Ma_SP || p['Mã SP'] || '';
    }
    let giaSauCK = Math.round(Number(it.Gia) * (1 - (Number(it.CK)||0)/100));
    let thanhTien = Math.round(Number(it.SL) * giaSauCK);

    return '<tr>'+
      '<td style="color:var(--muted);text-align:center;">'+(i+1)+'</td>'+
      '<td style="font-weight:700;color:var(--info);text-align:center;white-space:nowrap;">'+msp+'</td>'+
      '<td style="font-weight:700;overflow-wrap:break-word;word-break:break-word">'+it.Ten_Hang+'</td>'+
      '<td style="text-align:center;font-weight:700;color:var(--pri)">'+it.SL+'</td>'+
      '<td style="text-align:right">'+Number(it.Gia).toLocaleString()+'</td>'+
      '<td style="text-align:center;font-weight:700;color:var(--warn)">'+(it.CK||0)+'%</td>'+
      '<td style="text-align:right;color:var(--info)">'+giaSauCK.toLocaleString()+'</td>'+
      '<td style="text-align:right;font-weight:700;color:var(--dan)">'+thanhTien.toLocaleString()+'</td>'+
      '<td style="color:var(--muted);font-size:11px;overflow-wrap:break-word">'+(it.Ghi_Chu||'—')+'</td>'+
      '</tr>';
  }).join('');
  
  document.getElementById('detailTotal').textContent=Number(o.total).toLocaleString()+' VNĐ';
  let footer='<button type="button" class="btn2 btn-out" data-bs-dismiss="modal" onclick="restoreModalUI()">Đóng</button>';
  if(role==='admin')footer+='<button type="button" class="btn2 btn-dng" onclick="deleteOrderAndClose(\''+o.id+'\')">Xóa đơn</button>';
  document.getElementById('detailFooter').innerHTML=footer;
  new bootstrap.Modal(document.getElementById('orderDetailModal')).show();
}

function viewDetailReadOnly(id){viewDetail(id);}

function deleteOrderAndClose(id){
  const role=(user.role||'').toLowerCase();
  if(role!=='admin'){appAlert("Chỉ Admin mới có thể xóa đơn hàng!", "error");return;}
  appConfirm("Xóa vĩnh viễn đơn "+id+"?", () => {
    bootstrap.Modal.getInstance(document.getElementById('orderDetailModal'))?.hide();
    google.script.run.withSuccessHandler(()=>loadHist()).deleteOrder(id);
  });
}


// ===== XỬ LÝ ĐƠN HÀNG =====
function loadHistForXuLy(){
  loadHist(); 
}

function updateXuLyBadge(){
  const cnt = (db.historyForXuLy||[]).filter(o => o.status === 'Đã in').length;

  const badge = document.getElementById('sbXuLyBadge');
  if(badge){
    badge.style.display = cnt > 0 ? 'inline' : 'none';
    badge.textContent = cnt;
  }
  const grpBadge = document.getElementById('sbGrpBadgeXuLy');
  if (grpBadge) {
    grpBadge.textContent = cnt;
    grpBadge.style.display = cnt > 0 ? 'inline-block' : 'none';
  }

  const topBadge = document.getElementById('topXuLyCount');
  if(topBadge){
    topBadge.textContent = cnt;
    topBadge.style.display = cnt > 0 ? 'inline-block' : 'none';
  }
  const topMenuCount = document.getElementById('topMenuXuLyCount'); 
  if(topMenuCount){
    topMenuCount.textContent = cnt;
    topMenuCount.style.display = cnt > 0 ? 'inline-block' : 'none';
  }
}

function xlUpdateFilterBtns(){
  document.getElementById('xlFAll').className='fbtn'+(xlFilter==='all'?' act':'');
  document.getElementById('xlFWait').className='fbtn'+(xlFilter==='dain'?' act':'');
  document.getElementById('xlFFin').className='fbtn'+(xlFilter==='hoanThanh'?' act':'');
  if(document.getElementById('xlFHuy')) {
    document.getElementById('xlFHuy').className='fbtn'+(xlFilter==='huyToa'?' act':'');
  }
}

function renderAllHistoryPages() {
  updateXuLyBadge();
  renderXuLyUI();
  renderHistoryUI();
  renderLichSuHoaDon();
  
  if(typeof renderReport === 'function' && document.getElementById('pReport') && document.getElementById('pReport').style.display !== 'none') {
    renderReport();
  }
}

function renderXuLyUI(){
  const all = db.historyForXuLy || [];
  const isAdmin = (user.role || '').toLowerCase() === 'admin';
  const daIn = all.filter(o => o.status === 'Đã in');
  const hoanThanh = all.filter(o => o.status === 'Hoàn thành');
  const huyToa = all.filter(o => o.status === 'Đã Hủy');

  // Stat tính sau khi đã lọc thời gian + tên (nhưng bỏ qua tab trạng thái)
  // → tái dụng logic lọc date + cust trên toàn bộ `all`
  let statBase = all;

  // Áp date cũ
  const _fd = document.getElementById('xlDateFilter') ? document.getElementById('xlDateFilter').value : '';
  if(_fd) {
    const _p = _fd.split('-');
    if(_p.length === 3) {
      const _tgt = _p[2] + '/' + _p[1];
      statBase = statBase.filter(o => (o.time || '').split(' ')[0] === _tgt);
    }
  }

  // Áp xlDateMode
  if(!_fd && xlDateMode !== 'all') {
    const _today = new Date(); _today.setHours(0,0,0,0);
    const _yesterday = new Date(_today); _yesterday.setDate(_today.getDate() - 1);
    const _weekAgo   = new Date(_today); _weekAgo.setDate(_today.getDate() - 6);
    const _monthStart = new Date(_today.getFullYear(), _today.getMonth(), 1);

    statBase = statBase.filter(o => {
      const _raw = (o.time || '').split(' ')[0];
      const _pts = _raw.split('/');
      let _od;
      if(_pts.length === 3) _od = new Date(Number(_pts[2]), Number(_pts[1])-1, Number(_pts[0]));
      else if(_pts.length === 2) _od = new Date(_today.getFullYear(), Number(_pts[1])-1, Number(_pts[0]));
      else return true;
      _od.setHours(0,0,0,0);

      if(xlDateMode === 'today')     return _od.getTime() === _today.getTime();
      if(xlDateMode === 'yesterday') return _od.getTime() === _yesterday.getTime();
      if(xlDateMode === 'week')      return _od >= _weekAgo;
      if(xlDateMode === 'month')     return _od >= _monthStart;
      if(xlDateMode === 'custom') {
        const _fv = document.getElementById('xl_dateFrom') ? document.getElementById('xl_dateFrom').value : '';
        const _tv = document.getElementById('xl_dateTo')   ? document.getElementById('xl_dateTo').value   : '';
        if(_fv){ const _f = new Date(_fv); _f.setHours(0,0,0,0); if(_od < _f) return false; }
        if(_tv){ const _t = new Date(_tv); _t.setHours(0,0,0,0); if(_od > _t) return false; }
        return true;
      }
      return true;
    });
  }

  // Áp tên khách
  const _ckw = (document.getElementById('xl_custFilter') ? document.getElementById('xl_custFilter').value.trim().toLowerCase() : '');
  if(_ckw) statBase = statBase.filter(o => bodau(String(o.cust || '')).includes(bodau(_ckw)));

  // Cập nhật stat theo statBase
  document.getElementById('xlStatWait').textContent = statBase.filter(o => o.status === 'Đã in').length;
  document.getElementById('xlStatFin').textContent  = statBase.filter(o => o.status === 'Hoàn thành').length;
  if(document.getElementById('xlStatHuy'))
    document.getElementById('xlStatHuy').textContent = statBase.filter(o => o.status === 'Đã Hủy').length;
  document.getElementById('xlStatRev').textContent  =
    statBase.filter(o => o.status === 'Hoàn thành')
      .reduce((s, o) => s + Number(o.total), 0).toLocaleString() + 'đ';

  // === 1. Lọc theo tab trạng thái ===
  let filtered = all;
  if(xlFilter === 'dain')       filtered = daIn;
  else if(xlFilter === 'hoanThanh') filtered = hoanThanh;
  else if(xlFilter === 'huyToa')    filtered = huyToa;

  // === 2. Lọc theo ô date cũ (giữ tương thích) ===
  const fd = document.getElementById('xlDateFilter') ? document.getElementById('xlDateFilter').value : '';
  if(fd) {
    const p = fd.split('-');
    if(p.length === 3) {
      const tgt = p[2] + '/' + p[1];
      filtered = filtered.filter(o => (o.time || '').split(' ')[0] === tgt);
    }
  }

  // === 3. Lọc theo bộ lọc thời gian mới (xlDateMode) ===
  if(!fd && xlDateMode !== 'all') {
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday  = new Date(today); yesterday.setDate(today.getDate() - 1);
    const weekAgo    = new Date(today); weekAgo.setDate(today.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    filtered = filtered.filter(o => {
      // o.time có dạng "dd/mm hh:mm" hoặc "dd/mm/yyyy hh:mm"
      const rawDate = (o.time || '').split(' ')[0]; // "dd/mm" hoặc "dd/mm/yyyy"
      const parts = rawDate.split('/');
      let orderDate;
      if(parts.length === 3) {
        // dd/mm/yyyy
        orderDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      } else if(parts.length === 2) {
        // dd/mm — dùng năm hiện tại
        orderDate = new Date(today.getFullYear(), Number(parts[1]) - 1, Number(parts[0]));
      } else {
        return true; // không parse được thì giữ lại
      }
      orderDate.setHours(0,0,0,0);

      if(xlDateMode === 'today')     return orderDate.getTime() === today.getTime();
      if(xlDateMode === 'yesterday') return orderDate.getTime() === yesterday.getTime();
      if(xlDateMode === 'week')      return orderDate >= weekAgo;
      if(xlDateMode === 'month')     return orderDate >= monthStart;
      if(xlDateMode === 'custom') {
        const fromVal = document.getElementById('xl_dateFrom') ? document.getElementById('xl_dateFrom').value : '';
        const toVal   = document.getElementById('xl_dateTo')   ? document.getElementById('xl_dateTo').value   : '';
        if(fromVal) {
          const from = new Date(fromVal); from.setHours(0,0,0,0);
          if(orderDate < from) return false;
        }
        if(toVal) {
          const to = new Date(toVal); to.setHours(0,0,0,0);
          if(orderDate > to) return false;
        }
        return true;
      }
      return true;
    });
  }

  // === 4. Lọc theo tên khách hàng ===
  const custKw = (document.getElementById('xl_custFilter')
    ? document.getElementById('xl_custFilter').value.trim().toLowerCase() : '');
  if(custKw) {
    filtered = filtered.filter(o => bodau(String(o.cust || '')).includes(bodau(custKw)));
  }

  // === Render danh sách ===
  let html = '';
  filtered.forEach(o => {
    const isFin = o.status === 'Hoàn thành';
    const isHuy = o.status === 'Đã Hủy';
    const first = o.items[0] || { Ten_Hang: '?', SL: 0 };
    const more  = o.items.length - 1;
    const preview = '- ' + first.Ten_Hang + ' (x' + first.SL + ')' + (more > 0 ? '\n... và ' + more + ' sp khác' : '');

    let actHtml = '';
    if(isHuy) {
      actHtml = '<span class="stt-huy">❌ Đã Hủy</span>';
    } else if(isFin && isAdmin) {
      actHtml = '<span class="badge-s bfin">✔ Hoàn thành</span> <button class="btn2 btn-out btn-sm2 ms-2" onclick="event.stopPropagation();openXlModal(\'' + o.id + '\')">✏️ Sửa</button>';
    } else if(isFin) {
      actHtml = '<span class="badge-s bfin">✔ Hoàn thành</span>';
    } else {
      actHtml = '<span class="badge-s bwait" style="background:#dbeafe;color:#1e40af">⚙️ Chờ xử lý</span>';
    }

    html += '<div class="order-card ' + (isFin ? 'fin' : 'done') + '" onclick="openXlModal(\'' + o.id + '\')">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">' +
      '<div><div class="ocust">' + o.cust + '</div><div class="oid">' + o.id + '</div></div>' +
      '<div>' + actHtml + '</div>' +
      '</div>' +
      '<div class="oaddr">📍 ' + (o.addr || 'Chưa có địa chỉ') + '</div>' +
      '<div class="oprev">' + preview + '</div>' +
      '<div class="ofooter">' +
        '<span class="ometa">' + ((o.time.split(' ')[1]) || '') + ' | ' + (o.sale || '') + '</span>' +
        '<span class="ototl">' + Number(o.total).toLocaleString() + 'đ</span>' +
      '</div></div>';
  });

  // === Dòng kết quả tìm kiếm ===
  let resultHtml = '';
  if(custKw) {
    resultHtml = '<div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:8px;padding:6px 10px;background:var(--pri-lt);border-radius:8px;">' +
      (filtered.length > 0
        ? '🔍 Tìm thấy <strong style="color:var(--pri)">' + filtered.length + '</strong> đơn của khách "<strong style="color:var(--fin)">'+
          document.getElementById('xl_custFilter').value.trim() + '</strong>"'
        : '🔍 Không tìm thấy đơn nào') +
      '</div>';
  }

  // === Empty state ===
  let emptyTitle = 'Không có đơn chờ xử lý', emptyIcon = '⚙️';
  if(xlFilter === 'hoanThanh') { emptyTitle = 'Chưa có đơn hoàn thành'; emptyIcon = '✅'; }
  else if(xlFilter === 'huyToa') { emptyTitle = 'Chưa có đơn hủy'; emptyIcon = '❌'; }
  if(custKw && !filtered.length) { emptyTitle = 'Không tìm thấy đơn nào của khách này'; emptyIcon = '🔍'; }

  document.getElementById('xlList').innerHTML = resultHtml + (html ||
    '<div class="empty"><div class="empty-icon">' + emptyIcon + '</div><div class="empty-title">' + emptyTitle + '</div></div>');
}
function openXlModal(id){
  const all=db.historyForXuLy||[];
  const o=all.find(x=>x.id===id);if(!o)return;
  xlCurrentId=id;

  if (o.status === 'Hoàn thành') {
    xlEditItems[id] = o.items.map(i=>({Ten_Hang:i.Ten_Hang,SL:Number(i.SL)||1,Gia:Number(i.Gia)||0,CK:Number(i.CK)||0,Ghi_Chu:i.Ghi_Chu||''}));
  } else {
    xlEditItems[id] = o.items.map(i=>({Ten_Hang:i.Ten_Hang,SL:Number(i.SL)||1,Gia:Number(i.Gia)||0,CK:Number(i.CK)||0,Ghi_Chu:''}));
  }

  if(o.status==='Hoàn thành'){
    const rawCK = String(o.statusCK || o.ck || '0');
    xlGlobalCK[id] = Math.abs(Number(rawCK.replace(/[^\d]/g,'')) || 0);
  } else {
    xlGlobalCK[id] = 0;
  }

  if(xlFinEditMode) delete xlFinEditMode[id];
  renderXlModalContent(o);
  document.getElementById('xlModal').classList.add('show');
}

function closeXlModal(){
  document.getElementById('xlModal').classList.remove('show');
  if(xlCurrentId && xlFinEditMode) delete xlFinEditMode[xlCurrentId]; 
  xlCurrentId=null;
}

function xlCalcItem(item){return Math.round(Number(item.SL||0)*Number(item.Gia||0)*(1-(Number(item.CK)||0)/100));}
function xlCalcSubtotal(items){return items.reduce((s,i)=>s+xlCalcItem(i),0);}
function xlCalcFinalTotal(items, gckAmt){
  const sub = xlCalcSubtotal(items);
  let final = sub - (Number(gckAmt) || 0);
  return Math.round(final);  // Cho phép âm
}

function xlEnableFinEdit(id){
  xlFinEditMode[id] = true;
  const o = (db.historyForXuLy||[]).find(x=>x.id===id);
  if(!o) return;

  xlEditItems[id] = o.items.map(i=>({Ten_Hang:i.Ten_Hang,SL:Number(i.SL)||1,Gia:Number(i.Gia)||0,CK:Number(i.CK)||0,Ghi_Chu:i.Ghi_Chu||''}));

  const rawCK = String(o.statusCK || o.ck || '0');
  xlGlobalCK[id] = Math.abs(Number(rawCK.replace(/[^\d]/g,'')) || 0);

  // FIX KHO: Hoàn trả số lượng cũ vào db.products local khi bắt đầu sửa
  if(db.products) {
    o.items.forEach(orderItem => {
      const prod = db.products.find(p => String(p.Ten_San_Pham).trim() === String(orderItem.Ten_Hang).trim());
      if(prod) {
        prod.So_Luong = (Number(prod.So_Luong) || 0) + (Number(orderItem.SL) || 0);
      }
    });
  }

  renderXlModalContent(o);
}

function xlNavigate(e, className, currentIndex) {
  if (e.key === "ArrowDown" || e.key === "Enter") {
    e.preventDefault();
    const inputs = document.querySelectorAll('.' + className);
    if (currentIndex + 1 < inputs.length) {
      inputs[currentIndex + 1].focus();
      inputs[currentIndex + 1].select(); 
    }
  } 
  else if (e.key === "ArrowUp") {
    e.preventDefault();
    const inputs = document.querySelectorAll('.' + className);
    if (currentIndex > 0) {
      inputs[currentIndex - 1].focus();
      inputs[currentIndex - 1].select();
    }
  }
}

// 1. Thêm biến theo dõi tiền khách trả trước vào đầu file (nếu chưa có)
if (typeof window.xlPrePaid === 'undefined') window.xlPrePaid = {};

// 2. HÀM CẬP NHẬT TRỰC TIẾP TỔNG TIỀN KHI GÕ VÀO Ô THANH TOÁN TRƯỚC
function xlUpdatePrePaid(el, id) {
  let val = parseInt(el.value) || 0;
  xlPrePaid[id] = val; // Lưu trạng thái
  
  // Tính toán và cập nhật lại giao diện Tổng cộng toa ngay lập tức
  let finalGrandTotalEl = document.getElementById('xlFinalGrandTotal_' + id);
  if(finalGrandTotalEl) {
    let finalTotalText = document.getElementById('xlGrandTotal_' + id).innerText.replace(/đ|,|\./g, '');
    let pDebtText = document.getElementById('xlOldDebt_' + id).innerText.replace(/đ|,|\./g, '').replace('⚠️ DƯ / ÂM NỢ', '').replace('NỢ CŨ', '').trim();
    
    let finalTotal = parseInt(finalTotalText) || 0;
    let pDebt = parseInt(pDebtText) || 0;
    
    // Tổng cộng toa = Tổng hóa đơn + Nợ cũ - Thanh toán trước
    let grandFinal = finalTotal + pDebt - val;
    finalGrandTotalEl.innerText = grandFinal.toLocaleString() + 'đ';
  }
}

// 3. THAY THẾ TOÀN BỘ HÀM renderXlModalContent BẰNG HÀM SAU
function renderXlModalContent(o){
  const isAdmin = (user.role||'').toLowerCase() === 'admin';
  const isFin = o.status === 'Hoàn thành';
  const isHuy = o.status === 'Đã Hủy';
  const isReadOnly = (isFin || isHuy) && !xlFinEditMode[o.id];

  const items = xlEditItems[o.id] || o.items;
  const gck = xlGlobalCK[o.id] || 0;
  
  const prePaid = (typeof xlPrePaid !== 'undefined' && xlPrePaid[o.id] !== undefined) ? xlPrePaid[o.id] : Number(o.prePaid || 0);
  
  let pDebt = 0;
  let pDebtBeforeThisOrder = 0;

  let titleText;
  if(isHuy) titleText = '❌ Xem hóa đơn đã hủy — ' + o.id;
  else if(isFin && isReadOnly) titleText = '👁️ Xem hóa đơn — ' + o.id;
  else if(isFin && !isReadOnly) titleText = '✏️ Đang sửa hóa đơn — ' + o.id;
  else titleText = '⚙️ Xử lý đơn — ' + o.id;
  document.getElementById('xlModalTitle').textContent = titleText;

  let timeLabel = isHuy ? 'Thời gian hủy' : 'Thời gian';
  let body = '<div class="info-row"><div class="info-box"><div class="info-lbl">Mã đơn</div><div class="info-val" style="color:var(--fin);font-size:16px">' + o.id + '</div></div>' +
             '<div class="info-box"><div class="info-lbl">' + timeLabel + '</div><div class="info-val">' + o.time + '</div></div></div>';

  let saleOptions = (db.staffs || []).map(s => 
    `<option value="${s.name}" ${s.name === o.sale ? 'selected' : ''}>${s.name}</option>`
  ).join('');

  let saleText;
  if (!isReadOnly) {
    saleText = `
    <div style="display:inline-flex; align-items:center;">
      <span style="font-size:12px; color:var(--muted); margin-right:4px;">👤 NV:</span>
      <select class="finput" style="padding:2px 18px 2px 6px; font-size:12px; font-weight:bold; color:var(--pri); border:1px solid transparent; background-color:rgba(26,86,219,0.05); border-radius:6px; cursor:pointer;" onchange="changeOrderSale('${o.id}', this.value)">
        <option value="">-- Chọn --</option>
        ${saleOptions}
      </select>
    </div>`;
  } else {
    let salePhone = '';
    const staffMatch = (db.staffs || []).find(s => String(s.name).trim() === String(o.sale || '').trim());
    if (staffMatch) salePhone = staffMatch.phone || '';
    saleText = `<span style="font-size:12px;"><strong style="color:var(--pri)">👤 NV: ${o.sale || ''}</strong>${salePhone ? ' — 📞 ' + salePhone : ''}</span>`;
  }

  if(o.saleTime) {
    saleText += ' <span style="font-size:10px; color:var(--muted); font-weight:normal; margin-left:5px;">( Đặt Hàng Lúc  ' + o.saleTime + ')</span>';
  }

  body += '<div class="cust-box"><div class="cust-name">' + o.cust + '</div><div class="cust-sub">📍 ' + (o.addr || 'N/A') + '</div>' +
          '<div class="cust-sub" style="margin-top:3px">' + saleText + '</div></div>';

  if(!isReadOnly) {
    body += '<div style="margin-bottom:14px;position:relative;background:var(--bg);padding:10px;border-radius:8px;">'+
            '<label style="font-size:11px;font-weight:700;color:var(--pri);text-transform:uppercase;margin-bottom:6px;display:block">➕ Thêm sản phẩm vào đơn</label>'+
            '<input type="text" class="finput" placeholder="🔍 Nhập tên sản phẩm để thêm..." oninput="xlSearchProduct(this.value, \''+o.id+'\')">'+
            '<div id="xlSearchRes_'+o.id+'" class="search-res" style="display:none;position:absolute;width:100%;z-index:100;top:100%;box-shadow:0 10px 25px rgba(0,0,0,0.2)"></div>'+
            '</div>';
  }

  if(isHuy) {
    body += `
      <div style="background:#8b0000; border:2px solid #8b0000; border-radius:8px; padding:12px; margin-bottom:15px; color:#ffff00; font-weight:700; text-align:center;">
        ⚠️ THÔNG BÁO: ĐƠN HÀNG NÀY ĐÃ HỦY<br>
        Hệ thống đã tự động hoàn trả số lượng sản phẩm về kho và trừ công nợ cho khách hàng.
      </div>
    `;
  } else if(isFin && isReadOnly && isAdmin) body += '<div style="background:var(--fin-lt);border:1.5px solid var(--fin);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--fin);font-weight:600">✔ Đơn này đã hoàn thành — Bấm <strong>✏️ Sửa</strong> hoặc <strong>🗑️ Xóa</strong> ở dưới.</div>';
  else if(isFin && isReadOnly && !isAdmin) body += '<div style="background:var(--fin-lt);border:1.5px solid var(--fin);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--fin);font-weight:600">✔ Đơn này đã hoàn thành — Chỉ xem.</div>';
  else if(isFin && !isReadOnly) body += '<div style="background:var(--warn-lt);border:1.5px solid var(--warn);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--warn);font-weight:600">✏️ Đang chỉnh sửa hóa đơn — Bấm <strong>Cập nhật & In</strong> để lưu.</div>';
  
  body += '<div style="margin-bottom:8px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Chi tiết sản phẩm ' + (isReadOnly ? '' : '<span style="color:var(--fin)">(có thể chỉnh sửa)</span>') + '</div>';
  
  body += '<div class="items-head"><span>Sản phẩm</span><span style="text-align:center">SL</span><span style="text-align:center">Đơn giá</span><span style="text-align:center">CK%</span><span style="text-align:center;color:var(--info);">Sau CK</span><span style="text-align:center">T.Tiền</span><span>Ghi chú</span><span></span></div>';
  
  items.forEach((item, idx) => {
    const tt = xlCalcItem(item);
    let giaSauCK = Math.round(Number(item.Gia) * (1 - (Number(item.CK)||0)/100));

    if(isReadOnly){
      body += '<div class="item-row-xl"><div class="ig"><span class="iname" title="' + item.Ten_Hang + '">' + item.Ten_Hang + '</span><span style="text-align:center;font-weight:700;color:var(--pri)">' + item.SL + '</span><span style="text-align:center;color:var(--dan);font-weight:700">' + Number(item.Gia).toLocaleString() + '</span><span style="text-align:center;color:var(--warn);font-weight:700">' + (item.CK||0) + '%</span><span style="text-align:center;color:var(--info);font-weight:700">' + giaSauCK.toLocaleString() + '</span><span style="text-align:center;font-weight:700;color:var(--fin)">' + tt.toLocaleString() + '</span><span style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + (item.Ghi_Chu||'') + '">' + (item.Ghi_Chu||'—') + '</span><span></span></div></div>';
    } else {
      body += '<div class="item-row-xl"><div class="ig"><span class="iname" title="' + item.Ten_Hang + '">' + item.Ten_Hang + '</span>'+
        '<input class="xi xq nav-sl" type="number" min="1" value="' + (item.SL !== "" ? item.SL : "") + '" placeholder="SL" data-idx="' + idx + '" data-field="SL" oninput="xlUpdateItem(this,\'' + o.id + '\')" onkeydown="xlNavigate(event, \'nav-sl\', ' + idx + ')">'+
        '<input class="xi xp nav-gia" type="number" value="' + item.Gia + '" data-idx="' + idx + '" data-field="Gia" oninput="xlUpdateItem(this,\'' + o.id + '\')" onkeydown="xlNavigate(event, \'nav-gia\', ' + idx + ')">'+
        '<input class="xi xck nav-ck" type="number" min="0" max="100" value="' + (item.CK ? item.CK : "") + '" placeholder="%" data-idx="' + idx + '" data-field="CK" oninput="xlUpdateItem(this,\'' + o.id + '\')" onkeydown="xlNavigate(event, \'nav-ck\', ' + idx + ')">'+
        '<span class="xi xgia-ck" id="xlgck_' + o.id + '_' + idx + '" style="color:var(--info); font-weight:bold; text-align:center;">' + giaSauCK.toLocaleString() + '</span>'+
        '<span class="xi xtt" id="xltt_' + o.id + '_' + idx + '">' + tt.toLocaleString() + '</span>'+
        '<input class="xi xn nav-note" type="text" value="' + (item.Ghi_Chu||'') + '" placeholder="Ghi chú..." data-idx="' + idx + '" data-field="Ghi_Chu" oninput="xlUpdateItemNote(this,\'' + o.id + '\')" onkeydown="xlNavigate(event, \'nav-note\', ' + idx + ')">'+
        '<button class="irm" onclick="xlRemoveItem(' + idx + ',\'' + o.id + '\')">×</button></div></div>';
    }
  });

  const subtotal = xlCalcSubtotal(items);
  const finalTotal = xlCalcFinalTotal(items, gck);
  
  if(isFin || isHuy) {
    // ✅ FIX: đọc o.noCu trước, fallback sang o.oldDebt (tên field cũ) để không bị mất dữ liệu
    // trong khoảng thời gian giữa lúc vừa Hoàn thành và lúc auto-reload đồng bộ lại từ server
    let noCuRaw = (o.noCu !== undefined) ? o.noCu : (o.oldDebt !== undefined ? o.oldDebt : 0);
    pDebtBeforeThisOrder = Number(noCuRaw) || 0;
    pDebt = pDebtBeforeThisOrder;
  } else if(db.customers) {
    // ✅ FIX: dùng bodau() để so khớp tên khách không phân biệt hoa/thường/dấu,
    // tránh trường hợp lệch 1 ký tự khiến không tìm thấy khách -> nợ cũ hiện sai thành 0
    const match = db.customers.find(c => bodau(c.Ten_Khach) === bodau(o.cust));
    if(match) {
      const currentDebt = Number(match.Cong_No || 0);
      pDebt = currentDebt;
      pDebtBeforeThisOrder = currentDebt;
    }
  }
  
  if(!isReadOnly){
    body += '<div class="global-ck-box" style="padding: 8px 10px; margin: 8px 0;">'+
      '<div style="flex:1"><div class="global-ck-label">🏷️ Trừ chiết khấu trực tiếp (VNĐ)</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Trừ thẳng vào tổng tiền hàng</div></div>'+
      '<input type="number" class="global-ck-inp" style="width:160px; padding:5px 8px; font-size:13px;" id="xlGlobalCkInp_' + o.id + '" value="' + (gck ? gck : "") + '" min="0" placeholder="0" oninput="xlUpdateGlobalCK(this,\'' + o.id + '\')" onchange="xlUpdateGlobalCK(this,\'' + o.id + '\')"><span class="global-ck-pct">đ</span></div>';
  } else if(gck > 0){
    body += '<div class="global-ck-box" style="padding: 8px 10px; margin: 8px 0;"><div class="global-ck-label">🏷️ Đã trừ chiết khấu: ' + gck.toLocaleString() + 'đ</div></div>';
  }

  body += '<div class="grand" id="xlGrandBox_' + o.id + '" style="padding: 10px; margin-top: 8px;">'+
    '<div class="gr"><span class="glbl" style="font-size:11px;">TỔNG ĐƠN HÀNG NÀY</span><span class="gamt" id="xlGrandTotal_' + o.id + '" style="font-size:15px; color:var(--txt)">' + finalTotal.toLocaleString() + 'đ</span></div>';
  
  const debtColor = pDebt < 0 ? 'var(--suc)' : (pDebt > 0 ? 'var(--warn)' : 'var(--muted)');
  const debtLabel = pDebt < 0 ? '⚠️ DƯ / ÂM NỢ' : 'NỢ CŨ';
  const debtNote = pDebt < 0 ? ' (kiểm tra lại dữ liệu)' : '';
  
  body += '<div class="gr" style="margin-top:5px; padding-top:5px; border-top:1px dashed rgba(0,0,0,0.1)">' +
          '<span class="glbl" style="color:' + debtColor + '; font-size:11px;">' + debtLabel + '</span>' +
          '<span class="gamt" id="xlOldDebt_' + o.id + '" style="font-size:13px; color:' + debtColor + '" data-debt="'+pDebt+'">' + pDebt.toLocaleString() + 'đ' + debtNote + '</span></div>';
          
  if(!isReadOnly) {
    body += '<div class="gr" style="margin-top:5px; padding-top:5px; border-top:1px dashed rgba(0,0,0,0.1)">' +
            '<span class="glbl" style="color:var(--pri); font-weight:bold; font-size:11px;">💵 KHÁCH THANH TOÁN TRƯỚC</span>' +
            '<div style="text-align:right"><input type="number" class="global-ck-inp" style="width:160px; padding:3px 8px; font-size:14px; font-weight:bold; color:var(--pri); text-align:right; border:1px solid var(--pri);" id="xlPrePaid_' + o.id + '" value="' + (prePaid ? prePaid : "") + '" min="0" placeholder="0" oninput="xlUpdatePrePaid(this, \'' + o.id + '\')"><span class="global-ck-pct">đ</span></div></div>';
  } else {
    body += '<div class="gr" style="margin-top:5px; padding-top:5px; border-top:1px dashed rgba(0,0,0,0.1)">' +
            '<span class="glbl" style="color:var(--pri); font-weight:bold; font-size:11px;">💵 KHÁCH THANH TOÁN TRƯỚC</span>' +
            '<span class="gamt" style="font-size:14px; font-weight:bold; color:var(--pri)">-' + prePaid.toLocaleString() + 'đ</span></div>';
  }
          
  body += '<div class="gr" style="margin-top:5px; padding-top:5px; border-top:1px solid rgba(37,99,235,0.3)">' +
          '<span class="glbl" style="color:var(--fin); font-weight: 700; font-size:12px;">TỔNG CỘNG TOA</span>' +
          '<span class="gamt" id="xlFinalGrandTotal_' + o.id + '" style="font-size:20px; color:var(--fin)">' + (finalTotal + pDebt - prePaid).toLocaleString() + 'đ</span></div>';
          
  body += '<div class="gsub" id="xlDiscInfo_' + o.id + '" style="font-size:10px; margin-top:3px;">';
  if(gck > 0) body += 'Tiền hàng: ' + subtotal.toLocaleString() + 'đ | Chiết khấu: <strong style="color:var(--warn)">-' + gck.toLocaleString() + 'đ</strong>';
  else body += 'Không có trừ chiết khấu';
  body += '</div></div>';

  if(!isReadOnly) {
    let originalNote = o.note || '';
    let displayNote = '';
    
    if (o.status === 'Hoàn thành' && xlFinEditMode[o.id]) {
        displayNote = originalNote;
    } 
    else if (originalNote) {
        body += '<div class="note-area"><div class="note-lbl" style="font-size:10px;">📝 Ghi chú của Sale (Lúc lên đơn)</div><div style="background:var(--warn-lt);padding:8px;border-radius:8px;font-size:12px;color:var(--warn);font-weight:700;margin-bottom:8px;">' + originalNote + '</div></div>';
    }

    body += '<div class="note-area"><div class="note-lbl" style="font-size:10px;">✍️ Ghi chú thêm của Admin (In lên hóa đơn)</div><textarea class="note-ta" rows="2" id="xlNote_' + o.id + '" placeholder="Nhập ghi chú mới nếu cần...">' + displayNote + '</textarea></div>';
  }
  else if(o.note) {
    body += '<div class="note-area"><div class="note-lbl" style="font-size:10px;">Ghi chú đơn hàng</div><div style="background:var(--bg);padding:8px;border-radius:8px;font-size:11px">' + o.note + '</div></div>';
  }
  
  document.getElementById('xlModalBody').innerHTML = body;

  let foot = '<button class="btn2 btn-out" onclick="closeXlModal()">Đóng</button>';
  if (!isHuy) {
    if(isFin && isAdmin && isReadOnly) {
        foot += '<button class="btn2 btn-out" onclick="xlPrintInvoiceOnly(\'' + o.id + '\')">🖨️ In lại</button>';
        foot += '<button class="btn2" style="background-color: var(--dan); color: white; border: none;" onclick="handleAdminDeleteFromXlModal(\'' + o.id + '\')">🗑️ HUỶ TOA</button>';
        foot += '<button class="btn2 btn-warn" onclick="xlEnableFinEdit(\'' + o.id + '\')">✏️ Sửa Hóa Đơn</button>';
    } else if(isFin && isAdmin && !isReadOnly) {
        foot += '<button class="btn2 btn-fin" onclick="xlUpdateAndPrintFin(\'' + o.id + '\')">🖨️ Cập nhật Hóa Đơn & In lại</button>';
    } else if (!isFin) {
        foot += '<button class="btn2 btn-fin" onclick="xlPrintAndFinish(\'' + o.id + '\')">🖨️ In Hóa Đơn & Hoàn thành</button>';
    } else {
        foot += '<button class="btn2 btn-out" onclick="xlPrintInvoiceOnly(\'' + o.id + '\')">🖨️ In lại hóa đơn</button>';
    }
  }
  document.getElementById('xlModalFoot').innerHTML = foot;
}
function handleAdminDeleteFromXlModal(orderId) {
  appConfirm("⚠️ CẢNH BÁO: Bạn có chắc muốn XÓA đơn " + orderId + "?", function() {
    Swal.fire({ title: 'Đang xử lý...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    google.script.run
      .withSuccessHandler(function(res) {
        if (res.success) {
          appToast(res.msg, "success");
          
          // Lưu lại thông tin đơn trước khi xóa để cập nhật nợ
          const deletedOrder = (db.historyHoanThanh || []).find(x => x.id === orderId);

          // 1. Xóa đơn khỏi danh sách Hoàn Thành cục bộ
          db.historyHoanThanh = (db.historyHoanThanh || []).filter(x => x.id !== orderId);

          // 2. Thêm vào danh sách Hủy cục bộ
          if(!db.historyHuyToa) db.historyHuyToa = [];
          if(res.newHuyItem) db.historyHuyToa.unshift(res.newHuyItem);

          // 3. Cập nhật status "Đã Hủy" trong db.history
          if(db.history) {
            const idx = db.history.findIndex(x => x.id === orderId);
            if(idx >= 0) db.history[idx].status = 'Đã Hủy';
          }

          // FIX CÔNG NỢ: Trừ nợ ngay vào db.customers local
          if(deletedOrder && db.customers) {
            const cust = db.customers.find(c => String(c.Ten_Khach).trim() === String(deletedOrder.cust).trim());
            if(cust) {
              cust.Cong_No = (Number(cust.Cong_No) || 0) - (Number(deletedOrder.total) || 0);
              if(document.getElementById('pLichSuCongNo').style.display !== 'none') renderCongNoList();
              if(document.getElementById('pCustomers').style.display !== 'none') renderCustomerList();
            }
          }

          // 4. Cập nhật lại mảng hiển thị
          db.historyForXuLy = [
            ...(db.history || []).filter(o => o.status === 'Đã in'),
            ...(db.historyHoanThanh || []),
            ...(db.historyHuyToa || [])
          ];
          
          // 5. Vẽ lại toàn bộ giao diện
          renderAllHistoryPages();
          closeXlModal();

          // 6. Đồng bộ ngầm với server
          loadData();
        } else {
          appAlert(res.msg, "error");
        }
      })
      .adminDeleteCompletedOrder(orderId);
  });
}

function changeOrderSale(id, newSaleName) {
  if(!newSaleName) return;
  
  if (db.historyForXuLy) {
    let o1 = db.historyForXuLy.find(x => x.id === id);
    if (o1) o1.sale = newSaleName;
  }
  if (db.history) {
    let o2 = db.history.find(x => x.id === id);
    if (o2) o2.sale = newSaleName;
  }

  google.script.run
    .withSuccessHandler(() => {
      if (typeof appToast === 'function') appToast("Đã chuyển toa cho Sale: " + newSaleName);
    })
    .withFailureHandler(err => {
      if (typeof appAlert === 'function') appAlert("Lỗi đổi nhân viên: " + err.message, "error");
    })
    .quickUpdateOrderSale(id, newSaleName);
}

function xlSearchProduct(val, orderId) {
  const resEl = document.getElementById('xlSearchRes_'+orderId);
  if(!val) { resEl.style.display='none'; return; }
  const term = val.toLowerCase();
  const isAdmin = (user.role||'').toLowerCase() === 'admin';
  const existNames = (xlEditItems[orderId]||[]).map(i=>i.Ten_Hang);
  const f = (db.products||[]).filter(p =>
    p.Ten_San_Pham && p.Ten_San_Pham.toLowerCase().includes(term) &&
    (isAdmin || !existNames.includes(p.Ten_San_Pham))
  ).slice(0, 20);
  if(!f.length) { resEl.style.display='none'; return; }
  resEl.innerHTML = f.map(p => {
    const safeName = (p.Ten_San_Pham||'').replace(/'/g,"\\'").replace(/"/g,'\\"');
    const stk=Number(p.So_Luong||0);
    if(db.strictStock !== false && stk<=0){
      return'<div class="sr-item" style="opacity:.6;cursor:not-allowed"><span class="text-decoration-line-through text-muted">'+p.Ten_San_Pham+'</span><span class="stk stk-out">Hết hàng</span></div>';
    }
    const isDup = existNames.includes(p.Ten_San_Pham);
    const dupTag = (isAdmin && isDup) ? ' <span style="color:var(--warn);font-size:10px">(đã có trong đơn)</span>' : '';
    return '<div class="sr-item" onclick="xlAddProductToOrder(\''+safeName+'\', '+p.Don_Gia+', \''+orderId+'\')"><span><strong>'+p.Ten_San_Pham+'</strong>'+dupTag+' — <span style="color:var(--pri)">'+Number(p.Don_Gia).toLocaleString()+'đ</span></span></div>';
  }).join('');
  resEl.style.display = 'block';
}

function xlAddProductToOrder(name, price, orderId) {
  if(!xlEditItems[orderId]) xlEditItems[orderId] = [];
  
  // Thêm addDate để báo cáo thống kê tách được món hàng này sang ngày hôm nay
  xlEditItems[orderId].unshift({ 
    Ten_Hang: name, 
    SL: "", 
    Gia: price, 
    CK: "", 
    Ghi_Chu: "", 
    addDate: new Date().getTime() 
  });
  
  const o = (db.historyForXuLy||[]).find(x=>x.id===orderId);
  if(o) renderXlModalContent(o);
}

function xlUpdateGlobalCK(el, orderId){
  let val = Number(el.value)||0;
  if(val<0)val=0;
  xlGlobalCK[orderId]=val;
  const items=xlEditItems[orderId]||[];
  const subtotal=xlCalcSubtotal(items);
  const finalTotal=xlCalcFinalTotal(items,val);
  
  const gtEl=document.getElementById('xlGrandTotal_'+orderId);
  if(gtEl){
    gtEl.textContent=finalTotal.toLocaleString()+'đ';
    gtEl.style.color = finalTotal < 0 ? 'var(--dan)' : 'var(--txt)';
  }
  const diEl=document.getElementById('xlDiscInfo_'+orderId);
  if(diEl){
    if(val>0) diEl.innerHTML='Tiền hàng: '+subtotal.toLocaleString()+'đ<br>Trừ chiết khấu: <strong style="color:var(--warn)">-'+val.toLocaleString()+'đ</strong>';
    else diEl.innerHTML='Không có trừ chiết khấu';
  }

  const fgEl = document.getElementById('xlFinalGrandTotal_' + orderId);
  const debtEl = document.getElementById('xlOldDebt_' + orderId);
  if(fgEl && debtEl) {
    const currentOldDebt = Number(debtEl.getAttribute('data-debt') || 0);
    const grandTotal = finalTotal + currentOldDebt;
    fgEl.textContent = grandTotal.toLocaleString() + 'đ';
    fgEl.style.color = grandTotal < 0 ? 'var(--dan)' : 'var(--fin)';
  }
}

function xlUpdateItem(el,orderId){
  const idx=parseInt(el.dataset.idx),field=el.dataset.field;
  if(!xlEditItems[orderId]){const o=(db.historyForXuLy||[]).find(x=>x.id===orderId);xlEditItems[orderId]=o.items.map(i=>({...i,CK:Number(i.CK)||0}));}
  
  let val = el.value === "" ? "" : (Number(el.value)||0);
  
  // --- LOGIC KIỂM TRA TỒN KHO CỦA BẠN (GIỮ NGUYÊN) ---
  if(field === 'SL' && db.strictStock !== false && val !== "") {
     const itemName = xlEditItems[orderId][idx].Ten_Hang;
     let maxStock = 999999;
     const prod = (db.products||[]).find(p=>p.Ten_San_Pham===itemName);
     if(prod) maxStock = Number(prod.So_Luong||0);
     
     const origOrder = (db.historyForXuLy||[]).find(x=>x.id===orderId);
     if(origOrder && origOrder.status === 'Hoàn thành') {
        const oldItem = origOrder.items.find(i=>i.Ten_Hang===itemName);
        if(oldItem) maxStock += Number(oldItem.SL || 0); 
     }
     
     if(val > maxStock && maxStock > 0) {
        val = maxStock;
        el.value = maxStock;
        showStockAlert(itemName, maxStock);
     }
  }

  xlEditItems[orderId][idx][field]=val;
  const items=xlEditItems[orderId];
  
  // --- 1. CẬP NHẬT TỔNG TIỀN (Bỏ chữ 'đ' cho gọn bảng) ---
  const tt=xlCalcItem(items[idx]);
  const ttEl=document.getElementById('xltt_'+orderId+'_'+idx);
  if(ttEl) ttEl.textContent=tt.toLocaleString();
  
  // --- 2. [ĐÃ FIX] CẬP NHẬT REALTIME GIÁ SAU CK ---
  let giaSauCK = Math.round(Number(items[idx].Gia||0) * (1 - (Number(items[idx].CK)||0)/100));
  const gckEl = document.getElementById('xlgck_' + orderId + '_' + idx);
  if(gckEl) gckEl.textContent = giaSauCK.toLocaleString();
  
  // --- 3. CẬP NHẬT TỔNG ĐƠN ---
  const gck=xlGlobalCK[orderId]||0;
  const subtotal=xlCalcSubtotal(items);
  const finalTotal=xlCalcFinalTotal(items,gck);
  
  const gtEl=document.getElementById('xlGrandTotal_'+orderId);if(gtEl)gtEl.textContent=finalTotal.toLocaleString()+'đ';
  const diEl=document.getElementById('xlDiscInfo_'+orderId);
  if(diEl){
    if(gck>0) diEl.innerHTML='Tiền hàng: '+subtotal.toLocaleString()+'đ<br>Trừ chiết khấu: <strong style="color:var(--warn)">-'+gck.toLocaleString()+'đ</strong>';
    else diEl.innerHTML='Không có trừ chiết khấu';
  }

  const fgEl = document.getElementById('xlFinalGrandTotal_' + orderId);
  const debtEl = document.getElementById('xlOldDebt_' + orderId);
  if(fgEl && debtEl) {
    const currentOldDebt = Number(debtEl.getAttribute('data-debt') || 0);
    fgEl.textContent = (finalTotal + currentOldDebt).toLocaleString() + 'đ';
  }
}

function xlUpdateItemNote(el,orderId){
  const idx=parseInt(el.dataset.idx);
  if(!xlEditItems[orderId]){const o=(db.historyForXuLy||[]).find(x=>x.id===orderId);xlEditItems[orderId]=o.items.map(i=>({...i,CK:Number(i.CK)||0}));}
  xlEditItems[orderId][idx].Ghi_Chu=el.value;
}

function xlRemoveItem(idx,orderId){
  appConfirm("Xóa sản phẩm này khỏi đơn?", () => {
    if(!xlEditItems[orderId]){const o=(db.historyForXuLy||[]).find(x=>x.id===orderId);xlEditItems[orderId]=o.items.map(i=>({...i,CK:Number(i.CK)||0}));}
    xlEditItems[orderId].splice(idx,1);
    const o=(db.historyForXuLy||[]).find(x=>x.id===orderId);if(o)renderXlModalContent(o);
  });
}

// ===== NHẬP KHO =====
// Trạng thái: đang sửa phiếu nhập nào (null = nhập mới bình thường)
let editingImportId = null;

function searchImport() {
  const v = document.getElementById('importSearchP').value.toLowerCase().trim();
  if (!v) { document.getElementById('importResP').innerHTML = ""; return; }
  
  const sn = importCart.map(i => i.Ten_Hang);
  const f = (db.products || []).filter(p => p.Ten_San_Pham && p.Ten_San_Pham.toLowerCase().includes(v) && !sn.includes(p.Ten_San_Pham)).slice(0, 20);

  document.getElementById('importResP').innerHTML = f.length ? '<div class="search-res">' + f.map(p => {
    const safe = (p.Ten_San_Pham || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
    // Móc Mã SP từ data, nếu trống thì hiện ---
    const maSpDisplay = p.Ma_SP || '---'; 
    return '<div class="sr-item" onclick="addImportCart(\'' + safe + '\')">' +
           '<span><strong style="color:var(--info)">[' + maSpDisplay + ']</strong> <b style="margin-left:4px;">' + p.Ten_San_Pham + '</b></span>' +
           '<span class="stk stk-ok">Tồn: ' + Number(p.So_Luong || 0) + '</span></div>';
  }).join('') + '</div>' : '<div class="search-res" style="padding:10px;text-align:center;color:var(--muted)">Không tìm thấy sản phẩm</div>';
}

// 1. HÀM THÊM SẢN PHẨM VÀO GIỎ
function addImportCart(n) {
  importCart.unshift({Ten_Hang: n, SL: '', note: ''});
  document.getElementById('importSearchP').value = "";
  document.getElementById('importResP').innerHTML = "";
  updateImportUI();

  // Tự động nhảy nháy chuột vào ô số lượng
  setTimeout(() => {
    const firstQtyInput = document.querySelector('#importCartList input[type="number"]');
    if (firstQtyInput) {
      firstQtyInput.focus();
    }
  }, 50); 
}

// 2. HÀM XÓA SẢN PHẨM KHỎI GIỎ (Nút X đỏ)
function removeImportCart(idx) {
  importCart.splice(idx, 1);
  updateImportUI();
}

// 3. HÀM VẼ GIAO DIỆN GIỎ HÀNG NHẬP KHO (có banner khi đang sửa phiếu)
function updateImportUI() {
  const banner = editingImportId
    ? '<div style="background:#fff7e0;border:1px solid #f0c040;border-radius:8px;padding:10px 12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<span style="font-size:13px;">✏️ Đang sửa phiếu <b>' + editingImportId + '</b> — số lượng cũ sẽ được trả về kho, số lượng mới sẽ tính khi bấm Xác nhận.</span>' +
        '<button class="btn2 btn-out btn-sm2" onclick="cancelEditImport()">Hủy sửa</button>' +
      '</div>'
    : '';

  document.getElementById('importCartList').innerHTML = banner + importCart.map((i, idx) => {
    let p = (db.products || []).find(x => x.Ten_San_Pham === i.Ten_Hang);
    let maSpDisplay = (p && p.Ma_SP) ? p.Ma_SP : '---';

    return '<div class="imp-item" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--bdr);border-radius:8px;margin-bottom:8px;background:#fff;flex-wrap:wrap;">' +
      '<span style="font-weight:800;color:var(--info);min-width:65px;">[' + maSpDisplay + ']</span>' +
      '<span style="flex:1;font-weight:700;font-size:14px;color:var(--txt);min-width:200px;">' + i.Ten_Hang + '</span>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:nowrap;">' +
        '<input type="number" class="ci-inp" placeholder="SL" value="' + i.SL + '" min="1" style="width:75px;text-align:center;font-weight:bold;color:var(--pri);" onchange="importCart[' + idx + '].SL=Number(this.value)||1">' +
        '<input type="text" class="ci-inp" placeholder="Nhập ghi chú (nếu có)..." value="' + (i.note || '') + '" style="width:250px;text-align:left;" onchange="importCart[' + idx + '].note=this.value">' +
        '<button class="ci-rm" onclick="removeImportCart(' + idx + ')" style="background:var(--dan-lt);color:var(--dan);width:32px;height:32px;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;">×</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// 4. XÁC NHẬN: nhập mới hoặc cập nhật phiếu đang sửa
function submitImport(){
  if(!importCart.length){appAlert("Chưa chọn sản phẩm nào!", "warning");return;}
  if(importCart.some(i => !Number(i.SL) || Number(i.SL) <= 0)){
    appAlert("Vui lòng nhập số lượng lớn hơn 0 cho tất cả sản phẩm!", "warning");
    return;
  }
  const btn=document.getElementById('btnSubmitImport');
  btn.disabled=true;btn.textContent="Đang xử lý...";
  const resetBtn = () => { btn.disabled=false; btn.textContent="✔ XÁC NHẬN NHẬP KHO"; };
  const onFail = err => { appAlert("Lỗi: " + (err && err.message ? err.message : err), "error"); resetBtn(); };
  const onDone = msg => {
    appToast(msg);
    importCart=[]; editingImportId=null;
    updateImportUI(); loadData();
    if(typeof loadImportHist==='function') loadImportHist();
    resetBtn();
  };

  if (editingImportId) {
    google.script.run
      .withSuccessHandler(()=>onDone("Đã cập nhật phiếu nhập kho!"))
      .withFailureHandler(onFail)
      .updateImportData({id:editingImportId,userFullName:user.fullName,items:importCart});
  } else {
    google.script.run
      .withSuccessHandler(()=>onDone("Nhập kho thành công!"))
      .withFailureHandler(onFail)
      .saveImportData({userFullName:user.fullName,items:importCart});
  }
}

// 5. BẤM "SỬA" TRÊN PHIẾU LỊCH SỬ -> nạp phiếu vào giỏ để chỉnh số lượng
function editImport(id){
  const o=(db.importHistory||[]).find(x=>String(x.id)===String(id));
  if(!o) return;
  const proceed = () => {
    editingImportId = o.id;
    importCart = (o.items||[]).map(i=>({Ten_Hang:i.Ten_Hang,SL:Number(i.SL)||0,note:i.note||''}));
    updateImportUI();
    showPage('import');
  };
  if (importCart.length && !editingImportId) {
    appConfirm("Giỏ nhập kho đang có sản phẩm. Thay bằng phiếu "+id+" để sửa?", proceed);
  } else {
    appConfirm("Sửa phiếu nhập "+id+"? Số lượng cũ sẽ được trả về kho khi bạn xác nhận số lượng mới.", proceed);
  }
}

// 6. HỦY CHẾ ĐỘ SỬA
function cancelEditImport(){
  editingImportId = null;
  importCart = [];
  updateImportUI();
}

const IMPORT_PER_PAGE = 20;   // số phiếu mỗi trang
let currentImportPage = 1;
let importHistoryData = [];
function loadImportHist() {
  const role = (user.role || '').toLowerCase();
  if (role !== 'admin') return;
  google.script.run.withSuccessHandler(h => {
    db.importHistory = h;
    importHistoryData = h; // ← THÊM DÒNG NÀY
    renderImportHistoryUI();
  }).getImportHistory();
}

function renderImportHistoryUI(){
  if(!db.importHistory)return;
  const all=db.importHistory;
  let tq=0; all.forEach(o=>{tq+=Number(o.totalQty)||0;});   // thống kê tính trên TẤT CẢ phiếu
  const cnt=all.length;
  const totalPages=Math.max(1,Math.ceil(cnt/IMPORT_PER_PAGE));
  if(currentImportPage>totalPages)currentImportPage=totalPages;
  if(currentImportPage<1)currentImportPage=1;
  const pageItems=all.slice((currentImportPage-1)*IMPORT_PER_PAGE,currentImportPage*IMPORT_PER_PAGE);
  let html='';
  pageItems.forEach(o=>{
    html+='<div class="order-card fin" onclick="viewImportDetail(\''+o.id+'\')">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
        '<span style="font-weight:700;color:var(--info)">'+o.id+'</span>'+
        '<span style="display:flex;gap:6px;align-items:center">'+
          '<span class="badge-s" style="background:var(--info-lt);color:var(--info)">Đã nhập</span>'+
          '<button class="btn2 btn-out btn-sm2" onclick="event.stopPropagation();editImport(\''+o.id+'\')">✏️ Sửa</button>'+
        '</span>'+
      '</div>'+
      '<div class="ometa mb-1">'+o.time+' | Người nhập: <strong>'+o.user+'</strong></div>'+
      '<div style="text-align:right;font-weight:700">Tổng SL nhập: <span style="color:var(--pri)">'+o.totalQty+'</span></div></div>';
  });
  document.getElementById('statImportTotalQty').textContent=tq;document.getElementById('statImportCount').textContent=cnt;
  document.getElementById('importHistList').innerHTML=
    (html||'<div class="empty"><div class="empty-icon">📦</div><div class="empty-title">Chưa có lịch sử nhập kho</div></div>')
    + buildImportPagination(currentImportPage,totalPages,cnt);
}

// Thanh phân trang: ⬅ 1 ... 4 [5] 6 ... 20 ➡
function buildImportPagination(page,totalPages,totalCount){
  if(totalPages<=1) return '';
  const btn=(label,p,opts)=>{
    opts=opts||{};
    const active=opts.active, disabled=opts.disabled;
    return '<button class="btn2 '+(active?'btn-pri':'btn-out')+' btn-sm2" '+
      'style="min-width:36px;padding:4px 8px;'+(active?'font-weight:800;':'')+'" '+
      (disabled?'disabled ':'onclick="goImportPage('+p+')" ')+'>'+label+'</button>';
  };
  // Tập trang cần hiện: đầu, cuối, và 2 trang quanh trang hiện tại
  const show=new Set([1,totalPages,page-2,page-1,page,page+1,page+2]);
  const pages=[...show].filter(p=>p>=1&&p<=totalPages).sort((a,b)=>a-b);
  let nums='',prev=0;
  pages.forEach(p=>{
    if(prev && p-prev>1) nums+='<span style="color:var(--muted);padding:0 2px">…</span>';
    nums+=btn(p,p,{active:p===page});
    prev=p;
  });
  return '<div style="display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;margin:14px 0 6px;">'+
    btn('⬅',page-1,{disabled:page<=1})+nums+btn('➡',page+1,{disabled:page>=totalPages})+
  '</div>'+
  '<div style="text-align:center;font-size:12px;color:var(--muted);font-weight:600">Trang '+page+' / '+totalPages+' — tổng '+totalCount+' phiếu</div>';
}

function goImportPage(p){
  currentImportPage=p;
  renderImportHistoryUI();
  const el=document.getElementById('importHistList');
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}

function viewImportDetail(id){
  const o=(db.importHistory||[]).find(x=>String(x.id)===String(id));if(!o)return;
  document.getElementById('modalTitle').textContent='Chi tiết phiếu nhập kho';
  document.getElementById('orderHeaderDisplay').style.display='none';
  if(document.getElementById('detailDebtContainer')) document.getElementById('detailDebtContainer').style.display='none';
  document.getElementById('totalTextLabel').textContent='TỔNG SỐ LƯỢNG';
  document.getElementById('detailTotal').textContent=o.totalQty;
  document.getElementById('modalDynContent').innerHTML='<div style="background:var(--info-lt);border-radius:8px;padding:10px;margin-bottom:12px"><div style="font-weight:700;color:var(--info);font-size:14px">Mã phiếu: '+o.id+'</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Thời gian: '+o.time+'</div><div style="font-size:12px;color:var(--muted)">Người nhập: <strong>'+o.user+'</strong></div></div>';
  
  const tbl = document.getElementById('orderTable');
tbl.style.display = 'table';
tbl.style.minWidth = '550px';
tbl.style.width = 'max-content'; // ← thêm dòng này

const wrapper = tbl.parentElement;
if (wrapper) {
  wrapper.style.overflowX = 'auto';
  wrapper.style.webkitOverflowScrolling = 'touch'; // ← cuộn mượt trên mobile
  wrapper.style.maxWidth = '100%';                 // ← giới hạn không vượt modal
}

  // Tái cấu trúc tiêu đề bảng gồm 5 cột (Bổ sung thêm cột Ghi Chú)
  const thead = tbl.querySelector('thead');
  if(thead) {
    thead.innerHTML = `<tr>
      <th width="5%" style="text-align:center">#</th>
      <th width="15%" style="text-align:center">Mã SP</th>
      <th width="40%">Sản phẩm</th>
      <th width="15%" style="text-align:center">Số lượng</th>
      <th width="25%">Ghi chú</th>
    </tr>`;
  }

  // Đổ dữ liệu có chứa ghi chú
  document.getElementById('detailTableBody').innerHTML=o.items.map((i,idx)=>{
    let msp = '';
    if(db.products){
      let p = db.products.find(x => String(x.Ten_San_Pham).trim() === String(i.Ten_Hang).trim());
      if(p) msp = p.Ma_SP || p['Mã SP'] || '';
    }
    return '<tr>' +
      '<td style="color:var(--muted);text-align:center;">'+(idx+1)+'</td>' +
      '<td style="font-weight:700;color:var(--info);text-align:center;white-space:nowrap;">'+msp+'</td>' +
      '<td style="font-weight:700">'+i.Ten_Hang+'</td>' +
      '<td style="text-align:center;font-weight:700;color:var(--pri)">'+i.SL+'</td>' +
      '<td style="color:var(--muted);font-size:11px;">'+(i.note || '')+'</td>' +
      '</tr>';
  }).join('');
  
  // Footer: Đóng + Sửa phiếu
  document.getElementById('detailFooter').innerHTML=
    '<button class="btn2 btn-out" data-bs-dismiss="modal" onclick="restoreModalUI()">Đóng</button>'+
    '<button class="btn2 btn-warn" data-bs-dismiss="modal" onclick="restoreModalUI();editImport(\''+o.id+'\')">✏️ Sửa phiếu</button>';
  new bootstrap.Modal(document.getElementById('orderDetailModal')).show();
}

// 2. HÀM DỌN DẸP GIAO DIỆN SAU KHI ĐÓNG MODAL
function restoreModalUI(){
  document.getElementById('modalTitle').textContent='Chi tiết đơn hàng';
  document.getElementById('orderHeaderDisplay').style.display='block';
  if(document.getElementById('detailDebtContainer')) document.getElementById('detailDebtContainer').style.display='block';
  
  const tbl = document.getElementById('orderTable');
  tbl.style.display='table';
  tbl.style.minWidth=''; 
  tbl.classList.remove('force-scroll-table'); // XÓA CỜ ĐỂ TRẢ LẠI GIAO DIỆN GỌN GÀNG CHO MENU KHÁC
  
  if(tbl.parentElement) tbl.parentElement.style.overflowX='';

  document.getElementById('totalTextLabel').textContent='TỔNG CỘNG';
  document.getElementById('modalDynContent').innerHTML='';
}

// ===== TRA CỨU =====
function setDateMode(mode,btn){
  shDateMode=mode;document.querySelectorAll('.sdbtn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');
  const cr=document.getElementById('shCustomRange');cr.style.display=mode==='custom'?'flex':'none';
  if(mode!=='custom'){document.getElementById('shDateFrom').value='';document.getElementById('shDateTo').value='';}
  triggerShSearch();
}
function getShDateRange(){
  const today=new Date();const fmt=d=>String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
  if(shDateMode==='all')return null;
  if(shDateMode==='today')return{type:'single',val:fmt(today)};
  if(shDateMode==='yesterday'){const y=new Date(today);y.setDate(y.getDate()-1);return{type:'single',val:fmt(y)};}
  if(shDateMode==='week'){const dates=[];for(let i=0;i<7;i++){const d=new Date(today);d.setDate(d.getDate()-i);dates.push(fmt(d));}return{type:'multi',vals:dates};}
  if(shDateMode==='month'){return{type:'month',val:String(today.getMonth()+1).padStart(2,'0')};}
  if(shDateMode==='custom'){
    const from=document.getElementById('shDateFrom').value,to=document.getElementById('shDateTo').value;
    if(!from&&!to)return null;return{type:'range',from,to};
  }
  return null;
}
function orderMatchesDateRange(order){
  const range=getShDateRange();if(!range)return true;
  const datePart=(order.time||'').split(' ')[0];
  if(range.type==='single')return datePart===range.val;
  if(range.type==='multi')return range.vals.includes(datePart);
  if(range.type==='month'){const p=datePart.split('/');return p.length>=2&&p[1]===range.val;}
  if(range.type==='range'){
    if(!range.from&&!range.to)return true;
    const pts=datePart.split('/');if(pts.length<2)return false;
    const yr=pts[2]?parseInt(pts[2]):new Date().getFullYear();
    const od=new Date(yr,parseInt(pts[1])-1,parseInt(pts[0]));
    if(range.from&&od<new Date(range.from))return false;
    if(range.to&&od>new Date(range.to))return false;
    return true;
  }
  return true;
}
function getDateRangeLabel(){
  if(shDateMode==='all')return'';if(shDateMode==='today')return'Hôm nay';if(shDateMode==='yesterday')return'Hôm qua';
  if(shDateMode==='week')return'7 ngày qua';if(shDateMode==='month')return'Tháng này';
  if(shDateMode==='custom'){const f=document.getElementById('shDateFrom').value,t=document.getElementById('shDateTo').value;if(f&&t)return'Từ '+f.split('-').reverse().join('/')+' đến '+t.split('-').reverse().join('/');if(f)return'Từ '+f.split('-').reverse().join('/');if(t)return'Đến '+t.split('-').reverse().join('/');}
  return'';
}
function clearSearchHistory(){document.getElementById('shSearchInp').value='';document.getElementById('shSuggestions').style.display='none';document.getElementById('shResults').innerHTML='';}
function triggerShSearch(){const val=document.getElementById('shSearchInp').value;if(val.trim()){const type=document.querySelector('input[name="shSearchType"]:checked').value;selectSearchHistory(type,val);}}
function handleSearchHistory(val){
  const type=document.querySelector('input[name="shSearchType"]:checked').value,sugg=document.getElementById('shSuggestions');
  if(!val){sugg.style.display='none';return;}
  let matches=[];
  if(type==='product')matches=(db.products||[]).filter(p=>p.Ten_San_Pham&&p.Ten_San_Pham.toLowerCase().includes(val.toLowerCase())).slice(0,10).map(p=>p.Ten_San_Pham);
  else matches=(db.customers||[]).filter(c=>c.Ten_Khach&&bodau(c.Ten_Khach).includes(bodau(val))).slice(0,10).map(c=>c.Ten_Khach);
  if(matches.length){sugg.innerHTML='<div class="search-res">'+matches.map(m=>'<div class="sr-item" onclick="selectSearchHistory(\''+type+'\',\''+m.replace(/'/g,"\\'").replace(/"/g,'\\"')+'\')">'+m+'</div>').join('')+'</div>';sugg.style.display='block';}
  else sugg.style.display='none';
}
function selectSearchHistory(type,name){document.getElementById('shSearchInp').value=name;document.getElementById('shSuggestions').style.display='none';executeHistorySearch(type,name);}
function executeHistorySearch(type,name){
  if(!db.fullHistory||!db.fullHistory.length){document.getElementById('shResults').innerHTML='<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">Chưa có dữ liệu lịch sử</div></div>';return;}
  const label=getDateRangeLabel();let html='';
  
  if(type==='product'){
    const mo=db.fullHistory.filter(o=>o.items&&o.items.some(i=>String(i.Ten_Hang).trim()===name.trim())&&orderMatchesDateRange(o));
    if(!mo.length){
      html='<div style="text-align:center;color:var(--dan);padding:30px;font-weight:700">Không có giao dịch nào'+(label?' trong '+label:'')+'.</div>';
    } else {
      let tqSold=0;
      let tqUnsold=0;
      
      mo.forEach(o=>{
        const qty = o.items
  .filter(i => String(i.Ten_Hang).trim() === name.trim())
  .reduce((s, i) => s + Number(i.SL), 0);
        
        if (o.status === 'Hoàn thành') {
          tqSold += qty;
        } else {
          tqUnsold += qty;
        }
        
        const statusBadge = o.status === 'Hoàn thành' 
          ? '<span style="color:var(--suc); font-size:12px; font-weight:700; margin-right:8px;"><i class="fas fa-check-circle"></i> Đã bán</span>' 
          : '<span style="color:var(--warn); font-size:12px; font-weight:700; margin-right:8px;"><i class="fas fa-hourglass-half"></i> Chưa bán</span>';

        html+='<div class="res-card"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-weight:700;color:var(--pri)">'+o.id+'</span><span style="font-size:11px;color:var(--muted)">'+o.time+'</span></div><div style="margin-bottom:4px">Khách hàng: <strong>'+o.cust+'</strong></div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:var(--muted)">NV: '+o.sale+'</span><span>' + statusBadge + 'SL: <strong style="color:var(--dan);font-size:15px">'+qty+'</strong></span></div></div>';
      });
      
      html='<div class="res-sum" style="align-items:center;"><div><strong style="color:var(--pri)">'+name+'</strong>'+(label?'<br><small style="color:var(--muted)">'+label+'</small>':'')+'</div><div style="display:flex;justify-content:flex-end;gap:24px;text-align:center;"><div><div style="font-size:11px;color:var(--muted)">Tổng lượt bán</div><div style="font-size:24px;font-weight:700;color:var(--suc)">'+tqSold+'</div></div><div><div style="font-size:11px;color:var(--muted)">Chưa bán</div><div style="font-size:24px;font-weight:700;color:var(--warn)">'+tqUnsold+'</div></div></div></div>'+html;
    }
  }else{
    const mo=db.fullHistory.filter(o=>String(o.cust).trim()===name.trim()&&orderMatchesDateRange(o));
    if(!mo.length){
      html='<div style="text-align:center;color:var(--dan);padding:30px;font-weight:700">Không có giao dịch nào'+(label?' trong '+label:'')+'.</div>';
    } else {
      const total=mo.reduce((s,o)=>s+Number(o.total||0),0);
      html='<div class="res-sum"><div><strong style="color:var(--suc)">'+name+'</strong>'+(label?'<br><small style="color:var(--muted)">'+label+'</small>':'')+'</div><div style="text-align:right"><div style="font-size:11px;color:var(--muted)">'+mo.length+' hóa đơn</div><div style="font-size:20px;font-weight:700;color:var(--dan)">'+total.toLocaleString()+'đ</div></div></div>';
      
      mo.forEach(o=>{
        const badge=o.status==='Hoàn thành'?'<span class="badge-s bdone">✔ Hoàn thành</span>':o.status==='Đã in'?'<span class="badge-s bwait">Đã in</span>':'<span class="badge-s bprint">Chờ in</span>';
        html+='<div class="res-card cust-rc" onclick="viewDetailReadOnly(\''+o.id+'\')"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-weight:700;color:var(--suc)">'+o.id+'</span><span style="font-size:11px;color:var(--muted)">'+o.time+'</span></div><div style="margin-bottom:6px;font-size:12px">NV: <strong>'+o.sale+'</strong></div><div style="display:flex;justify-content:space-between;align-items:center">'+badge+'<strong style="color:var(--dan);font-size:15px">'+Number(o.total).toLocaleString()+'đ</strong></div></div>';
      });
    }
  }
  document.getElementById('shResults').innerHTML=html;
}

// ===== CÁC HÀM TIỆN ÍCH KHÁC =====
currentMapAddr="";
function onMapCustChange(){
  const name=document.getElementById('mapCustInp').value;
  const match=(db.customers||[]).find(c=>c.Ten_Khach&&c.Ten_Khach.toString().trim().toLowerCase()===name.toString().trim().toLowerCase());
  const aEl=document.getElementById('mapAddrDisplay'),btn=document.getElementById('btnOpenMaps');
  if(match&&match.Dia_Chi){currentMapAddr=match.Dia_Chi;aEl.innerHTML='📍 <strong>'+match.Ten_Khach+'</strong>: '+currentMapAddr;btn.disabled=false;
  const enc=encodeURIComponent(currentMapAddr);document.getElementById('mapFrameContainer').innerHTML='<iframe width="100%" height="100%" frameborder="0" style="border:0" src="https://maps.google.com/maps?q='+enc+'&t=m&z=15&output=embed" allowfullscreen></iframe>';}
  else{currentMapAddr="";btn.disabled=true;aEl.innerHTML='<span style="color:var(--dan)">❌ Không tìm thấy địa chỉ</span>';document.getElementById('mapFrameContainer').innerHTML='<div style="text-align:center;color:var(--muted)"><i class="fas fa-map fa-3x mb-3"></i><br>Chọn khách hàng để xem bản đồ</div>';}
}
function openGoogleMaps(){if(!currentMapAddr)return;window.open('https://maps.google.com/maps?q='+encodeURIComponent(currentMapAddr),'_blank');}

function saveNewCust(){
  const n=document.getElementById('ncName').value.trim(),ph=document.getElementById('ncPhone').value.trim(),a=document.getElementById('ncAddr').value.trim();
  // Bắt buộc điền đủ 3 trường: Tên khách hàng - Số ĐT - Địa chỉ
  const missing=[];
  if(!n) missing.push({label:"Tên khách hàng",id:"ncName"});
  if(!ph) missing.push({label:"Số ĐT",id:"ncPhone"});
  if(!a) missing.push({label:"Địa chỉ",id:"ncAddr"});
  if(missing.length){
    Swal.fire({
      text:"Vui lòng điền: "+missing.map(m=>m.label).join(", "),
      icon:'warning',
      confirmButtonColor:'#1a56db',
      confirmButtonText:'OK',
      width:'320px',
      customClass:{popup:'rounded-4'}
    }).then(()=>{const el=document.getElementById(missing[0].id);if(el)el.focus();});
    return;
  }
  const btn=document.querySelector('#pAddCust .btn2');const orig=btn.textContent;btn.textContent="Đang lưu...";btn.disabled=true;
  google.script.run.withSuccessHandler(()=>{
    appToast("Đã thêm khách hàng thành công!");
    document.getElementById('ncName').value="";document.getElementById('ncPhone').value="";document.getElementById('ncAddr').value="";
    btn.textContent=orig;btn.disabled=false;loadData();document.getElementById('custInp').value=n;onCustChange();showPage('order');
  }).withFailureHandler(err=>{
    btn.textContent=orig;btn.disabled=false;
    appAlert((err&&err.message)?err.message:"Không thể lưu khách hàng, vui lòng thử lại!", "error");
  }).addNewCustomer(n,ph,a);
}

// ===== THÊM NHANH SẢN PHẨM (có Mã SP tự động) =====
let quickProdList = [{ name: '', price: '', msp: '' }];
let _nextMaSP = '';   // mã SP kế tiếp do server trả về

function _qpEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Gọi khi mở trang Admin Panel: lấy mã SP kế tiếp rồi vẽ form
function initQuickProdFields() {
  google.script.run
    .withSuccessHandler(function (nextCode) {
      _nextMaSP = nextCode || 'SP0001';
      renderQuickProdFields();
    })
    .withFailureHandler(function () {
      _nextMaSP = _nextMaSP || 'SP0001';
      renderQuickProdFields();
    })
    .getNextMaSP();
}

// Giữ lại tên cũ để nơi nào còn gọi initQuickProdForm() vẫn chạy (chỉ vẽ lại form, không gọi server)
function initQuickProdForm() { renderQuickProdFields(); }

// Mã gợi ý cho từng dòng: dòng để trống mã nhận mã kế tiếp theo thứ tự, dòng nhập tay giữ mã đó
function _quickMspPreviews() {
  const base = _nextMaSP || 'SP0001';
  const baseNum = parseInt((base.match(/(\d+)$/) || [])[1] || '0', 10);
  const prefix = (base.match(/^([^\d]+)/) || [])[1] || 'SP';
  let auto = 0;
  return quickProdList.map(function (p) {
    const manual = (p.msp || '').trim();
    if (manual) return manual;
    return prefix + String(baseNum + auto++).padStart(4, '0');
  });
}

// Cập nhật chữ gợi ý Mã SP mà không vẽ lại form (để không mất con trỏ khi đang gõ)
function _refreshQuickMspPreview() {
  const prev = _quickMspPreviews();
  document.querySelectorAll('#quickProdFields .qp-msp').forEach(function (inp, i) {
    if (prev[i] !== undefined) {
      inp.placeholder = prev[i];
      inp.title = 'Để trống = tự động dùng mã: ' + prev[i];
    }
  });
}

function renderQuickProdFields() {
  const el = document.getElementById('quickProdFields');
  if (!el) return;

  const previews = _quickMspPreviews();
  const onlyOne = quickProdList.length <= 1;

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:2fr 1.2fr 1fr auto;gap:8px;padding:0 4px;margin-bottom:4px;">' +
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;">Tên sản phẩm *</span>' +
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;">Đơn giá *</span>' +
      '<span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;">Mã SP <span style="color:var(--info);font-style:italic;text-transform:none;">(tự động)</span></span>' +
      '<span style="width:26px;"></span>' +
    '</div>' +

    quickProdList.map(function (p, idx) {
      return '<div style="display:grid;grid-template-columns:2fr 1.2fr 1fr auto;gap:8px;align-items:center;margin-bottom:8px;">' +
        '<input class="finput qp-name" placeholder="Nhập tên sản phẩm..." value="' + _qpEsc(p.name) + '" ' +
          'oninput="quickProdList[' + idx + '].name=this.value" style="padding:8px 10px;">' +
        '<input type="number" class="finput qp-price" placeholder="0" min="0" value="' + (p.price || '') + '" ' +
          'oninput="quickProdList[' + idx + '].price=Number(this.value)||0" style="padding:8px 10px;">' +
        '<input class="finput qp-msp" placeholder="' + _qpEsc(previews[idx]) + '" value="' + _qpEsc(p.msp) + '" ' +
          'oninput="quickProdList[' + idx + '].msp=this.value;_refreshQuickMspPreview()" ' +
          'style="padding:8px 10px;color:var(--info);font-weight:600;" title="Để trống = tự động dùng mã: ' + _qpEsc(previews[idx]) + '">' +
        '<button class="ci-rm" onclick="removeQuickProd(' + idx + ')" title="Xóa dòng"' +
          (onlyOne ? ' disabled style="opacity:.4"' : '') + '>×</button>' +
      '</div>';
    }).join('') +

    '<button class="btn2 btn-out btn-full" onclick="addQuickProdRow()" ' +
      'style="margin-top:4px;border-style:dashed;color:var(--warn);border-color:var(--warn);">' +
      '<i class="fas fa-plus me-1"></i> Thêm dòng</button>';
}

function addQuickProdRow() {
  quickProdList.push({ name: '', price: '', msp: '' });
  renderQuickProdFields();
  const names = document.querySelectorAll('#quickProdFields .qp-name');
  if (names.length) names[names.length - 1].focus();
}

function removeQuickProd(idx) {
  if (quickProdList.length <= 1) return;
  quickProdList.splice(idx, 1);
  renderQuickProdFields();
}

function saveQuickProducts() {
  const validList = quickProdList
    .filter(function (p) { return p.name && p.name.trim(); })
    .map(function (p) { return { name: p.name.trim(), price: p.price, msp: (p.msp || '').trim() }; });

  if (!validList.length) {
    appAlert("Chưa nhập tên sản phẩm nào!", "warning");
    return;
  }

  const missingPrice = validList.filter(function (p) { return !p.price || Number(p.price) <= 0; });
  if (missingPrice.length) {
    appAlert(
      missingPrice.length + " sản phẩm chưa có đơn giá:\n" +
      missingPrice.map(function (p) { return '• ' + p.name; }).join('\n'),
      "warning"
    );
    return;
  }

  appConfirm("Xác nhận thêm " + validList.length + " sản phẩm mới vào danh mục?", function () {
    const btn = document.getElementById('btnSaveQuickProd');
    if (btn) btn.disabled = true;

    google.script.run
      .withSuccessHandler(function (res) {
        if (btn) btn.disabled = false;
        const n = (res && res.added) || validList.length;
        appToast("Đã thêm " + n + " sản phẩm thành công!");
        quickProdList = [{ name: '', price: '', msp: '' }];
        initQuickProdFields();   // lấy lại mã SP kế tiếp rồi vẽ lại form trống
        loadData();
      })
      .withFailureHandler(function (err) {
        if (btn) btn.disabled = false;
        appAlert("Lỗi thêm sản phẩm: " + ((err && err.message) || err), "error");
      })
      .addQuickProducts(validList);
  });
}

function renderStaffManagement(){
  const el=document.getElementById('staffListTable');if(!el||!db.staffs)return;
  const role=(user.role||'').toLowerCase();
  if(role!=='admin')return;
  el.innerHTML=db.staffs.map(s=>{
    const rm={'admin':'background:var(--dan-lt);color:var(--dan)','leader':'background:var(--info-lt);color:var(--info)','sale':'background:var(--bg);color:var(--muted)'};
    const st=rm[(s.role||'').toLowerCase()]||rm.sale;
    return'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bdr)"><div><span style="font-weight:700">'+s.name+'</span> <span class="badge-s" style="'+st+'">'+s.role+'</span><br><small style="color:var(--muted)">ID: '+s.id+' | SĐT: '+s.phone+'</small></div>'+
      '<div style="display:flex;gap:4px"><button class="btn2 btn-out btn-sm2" onclick="changeStaffRole(\''+s.id+'\',\''+s.role+'\')">Quyền</button><button class="btn2 btn-out btn-sm2" onclick="changeStaffPass(\''+s.id+'\')">Pass</button><button class="btn2 btn-sm2" style="background:var(--dan-lt);color:var(--dan);border:none" onclick="removeStaff(\''+s.id+'\')">Xóa</button></div></div>';
  }).join('');
}

function addStaff(){
  const d={name:document.getElementById('adName').value,id:document.getElementById('adID').value,pass:document.getElementById('adPass').value,phone:document.getElementById('adPhone').value,role:document.getElementById('adRole').value};
  if(!d.name||!d.id||!d.pass){appAlert("Vui lòng điền đủ Tên, ID và Mật khẩu!", "warning");return;}
  google.script.run.withSuccessHandler(()=>{appToast("Đã thêm nhân viên!");['adName','adID','adPass','adPhone'].forEach(id=>document.getElementById(id).value='');loadData();}).addNewStaff(d);
}

// [Hàm changeStaffRole đã được khai báo phía trên với đầy đủ kiểm tra quyền SADMIN]

function changeStaffPass(id){const p=prompt("Mật khẩu mới cho "+id+":");if(p)google.script.run.withSuccessHandler(()=>appToast("Đã cập nhật mật khẩu!")).updateStaffPass(id,p);}
function removeStaff(id){appConfirm("Xóa nhân viên "+id+"?", () => { google.script.run.withSuccessHandler(()=>loadData()).deleteStaff(id); });}

function renderCustomerList(){
  if(!db.customers)return;
  const role=(user.role||'').toLowerCase();
  const canEdit=(role==='admin');
  const term=document.getElementById('searchCustList').value.toLowerCase();
  const filtered=db.customers.filter(c=>c.Ten_Khach&&bodau(c.Ten_Khach.toString()).includes(bodau(term)));
  const total=Math.ceil(filtered.length/ITEMS_PER_PAGE);
  
  if(currentCustPage<1)currentCustPage=1;
  if(currentCustPage>total&&total>0)currentCustPage=total;
  
  const page=filtered.slice((currentCustPage-1)*ITEMS_PER_PAGE,currentCustPage*ITEMS_PER_PAGE);
  
  let html='<table class="dtbl"><thead><tr><th>#</th><th>Tên khách</th><th>SĐT</th><th>Địa chỉ</th><th style="text-align:right">Công nợ</th>'+(canEdit?'<th style="text-align:center">Thao tác</th>':'')+'</tr></thead><tbody>';
  
  if(!page.length)html+='<tr><td colspan="'+(canEdit?6:5)+'" style="text-align:center;color:var(--muted);padding:20px">Không có dữ liệu</td></tr>';
  else{
    const start=(currentCustPage-1)*ITEMS_PER_PAGE;
    page.forEach((c,i)=>{
      const sn=(c.Ten_Khach||'').toString().replace(/'/g,"\\'").replace(/"/g,'\\"');
      const sa=(c.Dia_Chi||'').toString().replace(/'/g,"\\'").replace(/"/g,'\\"');
      let phone=String(c.SDT||'').trim();if(phone&&!phone.startsWith('0'))phone='0'+phone;
      const sp=phone.replace(/'/g,"\\'").replace(/"/g,'\\"');
      
      const debt = Number(c.Cong_No || 0);
      const debtHtml = debt < 0 
        ? '<span style="color:#ef4444;font-weight:700" title="Công nợ âm - cần kiểm tra!">⚠️ ' + debt.toLocaleString() + 'đ</span>'
        : (debt > 0 ? '<span style="color:var(--warn);font-weight:700">' + debt.toLocaleString() + 'đ</span>' : '<span style="color:var(--muted)">0đ</span>');

      const act=canEdit?'<td style="text-align:center"><button class="btn2 btn-out btn-sm2 me-1" onclick="editCustomer(\''+sn+'\',\''+sp+'\',\''+sa+'\')">✏️</button><button class="btn2 btn-sm2" style="background:var(--dan-lt);color:var(--dan);border:none" onclick="removeCustomer(\''+sn+'\')">❌</button></td>':'';
      
      html+='<tr><td style="color:var(--muted)">'+(start+i+1)+'</td><td style="font-weight:700;color:var(--pri)">'+c.Ten_Khach+'</td><td style="font-weight:600">'+phone+'</td><td style="color:var(--muted);font-size:11px">'+c.Dia_Chi+'</td><td style="text-align:right">'+debtHtml+'</td>'+act+'</tr>';
    });
  }
  html+='</tbody></table>';
  
  document.getElementById('custListTable').innerHTML=html;
  document.getElementById('custPagination').innerHTML='<button class="btn2 btn-out btn-sm2" onclick="currentCustPage--;renderCustomerList()"'+(currentCustPage<=1?' disabled':'')+'>⬅ Trước</button><span style="font-size:12px;color:var(--muted);font-weight:600">Trang '+(total?currentCustPage:0)+' / '+total+'</span><button class="btn2 btn-out btn-sm2" onclick="currentCustPage++;renderCustomerList()"'+(currentCustPage>=total?' disabled':'')+'>Sau ➡</button>';
}

function editCustomer(oldName,phone,addr){
  const role=(user.role||'').toLowerCase();
  if(role!=='admin'){appAlert("Chỉ Admin mới có thể sửa thông tin khách hàng!", "error");return;}
  const n=prompt("Sửa tên:",oldName);if(n===null||!n.trim())return;
  const p=prompt("Sửa SĐT:",phone);if(p===null)return;
  const a=prompt("Sửa địa chỉ:",addr);if(a===null||!a.trim())return;
  google.script.run.withSuccessHandler(()=>{appToast("Đã cập nhật!");loadData();renderCustomerList();}).updateCustomerInfo(oldName,n,p,a);
}

function removeCustomer(name){
  const role=(user.role||'').toLowerCase();
  if(role!=='admin'){appAlert("Chỉ Admin mới có thể xóa khách hàng!", "error");return;}
  appConfirm("Xóa khách hàng: "+name+"?", () => { google.script.run.withSuccessHandler(()=>{appToast("Đã xóa!");loadData();renderCustomerList();}).deleteCustomer(name); });
}

// ===== MODULE DANH SÁCH SẢN PHẨM =====
let _allProductsCache = [];

function renderProductList(products) {
  _allProductsCache = products || db.products || [];
  _renderProdTable(_allProductsCache);
}

function filterProductList() {
  const kw = (document.getElementById('prodSearchInp')?.value || '').toLowerCase().trim();
  const filtered = kw
    ? _allProductsCache.filter(p =>
        (p.Ten_San_Pham || '').toLowerCase().includes(kw) ||
        (p.Ma_SP || '').toString().toLowerCase().includes(kw))
    : _allProductsCache;
  _renderProdTable(filtered);
}

function _renderProdTable(list) {
  const tbody = document.getElementById('prodListTbody');
  if (!tbody) return;
  if (!list || !list.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--muted);">Không có sản phẩm nào</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((p, idx) => {
    const stk = Number(p.So_Luong || 0);
    const stkBadge = stk > 0
      ? `<span style="background:#0e9f6e;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${stk}</span>`
      : `<span style="background:#e02424;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">Hết</span>`;
    const isAdmin = (user.role || '').toLowerCase() === 'admin';

    // Chỉ Admin mới thấy nút Sửa / Xóa
    const actions = isAdmin
      ? `<button onclick="openEditProd('${(p.Ma_SP||'').replace(/'/g,"\\'")}','${(p.Ten_San_Pham||'').replace(/'/g,"\\'")}',${p.Don_Gia||0},${stk})"
               style="background:#d97706;color:#fff;border:none;border-radius:6px;padding:5px 11px;font-size:12px;font-weight:700;cursor:pointer;margin-right:4px;">
           <i class="fas fa-edit"></i> Sửa
         </button>
         <button onclick="confirmDeleteProduct('${(p.Ma_SP||'').replace(/'/g,"\\'")}','${(p.Ten_San_Pham||'').replace(/'/g,"\\'")}',this)"
               style="background:#e02424;color:#fff;border:none;border-radius:6px;padding:5px 11px;font-size:12px;font-weight:700;cursor:pointer;">
           <i class="fas fa-trash"></i> Xóa
         </button>`
      : '—';
      
    return `<tr style="border-bottom:1px solid var(--bdr);">
      <td style="padding:10px 8px;text-align:center;color:var(--muted);font-weight:600;">${idx + 1}</td>
      <td style="padding:10px 8px;font-weight:700;">${p.Ten_San_Pham || '—'}</td>
      <td style="padding:10px 8px;text-align:right;color:#e02424;font-weight:700;">
        ${Number(p.Don_Gia || 0).toLocaleString('vi-VN')}đ
      </td>
      <td style="padding:10px 8px;text-align:center;">${stkBadge}</td>
      <td style="padding:10px 8px;text-align:center;">${actions}</td>
    </tr>`;
  }).join('');
}

function openEditProd(maSP, ten, gia, tonKho) {
  document.getElementById('editProdOldMaSP').value = maSP;
  document.getElementById('editProdMaSP').value = maSP;
  document.getElementById('editProdName').value = ten;
  document.getElementById('editProdPrice').value = gia;
  document.getElementById('editProdStock').value = tonKho;
  new bootstrap.Modal(document.getElementById('editProdModal')).show();
}

function saveEditProduct() {
  const oldMaSP = document.getElementById('editProdOldMaSP').value;
  const newMaSP = document.getElementById('editProdMaSP').value.trim();
  const name  = document.getElementById('editProdName').value.trim();
  const price = Number(document.getElementById('editProdPrice').value) || 0;
  const stock = Number(document.getElementById('editProdStock').value) || 0;

  if (!name) { appAlert("Tên sản phẩm không được trống!", "warning"); return; }
  if (!newMaSP) { appAlert("Mã sản phẩm không được trống!", "warning"); return; }

  appConfirm("Lưu thay đổi cho sản phẩm này?", () => {
    bootstrap.Modal.getInstance(document.getElementById('editProdModal'))?.hide();
    google.script.run
      .withSuccessHandler(() => {
        appToast("Đã cập nhật sản phẩm!");
        loadData();
        setTimeout(() => { renderProductList(db.products); }, 1200);
      })
      .withFailureHandler(err => appAlert("Lỗi: " + err.message, "error"))
      .updateProduct({ oldMaSP, maSP: newMaSP, name, price, stock });
  });
}

function confirmDeleteProduct(maSP, ten, btn) {
  appConfirm(`Xóa vĩnh viễn sản phẩm "${ten}"?`, () => {
    btn.disabled = true;
    google.script.run
      .withSuccessHandler(() => {
        appToast("Đã xóa sản phẩm!");
        loadData();
        setTimeout(() => { renderProductList(db.products); }, 1200);
      })
      .withFailureHandler(err => {
        appAlert("Lỗi: " + err.message, "error");
        btn.disabled = false;
      })
      .deleteProduct(maSP);
  });
}

// ===== LỊCH SỬ HÓA ĐƠN =====
let lshd_viewMode='all';

function lshdSetMode(mode){
  lshd_viewMode=mode;
  document.querySelectorAll('.lshd-mode-btn').forEach(b=>b.classList.remove('act'));
  const btn=document.getElementById('lshd_btn_'+mode);
  if(btn)btn.classList.add('act');
  renderLichSuHoaDon();
}

// KHAI BÁO BIẾN VÀ HÀM LỌC NGÀY MỚI (NÚT BẤM)
let lshdDateMode = 'all';

function setLshdDateMode(mode, btn) {
  lshdDateMode = mode;
  document.querySelectorAll('.lshd-sdbtn').forEach(b => b.classList.remove('act'));
  if(btn) btn.classList.add('act');
  const cr = document.getElementById('lshdCustomRange');
  if(cr) cr.style.display = (mode === 'custom') ? 'flex' : 'none';
  if (mode !== 'custom') {
    document.getElementById('lshd_dateFrom').value = '';
    document.getElementById('lshd_dateTo').value = '';
  }
  renderLichSuHoaDon();
}

function checkLshdDate(timeMs) {
  const now = new Date();
  const d = new Date(timeMs);
  if (isNaN(d.getTime())) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;
  
  if (lshdDateMode === 'all') return true;
  if (lshdDateMode === 'today') return timeMs >= startOfToday && timeMs <= endOfToday;
  if (lshdDateMode === 'yesterday') {
    const startYest = startOfToday - 86400000;
    return timeMs >= startYest && timeMs <= (startYest + 86400000 - 1);
  }
  if (lshdDateMode === 'week') return timeMs >= (startOfToday - 6 * 86400000) && timeMs <= endOfToday;
  if (lshdDateMode === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (lshdDateMode === 'custom') {
    const from = document.getElementById('lshd_dateFrom').value;
    const to = document.getElementById('lshd_dateTo').value;
    if (from && timeMs < new Date(from).getTime()) return false;
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      if (timeMs > t.getTime()) return false;
    }
    return true;
  }
  return true;
}

function renderLichSuHoaDon(){
  const custFilter = document.getElementById('lshd_custFilter') ? document.getElementById('lshd_custFilter').value.toLowerCase().trim() : '';
  const el=document.getElementById('lshdList');
  const role=(user.role||'').toLowerCase();
  if(!db.historyHoanThanh){el.innerHTML='<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">Đang tải dữ liệu...</div></div>';return;}

  const staffWrap=document.getElementById('lshd_staffWrap');
  const staffSel=document.getElementById('lshd_staffFilter');
  const saleToggleWrap=document.getElementById('lshd_saleToggleWrap');

  if(role==='admin'||role==='leader'||role==='sale'){
    staffWrap.style.display='block';
    if(saleToggleWrap)saleToggleWrap.style.display='none';
    const cur=staffSel.value;
    const allDone=db.historyHoanThanh;
    const staffs=[...new Set(allDone.map(i=>i.sale))].filter(Boolean).sort();
    staffSel.innerHTML='<option value="ALL">Tất cả nhân viên</option>'+staffs.map(s=>'<option value="'+s+'">'+s+'</option>').join('');
    if(staffs.includes(cur))staffSel.value=cur;
  } else {
    staffWrap.style.display='none';
    if(saleToggleWrap)saleToggleWrap.style.display='flex';
  }

  const fs=(role==='admin'||role==='leader'||role==='sale')?(staffSel.value||'ALL'):'ALL';
  
  const allDoneFiltered=db.historyHoanThanh.filter(i=>{
    if(custFilter && !bodau(String(i.cust||'')).includes(bodau(custFilter))) return false;
    if(!checkLshdDate(i.realDate)) return false;
    return true;
  });

  const listDone=allDoneFiltered.filter(i=>{
    if(role==='sale'&&lshd_viewMode==='personal'){
      if(String(i.sale||'').trim()!==String(user.fullName||'').trim())return false;
    }
    if((role==='admin'||role==='leader'||role==='sale')&&fs!=='ALL'){
      if(String(i.sale||'').trim()!==String(fs||'').trim())return false;
    }
    return true;
  });

  let dateLabel = '';
  if(lshdDateMode==='today') dateLabel='Hôm nay';
  else if(lshdDateMode==='yesterday') dateLabel='Hôm qua';
  else if(lshdDateMode==='week') dateLabel='7 ngày qua';
  else if(lshdDateMode==='month') dateLabel='Tháng này';
  else if(lshdDateMode==='all') dateLabel='Tất cả thời gian';
  else {
    const from = document.getElementById('lshd_dateFrom').value;
    const to = document.getElementById('lshd_dateTo').value;
    if(from && to) dateLabel = 'Từ ' + from.split('-').reverse().join('/') + ' đến ' + to.split('-').reverse().join('/');
    else if(from) dateLabel = 'Từ ' + from.split('-').reverse().join('/');
    else if(to) dateLabel = 'Đến ' + to.split('-').reverse().join('/');
  }

  const totalRevAll=allDoneFiltered.reduce((s,i)=>s+Number(i.total||0),0);
  const myDone=allDoneFiltered.filter(i=>String(i.sale||'').trim()===String(user.fullName||'').trim());
  const totalRevMy=myDone.reduce((s,i)=>s+Number(i.total||0),0);

  if(role==='sale'){
    if(lshd_viewMode==='personal'){
      document.getElementById('lshd_statRev').textContent=totalRevMy.toLocaleString()+'đ';
      document.getElementById('lshd_statCount').textContent=myDone.length;
      document.getElementById('lshd_statSub').textContent='Cá nhân bạn'+(dateLabel?' — '+dateLabel:'');
    } else {
      document.getElementById('lshd_statRev').textContent=totalRevAll.toLocaleString()+'đ';
      document.getElementById('lshd_statCount').textContent=allDoneFiltered.length;
      document.getElementById('lshd_statSub').textContent='Tất cả đơn hoàn thành'+(dateLabel?' — '+dateLabel:'');
    }
  } else {
    const dispRev=listDone.reduce((s,i)=>s+Number(i.total||0),0);
    document.getElementById('lshd_statRev').textContent=dispRev.toLocaleString()+'đ';
    document.getElementById('lshd_statCount').textContent=listDone.length;
    const subLabel=fs!=='ALL'?'NV: '+fs:'Tất cả NV';
    document.getElementById('lshd_statSub').textContent=subLabel+(dateLabel?' — '+dateLabel:'');
  }

  if(!listDone.length){el.innerHTML='<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">Không có hóa đơn hoàn thành nào</div><div class="empty-sub">Thử thay đổi bộ lọc</div></div>';return;}
  let html='<div style="margin-bottom:10px;font-size:12px;color:var(--muted);font-weight:600">Tìm thấy <strong style="color:var(--fin)">'+listDone.length+'</strong> hóa đơn hoàn thành</div>';
  listDone.forEach(i=>{
    const first=i.items[0]||{Ten_Hang:'?',SL:0};const more=i.items.length-1;
    const preview='- '+first.Ten_Hang+' (x'+first.SL+')'+(more>0?' +'+more+' sp khác':'');
    html+='<div class="order-card fin" onclick="viewLichSuHoaDonDetail(\''+i.id+'\')">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px"><div class="ocust" style="flex:1">'+i.cust+'</div><span class="badge-s bfin">✔ Hoàn thành</span></div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div class="oid">'+i.id+'</div></div>'+
      '<div class="oaddr">📍 '+(i.addr||'Chưa có địa chỉ')+'</div>'+
      '<div class="oprev">'+preview+'</div>'+
      '<div class="ofooter"><span class="ometa">'+i.time+' | '+(i.sale||'')+'</span><span class="ototl">'+Number(i.total).toLocaleString()+'đ</span></div></div>';
  });
  el.innerHTML=html;
}

// 1. HÀM MỞ CHI TIẾT HÓA ĐƠN HOÀN THÀNH (LỊCH SỬ HÓA ĐƠN)
function viewLichSuHoaDonDetail(id){
  const o = (db.historyHoanThanh||[]).find(x=>String(x.id).trim()===String(id).trim());if(!o)return;
  
  document.getElementById('modalTitle').textContent='Hóa Đơn Hoàn Thành';
  document.getElementById('orderHeaderDisplay').style.display='block';
  
  const tbl = document.getElementById('orderTable');
  tbl.style.display='table';
  tbl.style.width='100%';
  tbl.style.tableLayout='fixed';
  tbl.style.minWidth='900px'; 
  tbl.classList.add('force-scroll-table'); // BẬT CỜ ÉP CUỘN NGANG VÀ HIỆN 9 CỘT
  
  const wrap = tbl.parentElement;
  if(wrap && !wrap.classList.contains('table-responsive')) {
    wrap.classList.add('table-responsive');
  }
  wrap.style.overflowX='auto'; 
  
  const thead = tbl.querySelector('thead');
  if(thead) {
    thead.innerHTML = `<tr>
      <th width="4%">#</th>
      <th width="8%" style="text-align:center">Mã SP</th>
      <th width="25%">Sản phẩm</th>
      <th width="8%" style="text-align:center">SL</th>
      <th width="12%" style="text-align:right">Giá</th>
      <th width="5%" style="text-align:center">CK%</th>
      <th width="12%" style="text-align:right;color:var(--info)">Giá sau CK</th>
      <th width="14%" style="text-align:right">T.Tiền</th>
      <th width="22%">Ghi chú</th>
    </tr>`;
  }

  document.getElementById('detailId').textContent=o.id;
  document.getElementById('detailTime').textContent=o.time;
  document.getElementById('detailCust').textContent=o.cust;
  
  let addr=o.addr;
  let currentDbDebt = 0;
  let phone = ''; // SỐ ĐIỆN THOẠI KHÁCH HÀNG

  if(db.customers){
    const m=db.customers.find(c=>String(c.Ten_Khach).trim().toLowerCase()===String(o.cust).trim().toLowerCase());
    if(m){
      if(!addr||addr==='N/A') addr=m.Dia_Chi;
      currentDbDebt = Number(m.Cong_No||0);
      phone = m.SDT || ''; // LẤY SĐT TỪ CỘT B SHEET Khach_Hang
    }
  }
  document.getElementById('detailAddr').textContent=addr||'Chưa có địa chỉ';

  // ====== THÊM HIỂN THỊ SỐ ĐIỆN THOẠI KHÁCH HÀNG (ngay dưới địa chỉ) ======
  let phoneEl = document.getElementById('detailPhone');
  const addrEl = document.getElementById('detailAddr');
  if(!phoneEl && addrEl){
    phoneEl = document.createElement('div');
    phoneEl.id = 'detailPhone';
    phoneEl.style.marginTop = '2px';
    addrEl.insertAdjacentElement('afterend', phoneEl);
  }
  if(phoneEl){
    phoneEl.innerHTML = phone
      ? '<i class="fas fa-phone-alt" style="margin-right:4px;color:var(--pri);"></i>' + phone
      : '<span style="color:var(--muted); font-style:italic;">Chưa có SĐT</span>';
  }
  // ====== HẾT PHẦN THÊM SĐT ======
  
  const orderTotal = Number(o.total || 0);
  const prePaid = Number(o.prePaid || 0);
  const oldDebt = (o.noCu !== undefined) ? Number(o.noCu) : (currentDbDebt - orderTotal + prePaid); 

  const debtCont=document.getElementById('detailDebtContainer');
  if(debtCont) {
    debtCont.style.display='block';
    document.getElementById('detailDebt').textContent = oldDebt.toLocaleString() + ' VNĐ';
    debtCont.querySelector('div').textContent = 'NỢ CŨ';
  }

  document.getElementById('detailTableBody').innerHTML=(o.items||[]).map((it,i)=>{
    let msp = '';
    if(db.products){
      let p = db.products.find(x => String(x.Ten_San_Pham).trim() === String(it.Ten_Hang).trim());
      if(p) msp = p.Ma_SP || p['Mã SP'] || '';
    }
    let giaSauCK = Math.round(Number(it.Gia) * (1 - (Number(it.CK)||0)/100));
    let thanhTien = Math.round(Number(it.SL) * giaSauCK);
    
    return '<tr>'+
      '<td style="color:var(--muted);text-align:center;">'+(i+1)+'</td>'+
      '<td style="font-weight:700;color:var(--info);text-align:center;white-space:nowrap;">'+msp+'</td>'+
      '<td style="font-weight:700;overflow-wrap:break-word;word-break:break-word">'+it.Ten_Hang+'</td>'+
      '<td style="text-align:center;font-weight:700;color:var(--pri)">'+it.SL+'</td>'+
      '<td style="text-align:right">'+Number(it.Gia).toLocaleString()+'</td>'+
      '<td style="text-align:center;font-weight:700;color:var(--warn)">'+(it.CK||0)+'%</td>'+
      '<td style="text-align:right;color:var(--info)">'+giaSauCK.toLocaleString()+'</td>'+
      '<td style="text-align:right;font-weight:700;color:var(--dan)">'+thanhTien.toLocaleString()+'</td>'+
      '<td style="color:var(--muted);font-size:11px;overflow-wrap:break-word">'+(it.Ghi_Chu||'—')+'</td>'+
      '</tr>';
  }).join('');
  
  // LỚP CSS ĐỘNG ĐƯỢC GIA TĂNG SỨC MẠNH: Đè bẹp CSS gốc để ép hiện 9 cột
  const mobileScrollCss = `
    <style>
      @media screen and (max-width: 768px) {
        /* 1. Ép hiện lại các cột: Mã SP (2), CK% (6), Giá sau CK (7) */
        table#orderTable.force-scroll-table th:nth-child(2),
        table#orderTable.force-scroll-table td:nth-child(2),
        table#orderTable.force-scroll-table th:nth-child(6),
        table#orderTable.force-scroll-table td:nth-child(6),
        table#orderTable.force-scroll-table th:nth-child(7),
        table#orderTable.force-scroll-table td:nth-child(7) { 
          display: table-cell !important; 
        }
        
        /* 2. Đè lại độ rộng màn hình, khôi phục thanh cuộn ngang */
        .table-responsive:has(.force-scroll-table) { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
        table#orderTable.force-scroll-table { width: 900px !important; max-width: none !important; }
        
        /* 3. Ghi đè lại tỷ lệ 9 cột trên điện thoại để không bị móp méo */
        table#orderTable.force-scroll-table th:nth-child(1), table#orderTable.force-scroll-table td:nth-child(1) { width: 4% !important; text-align: center !important;}
        table#orderTable.force-scroll-table th:nth-child(2), table#orderTable.force-scroll-table td:nth-child(2) { width: 8% !important; text-align: center !important;}
        table#orderTable.force-scroll-table th:nth-child(3), table#orderTable.force-scroll-table td:nth-child(3) { width: 25% !important; text-align: left !important;}
        table#orderTable.force-scroll-table th:nth-child(4), table#orderTable.force-scroll-table td:nth-child(4) { width: 6% !important; text-align: center !important;}
        table#orderTable.force-scroll-table th:nth-child(5), table#orderTable.force-scroll-table td:nth-child(5) { width: 12% !important; text-align: right !important;}
        table#orderTable.force-scroll-table th:nth-child(6), table#orderTable.force-scroll-table td:nth-child(6) { width: 6% !important; text-align: center !important;}
        table#orderTable.force-scroll-table th:nth-child(7), table#orderTable.force-scroll-table td:nth-child(7) { width: 12% !important; text-align: right !important;}
        table#orderTable.force-scroll-table th:nth-child(8), table#orderTable.force-scroll-table td:nth-child(8) { width: 14% !important; text-align: right !important;}
        table#orderTable.force-scroll-table th:nth-child(9), table#orderTable.force-scroll-table td:nth-child(9) { width: 13% !important; text-align: left !important;}
      }
    </style>
  `;

  // Xử lý ghi chú: Xuống dòng HTML và hiển thị mờ nếu không có
  const orderNoteDisplay = (o.note || '').trim().replace(/\n/g, '<br>') || '<span style="color:var(--muted); font-style:italic;">Không có ghi chú</span>';

  document.getElementById('modalDynContent').innerHTML = mobileScrollCss +
    '<div style="background:var(--bg); border:1px solid var(--bdr); border-radius:8px; padding:10px 12px; margin-bottom:12px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
        '<span style="font-weight:600; color:var(--muted); font-size:12px;">💰 TỔNG TIỀN HÀNG:</span>' +
        '<span style="font-weight:800; color:var(--txt); font-size:14px;">' + orderTotal.toLocaleString() + 'đ</span>' +
      '</div>' +
      '<div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px dashed var(--bdr); margin-bottom:6px;">' +
        '<span style="font-weight:700; color:var(--pri); font-size:12px;">💵 KHÁCH THANH TOÁN TRƯỚC:</span>' +
        '<span style="font-weight:800; color:var(--pri); font-size:15px;">-' + prePaid.toLocaleString() + 'đ</span>' +
      '</div>' +
      // Đã chuyển <div> thành <span> để nội dung ghi chú nằm ngay sau dấu :
      '<div style="padding-top:6px; border-top:1px dashed var(--bdr); text-align:left; line-height:1.4;">' +
        '<span style="font-weight:700; color:var(--muted); font-size:11px; text-transform:uppercase;">📝 GHI CHÚ: </span>' +
        '<span style="font-size:12px; color:#c026d3; font-weight:bold; word-break:break-word;">' + orderNoteDisplay + '</span>' +
      '</div>' +
    '</div>';
    
  document.getElementById('totalTextLabel').textContent='TỔNG CỘNG TOA';
  
  document.getElementById('detailTotal').textContent=(oldDebt + orderTotal - prePaid).toLocaleString()+' VNĐ';
  
  document.getElementById('detailFooter').innerHTML='<button type="button" class="btn2 btn-out" data-bs-dismiss="modal" onclick="restoreModalUI()"><i class="fas fa-times me-1"></i>Đóng</button>';
  new bootstrap.Modal(document.getElementById('orderDetailModal')).show();
}

// ===== FIX: THANH TOÁN CÔNG NỢ =====
let ttCurrentCust = null;

function searchThanhToan(){
  const v=(document.getElementById('ttSearchInp').value||'').toLowerCase().trim();
  const res=document.getElementById('ttSearchRes');
  document.getElementById('ttResult').style.display='none';
  document.getElementById('ttEmpty').style.display='block';
  ttCurrentCust=null;
  if(!v){res.innerHTML='';return;}
  const found=(db.customers||[]).filter(c=>bodau(String(c.Ten_Khach||'')).includes(bodau(v))).slice(0,15);
  if(!found.length){res.innerHTML='<div class="search-res"><div class="sr-item" style="cursor:default;color:var(--muted)">Không tìm thấy khách hàng</div></div>';return;}
  res.innerHTML='<div class="search-res">'+found.map(c=>{
    const sn=(c.Ten_Khach||'').replace(/'/g,"\\'").replace(/"/g,'\\"');
    return'<div class="sr-item" onclick="selectThanhToanCust(\''+sn+'\')"><span style="font-weight:700">'+c.Ten_Khach+'</span><span style="font-size:11px;color:var(--muted)">'+(c.SDT||'')+'</span></div>';
  }).join('')+'</div>';
}

function selectThanhToanCust(name){
  document.getElementById('ttSearchInp').value=name;
  document.getElementById('ttSearchRes').innerHTML='';
  const m=(db.customers||[]).find(c=>bodau(String(c.Ten_Khach||'').trim())===bodau(String(name||'').trim()));
  if(!m)return;
  ttCurrentCust=m;
  let phone=String(m.SDT||'').trim();
  if(phone&&!phone.startsWith('0'))phone='0'+phone;
  document.getElementById('ttCustName').textContent=m.Ten_Khach||'';
  document.getElementById('ttCustAddr').textContent='📍 '+(m.Dia_Chi||'Chưa có địa chỉ');
  document.getElementById('ttCustPhone').textContent=phone?'📞 '+phone:'';
  document.getElementById('ttResult').style.display='block';

  const inp=document.getElementById('ttPayInp');
  inp.value='';
  inp.removeAttribute('data-raw');
  document.getElementById('ttPaymentPreview').style.display='none';

  _renderDebtBox(Number(m.Cong_No||0), 0);

  const orders = (db.historyHoanThanh||[]).filter(o=>String(o.cust||'').trim()===String(name).trim());
  let ohHtml='';
  if(!orders.length){
    ohHtml='<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">Chưa có đơn hoàn thành</div>';
  } else {
    orders.forEach(o=>{
      const first=o.items[0]||{Ten_Hang:'?',SL:0};
      const more=o.items.length-1;
      const preview='- '+first.Ten_Hang+' (x'+first.SL+')'+(more>0?' +'+more+' sp khác':'');
      ohHtml+=
        '<div style="padding:10px 0;border-bottom:1px solid var(--bdr)">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'+
            '<span style="font-weight:700;color:var(--pri);font-size:13px">'+o.id+'</span>'+
            '<span style="font-weight:700;color:var(--dan);font-size:13px">'+Number(o.total).toLocaleString('vi-VN')+'đ</span>'+
          '</div>'+
          '<div style="font-size:11px;color:var(--muted);margin-bottom:2px">🕐 '+o.time+' | 👤 '+(o.sale||'')+'</div>'+
          '<div style="font-size:11px;color:var(--txt)">'+preview+'</div>'+
        '</div>';
    });
  }
  document.getElementById('ttOrderHistory').innerHTML=ohHtml;
}

function _renderDebtBox(debt, payAmt){
  const debtEl=document.getElementById('ttDebtAmount');
  const previewEl=document.getElementById('ttPaymentPreview');

  // HIỂN THỊ NÚT SỬA CÔNG NỢ CHỈ KHI LÀ SADMIN
  let editBtnHtml = '';
  
  // DÒNG ĐÃ ĐƯỢC SỬA LẠI (Dùng includes thay vì toLowerCase cho mảng SADMIN_IDS)
  if (user.userId && SADMIN_IDS.includes(user.userId.toLowerCase())) {
    editBtnHtml = `
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed rgba(0,0,0,0.1);">
        <button class="btn2 btn-warn btn-sm2" style="font-weight:700;" onclick="editCongNoSAdmin()">
          <i class="fas fa-edit"></i> Chỉnh sửa công nợ
        </button>
      </div>`;
  }

  if(payAmt>0){
    const remain=debt-payAmt;
    const remainColor=remain<0?'#ef4444':'var(--suc)';
    const remainLabel=remain<0?'⚠️ Âm':'👉 Còn lại';

    debtEl.innerHTML=
      '<div style="font-size:13px;color:var(--muted);margin-bottom:4px">'+
        debt.toLocaleString('vi-VN')+' VNĐ &nbsp;—&nbsp; '+
        'Thu: <span style="color:var(--suc);font-weight:700">'+payAmt.toLocaleString('vi-VN')+'đ</span>'+
      '</div>'+
      '<div style="font-size:28px;font-weight:800;color:'+remainColor+'">'+
        remainLabel+': '+remain.toLocaleString('vi-VN')+' VNĐ'+
      '</div>' + editBtnHtml;

    if(previewEl) previewEl.style.display='none'; 
  } else {
    const color=debt<0?'#ef4444':(debt>0?'var(--warn)':'var(--suc)');
    const text=debt<0?'⚠️ ÂM: '+debt.toLocaleString('vi-VN')+' VNĐ (cần kiểm tra)':debt.toLocaleString('vi-VN')+' VNĐ';
    debtEl.innerHTML='<div style="font-size:28px;font-weight:800;color:'+color+'">'+text+'</div>' + editBtnHtml;
    
    if(previewEl) previewEl.style.display='none';
  }
}
// HÀM HIỂN THỊ POPUP SỬA CÔNG NỢ (BẢN CHỐNG NHẢY BÀN PHÍM 100%)
function editCongNoSAdmin() {
  if(!ttCurrentCust) return;
  
  // Kiểm tra quyền SAdmin (Đã sửa lại SADMIN_IDS thành mảng)
  const isSadmin = (user.userId && SADMIN_IDS.includes(user.userId.toLowerCase())) || 
                   (user.fullName && user.fullName.toLowerCase() === "mr phong".toLowerCase());

  if (!isSadmin) {
    appAlert("Chỉ SAdmin mới có quyền sửa công nợ trực tiếp!", "error"); 
    return;
  }
  
  const currentDebt = Number(ttCurrentCust.Cong_No || 0);

  // Xây dựng giao diện: Tách biệt ô gõ số và dòng hiển thị format
  const htmlContent = `
    <div style="text-align:left; margin-bottom: 12px; margin-top: 10px;">
        <div style="font-size:12px; color:var(--muted);">Khách hàng</div>
        <div style="font-size:16px; font-weight:bold; color:var(--pri);">${ttCurrentCust.Ten_Khach}</div>
    </div>
    <div style="background:var(--warn-lt); border:1px solid var(--warn); border-radius:8px; padding:15px 20px; margin-bottom:20px; text-align:left;">
        <div style="font-size:11px; font-weight:bold; color:#92400e; margin-bottom:5px; text-transform:uppercase;">Công nợ hiện tại</div>
        <div style="font-size:24px; font-weight:900; color:var(--warn);">${currentDebt.toLocaleString('vi-VN')} VNĐ</div>
    </div>
    
    <div style="text-align:left; margin-bottom:6px;">
        <label style="font-size:13px; font-weight:700; color:var(--txt);">Nhập công nợ mới</label>
    </div>
    
    <!-- Ô gõ số thô: Không dùng JS format đè vào value để chống nhảy phím -->
    <input type="tel" id="swal-input-new-debt" class="finput" inputmode="numeric" 
           style="text-align:right; font-size:22px; font-weight:700; color:var(--pri); padding: 10px 15px; border-color:#1a56db; margin-bottom: 4px;" 
           placeholder="Gõ số liền (VD: 1500000)" autocomplete="off"
           oninput="const raw = this.value.replace(/[^0-9-]/g, ''); document.getElementById('live-format-display').innerText = (raw && raw !== '-') ? Number(raw).toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';">
           
    <!-- Dòng hiển thị số đã được phẩy cực kỳ to và rõ ràng ở bên dưới -->
    <div style="text-align:right; font-size:26px; font-weight:900; color:#d97706; margin-bottom: 12px;" id="live-format-display">
        0 VNĐ
    </div>
    
    <div style="text-align:left; font-size:11px; color:var(--muted);">
        <i class="fas fa-exclamation-triangle" style="color:var(--warn);"></i> Giá trị này sẽ ghi đè trực tiếp vào dữ liệu khách hàng
    </div>
  `;

  Swal.fire({
    title: '<span style="color:#d97706; font-weight:bold; font-size: 18px;"><i class="fas fa-pencil-alt"></i> Sửa Công Nợ</span>',
    html: htmlContent,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-save"></i> Lưu công nợ',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#d97706',
    cancelButtonColor: '#6b7280',
    width: '400px',
    customClass: { popup: 'rounded-4' },
    didOpen: () => {
       // Bật bàn phím tự động
       setTimeout(() => document.getElementById('swal-input-new-debt').focus(), 100);
    },
    preConfirm: () => {
      const inputVal = document.getElementById('swal-input-new-debt').value;
      // Chỉ lấy phần số khi lưu xuống DB
      const raw = inputVal.replace(/[^0-9-]/g, '');
      
      if (!raw || raw === '-') {
        Swal.showValidationMessage('Vui lòng nhập số tiền công nợ mới!');
        return false;
      }
      
      const parsedDebt = parseFloat(raw); 
      if (isNaN(parsedDebt)) {
         Swal.showValidationMessage('Số tiền không hợp lệ!');
         return false;
      }
      return parsedDebt;
    }
  }).then((result) => {
    if (result.isConfirmed) {
       const parsedDebt = result.value;
       
       Swal.fire({
          title: 'Đang lưu...',
          text: 'Hệ thống đang cập nhật dữ liệu',
          allowOutsideClick: false,
          didOpen: () => { Swal.showLoading(); }
       });

       google.script.run.withSuccessHandler(() => {
         Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: 'Đã cập nhật công nợ mới',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'rounded-4' }
         });
         
         // Đồng bộ cục bộ để UI tải ngay
         ttCurrentCust.Cong_No = parsedDebt;
         _renderDebtBox(parsedDebt, _getRawPayAmt());
         
         const custIndex = (db.customers||[]).findIndex(c => c.Ten_Khach === ttCurrentCust.Ten_Khach);
         if(custIndex !== -1) db.customers[custIndex].Cong_No = parsedDebt;
         
       }).withFailureHandler((err) => {
         appAlert("Lỗi cập nhật: " + err.message, "error");
       }).updateCustomerDebt(ttCurrentCust.Ten_Khach, parsedDebt);
    }
  });
}

function updatePaymentPreview(){
  if(!ttCurrentCust)return;
  const debt=Number(ttCurrentCust.Cong_No||0);
  const payAmt=_getRawPayAmt();
  _renderDebtBox(debt, payAmt);
}

function formatPayInput(el){
  const digits=el.value.replace(/\D/g,'');
  const num=Number(digits)||0;
  el.setAttribute('data-raw', num);
  if(el.value!==digits) {
    el.value=digits;
    const len=digits.length;
    el.setSelectionRange(len,len);
  }
  updatePaymentPreview();
}

function formatPayInputOnBlur(el){
  const num=Number(el.getAttribute('data-raw'))||0;
  el.value=num>0?num.toLocaleString('vi-VN'):'';
}

function _getRawPayAmt(){
  const inp=document.getElementById('ttPayInp');
  return Number(inp.getAttribute('data-raw'))||0;
}

function _setRawPayAmt(val){
  const inp=document.getElementById('ttPayInp');
  inp.setAttribute('data-raw',val);
  inp.value=val>0?val.toLocaleString('vi-VN'):'';
  updatePaymentPreview();
}

function quickFill(amt){
  _setRawPayAmt(amt);
}

function fillFullDebt(){
  if(!ttCurrentCust)return;
  const debt=Number(ttCurrentCust.Cong_No||0);
  if(debt<=0){
    appAlert("Khách hàng không có nợ!"+(debt<0?"\n(Công nợ đang bị âm: "+debt.toLocaleString('vi-VN')+"đ — cần kiểm tra lại dữ liệu)":''), "warning");
    return;
  }
  _setRawPayAmt(debt);
}

function thanhToanCongNo(){
  if(!ttCurrentCust){alert("Vui lòng chọn khách hàng!");return;}
  const debt=Number(ttCurrentCust.Cong_No||0);
  const payAmt=_getRawPayAmt();
  if(payAmt<=0){alert("Vui lòng nhập số tiền hợp lệ lớn hơn 0!");return;}
  const thuNguoi=document.getElementById('ttNguoiThu').value.trim()||user.fullName;
  if(debt<0){
    alert("⚠️ Công nợ khách đang bị âm ("+debt.toLocaleString('vi-VN')+"đ)!\nVui lòng kiểm tra lại dữ liệu trước khi thu tiền.");
    return;
  }
  const btn=document.getElementById('ttPayBtn');
  btn.disabled=true;btn.textContent='Đang xử lý...';
  const newDebt=Math.max(0,debt-payAmt);
  
  // Sửa lỗi biến 'name' không tồn tại thành ttCurrentCust.Ten_Khach
  const orders = (db.historyHoanThanh||[]).filter(o=>String(o.cust||'').trim()===String(ttCurrentCust.Ten_Khach).trim());
  const latestOrderId=orders.length>0?orders[0].id:'Không có đơn';
  
  google.script.run.withSuccessHandler(()=>{
    const note='Thu bởi '+thuNguoi;
    google.script.run.withSuccessHandler(()=>{
      google.script.run.sendPaymentTelegramNotification({
        latestOrder:latestOrderId,
        custName:ttCurrentCust.Ten_Khach,
        oldDebt:debt,
        payAmt:payAmt,
        newDebt:newDebt,
        collector:thuNguoi
      });
      const inp=document.getElementById('ttPayInp');
      inp.value='';
      inp.removeAttribute('data-raw');
      document.getElementById('ttNguoiThu').value='';
      btn.disabled=false;
      btn.innerHTML='<i class="fas fa-check me-1"></i>Xác nhận';
      
      // CẬP NHẬT TRỰC TIẾP DỮ LIỆU LOCAL ĐỂ GIAO DIỆN PHẢN HỒI NGAY LẬP TỨC
      ttCurrentCust.Cong_No = newDebt;
      const custIndex = (db.customers||[]).findIndex(c => c.Ten_Khach === ttCurrentCust.Ten_Khach);
      if(custIndex !== -1) db.customers[custIndex].Cong_No = newDebt;

      // Làm mới giao diện ngay tức thì không cần đợi
      selectThanhToanCust(ttCurrentCust.Ten_Khach);
      
      // Đồng bộ ngầm với máy chủ
      loadData();
      
    }).savePaymentRecord(ttCurrentCust.Ten_Khach,'',0,payAmt,newDebt,note);
  }).updateCustomerDebt(ttCurrentCust.Ten_Khach,newDebt);
}

// ===== LỊCH SỬ THANH TOÁN (SỔ CÁI) =====
let lsttDateMode = 'all';

function loadAllPaymentHistory() {
  const container = document.getElementById('lsttAllHistoryContainer');
  if(container) container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)"><i class="fas fa-spinner fa-spin fa-2x"></i><div style="margin-top:10px;font-weight:600">Đang tải lịch sử giao dịch...</div></div>';

  google.script.run.withSuccessHandler(data => {
    db.allPaymentHistory = data || [];
    renderAllLichSuThanhToan();
  }).getAllPaymentHistory();
}

function setLsttDateMode(mode, btn) {
  lsttDateMode = mode;
  document.querySelectorAll('.lstt-sdbtn').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  const cr = document.getElementById('lsttCustomRange');
  if(cr) cr.style.display = (mode === 'custom') ? 'flex' : 'none';
  if (mode !== 'custom') {
    document.getElementById('lsttDateFrom').value = '';
    document.getElementById('lsttDateTo').value = '';
  }
  renderAllLichSuThanhToan();
}

function checkLsttDate(timeMs) {
  const now = new Date();
  const d = new Date(timeMs);
  if (isNaN(d.getTime())) return false;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;

  if (lsttDateMode === 'all') return true;
  if (lsttDateMode === 'today') return timeMs >= startOfToday && timeMs <= endOfToday;
  if (lsttDateMode === 'yesterday') {
    const startYest = startOfToday - 86400000;
    return timeMs >= startYest && timeMs <= (startYest + 86400000 - 1);
  }
  if (lsttDateMode === 'week') return timeMs >= (startOfToday - 6 * 86400000) && timeMs <= endOfToday;
  if (lsttDateMode === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (lsttDateMode === 'custom') {
    const from = document.getElementById('lsttDateFrom').value;
    const to = document.getElementById('lsttDateTo').value;
    if (from && timeMs < new Date(from).getTime()) return false;
    if (to) {
      const t = new Date(to); t.setHours(23, 59, 59, 999);
      if (timeMs > t.getTime()) return false;
    }
    return true;
  }
  return true;
}

function renderAllLichSuThanhToan() {
  if(!db.allPaymentHistory) return;

  const searchVal = (document.getElementById('lsttSearchGlobalInp').value || '').toLowerCase().trim();
  let totalThu = 0;
  let count = 0;
  let html = '';

  // ← TÍNH DƯ NỢ THEO ĐÚNG BỘ LỌC ĐANG ÁP DỤNG (tên khách + khoảng thời gian)
  // db.allPaymentHistory đã reverse() nên [0] của mỗi khách trong tập đã lọc = mới nhất trong khoảng đó
  let latestConLaiMap = {};
  db.allPaymentHistory.forEach(r => {
    if(searchVal && !String(r.KhachHang).toLowerCase().includes(searchVal)) return;
    if(!checkLsttDate(r.TimeMs)) return;
    if(!(r.KhachHang in latestConLaiMap)) {
      latestConLaiMap[r.KhachHang] = Number(r.ConLai) || 0;
    }
  });
  let totalConLai = Object.values(latestConLaiMap).reduce((s, v) => s + v, 0);

  // ← PHẦN CÒN LẠI: lọc thời gian + tên khách áp dụng cho totalThu và danh sách hiển thị
  db.allPaymentHistory.forEach(r => {
    if(searchVal && !String(r.KhachHang).toLowerCase().includes(searchVal)) return;
    if(!checkLsttDate(r.TimeMs)) return;

    let note = r.GhiChu || '';
    let isDonHang = r.MaDH && String(r.MaDH).startsWith('HD');
    const thuAmt = Number(r.DaThanhToan) || 0;
    
    totalThu += thuAmt;
    count++;

    let icon = isDonHang ? '<i class="fas fa-shopping-bag" style="color:var(--warn)"></i>' : '<i class="fas fa-money-bill-wave" style="color:var(--suc)"></i>';
    let lbl = isDonHang ? ('Phát sinh nợ (HĐ ' + r.MaDH + ')') : 'Thu tiền nợ';

    let amountHtml = '';
    if(isDonHang && thuAmt === 0) {
      amountHtml = '<div style="color:var(--warn);font-weight:700">+' + Number(r.TongToa).toLocaleString('vi-VN') + 'đ</div>';
    } else if(thuAmt > 0) {
      amountHtml = '<div style="color:var(--suc);font-weight:800;font-size:14px">+' + thuAmt.toLocaleString('vi-VN') + 'đ</div>';
    } else {
      amountHtml = '<div style="font-weight:700">0đ</div>';
    }

    html += `<div style="background:var(--surf); border:1px solid var(--bdr); border-radius:var(--rad); padding:12px; margin-bottom:8px; border-left:4px solid ${isDonHang ? 'var(--warn)' : 'var(--suc)'}; display:flex; justify-content:space-between; align-items:center; transition: 0.15s;" onmouseover="this.style.borderColor='var(--pri)'" onmouseout="this.style.borderColor='var(--bdr)'">
        <div style="display:flex; gap:12px; align-items:center;">
            <div style="font-size:20px; width:36px; height:36px; background:${isDonHang ? 'var(--warn-lt)' : 'var(--suc-lt)'}; border-radius:50%; display:flex; align-items:center; justify-content:center;">${icon}</div>
            <div>
                <div style="font-weight:800; color:var(--pri); font-size:14px;">${r.KhachHang}</div>
                <div style="font-weight:600; font-size:12px; color:var(--txt); margin:2px 0;">${lbl}</div>
                <div style="font-size:11px; color:var(--muted);"><i class="far fa-clock me-1"></i>${r.Ngay} ${note ? ' • <i>'+note+'</i>' : ''}</div>
            </div>
        </div>
        <div style="text-align:right;">
            ${amountHtml}
            <div style="font-size:11px; color:var(--muted); margin-top:4px; font-weight:600;">Dư nợ KH: ${Number(r.ConLai).toLocaleString('vi-VN')}đ</div>
        </div>
    </div>`;
  });

  document.getElementById('lsttStatTotal').textContent = totalThu.toLocaleString('vi-VN') + 'đ';
  document.getElementById('lsttStatCount').textContent = count;
  document.getElementById('lsttStatConLai').textContent = totalConLai.toLocaleString('vi-VN') + 'đ';

  if(!html) {
      html = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">Không có lịch sử giao dịch</div><div class="empty-sub">Hãy thử thay đổi ngày hoặc từ khóa tìm kiếm</div></div>';
  }
  document.getElementById('lsttAllHistoryContainer').innerHTML = html;
}

// ===== LỊCH SỬ CÔNG NỢ (TRANG QUẢN LÝ TỔNG) =====
function renderCongNoList(){
  if(!db.customers)return;
  const term = document.getElementById('searchCongNo').value.toLowerCase().trim();
  const allDebtors = db.customers.filter(c => Number(c.Cong_No||0) !== 0);
  const debtors = allDebtors.filter(c => Number(c.Cong_No||0) > 0);
  const negDebtors = allDebtors.filter(c => Number(c.Cong_No||0) < 0);
  
  // Đã fix lỗi NaN phá thuật toán bằng cách dùng (Number(...) || 0)
  const filtered = allDebtors.filter(c => c.Ten_Khach && bodau(c.Ten_Khach.toString()).includes(bodau(term))).sort((a,b) => (Number(b.Cong_No) || 0) - (Number(a.Cong_No) || 0));
  
  const totalDebt = debtors.reduce((s, c) => s + Number(c.Cong_No||0), 0);
  document.getElementById('congNoTotal').textContent = totalDebt.toLocaleString() + 'đ';
  document.getElementById('congNoCount').textContent = debtors.length;
  
  let negWarnHtml = '';
  if(negDebtors.length > 0) {
    negWarnHtml = '<div style="background:#fef3c7;border:1.5px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#92400e">' +
      '<strong>⚠️ ' + negDebtors.length + ' khách hàng có công nợ ÂM (dữ liệu bị lỗi):</strong><br>' +
      negDebtors.map(c => '<span style="display:inline-block;margin:3px 6px 0 0;font-weight:700;color:#b45309">' + c.Ten_Khach + ': ' + Number(c.Cong_No).toLocaleString() + 'đ</span>').join('') +
      '<br><small>Vui lòng kiểm tra lại dữ liệu trên Google Sheet và sửa thủ công.</small>' +
    '</div>';
  }
  
  const totalPage = Math.ceil(filtered.length/ITEMS_PER_PAGE);
  if(currentCongNoPage<1)currentCongNoPage=1;
  if(currentCongNoPage>totalPage&&totalPage>0)currentCongNoPage=totalPage;
  
  const page = filtered.slice((currentCongNoPage-1)*ITEMS_PER_PAGE, currentCongNoPage*ITEMS_PER_PAGE);
  
  let html='<table class="dtbl"><thead><tr><th width="10%">#</th><th>Khách hàng</th><th>SĐT</th><th style="text-align:right">Công nợ</th><th style="text-align:center" width="20%">Hành động</th></tr></thead><tbody>';
  
  if(!page.length){
    html+='<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Không có khách hàng nợ</td></tr>';
  } else {
    const start=(currentCongNoPage-1)*ITEMS_PER_PAGE;
    page.forEach((c,i)=>{
      const sn=(c.Ten_Khach||'').toString().replace(/'/g,"\\'").replace(/"/g,'\\"');
      let phone=String(c.SDT||'').trim();if(phone&&!phone.startsWith('0'))phone='0'+phone;
      html+='<tr><td style="color:var(--muted)">'+(start+i+1)+'</td><td style="font-weight:700;color:var(--pri)">'+c.Ten_Khach+'</td><td style="font-weight:600">'+phone+'</td><td style="text-align:right;font-weight:700;color:var(--warn);font-size:13px">'+Number(c.Cong_No||0).toLocaleString()+'đ</td><td style="text-align:center"><button class="btn2 btn-suc btn-sm2" onclick="goToThanhToan(\''+sn+'\')">Thu nợ</button></td></tr>';
    });
  }
  html+='</tbody></table>';
  document.getElementById('congNoTable').innerHTML = negWarnHtml + html;
  document.getElementById('congNoPagination').innerHTML='<button class="btn2 btn-out btn-sm2" onclick="currentCongNoPage--;renderCongNoList()"'+(currentCongNoPage<=1?' disabled':'')+'>⬅ Trước</button><span style="font-size:12px;color:var(--muted);font-weight:600">Trang '+(totalPage?currentCongNoPage:0)+' / '+totalPage+'</span><button class="btn2 btn-out btn-sm2" onclick="currentCongNoPage++;renderCongNoList()"'+(currentCongNoPage>=totalPage?' disabled':'')+'>Sau ➡</button>';
}

function goToThanhToan(custName) {
  showPage('thanhToan');
  selectThanhToanCust(custName);
}

// ==================== HỆ THỐNG LƯU TẠM ĐƠN HÀNG ====================
let _draftsCache = null;
let _draftsCacheLoading = false;

function _setDraftsBadge(count) {
  const b = document.getElementById('sbDraftBadge');
  if(b) { b.textContent = count; b.style.display = count > 0 ? 'inline-block' : 'none'; }
  
  const tb = document.getElementById('topMenuDraftBadge');
  if(tb) { tb.textContent = count; tb.style.display = count > 0 ? 'inline-block' : 'none'; }
  const topDatHang = document.getElementById('topDatHangCount');
  if(topDatHang) { topDatHang.textContent = count; topDatHang.style.display = count > 0 ? 'inline-block' : 'none'; }
  
  const sbGrpDatHang = document.getElementById('sbGrpBadgeDatHang');
  if(sbGrpDatHang) { sbGrpDatHang.textContent = count; sbGrpDatHang.style.display = count > 0 ? 'inline-block' : 'none'; }
  
  const hamburgerBadge = document.getElementById('hamburgerDraftBadge');
  if(hamburgerBadge) { hamburgerBadge.textContent = count; hamburgerBadge.style.display = count > 0 ? 'inline-block' : 'none'; }
}

function updateDraftBadge() {
  if(_draftsCache !== null) {
    _setDraftsBadge(_draftsCache.length);
  } else {
    google.script.run.withSuccessHandler(function(arr) {
      _draftsCache = arr || [];
      _setDraftsBadge(_draftsCache.length);
    }).getMyDrafts(user.fullName);
  }
}

function clearCartAndDraftState() {
  cart = [];
  currentDraftId = null;
  editingOrderId = null;
  const custInp = document.getElementById('custInp');
  if(custInp) { custInp.value = ''; custInp.disabled = false; }
  const banner = document.getElementById('draftActiveBanner');
  if(banner) banner.style.display = 'none';
  selectedAddr = "";
  const addrEl = document.getElementById('addrDisplay');
  if(addrEl) addrEl.style.display = 'none';
  const debtH = document.getElementById('debtH');
  if(debtH) debtH.textContent = '0đ';
  adminSelectedSale = null;
  const adminSaleSel = document.getElementById('adminSaleSelect');
  if(adminSaleSel) adminSaleSel.value = '';
  const adminSalePhone = document.getElementById('adminSalePhone');
  if(adminSalePhone) adminSalePhone.textContent = '';
  updateUI();
}

function saveDraft() {
  if(cart.length === 0) { appAlert("Giỏ hàng đang trống!", "warning"); return; }
  const cust = document.getElementById('custInp').value;
  const cartJson = JSON.stringify(cart);
  const btn = document.getElementById('btnSaveDraft');
  if(btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  google.script.run
    .withSuccessHandler(function(newId) {
      if(_draftsCache === null) _draftsCache = [];
      if(currentDraftId) {
        const idx = _draftsCache.findIndex(d => d.id === currentDraftId);
        if(idx >= 0) { _draftsCache[idx].cart = cart; _draftsCache[idx].cust = cust; _draftsCache[idx].time = Date.now(); }
      } else {
        _draftsCache.push({ id: newId, sale: user.fullName, cust: cust, time: Date.now(), cart: cart });
      }
      _setDraftsBadge(_draftsCache.length);
      if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Lưu tạm'; }
      appToast("Đã lưu tạm đơn hàng vào hệ thống!");
      clearCartAndDraftState();
    })
    .withFailureHandler(function(err) {
      if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Lưu tạm'; }
      appAlert("Lỗi lưu tạm: " + err.message, "error");
    })
    .saveDraftToSheet(user.fullName, cust, cartJson, currentDraftId || null);
}

function renderDraftsPage() {
  const b = document.getElementById('draftsPageList');
  if(!b) return;
  
  const role = (user.role||'').toLowerCase();
  const isAdmin = role === 'admin';
  
  b.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)"><i class="fas fa-spinner fa-spin" style="font-size:24px"></i><div style="margin-top:10px">Đang tải đơn lưu tạm...</div></div>';

  if (isAdmin) {
    // Admin gọi hàm lấy TẤT CẢ toa tạm
    google.script.run
      .withSuccessHandler(function(arr) {
        _renderDraftsHtml(arr || [], true);
      })
      .withFailureHandler(function(err) {
        b.innerHTML = '<div class="empty"><div class="empty-icon">❌</div><div class="empty-title">Lỗi tải đơn tạm</div><div class="empty-sub">' + err.message + '</div></div>';
      })
      .getAllDrafts();
  } else {
    // Sale chỉ thấy đơn của mình
    google.script.run
      .withSuccessHandler(function(arr) {
        _draftsCache = arr || [];
        _setDraftsBadge(_draftsCache.length);
        _renderDraftsHtml(_draftsCache, false);
      })
      .withFailureHandler(function(err) {
        b.innerHTML = '<div class="empty"><div class="empty-icon">❌</div><div class="empty-title">Lỗi tải đơn tạm</div><div class="empty-sub">' + err.message + '</div></div>';
      })
      .getMyDrafts(user.fullName);
  }
}

// Khai báo biến toàn cục để lưu trữ tạm danh sách toa
let GLOBAL_DRAFTS_CACHE = [];

function _renderDraftsHtml(arr, isAdminView) {
  // BƯỚC QUAN TRỌNG: Lưu mảng arr vào biến cache để dùng lại khi xem chi tiết
  GLOBAL_DRAFTS_CACHE = arr || [];

  const b = document.getElementById('draftsPageList');
  if(!b) return;
  
  if(!arr || arr.length === 0) {
    b.innerHTML = '<div class="empty" style="padding:40px 10px"><div class="empty-icon" style="font-size:40px">📂</div>' +
      '<div class="empty-title">' + (isAdminView ? 'Không có toa tạm nào' : 'Chưa có đơn lưu tạm nào') + '</div>' +
      '<div class="empty-sub">' + (isAdminView ? 'Hiện tại không có sale nào đang lưu toa' : 'Các toa chưa hoàn thành của bạn sẽ nằm tại đây') + '</div></div>';
    return;
  }

  if (isAdminView) {
    const saleGroups = {};
    arr.forEach(d => {
      if (!saleGroups[d.sale]) saleGroups[d.sale] = [];
      saleGroups[d.sale].push(d);
    });

    let h = '<div style="background:var(--pri-lt);border:1px solid var(--pri);border-radius:var(--rad);padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">' +
      '<div style="font-size:12px;font-weight:700;color:var(--pri)"><i class="fas fa-eye me-1"></i>Chế độ Admin — Xem tất cả toa tạm</div>' +
      '<div style="font-size:13px;font-weight:800;color:var(--dan)">' + arr.length + ' toa / ' + Object.keys(saleGroups).length + ' sale</div>' +
    '</div>';

    Object.keys(saleGroups).forEach((saleName, groupIdx) => {
      const group = saleGroups[saleName];
      const groupId = 'draftGroup_' + groupIdx;

      h += '<div style="margin-bottom:14px; border-radius:var(--rad); overflow:hidden; border:1px solid var(--bdr); box-shadow: 0 2px 8px rgba(0,0,0,0.04);">' +
        '<div onclick="event.stopPropagation(); _toggleDraftGroup(\'' + groupId + '\')" ' +
             // Đổi nền thành gradient nhẹ để có chiều sâu hơn
             'style="background: linear-gradient(135deg, var(--fin) 0%, #2563eb 100%); color:#fff; padding:12px 16px; font-weight:700; font-size:13px; ' +
             'display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; transition: opacity 0.2s;">' +
          
          // --- BÊN TRÁI: Khối chứa Icon Mũi tên và Tên Sale ---
          '<div style="display:flex; align-items:center; gap:14px;">' +
            
            // 1. Nút mũi tên: Phong cách Glassmorphism (Kính mờ) sang trọng
            '<div style="width:32px; height:32px; display:flex; align-items:center; justify-content:center; ' +
                 'background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 50%; ' +
                 'box-shadow: 0 4px 6px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.3); backdrop-filter: blur(4px);">' +
              '<i id="' + groupId + '_icon" class="fas fa-chevron-down" style="font-size:14px; transition:transform .3s cubic-bezier(0.4, 0, 0.2, 1); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));"></i>' +
            '</div>' +
            
            // 2. Tên Sale & Avatar
            '<div style="display:flex; align-items:center; gap:8px;">' +
               // Làm icon user trông như một avatar thu nhỏ
               '<div style="width:24px; height:24px; background: rgba(255,255,255,0.2); border-radius: 50%; display:flex; align-items:center; justify-content:center;">' +
                  '<i class="fas fa-user" style="font-size:11px; opacity:0.9;"></i>' +
               '</div>' +
               '<span style="font-size:14.5px; font-weight:600; text-shadow: 0 1px 2px rgba(0,0,0,0.2); letter-spacing: 0.3px;">' + saleName + '</span>' +
            '</div>' +
            
          '</div>' +

          // --- BÊN PHẢI: Khối chứa số lượng toa ---
          '<div style="display:flex; align-items:center;">' +
            // Badge hiển thị số lượng cũng được bo cong và làm mờ đồng bộ
            '<span style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); padding:4px 12px; border-radius:20px; ' +
                  'font-size:12px; font-weight:600; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">' + group.length + ' toa</span>' +
          '</div>' +
        '</div>' +
        
        '<div id="' + groupId + '" style="padding:10px; content-visibility: auto; display: none;">';

      group.forEach(d => {
        h += _buildDraftCard(d, true);
      });

      h += '</div></div>';
    });

    b.innerHTML = h;

  } else {
    let h = '';
    arr.forEach(d => { h += _buildDraftCard(d, false); });
    b.innerHTML = h;
  }
}

// Hàm JS này bạn GIỮ NGUYÊN không cần thay đổi
function _toggleDraftGroup(groupId) {
  const content = document.getElementById(groupId);
  const icon    = document.getElementById(groupId + '_icon');
  if (!content) return;

  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  if (icon) {
    icon.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

// Tách riêng hàm build card để dùng chung
function _buildDraftCard(d, isAdminView) {
  const dt = new Date(d.time);
  const timeStr = String(dt.getDate()).padStart(2,'0') + '/' + 
                  String(dt.getMonth()+1).padStart(2,'0') + ' ' + 
                  String(dt.getHours()).padStart(2,'0') + ':' + 
                  String(dt.getMinutes()).padStart(2,'0');
  const total = d.cart.reduce((s,i) => s + (Number(i.SL)||0)*Number(i.Gia)*(1-(Number(i.CK)||0)/100), 0);
  const qty = d.cart.reduce((s,i) => s + (Number(i.SL)||0), 0);
  const safeId = String(d.id).replace(/'/g, "\\'");
  const safeSale = String(d.sale || '').replace(/'/g, "\\'");
  
  // Nút xóa: Admin xóa toa của bất kỳ sale nào
  const deleteBtn = isAdminView
    ? '<button class="btn2 btn-out" style="width:44px;color:var(--dan);border-color:var(--dan)" onclick="adminDeleteDraft(\'' + safeId + '\',\'' + safeSale + '\')"><i class="fas fa-trash-alt"></i></button>'
    : '<button class="btn2 btn-out" style="width:44px;color:var(--dan);border-color:var(--dan)" onclick="deleteDraft(\'' + safeId + '\')"><i class="fas fa-trash-alt"></i></button>';
  
  // Nút mở: Admin chỉ xem chi tiết, Sale thì mở lên giỏ
  const openBtn = isAdminView
    ? '<button class="btn2 btn-pri" style="flex:1" onclick="adminViewDraftDetail(\'' + safeId + '\')"><i class="fas fa-eye me-1"></i> Xem chi tiết</button>'
    : '<button class="btn2 btn-info" style="flex:1" onclick="loadDraft(\'' + safeId + '\')"><i class="fas fa-upload me-1"></i> Mở lên đơn</button>';
  
  const borderColor = isAdminView ? 'var(--fin)' : 'var(--info)';
  
  return '<div class="order-card" style="border-left:4px solid ' + borderColor + ';margin-bottom:10px;background:var(--surf);padding:14px;border-radius:var(--rad-lg);">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<div style="font-weight:800;color:var(--pri);font-size:14px;">' + (d.cust || 'Chưa chọn khách') + '</div>' +
      '<div style="font-size:11px;color:var(--muted);font-weight:600;">' + timeStr + '</div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">' +
      'Gồm <strong>' + d.cart.length + '</strong> mặt hàng (SL: <strong>' + qty + '</strong>) — ' +
      'Tạm tính: <strong style="color:var(--dan)">' + Math.round(total).toLocaleString() + 'đ</strong>' +
    '</div>' +
    '<div style="display:flex;gap:8px">' + openBtn + deleteBtn + '</div>' +
  '</div>';
}

// Admin xóa toa tạm của bất kỳ sale nào
function adminDeleteDraft(id, saleName) {
  appConfirm('Xóa toa tạm này của sale ' + saleName + '?', () => {
    google.script.run
      .withSuccessHandler(function() {
        appToast('Đã xóa toa tạm!');
        renderDraftsPage(); // Tải lại danh sách
      })
      .withFailureHandler(function(err) {
        appAlert('Lỗi: ' + err.message, 'error');
      })
      .deleteDraftFromSheet(saleName, id);
  });
}

// Admin xem chi tiết toa tạm (popup modal) - Phiên bản Load Siêu Tốc
function adminViewDraftDetail(id) {
  // Lấy dữ liệu ngay lập tức từ biến cache, KHÔNG GỌI SERVER NỮA
  const d = GLOBAL_DRAFTS_CACHE.find(x => String(x.id) === String(id));
  
  if (!d) { 
    appAlert('Không tìm thấy toa tạm!', 'error'); 
    return; 
  }
  
  const total = d.cart.reduce((s,i) => s + (Number(i.SL)||0)*Number(i.Gia)*(1-(Number(i.CK)||0)/100), 0);
  
  // Build bảng chi tiết sản phẩm (Đã loại bỏ CK%)
  let tableRows = d.cart.map((item, i) => {
    const tt = Math.round((Number(item.SL)||0) * Number(item.Gia) * (1-(Number(item.CK)||0)/100));
    return '<tr>' +
      '<td style="padding:7px 5px;border:1px solid #e5e7eb;color:var(--muted);text-align:center;">' + (i+1) + '</td>' +
      '<td style="padding:7px 5px;border:1px solid #e5e7eb;font-weight:700;">' + item.Ten_Hang + '</td>' +
      '<td style="padding:7px 5px;border:1px solid #e5e7eb;text-align:center;font-weight:700;color:var(--pri);">' + item.SL + '</td>' +
      '<td style="padding:7px 5px;border:1px solid #e5e7eb;text-align:right;color:var(--dan);">' + Number(item.Gia).toLocaleString() + '</td>' +
      '<td style="padding:7px 5px;border:1px solid #e5e7eb;text-align:right;font-weight:700;color:var(--fin);">' + tt.toLocaleString() + '</td>' +
      '<td style="padding:7px 5px;border:1px solid #e5e7eb;font-size:11px;color:var(--muted);">' + (item.Ghi_Chu||'—') + '</td>' +
    '</tr>';
  }).join('');
  
  // Hiển thị ngay lập tức
  Swal.fire({
    title: '<span style="color:var(--fin);font-size:16px;"><i class="fas fa-folder-open me-2"></i>Chi tiết toa tạm</span>',
    html: '<div style="text-align:left;">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
        '<div style="background:var(--bg);border-radius:8px;padding:10px;">' +
          '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Sale</div>' +
          '<div style="font-weight:700;color:var(--fin);">' + d.sale + '</div>' +
        '</div>' +
        '<div style="background:var(--bg);border-radius:8px;padding:10px;">' +
          '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Khách hàng</div>' +
          '<div style="font-weight:700;color:var(--pri);">' + (d.cust||'Chưa chọn') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:350px;">' + // Đã giảm min-width để vừa điện thoại
        '<thead><tr style="background:var(--fin);color:#fff;">' +
          '<th style="padding:8px 5px;border:1px solid #1e40af;text-align:center;width:5%">#</th>' +
          '<th style="padding:8px 5px;border:1px solid #1e40af;">Tên hàng</th>' +
          '<th style="padding:8px 5px;border:1px solid #1e40af;text-align:center;width:10%">SL</th>' +
          '<th style="padding:8px 5px;border:1px solid #1e40af;text-align:right;width:18%">Đơn giá</th>' +
          '<th style="padding:8px 5px;border:1px solid #1e40af;text-align:right;width:18%">T.Tiền</th>' +
          '<th style="padding:8px 5px;border:1px solid #1e40af;width:15%">Ghi chú</th>' +
        '</tr></thead>' +
        '<tbody>' + tableRows + '</tbody>' +
      '</table></div>' +
      '<div style="text-align:right;margin-top:12px;padding-top:10px;border-top:2px dashed var(--bdr);">' +
        '<span style="font-size:12px;color:var(--muted);">TỔNG TẠM TÍNH: </span>' +
        '<span style="font-size:20px;font-weight:800;color:var(--dan);">' + Math.round(total).toLocaleString() + 'đ</span>' +
      '</div>' +
    '</div>',
    width: '680px',
    confirmButtonText: 'Đóng',
    confirmButtonColor: '#1a56db',
    customClass: { popup: 'rounded-4', htmlContainer: 'text-start' }
  });
}

function loadDraft(id) {
  const proceedLoadDraft = () => {
    const fromCache = _draftsCache ? _draftsCache.find(x => x.id === id) : null;
    if(fromCache) {
      _applyDraft(fromCache);
      return;
    }
    
    google.script.run
      .withSuccessHandler(function(arr) {
        _draftsCache = arr || [];
        const d = _draftsCache.find(x => x.id === id);
        if(d) _applyDraft(d);
        else appAlert("Không tìm thấy đơn tạm này!", "error");
      })
      .getMyDrafts(user.fullName);
  };

  if(cart.length > 0 && !currentDraftId && !editingOrderId) {
    appConfirm("Giỏ hàng hiện tại đang có sản phẩm. Mở đơn tạm sẽ ghi đè lên giỏ hàng này. Tiếp tục?", proceedLoadDraft);
  } else {
    proceedLoadDraft();
  }
}

function _applyDraft(d) {
  cart = d.cart;
  currentDraftId = d.id;
  document.getElementById('custInp').value = d.cust || '';
  onCustChange();
  updateUI();
  
  document.getElementById('custInp').disabled = true;
  document.getElementById('draftActiveBanner').style.display = 'flex';
  document.getElementById('draftActiveCust').textContent = (d.cust || 'Chưa chọn khách hàng');
  
  showPage('order'); 
}

function deleteDraft(id) {
  appConfirm("Xóa vĩnh viễn đơn lưu tạm này?", () => {
    google.script.run
      .withSuccessHandler(function() {
        if(_draftsCache) _draftsCache = _draftsCache.filter(x => x.id !== id);
        _setDraftsBadge((_draftsCache||[]).length);
        _renderDraftsHtml(_draftsCache || []);
      })
      .withFailureHandler(function(err) {
        appAlert("Lỗi xóa đơn tạm: " + err.message, "error");
      })
      .deleteDraftFromSheet(user.fullName, id);
  });
}

function cancelDraft() {
  appConfirm("Hủy bỏ đơn lưu tạm này? Đơn sẽ bị xóa vĩnh viễn và giỏ hàng sẽ làm trống.", () => {
    const idToDelete = currentDraftId;
    clearCartAndDraftState();
    if(idToDelete) {
      google.script.run
        .withSuccessHandler(function() {
          if(_draftsCache) _draftsCache = _draftsCache.filter(x => x.id !== idToDelete);
          _setDraftsBadge((_draftsCache||[]).length);
        })
        .deleteDraftFromSheet(user.fullName, idToDelete);
    }
  });
}
// ===== TÌM VÀ MỞ NHANH XỬ LÝ ĐƠN HÀNG (CHỈ NHẬP SỐ) =====
function searchAndOpenOrder() {
  const inp = document.getElementById('xlSearchIdInp');
  let val = inp.value.trim(); 

  if (!val) {
    appAlert("Vui lòng nhập số hóa đơn cần xử lý!", "warning");
    return;
  }

  // Tự động format số nhập vào thành chuẩn HDxxxx (VD: 514 -> HD0514, 14 -> HD0014)
  let searchId = "HD" + ("00000" + val).slice(-5);

  // Tìm trong mảng lịch sử đang chờ xử lý hoặc hoàn thành (db.historyForXuLy)
  const allOrders = db.historyForXuLy || [];
  const foundOrder = allOrders.find(o => String(o.id).trim().toUpperCase() === searchId);

  if (foundOrder) {
    // Nếu tìm thấy, gọi thẳng hàm mở modal của hệ thống
    openXlModal(foundOrder.id);
    inp.value = ''; // Xóa ô nhập sau khi mở thành công
  } else {
    // Nếu không tìm thấy
    appAlert("Không tìm thấy hóa đơn: " + searchId + "\n(Có thể đơn chưa được lưu hoặc bạn gõ sai số)", "error");
  }
}
// ===== LOẠI TRỪ GỘP ĐƠN =====
let _excludeList = [];

function updateExcludeBtnState() {
  const btn = document.getElementById('btnExcludeList');
  if (!btn) return;
  const on = !!db.excludeMerge;
  btn.disabled = !on;
  btn.style.opacity = on ? '1' : '.5';
  btn.style.background = on ? '#dc2626' : '';
  btn.style.color = on ? '#fff' : '';
  btn.style.borderColor = on ? '#dc2626' : '';
}

function toggleExcludeMerge(el) {
  const isOn = el.checked;
  el.disabled = true;
  google.script.run
    .withSuccessHandler(() => {
      db.excludeMerge = isOn;
      el.disabled = false;
      updateExcludeBtnState();
      appToast(isOn ? "Đã BẬT loại trừ gộp đơn!" : "Đã TẮT loại trừ gộp đơn!");
    })
    .withFailureHandler(err => {
      el.checked = !isOn; el.disabled = false;
      appAlert("Lỗi: " + err.message, "error");
    })
    .toggleExcludeSetting(isOn);
}

function openExcludeModal() {
  if (!db.excludeMerge) return;
  document.getElementById('excludeProdDl').innerHTML =
    (db.products || []).map(p => '<option value="' + String(p.Ten_San_Pham).replace(/"/g, '&quot;') + '">').join('');
  document.getElementById('excludeInp').value = '';
  document.getElementById('excludeListWrap').innerHTML =
    '<div style="text-align:center;padding:20px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Đang tải...</div>';
  document.getElementById('excludeModal').classList.add('show');
  google.script.run.withSuccessHandler(list => {
    _excludeList = list || [];
    renderExcludeList();
  }).getExcludeList();
  setTimeout(() => document.getElementById('excludeInp').focus(), 150);
}

function closeExcludeModal() {
  document.getElementById('excludeModal').classList.remove('show');
}

function renderExcludeList() {
  const wrap = document.getElementById('excludeListWrap');
  if (!_excludeList.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-style:italic">Chưa có sản phẩm nào trong danh sách</div>';
    return;
  }
  wrap.innerHTML = '<table class="dtbl"><thead><tr><th width="12%" style="text-align:center">STT</th><th>Tên sản phẩm</th><th width="15%" style="text-align:center">Xóa</th></tr></thead><tbody>' +
    _excludeList.map((n, i) =>
      '<tr><td style="text-align:center;color:var(--muted)">' + (i + 1) + '</td>' +
      '<td style="font-weight:700">' + n + '</td>' +
      '<td style="text-align:center"><button class="btn2 btn-sm2" style="background:var(--dan-lt);color:var(--dan);border:none" onclick="removeExcludeItem(' + i + ')">❌</button></td></tr>'
    ).join('') + '</tbody></table>';
}

function addExcludeItem() {
  const inp = document.getElementById('excludeInp');
  const val = inp.value.trim();
  if (!val) { appAlert("Vui lòng nhập tên sản phẩm!", "warning"); return; }

  // Chỉ cho thêm sản phẩm có thật trong danh mục (lấy đúng tên chuẩn)
  const prod = (db.products || []).find(p => bodau(p.Ten_San_Pham) === bodau(val));
  if (!prod) { appAlert("Không tìm thấy sản phẩm này trong danh mục!\nHãy chọn từ gợi ý.", "error"); return; }

  google.script.run
    .withSuccessHandler(res => {
      if (res.success) {
        _excludeList = res.list || [];
        renderExcludeList();
        inp.value = '';
        inp.focus();
        appToast("Đã thêm vào danh sách loại trừ!");
      } else {
        appAlert(res.msg, "warning");
      }
    })
    .withFailureHandler(err => appAlert("Lỗi: " + err.message, "error"))
    .addExcludeProduct(prod.Ten_San_Pham);
}

function removeExcludeItem(idx) {
  const name = _excludeList[idx];
  if (!name) return;
  appConfirm('Xóa "' + name + '" khỏi danh sách loại trừ?', () => {
    google.script.run
      .withSuccessHandler(res => {
        if (res.success) { _excludeList = res.list || []; renderExcludeList(); appToast("Đã xóa!"); }
        else appAlert(res.msg, "error");
      })
      .deleteExcludeProduct(name);
  });
}
