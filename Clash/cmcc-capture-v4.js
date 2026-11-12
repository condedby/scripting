// 移动余量 · Clash 模块脚本 v4（Clash for Apple Platforms 用）
//
// 触发方式不同，做的事不同：
//   请求阶段（10086 两个域）：全部记 URL；autoLogin 额外存正文 + 请求头
//   响应阶段（同样两个域，只挑几个业务接口）：把响应正文原样存下来（还是密文，交给脚本解）
//   读回（https://example.com/cmcc-read-8f3a）：回一段 JSON
//   面板：显示抓没抓到

const K_CRED = "cmcc.autoLogin";
const K_AT = "cmcc.autoLogin.at";
const K_HDR = "cmcc.autoLogin.headers";
const K_SEEN = "cmcc.seen";
const K_RSP = "cmcc.rsp";
const READ = "/cmcc-read-8f3a";
const WATCH = ["getNewPlanRemainQry", "getPayFeesQueryInfo", "getScoreQuery", "getRealFee", "getUserInformation"];

function read(k) {
  try { const v = $persistentStore.read(k); return v == null ? "" : String(v) } catch (e) { return "" }
}
function write(v, k) {
  try { $persistentStore.write(String(v), k) } catch (e) {}
}
function json(k, fallback) {
  try { const v = JSON.parse(read(k) || ""); return v == null ? fallback : v } catch (e) { return fallback }
}

const hasReq = typeof $request !== "undefined" && $request && $request.url;
const hasRsp = typeof $response !== "undefined" && $response;
const url = hasReq ? String($request.url) : "";

if (hasRsp) {
  // ── 响应阶段：把业务接口的密文正文存下来 ──
  const u = hasReq ? url : "";
  const hit = WATCH.filter((n) => u.indexOf(n) >= 0)[0];
  if (hit) {
    const body = typeof $response.body === "string" ? $response.body : "";
    const map = json(K_RSP, {});
    map[hit] = { at: new Date().toLocaleString("zh-CN", { hour12: false }), body: body.slice(0, 20000) };
    write(JSON.stringify(map), K_RSP);
    console.log("cmcc: rsp " + hit + " [" + body.length + "]");
  }
  $done({});
} else if (!hasReq) {
  // ── 面板 ──
  const cred = read(K_CRED);
  $done({
    title: "移动凭证",
    content: cred ? "已抓到 " + cred.length + " 字符\n" + (read(K_AT) || "") : "还没抓到",
  });
} else if (url.indexOf(READ) >= 0) {
  // ── 读回 ──
  const cred = read(K_CRED);
  $done({
    response: {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        credLength: cred.length,
        at: read(K_AT),
        cred: cred,
        headers: read(K_HDR),
        seen: json(K_SEEN, []),
        rsp: json(K_RSP, {}),
      }),
    },
  });
} else {
  // ── 请求阶段 ──
  const body = typeof $request.body === "string" ? $request.body : "";
  const line = String($request.method || "POST") + " " + url.replace(/^https:\/\//, "") + " [" + body.length + "]";
  const seen = json(K_SEEN, []);
  seen.push(line);
  write(JSON.stringify(seen.slice(-20)), K_SEEN);
  console.log("cmcc: " + line);

  if (url.indexOf("/autoLogin") >= 0 && body.length > 20) {
    write(body, K_CRED);
    write(new Date().toLocaleString("zh-CN", { hour12: false }), K_AT);
    try { write(JSON.stringify($request.headers || {}), K_HDR) } catch (e) {}
    $notification.post("移动余量", "已抓到登录凭证", body.length + " 字符");
  }
  $done({});
}
