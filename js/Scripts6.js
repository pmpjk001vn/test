// =====================================================================
// ĐỊNH VỊ SALE v3 (Scripts6) - thay thế hoàn toàn bản v2
// - Sale / Leader: cứ 45 giây gửi vị trí; mở lại app / bật lại màn hình là gửi NGAY;
//   định vị lỗi thì tự thử lại bằng chế độ tiết kiệm; lỗi hiện liên tục đến khi hết.
// - Admin: tab "📍 Định Vị": bản đồ vệ tinh, vị trí cũ tô cam,
//   và LỊCH SỬ: chọn nhân viên + ngày để xem lộ trình đã đi.
// =====================================================================
(function () {
  'use strict';

  const SEND_MS = 45000;
  const ONLINE_MS = 3 * 60000;
  const STALE_MS = 5 * 60000;     // online nhưng vị trí cũ hơn 5 phút => cảnh báo
  const REFRESH_MS = 30000;

  let trackTimer = null, statusEl = null, ticking = false, lastTickAt = 0;
  let map = null, layer = null, histLayer = null, refreshTimer = null, leafletPromise = null;
  let uiBuilt = false, locData = [], serverOffset = 0, fitted = false, markers = {};
  let histMode = false, histMarkers = [];

  // ---------- tiện ích ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function p2(n) { return ('0' + n).slice(-2); }
  function curUser() { try { return (typeof user !== 'undefined') ? user : null; } catch (e) { return null; } }
  function isAdmin() {
    const u = curUser();
    return !!(u && String(u.role || '').trim().toLowerCase() === 'admin');
  }
  function isLoggedIn() {
    const app = document.getElementById('mainApp');
    const u = curUser();
    return !!(app && app.style.display !== 'none' && u && (u.userId || u.fullName));
  }
  function getToken() {
    const u = curUser();
    return (u && u.token) ? u.token : '';
  }
  function hhmm() {
    const d = new Date();
    return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }
  function fmtAgo(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'vừa xong';
    if (m < 60) return m + ' phút trước';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' giờ trước';
    return Math.floor(h / 24) + ' ngày trước';
  }
  function fmtTime(ms) {
    if (!ms) return '---';
    const d = new Date(ms);
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function fmtHM(ms) {
    const d = new Date(ms);
    return p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function todayStr(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function distM(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  // ---------- 1) SALE / LEADER ----------
  let okShown = false, lastErr = '', hideTimer = null;
  function setStatus(text, ok, hideMs) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (hideMs) hideTimer = setTimeout(hideStatus, hideMs);
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9990;max-width:80vw;' +
        'font-size:11px;font-weight:700;padding:5px 10px;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.15);';
      document.body.appendChild(statusEl);
    }
    statusEl.style.display = 'block';
    statusEl.style.background = ok ? '#d1fae5' : '#fee2e2';
    statusEl.style.color = ok ? '#065f46' : '#991b1b';
    statusEl.textContent = text;
  }
  function hideStatus() { if (statusEl) statusEl.style.display = 'none'; }

  function push(lat, lng, acc, err) {
    const token = getToken();
    if (!token) { setStatus('⚠️ Định vị: thiếu token đăng nhập', false); return; }
    google.script.run
      .withSuccessHandler(function (r) {
        if (r && r.success) {
          if (err) {
            // Lỗi định vị: hiện LIÊN TỤC cho đến khi lấy lại được vị trí
            lastErr = err;
            setStatus('⚠️ Không lấy được vị trí: ' + err + '. Hãy bật Định vị (GPS) và cho phép trình duyệt dùng vị trí.', false, 4000);
          } else if (lastErr) {
            lastErr = '';
            setStatus('📍 Đã gửi lại vị trí lúc ' + hhmm(), true, 4000);
          } else if (!okShown) {
            okShown = true;
            setStatus('📍 Đã gửi vị trí lúc ' + hhmm(), true, 4000);
          }
        } else {
          setStatus('⚠️ Server từ chối: ' + ((r && r.msg) || 'không rõ'), false, 8000);
        }
      })
      .withFailureHandler(function (e) {
        setStatus('⚠️ Lỗi gọi server: ' + ((e && e.message) || e), false, 8000);
      })
      .saveLocation(token, lat, lng, acc, err || '');
  }

  // Lấy vị trí MỚI (maximumAge 0). Lỗi timeout/không xác định => thử lại chế độ tiết kiệm (Wi-Fi/mạng)
  function tick() {
    if (ticking && Date.now() - lastTickAt < 40000) return;
    ticking = true; lastTickAt = Date.now();
    if (!navigator.geolocation) { ticking = false; push(null, null, 0, 'Thiết bị không hỗ trợ định vị'); return; }

    function ok(pos) {
      ticking = false;
      push(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, '');
    }
    function fail(e) {
      ticking = false;
      const m = { 1: 'bị chặn quyền vị trí', 2: 'không xác định được vị trí', 3: 'hết thời gian chờ định vị' };
      push(null, null, 0, (m[e && e.code] || 'lỗi định vị') + (e && e.message ? ' (' + e.message + ')' : ''));
    }
    navigator.geolocation.getCurrentPosition(
      ok,
      function (e1) {
        if (e1 && e1.code === 1) { fail(e1); return; }   // bị chặn quyền thì thử lại cũng vô ích
        navigator.geolocation.getCurrentPosition(ok, fail,
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Quay lại app / bật lại màn hình / có mạng lại => gửi ngay (điện thoại ngủ sẽ làm đồng hồ 45s bị treo)
  function wake() {
    if (!trackTimer) return;
    if (document.visibilityState === 'hidden') return;
    if (Date.now() - lastTickAt > 10000) tick();
  }
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('pageshow', wake);
  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);

  function startTracking() {
    if (trackTimer) return;
    okShown = false; lastErr = '';
    tick();
    trackTimer = setInterval(tick, SEND_MS);
  }
  function stopTracking() {
    if (trackTimer) { clearInterval(trackTimer); trackTimer = null; }
    hideStatus();
  }

  // ---------- 2) ADMIN: giao diện ----------
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise(function (resolve, reject) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      js.onload = resolve;
      js.onerror = function () { leafletPromise = null; reject(); };
      document.head.appendChild(js);
    });
    return leafletPromise;
  }

  const FIELD = 'padding:7px 10px;border:1px solid var(--bdr);border-radius:8px;font-size:13px;background:var(--bg);color:inherit;';

  function buildUI() {
    if (uiBuilt) return;
    uiBuilt = true;

    const host = document.querySelector('.main-wrap .container-fluid');
    if (host && !document.getElementById('pLocation')) {
      const page = document.createElement('div');
      page.id = 'pLocation';
      page.className = 'page';
      page.innerHTML =
        '<div class="stat-grid" style="grid-template-columns:1fr 1fr;">' +
          '<div class="stat-card" style="border-left:4px solid var(--suc)"><div class="slabel">Đang online</div><div class="sval" id="locStatOn" style="color:var(--suc)">0</div><div class="ssub">cập nhật trong 3 phút</div></div>' +
          '<div class="stat-card" style="border-left:4px solid var(--info)"><div class="slabel">Tổng nhân viên</div><div class="sval" id="locStatAll" style="color:var(--info)">0</div><div class="ssub">đã từng báo online</div></div>' +
        '</div>' +
        '<div class="card" style="border-top:3px solid var(--info)">' +
          '<div class="sec-head" style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="color:var(--info)"><i class="fas fa-location-dot me-2"></i>Bản Đồ nhân viên</span>' +
            '<button class="btn2 btn-out btn-sm2" id="locRefreshBtn"><i class="fas fa-sync-alt"></i> Làm mới</button>' +
          '</div>' +
          // --- Bộ lọc lịch sử ---
          '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">' +
            '<span style="font-size:12px;font-weight:700;color:var(--muted)"><i class="fas fa-route me-1"></i>Lịch sử:</span>' +
            '<select id="locHistUser" style="' + FIELD + 'min-width:150px"><option value="">-- Chọn nhân viên --</option></select>' +
            '<button class="btn2 btn-out btn-sm2" id="locHistPrev" title="Ngày trước">◀</button>' +
            '<input type="date" id="locHistDate" style="' + FIELD + '">' +
            '<button class="btn2 btn-out btn-sm2" id="locHistNext" title="Ngày sau">▶</button>' +
            '<button class="btn2 btn-sm2" id="locHistGo" style="background:var(--info);color:#fff;border:0"><i class="fas fa-search"></i> Xem</button>' +
            '<button class="btn2 btn-out btn-sm2" id="locHistClear" style="display:none"><i class="fas fa-xmark"></i> Thoát lịch sử</button>' +
          '</div>' +
          '<div id="locHistInfo" style="font-size:12px;font-weight:700;margin-bottom:8px;display:none"></div>' +
          '<div id="locMap" style="width:100%;height:440px;border-radius:var(--rad-lg);overflow:hidden;border:1px solid var(--bdr);background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--muted)">Đang tải bản đồ...</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:6px">' +
            '<span style="color:#0e9f6e">●</span> Online &nbsp; ' +
            '<span style="color:#f59e0b">●</span> Online nhưng vị trí cũ &nbsp; ' +
            '<span style="color:#9ca3af">●</span> Offline (vị trí cuối cùng)</div>' +
          '<div id="locHistList" style="display:none;margin-top:10px;max-height:320px;overflow:auto;border:1px solid var(--bdr);border-radius:10px"></div>' +
        '</div>' +
        '<div class="card"><div class="sec-head"><i class="fas fa-users me-2"></i>Danh sách</div><div id="locList"></div></div>';
      host.appendChild(page);

      document.getElementById('locRefreshBtn').onclick = function () { fitted = false; loadLocations(); };
      document.getElementById('locHistDate').value = todayStr(0);
      document.getElementById('locHistDate').max = todayStr(0);
      document.getElementById('locHistGo').onclick = loadHistory;
      document.getElementById('locHistClear').onclick = clearHistory;
      document.getElementById('locHistUser').onchange = function () { if (this.value) loadHistory(); };
      document.getElementById('locHistDate').onchange = function () {
        if (document.getElementById('locHistUser').value) loadHistory();
      };
      document.getElementById('locHistPrev').onclick = function () { shiftDay(-1); };
      document.getElementById('locHistNext').onclick = function () { shiftDay(1); };
    }

    const top = document.getElementById('adminTopMenu');
    if (top && !document.getElementById('locTopItem')) {
      const d = document.createElement('div');
      d.className = 'admin-dropdown';
      d.id = 'locTopItem';
      d.innerHTML = '<button class="admin-menu-btn" onclick="showPage(\'location\')">📍 Bản Đồ</button>';
      top.appendChild(d);
    }

    const sb = document.getElementById('sidebar');
    if (sb && !document.getElementById('locSbGrp')) {
      const g = document.createElement('div');
      g.className = 'sb-grp';
      g.id = 'locSbGrp';
      g.innerHTML =
        '<div class="sb-items open" style="max-height:none;opacity:1">' +
          '<div class="sb-item" data-tab="location" onclick="showPage(\'location\');closeSidebar()"><i class="fas fa-location-dot"></i> Bản Đồ nhân viên</div>' +
        '</div>';
      sb.insertBefore(g, sb.querySelector('.sb-close'));
    }
  }

  function applyVisibility() {
    const show = isAdmin();
    ['locTopItem', 'locSbGrp'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = show ? '' : 'none';
    });
    if (!show) {
      const p = document.getElementById('pLocation');
      if (p) p.style.display = 'none';
      stopRefresh();
    }
  }

  // ---------- 3) ADMIN: tải & vẽ vị trí hiện tại ----------
  function loadLocations() {
    const token = getToken();
    if (!token || !isAdmin()) return;
    google.script.run
      .withSuccessHandler(function (res) {
        if (!res || !res.success) {
          const l = document.getElementById('locList');
          if (l) l.innerHTML = '<div class="empty"><div class="empty-title">' + esc((res && res.msg) || 'Không tải được dữ liệu') + '</div></div>';
          return;
        }
        locData = res.list || [];
        serverOffset = (res.serverTime || Date.now()) - Date.now();
        render();
      })
      .withFailureHandler(function (e) {
        const l = document.getElementById('locList');
        if (l) l.innerHTML = '<div class="empty"><div class="empty-title">Lỗi gọi server: ' + esc((e && e.message) || e) + '</div><div class="empty-sub">Hãy Deploy lại bản mới của Apps Script.</div></div>';
      })
      .getSaleLocations(token);
  }

  function isOnline(x, now) { return now - (x.online || x.time || 0) <= ONLINE_MS; }
  function isStale(x, now) { return x.hasPos && (now - x.time) > STALE_MS; }
  function dotColor(x, now) {
    if (!isOnline(x, now)) return '#9ca3af';
    return isStale(x, now) ? '#f59e0b' : '#0e9f6e';
  }

  function ensureMap() {
    return loadLeaflet().then(function () {
      if (map) return;
      const box = document.getElementById('locMap');
      box.innerHTML = '';
      box.style.display = 'block';
      map = L.map('locMap').setView([10.0452, 105.7469], 12);
      // Mặc định: VỆ TINH (Esri) + nhãn tên đường/địa danh; có nút đổi sang bản đồ đường phố
      const sat = L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19, attribution: 'Tiles © Esri'
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19
        })
      ]);
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
      sat.addTo(map);
      L.control.layers({ '🛰️ Vệ tinh': sat, '🗺️ Đường phố': osm }, null, { position: 'topright', collapsed: true }).addTo(map);
      layer = L.layerGroup().addTo(map);
      histLayer = L.layerGroup().addTo(map);
    });
  }

  function fillUserSelect() {
    const sel = document.getElementById('locHistUser');
    if (!sel) return;
    const cur = sel.value;
    let html = '<option value="">-- Chọn nhân viên --</option>';
    locData.slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); })
      .forEach(function (x) {
        html += '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>';
      });
    if (sel.getAttribute('data-sig') !== html) {
      sel.innerHTML = html;
      sel.setAttribute('data-sig', html);
      sel.value = cur;
    }
  }

  function render() {
    const now = Date.now() + serverOffset;
    const online = locData.filter(function (x) { return isOnline(x, now); });
    document.getElementById('locStatOn').textContent = online.length;
    document.getElementById('locStatAll').textContent = locData.length;
    fillUserSelect();

    const list = document.getElementById('locList');
    if (!locData.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">📍</div><div class="empty-title">Chưa có nhân viên nào báo online</div><div class="empty-sub">Nhân viên cần đăng nhập vào bản web đã cập nhật.</div></div>';
    } else {
      list.innerHTML = locData.map(function (x) {
        const on = isOnline(x, now);
        const stale = on && isStale(x, now);
        const posLine = x.hasPos
          ? ((stale ? '⚠️ Vị trí CŨ: ' : 'Vị trí: ') + fmtAgo(now - x.time) + ' · ' + fmtTime(x.time) + (x.acc ? ' · ±' + x.acc + 'm' : ''))
          : 'Chưa có toạ độ';
        const posColor = stale ? '#b45309' : 'var(--muted)';
        const note = x.note ? '<div style="font-size:11px;color:#b45309;font-weight:700;margin-top:2px">⚠️ ' + esc(x.note) + '</div>' : '';
        const mapBtn = x.hasPos
          ? '<a class="btn2 btn-out btn-sm2" target="_blank" rel="noopener" onclick="event.stopPropagation()" href="https://www.google.com/maps?q=' + x.lat + ',' + x.lng + '"><i class="fas fa-directions"></i> Maps</a>'
          : '';
        return '<div class="res-card" style="border-left-color:' + dotColor(x, now) + ';cursor:pointer" data-uid="' + esc(x.id) + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
            '<div><div style="font-weight:700;font-size:14px">' + esc(x.name) + ' <span style="font-size:11px;color:var(--muted);font-weight:600">(' + esc(x.role) + ')</span></div>' +
            '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + (on ? '🟢 Online' : '⚪ Offline') + ' · báo cuối ' + fmtAgo(now - (x.online || x.time)) + '</div>' +
            '<div style="font-size:11px;color:' + posColor + ';' + (stale ? 'font-weight:700' : '') + '">' + posLine + '</div>' + note + '</div>' +
            mapBtn +
          '</div></div>';
      }).join('');
      Array.prototype.forEach.call(list.querySelectorAll('[data-uid]'), function (el) {
        el.onclick = function () {
          const m = markers[el.getAttribute('data-uid')];
          if (m && map) {
            if (histMode) clearHistory();
            map.setView(m.getLatLng(), 17); m.openPopup(); window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        };
      });
    }

    ensureMap().then(function () {
      layer.clearLayers();
      markers = {};
      const pts = [];
      locData.forEach(function (x) {
        if (!x.hasPos) return;
        const on = isOnline(x, now);
        const stale = on && isStale(x, now);
        const m = L.circleMarker([x.lat, x.lng], { radius: 10, color: '#fff', weight: 2, fillColor: dotColor(x, now), fillOpacity: 1 }).addTo(layer);
        m.bindTooltip(x.name, { permanent: true, direction: 'top', offset: [0, -8] });
        m.bindPopup('<b>' + esc(x.name) + '</b><br>' + (on ? 'Online' : 'Offline') + ' · vị trí ' + fmtAgo(now - x.time) +
          (stale ? '<br><span style="color:#b45309"><b>⚠️ Vị trí đã cũ</b>' + (x.note ? ': ' + esc(x.note) : '') + '</span>' : '') +
          '<br><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + x.lat + ',' + x.lng + '">Mở Google Maps</a>');
        markers[x.id] = m;
        pts.push([x.lat, x.lng]);
      });
      if (!fitted && !histMode && pts.length) { map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 }); fitted = true; }
      setTimeout(function () { map.invalidateSize(); }, 150);
    }).catch(function () {
      const box = document.getElementById('locMap');
      if (box && !map) box.textContent = 'Không tải được bản đồ (kiểm tra mạng).';
    });
  }

  // ---------- 4) ADMIN: LỊCH SỬ ----------
  function shiftDay(delta) {
    const inp = document.getElementById('locHistDate');
    const parts = (inp.value || todayStr(0)).split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + delta);
    const s = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    if (s > todayStr(0)) return;
    inp.value = s;
    if (document.getElementById('locHistUser').value) loadHistory();
  }

  function showInfo(html, color) {
    const el = document.getElementById('locHistInfo');
    el.style.display = html ? 'block' : 'none';
    el.style.color = color || 'var(--info)';
    el.innerHTML = html || '';
  }

  function loadHistory() {
    const sel = document.getElementById('locHistUser');
    const uid = sel.value, dateStr = document.getElementById('locHistDate').value;
    if (!uid) { showInfo('Hãy chọn nhân viên trước.', '#b45309'); return; }
    if (!dateStr) { showInfo('Hãy chọn ngày.', '#b45309'); return; }
    const name = sel.options[sel.selectedIndex].text;
    showInfo('Đang tải lịch sử...', 'var(--muted)');
    google.script.run
      .withSuccessHandler(function (res) {
        if (!res || !res.success) { showInfo(esc((res && res.msg) || 'Không tải được lịch sử'), '#b91c1c'); return; }
        drawHistory(res.points || [], name, dateStr);
      })
      .withFailureHandler(function (e) {
        showInfo('Lỗi gọi server: ' + esc((e && e.message) || e) + ' (hãy Deploy lại bản mới của Apps Script)', '#b91c1c');
      })
      .getLocationHistory(getToken(), uid, dateStr);
  }

  function drawHistory(pts, name, dateStr) {
    ensureMap().then(function () {
      histMode = true;
      histLayer.clearLayers();
      histMarkers = [];
      if (map.hasLayer(layer)) map.removeLayer(layer);
      document.getElementById('locHistClear').style.display = '';
      const listEl = document.getElementById('locHistList');
      const dp = dateStr.split('-');
      const dTxt = dp[2] + '/' + dp[1] + '/' + dp[0];

      if (!pts.length) {
        listEl.style.display = 'none';
        showInfo('Không có dữ liệu vị trí của <b>' + esc(name) + '</b> ngày ' + dTxt +
          '. (Lịch sử chỉ ghi từ lúc cập nhật bản mới; nhân viên phải đang mở app/bật định vị.)', '#b45309');
        return;
      }

      const ll = pts.map(function (p) { return [p.lat, p.lng]; });
      // quãng đường: bỏ các đoạn <15m (nhiễu GPS khi đứng yên)
      let total = 0;
      for (let i = 1; i < ll.length; i++) {
        const d = distM(ll[i - 1], ll[i]);
        if (d >= 15) total += d;
      }

      L.polyline(ll, { color: '#000', weight: 8, opacity: 0.35 }).addTo(histLayer);
      L.polyline(ll, { color: '#fbbf24', weight: 4, opacity: 0.95 }).addTo(histLayer);

      pts.forEach(function (p, i) {
        const first = i === 0, last = i === pts.length - 1;
        const m = L.circleMarker([p.lat, p.lng], {
          radius: first || last ? 9 : 4,
          color: '#fff', weight: first || last ? 2 : 1,
          fillColor: first ? '#0e9f6e' : (last ? '#e02424' : '#2563eb'),
          fillOpacity: 1
        }).addTo(histLayer);
        if (first || last) {
          m.bindTooltip((first ? 'Bắt đầu ' : 'Cuối ') + fmtHM(p.t), { permanent: true, direction: 'top', offset: [0, -8] });
        }
        m.bindPopup('<b>' + esc(name) + '</b><br>#' + (i + 1) + ' · ' + fmtHM(p.t) + (p.acc ? ' · ±' + p.acc + 'm' : '') +
          '<br><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + p.lat + ',' + p.lng + '">Mở Google Maps</a>');
        histMarkers.push(m);
      });

      map.fitBounds(ll, { padding: [40, 40], maxZoom: 17 });
      setTimeout(function () { map.invalidateSize(); }, 150);

      const km = total >= 1000 ? (total / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(total) + ' m';
      showInfo('📍 <b>' + esc(name) + '</b> · ' + dTxt + ' · ' + pts.length + ' điểm · từ ' + fmtHM(pts[0].t) +
        ' đến ' + fmtHM(pts[pts.length - 1].t) + ' · ≈ ' + km, 'var(--info)');

      listEl.style.display = 'block';
      listEl.innerHTML = pts.map(function (p, i) {
        return '<div data-i="' + i + '" style="display:flex;justify-content:space-between;gap:8px;padding:7px 10px;border-bottom:1px solid var(--bdr);font-size:12px;cursor:pointer">' +
          '<span><b>#' + (i + 1) + '</b> &nbsp;' + fmtHM(p.t) + (p.acc ? ' <span style="color:var(--muted)">±' + p.acc + 'm</span>' : '') + '</span>' +
          '<a target="_blank" rel="noopener" onclick="event.stopPropagation()" href="https://www.google.com/maps?q=' + p.lat + ',' + p.lng + '" style="font-weight:700">Maps</a>' +
          '</div>';
      }).join('');
      Array.prototype.forEach.call(listEl.querySelectorAll('[data-i]'), function (el) {
        el.onclick = function () {
          const i = Number(el.getAttribute('data-i'));
          const m = histMarkers[i];
          if (m) { map.setView(m.getLatLng(), 18); m.openPopup(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        };
      });
    }).catch(function () { showInfo('Không tải được bản đồ (kiểm tra mạng).', '#b91c1c'); });
  }

  function clearHistory() {
    histMode = false;
    histMarkers = [];
    if (histLayer) histLayer.clearLayers();
    if (map && layer && !map.hasLayer(layer)) layer.addTo(map);
    document.getElementById('locHistClear').style.display = 'none';
    document.getElementById('locHistList').style.display = 'none';
    showInfo('');
    fitted = false;
    loadLocations();
  }

  function startRefresh() { stopRefresh(); refreshTimer = setInterval(loadLocations, REFRESH_MS); }
  function stopRefresh() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }
  function onOpen() { fitted = false; loadLocations(); startRefresh(); }

  // ---------- 5) Gắn vào showPage ----------
  function wrapShowPage() {
    if (typeof showPage !== 'function' || showPage.__loc) return;
    const orig = showPage;
    const wrapped = function (name) {
      if (name === 'location' && !isAdmin()) return;
      const r = orig.apply(this, arguments);
      if (name === 'location') {
        const p = document.getElementById('pLocation');
        if (p) p.style.display = 'block';
        onOpen();
      } else {
        stopRefresh();
      }
      return r;
    };
    wrapped.__loc = true;
    window.showPage = wrapped;
  }

  // ---------- 6) Vòng kiểm tra đăng nhập / đăng xuất ----------
  setInterval(function () {
    wrapShowPage();
    if (isLoggedIn()) {
      if (isAdmin()) { buildUI(); stopTracking(); }
      else { startTracking(); }
      applyVisibility();
    } else {
      stopTracking();
      stopRefresh();
      applyVisibility();
    }
  }, 2000);
})();
function initApkNotifBtn() {
  const saved = localStorage.getItem("APK_NOTIF_STATE") || "ON";
  renderApkNotifBtn(saved);
  console.log("APK_NOTIF_TOGGLE|" + saved);
}

function toggleApkNotif() {
  const current = localStorage.getItem("APK_NOTIF_STATE") || "ON";
  const next = (current === "ON") ? "OFF" : "ON";
  localStorage.setItem("APK_NOTIF_STATE", next);
  renderApkNotifBtn(next);
  console.log("APK_NOTIF_TOGGLE|" + next);
}

function renderApkNotifBtn(state) {
  const btn = document.getElementById("btnToggleApkNotif");
  const icon = document.getElementById("iconApkNotif");
  const txt = document.getElementById("txtApkNotif");
  if (!btn || !icon || !txt) return;
  if (state === "ON") {
    btn.style.background = "#10b981";
    btn.style.borderColor = "#a7f3d0";
    icon.textContent = "🔔";
    txt.textContent = "ON";
  } else {
    btn.style.background = "rgba(0,0,0,0.35)";
    btn.style.borderColor = "rgba(255,255,255,0.3)";
    icon.textContent = "🔕";
    txt.textContent = "OFF";
  }
}
setTimeout(initApkNotifBtn, 1000);
