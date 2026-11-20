async function callApi(action, args = []) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, args }),
    redirect: "follow"
  });
  if (!res.ok) throw new Error("Lỗi kết nối máy chủ: " + res.status);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Lỗi xử lý dữ liệu");
  return json.data;
}
