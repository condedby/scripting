// 移动余量 · Clash 模块脚本 v5
// 目的：把「中国移动 App 当前这一个会话」悄悄抄给脚本用。
//   http-request  → 记录任何 10086 请求的 Cookie（最新的那份）+ autoLogin 正文/请求头
//   http-response → autoLogin 存响应头；业务接口存响应正文
//   https://example.com/cmcc-read-8f3a → 回 JSON
//   面板 → 显示状态
// 自测请求（带 x-cc-probe: 1 头）不会被记录，避免覆盖 App 的真实数据。

const K_CRED = "cmcc.autoLogin";
const K_AT = "cmcc.autoLogin.at";
const K_COOKIE = "cmcc.cookie";
const K_COOKIE_INFO = "cmcc.cookie.at";
const K_RSPH = "cmcc.autoLogin.rspHeaders";
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
const probe = hasReq && !!($request.headers && ($request.headers["x-cc-probe"] || $request.headers["X-Cc-Probe"]));

if (hasRsp) {
  if (!probe) {
    const u = hasReq ? url : "";
    if (u.indexOf("/autoLogin") >= 0) {
      try { write(JSON.stringify({ status: $response.status || 0, headers: $response.headers || {} }), K_RSPH) } catch (e) {}
      console.log("cmcc: rsp autoLogin");
    } else {
      const hit = WATCH.filter((n) => u.indexOf(n) >= 0)[0];
      if (hit) {
        const body = typeof $response.body === "string" ? $response.body : "";
        const map = json(K_RSP, {});
        map[hit] = { at: new Date().toLocaleString("zh-CN", { hour12: false }), body: body.slice(0, 20000) };
        write(JSON.stringify(map), K_RSP);
        console.log("cmcc: rsp " + hit + " [" + body.length + "]");
      }
    }
  }
  $done({});
} else if (!hasReq) {
  const cookie = read(K_COOKIE);
  $done({
    title: "移动会话",
    content: cookie ? "已有会话\n" + (read(K_COOKIE_INFO) || "") : "还没抓到会话",
  });
} else if (url.indexOf(READ) >= 0) {
  const cred = read(K_CRED);
  $done({
    response: {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        credLength: cred.length,
        at: read(K_AT),
        cred: cred,
        cookie: read(K_COOKIE),
        cookieAt: read(K_COOKIE_INFO),
        rspHeaders: read(K_RSPH),
        seen: json(K_SEEN, []),
        rsp: json(K_RSP, {}),
      }),
    },
  });
} else {
  const body = typeof $request.body === "string" ? $request.body : "";
  if (!probe) {
    const line = String($request.method || "POST") + " " + url.replace(/^https:\/\//, "") + " [" + body.length + "]";
    const seen = json(K_SEEN, []);
    seen.push(line);
    write(JSON.stringify(seen.slice(-20)), K_SEEN);
    console.log("cmcc: " + line);

    const ck = ($request.headers && ($request.headers["cookie"] || $request.headers["Cookie"])) || "";
    if (ck) {
      write(String(ck), K_COOKIE);
      write(new Date().toLocaleString("zh-CN", { hour12: false }) + " " + url.replace(/^https:\/\//, "").split("/")[0], K_COOKIE_INFO);
    }
    if (url.indexOf("/autoLogin") >= 0 && body.length > 20) {
      write(body, K_CRED);
      write(new Date().toLocaleString("zh-CN", { hour12: false }), K_AT);
      try { write(JSON.stringify($request.headers || {}), "cmcc.autoLogin.headers") } catch (e) {}
      $notification.post("移动余量", "已抓到登录凭证", body.length + " 字符");
    }
  }
  $done({});
}
