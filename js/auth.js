function saveAuthSession(userObj, keep7Days) {
  if (!keep7Days) {
    localStorage.removeItem("ad_session_v2");
    return;
  }
  localStorage.setItem("ad_session_v2", JSON.stringify({
    user: userObj,
    exp: Date.now() + 7 * 24 * 3600 * 1000
  }));
}

function clearAuthSession() {
  localStorage.removeItem("ad_session_v2");
}

async function initAuth(onAuthenticated) {
  const params = new URLSearchParams(window.location.search);
  const uParam = params.get("u");
  const pParam = params.get("p");

  if (uParam && pParam) {
    window.history.replaceState({}, document.title, window.location.pathname);
    const res = await callApi("checkLogin", [uParam, pParam]);
    if (res && res.success) {
      saveAuthSession(res, true);
      return onAuthenticated(res);
    }
  }

  const savedRaw = localStorage.getItem("ad_session_v2");
  if (savedRaw) {
    try {
      const saved = JSON.parse(savedRaw);
      if (saved && saved.exp > Date.now() && saved.user && saved.user.token) {
        const check = await callApi("checkToken", [saved.user.token]);
        if (check && check.success) {
          return onAuthenticated(Object.assign({}, saved.user, check));
        }
      }
    } catch (e) {}
    clearAuthSession();
  }
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const u = document.getElementById("login-user").value.trim();
  const p = document.getElementById("login-pass").value.trim();
  const keep = document.getElementById("login-remember").checked;
  const btn = document.getElementById("login-btn");

  btn.disabled = true;
  btn.textContent = "Đang đăng nhập...";
  try {
    const res = await callApi("checkLogin", [u, p]);
    if (!res || !res.success) {
      Swal.fire("Đăng nhập thất bại", res?.message || "Sai tài khoản hoặc mật khẩu", "error");
      return;
    }
    saveAuthSession(res, keep);
    startApp(res);
  } catch (err) {
    Swal.fire("Lỗi kết nối", err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Đăng Nhập Hệ Thống";
  }
});
