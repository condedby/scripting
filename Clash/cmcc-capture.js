// 移动余量 · Clash 模块脚本 v3（Clash for Apple Platforms 用）
//
// 1) 「中国移动」App 打到 client.app.coc.10086.cn / clientaccess.10086.cn 的请求：
//    全部记到 $persistentStore；其中 autoLogin 的正文单独存下来当长期凭证。
// 2) 读回：
//    https://example.com/cmcc-read-8f3a  → JSON { credLength, at, seen, cred }
//    https://example.com/cmcc-read-raw   → 纯文本凭证（就是 autoLogin 的请求体）
// 3) 面板刷新 → 显示抓没抓到

const KEY_CRED = "cmcc.autoLogin";
const KEY_AT = "cmcc.autoLogin.at";
const KEY_SEEN = "cmcc.seen";
const READ_JSON = "/cmcc-read-8f3a";
const READ_RAW = "/cmcc-read-raw";

function read(k) {
  try {
    const v = $persistentStore.read(k);
    return v == null ? "" : String(v);
  } catch (e) {
    return "";
  }
}

function write(v, k) {
  try {
    $persistentStore.write(String(v), k);
  } catch (e) {}
}

function seenList() {
  try {
    const a = JSON.parse(read(KEY_SEEN) || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

const hasRequest = typeof $request !== "undefined" && $request && $request.url;
const url = hasRequest ? String($request.url) : "";

if (!hasRequest) {
  // 面板脚本
  const cred = read(KEY_CRED);
  $done({
    title: "移动凭证",
    content: cred
      ? "已抓到 " + cred.length + " 字符\n" + (read(KEY_AT) || "")
      : "还没抓到\n" + (seenList().slice(-3).join("\n") || "还没看到任何请求"),
  });
} else if (url.indexOf(READ_JSON) >= 0) {
  const cred = read(KEY_CRED);
  $done({
    response: {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        credLength: cred ? cred.length : 0,
        at: read(KEY_AT),
        seen: seenList(),
        cred: cred,
      }),
    },
  });
} else if (url.indexOf(READ_RAW) >= 0) {
  const cred = read(KEY_CRED);
  $done({
    response: {
      status: cred ? 200 : 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: cred || "EMPTY",
    },
  });
} else {
  // 记录 + 抓取
  const body = typeof $request.body === "string" ? $request.body : "";
  const line = String($request.method || "POST") + " " + url.replace(/^https:\/\//, "") + " [" + body.length + "]";
  const seen = seenList();
  seen.push(line);
  write(JSON.stringify(seen.slice(-20)), KEY_SEEN);
  console.log("cmcc: " + line);

  if (url.indexOf("/autoLogin") >= 0 && body.length > 20) {
    write(body, KEY_CRED);
    write(new Date().toLocaleString("zh-CN", { hour12: false }), KEY_AT);
    $notification.post("移动余量", "已抓到登录凭证", body.length + " 字符");
  }
  $done({});
}
