// 移动余量 · Clash 模块脚本 v6
// 目标：把「App 查询余量/话费时发的那份请求」原样抄下来（正文 + 头），供脚本重放。
//   http-request  → 记录 Cookie；autoLogin 存正文；业务查询接口存正文 + 请求头
//   http-response → 业务接口存响应正文
//   https://example.com/cmcc-read-8f3a → 回 JSON
//   面板 → 状态
// 带 x-cc-probe: 1 的请求会被忽略（防覆盖）。

const K_CRED = "cmcc.autoLogin";
const K_AT = "cmcc.autoLogin.at";
const K_COOKIE = "cmcc.cookie";
const K_COOKIE_INFO = "cmcc.cookie.at";
const K_REQ = "cmcc.req";
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
function nowText() { return new Date().toLocaleString("zh-CN", { hour12: false }) }

const hasReq = typeof $request !== "undefined" && $request && $request.url;
const hasRsp = typeof $response !== "undefined" && $response;
const url = hasReq ? String($request.url) : "";
const probe = hasReq && !!($request.headers && ($request.headers["x-cc-probe"] || $request.headers["X-Cc-Probe"]));
const hit = WATCH.filter((n) => url.indexOf(n) >= 0)[0];

if (hasRsp) {
  if (!probe && hit) {
    const body = typeof $response.body === "string" ? $response.body : "";
    const map = json(K_RSP, {});
    map[hit] = { at: nowText(), body: body.slice(0, 20000) };
    write(JSON.stringify(map), K_RSP);
    console.log("cmcc: rsp " + hit + " [" + body.length + "]");
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
        req: json(K_REQ, {}),
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
      write(nowText() + " " + url.replace(/^https:\/\//, "").split("/")[0], K_COOKIE_INFO);
    }
    if (url.indexOf("/autoLogin") >= 0 && body.length > 20) {
      write(body, K_CRED);
      write(nowText(), K_AT);
      $notification.post("移动余量", "已抓到登录凭证", body.length + " 字符");
    } else if (hit && body.length > 20) {
      const map = json(K_REQ, {});
      map[hit] = {
        at: nowText(),
        url: url,
        body: body,
        headers: ($request.headers || {}),
      };
      write(JSON.stringify(map), K_REQ);
      console.log("cmcc: req " + hit);
    }
  }
  $done({});
}
