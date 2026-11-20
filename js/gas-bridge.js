// js/gas-bridge.js — Cầu nối google.script.run -> Google Apps Script Web App
window.API_URL = "https://script.google.com/macros/s/AKfycbyAjYhKWFDp53RLiw8z4VhliJnXqeI4PLQC1kziqSzUTzRRieX4kGwojjUSCZLbub33Bg/exec";

(function () {
  const CACHE_KEY_DATA = "ad_fast_cache_getDataForApp";

  function createRunner(successCb, failureCb) {
    return new Proxy({}, {
      get: function (_, prop) {
        if (prop === "withSuccessHandler") {
          return function (fn) { return createRunner(fn, failureCb); };
        }
        if (prop === "withFailureHandler") {
          return function (fn) { return createRunner(successCb, fn); };
        }
        return function () {
          const args = Array.prototype.slice.call(arguments);

          // 1. INSTANT CACHE: Trả ngay dữ liệu cũ cho getDataForApp để web mở tức thì
          if (prop === "getDataForApp" && typeof successCb === "function") {
            try {
              const cached = localStorage.getItem(CACHE_KEY_DATA);
              if (cached) {
                setTimeout(() => successCb(JSON.parse(cached)), 0);
              }
            } catch (e) {}
          }

          // 2. Gọi API thật chạy ngầm để cập nhật số liệu mới nhất
          fetch(window.API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: prop, args: args }),
            redirect: "follow"
          })
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(function (json) {
            if (json && json.success) {
              if (prop === "getDataForApp") {
                try { localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(json.data)); } catch (e) {}
              }
              if (typeof successCb === "function") successCb(json.data);
            } else {
              const err = new Error((json && json.error) || "Lỗi xử lý máy chủ");
              if (typeof failureCb === "function") failureCb(err);
              else console.error("[GAS Bridge]", prop, err);
            }
          })
          .catch(function (err) {
            if (typeof failureCb === "function") failureCb(err);
            else console.error("[GAS Bridge]", prop, err);
          });
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createRunner(null, null);

  // Tải song song toàn bộ các module HTML thay vì chờ từng file
  window.loadHtmlModules = async function (urls) {
    const results = await Promise.all(
      urls.map(u => fetch(u).then(r => r.ok ? r.text() : "").catch(() => ""))
    );
    results.forEach(function (html) {
      if (!html) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const scripts = [];
      Array.from(tmp.childNodes).forEach(function (node) {
        if (node.tagName === "SCRIPT") scripts.push(node.textContent);
        else document.body.appendChild(node);
      });
      scripts.forEach(function (code) {
        const s = document.createElement("script");
        s.textContent = code;
        document.body.appendChild(s);
      });
    });
  };
})();
