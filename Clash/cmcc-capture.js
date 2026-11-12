// 移动余量 · Clash 模块脚本（Clash for Apple Platforms 用）
//
// 一个文件干三件事，靠触发方式区分：
//   1) 抓到「中国移动 App」的 autoLogin 请求体 → 存进 $persistentStore
//   2) 谁访问 https://example.com/cmcc-read-8f3a → 把存的内容原样回给它
//   3) 面板刷新 → 显示抓没抓到（可选）
//
// 依赖：模块里那条 [Script] 要写 requires-body=true，否则拿不到正文。

const KEY = "cmcc.autoLogin";
const AT = "cmcc.autoLogin.at";
const READ_PATH = "/cmcc-read-8f3a";

function read(key) {
  try {
    const v = $persistentStore.read(key);
    return v == null ? "" : String(v);
  } catch (e) {
    return "";
  }
}

function write(value, key) {
  try {
    $persistentStore.write(String(value), key);
  } catch (e) {}
}

const hasRequest = typeof $request !== "undefined" && $request && $request.url;
const url = hasRequest ? String($request.url) : "";

if (!hasRequest) {
  // 面板脚本
  const body = read(KEY);
  $done({
    title: "移动凭证",
    content: body
      ? "已抓到 " + body.length + " 字符\n" + (read(AT) || "")
      : "还没有抓到\n去打开一次「中国移动」App 并登录",
  });
} else if (url.indexOf("/uamrandcodelogin/autoLogin") >= 0) {
  // 抓取
  const body = typeof $request.body === "string" ? $request.body : "";
  if (body.length > 20) {
    write(body, KEY);
    write(new Date().toLocaleString("zh-CN", { hour12: false }), AT);
    $notification.post("移动余量", "已抓到登录凭证", body.length + " 字符");
    console.log("cmcc: captured " + body.length);
  } else {
    console.log("cmcc: autoLogin body empty (missing requires-body?)");
  }
  $done({});
} else if (url.indexOf(READ_PATH) >= 0) {
  // 读回
  const body = read(KEY);
  $done({
    response: {
      status: body ? 200 : 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: body || "EMPTY",
    },
  });
} else {
  $done({});
}
