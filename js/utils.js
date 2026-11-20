function bodau(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function formatMoney(num) {
  return (Number(num) || 0).toLocaleString("vi-VN");
}

function isDateInRange(dateStr, filterType, fromVal, toVal) {
  if (filterType === "all" || !dateStr) return true;
  let d;
  if (String(dateStr).includes("/")) {
    const p = String(dateStr).split(" ")[0].split("/");
    d = new Date(p[2], p[1] - 1, p[0]);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return true;
  d.setHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (filterType === "today") return d.getTime() === now.getTime();
  if (filterType === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return d.getTime() === y.getTime();
  }
  if (filterType === "7days") {
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    return d >= d7 && d <= now;
  }
  if (filterType === "thisMonth") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (filterType === "lastMonth") {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }
  if (filterType === "custom") {
    const f = fromVal ? new Date(fromVal) : null;
    const t = toVal ? new Date(toVal) : null;
    if (f) f.setHours(0, 0, 0, 0);
    if (t) t.setHours(23, 59, 59, 999);
    if (f && d < f) return false;
    if (t && d > t) return false;
  }
  return true;
}

function exportExcelRows(rows, fileName = "BaoCao_AnhDuong.xlsx") {
  if (!window.XLSX) return Swal.fire("Lỗi", "Chưa tải được thư viện XLSX", "error");
  const ws = XLSX.utils.json_to_sheet(rows || []);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, fileName);
}

function openModal(html) {
  const box = document.getElementById("modal-box");
  box.innerHTML = html;
  document.getElementById("modal-backdrop").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.getElementById("modal-box").innerHTML = "";
}

function printExportSlipA5(order, debt = 0) {
  const win = window.open("", "_blank", "width=650,height=850");
  const rows = (order.items || []).map((it, idx) => {
    const after = Number(it.price) * (1 - Number(it.ck || 0) / 100);
    return `<tr>
      <td style="text-align:center">${idx + 1}</td>
      <td><b>${it.name}</b>${it.note ? `<br><i style="font-size:11px">(${it.note})</i>` : ""}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${formatMoney(it.price)}</td>
      <td style="text-align:center">${it.ck || 0}%</td>
      <td style="text-align:right"><b>${formatMoney(after * it.qty)}</b></td>
    </tr>`;
  }).join("");

  win.document.write(`<html><head><title>Phiếu Xuất Kho - ${order.id}</title>
    <style>@page{size:A5 portrait;margin:8mm}body{font-family:Arial,sans-serif;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #333;padding:4px 6px}th{background:#f1f5f9}</style>
    </head><body onload="window.print();window.close();">
    <div style="text-align:center;border-bottom:1px dashed #333;padding-bottom:6px">
      <div style="font-weight:bold;font-size:14px">${COMPANY_INFO.name}</div>
      <div style="font-size:11px">ĐC: ${COMPANY_INFO.address} - ĐT: ${COMPANY_INFO.phone}</div>
      <h2 style="margin:6px 0 2px">PHIẾU XUẤT KHO</h2>
      <div>Mã phiếu: <b>${order.id}</b> | Ngày: ${order.date || ""}</div>
    </div>
    <div style="margin-top:8px">
      <div>Khách hàng: <b>${order.customerName}</b> - SĐT: ${order.phone || ""}</div>
      <div>Địa chỉ: ${order.address || ""} | Sale: <b>${order.saleName}</b></div>
    </div>
    <table><thead><tr><th width="28">STT</th><th>Tên Hàng Hóa</th><th width="38">SL</th><th width="68">Đơn Giá</th><th width="38">CK</th><th width="78">Thành Tiền</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:8px;text-align:right;line-height:1.6">
      <div>Tổng tiền hàng: <b>${formatMoney(order.totalAmount)} đ</b></div>
      <div>Công nợ cũ: <b>${formatMoney(debt)} đ</b></div>
      <div style="font-size:14px">Tổng cộng: <b>${formatMoney(Number(order.totalAmount) + Number(debt))} đ</b></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:20px;text-align:center">
      <div><b>Người lập phiếu</b><br><i style="font-size:11px">(Ký, họ tên)</i></div>
      <div><b>Thủ kho / Giao hàng</b><br><i style="font-size:11px">(Ký, họ tên)</i></div>
      <div><b>Khách hàng</b><br><i style="font-size:11px">(Ký, nhận đủ hàng)</i></div>
    </div>
    </body></html>`);
  win.document.close();
}

function buildInvoiceA5Html(inv, cfg = DEFAULT_INVOICE_CONFIG, excludeList = []) {
  const c = Object.assign({}, DEFAULT_INVOICE_CONFIG, cfg || {});
  const merged = [];
  (inv.items || []).forEach((it) => {
    const blocked = (excludeList || []).some((x) => bodau(x) === bodau(it.name));
    if (blocked) {
      merged.push(Object.assign({}, it));
    } else {
      const found = merged.find(
        (m) => m.name === it.name && Number(m.price) === Number(it.price) && Number(m.ck || 0) === Number(it.ck || 0)
      );
      if (found) {
        found.qty = Number(found.qty) + Number(it.qty);
        if (it.note && !String(found.note || "").includes(it.note)) {
          found.note = found.note ? `${found.note}; ${it.note}` : it.note;
        }
      } else {
        merged.push(Object.assign({}, it));
      }
    }
  });

  const rowsHtml = merged.map((it, i) => {
    const unit = Number(it.price) * (1 - Number(it.ck || 0) / 100);
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${it.name}${it.note ? ` <i style="font-size:${c.fontSize - 1}px">(${it.note})</i>` : ""}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${formatMoney(unit)}</td>
      <td style="text-align:right"><b>${formatMoney(unit * it.qty)}</b></td>
    </tr>`;
  }).join("");

  const sub = Number(inv.totalAmount || 0);
  const disc = Number(inv.directDiscount || 0);
  const oldD = Number(inv.oldDebt || 0);
  const paid = Number(inv.paidAmount || 0);
  const finalTot = sub - disc + oldD - paid;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page{size:A5 portrait;margin:${c.marginTop}mm ${c.marginLeft}mm}
    body{font-family:Arial,sans-serif;font-size:${c.fontSize}px;color:#111;margin:0;padding:8px}
    .inv-title{color:${c.headerColor};font-size:${c.fontSize + 5}px;font-weight:bold;text-align:center;margin:6px 0 2px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th,td{border:1px solid #444;padding:4px 5px}
    th{background:${c.headerColor}18;color:${c.headerColor}}
    .sum{margin-top:8px;float:right;width:65%}
    .sum div{display:flex;justify-content:space-between;padding:2px 0}
  </style></head><body>
    <div style="border-bottom:2px solid ${c.headerColor};padding-bottom:5px">
      <div style="font-weight:bold;font-size:${c.fontSize + 1}px;color:${c.headerColor}">${COMPANY_INFO.name}</div>
      <div style="font-size:${c.fontSize - 2}px">ĐC: ${COMPANY_INFO.address} | ĐT: ${COMPANY_INFO.phone}</div>
      <div style="font-size:${c.fontSize - 2}px;font-weight:bold">STK: ${COMPANY_INFO.bank}</div>
    </div>
    <div class="inv-title">${c.title}</div>
    <div style="text-align:center;font-size:${c.fontSize - 1}px;margin-bottom:6px">Số HĐ: <b>${inv.id}</b> — Ngày: ${inv.date || ""}</div>
    <div style="margin-bottom:6px;line-height:1.4">
      <div>Khách hàng: <b>${inv.customerName}</b> — SĐT: ${inv.phone || ""}</div>
      <div>Địa chỉ: ${inv.address || ""} | Sale: <b>${inv.saleName || ""}</b></div>
    </div>
    <table><thead><tr><th width="26">STT</th><th>${c.colName}</th><th width="36">${c.colQty}</th><th width="68">${c.colPrice}</th><th width="78">${c.colTotal}</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <div class="sum">
      <div><span>Tiền hàng:</span><b>${formatMoney(sub)} đ</b></div>
      ${disc > 0 ? `<div><span>Trừ chiết khấu:</span><b>-${formatMoney(disc)} đ</b></div>` : ""}
      <div><span>Nợ cũ:</span><b>${formatMoney(oldD)} đ</b></div>
      ${paid > 0 ? `<div><span>Thanh toán trước:</span><b>-${formatMoney(paid)} đ</b></div>` : ""}
      <div style="border-top:1px solid #333;margin-top:3px;padding-top:3px;font-size:${c.fontSize + 2}px;color:${c.headerColor}"><span>TỔNG CỘNG TOA:</span><b>${formatMoney(finalTot)} đ</b></div>
    </div>
    <div style="clear:both"></div>
    ${inv.adminNote ? `<div style="margin-top:8px;padding:6px;border:1px dashed #666;font-size:${c.fontSize - 1}px"><b>Ghi chú:</b> ${inv.adminNote}</div>` : ""}
    <div style="font-style:italic;font-size:${c.fontSize - 2}px;margin-top:8px">${c.footerNote}</div>
    <div style="display:flex;justify-content:space-between;text-align:center;margin-top:16px">
      <div><b>Người lập phiếu</b><br><i style="font-size:10px">(Ký, ghi rõ họ tên)</i></div>
      <div><b>Người giao hàng</b><br><i style="font-size:10px">(Ký, ghi rõ họ tên)</i></div>
      <div><b>Khách hàng</b><br><i style="font-size:10px">(Ký, nhận đủ hàng)</i></div>
    </div>
  </body></html>`;
}

function printInvoiceA5(inv, cfg, excludeList) {
  const html = buildInvoiceA5Html(inv, cfg, excludeList);
  const win = window.open("", "_blank", "width=650,height=850");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}
