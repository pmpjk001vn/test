// js/gas-bridge.js — Cầu nối google.script.run -> Google Apps Script Web App
window.API_URL = "https://script.google.com/macros/s/AKfycbyAjYhKWFDp53RLiw8z4VhliJnXqeI4PLQC1kziqSzUTzRRieX4kGwojjUSCZLbub33Bg/exec";

(function () {
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

  // Tiện ích nạp các file module HTML (Thekho, ThongBao, Tracuu, Mascot) và chạy thẻ <script> bên trong
  window.loadHtmlModules = async function (urls) {
    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch(urls[i]);
        if (!res.ok) continue;
        const html = await res.text();
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        const scripts = [];
        Array.from(tmp.childNodes).forEach(function (node) {
          if (node.tagName === "SCRIPT") {
            scripts.push(node.textContent);
          } else {
            document.body.appendChild(node);
          }
        });
        scripts.forEach(function (code) {
          const s = document.createElement("script");
          s.textContent = code;
          document.body.appendChild(s);
        });
      } catch (e) {
        console.error("Lỗi nạp module:", urls[i], e);
      }
    }
  };
})();
