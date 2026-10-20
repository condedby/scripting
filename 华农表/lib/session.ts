/**
 * 华农课表 —— 登录与取数
 *
 * 链路（已实测）：
 *   1. 打开 cas.scau.edu.cn/lyuapServer/login?service=<正方 SSO>
 *   2. 若已在登录态 → 自动跳进教务系统；否则自动填表提交（失败再让用户手动登录）
 *   3. 进入正方教务后打开课表页：页面上只有「学年 / 学期」两个 select，**没有周次**
 *   4. 当前教学周去首页「我的课表」挂件里读 dqzc（备选：用「校历」的学期起止日期算）
 *   5. 在页面内 fetch 课表接口拿 kbList（⚠️ zs 必须留空，否则服务端会裁掉课程）
 *
 * 为什么要用 WebView：CAS 的 /v1/tickets 接口对密码有额外校验（明文会返回 PASSERROR），
 * 走真实登录页最稳；而且 WebView 的 cookie 仓是持久的，登录一次能维持很久。
 */

export const CAS_BASE = "https://cas.scau.edu.cn/lyuapServer"
export const JWZF_BASE = "https://jwzf.scau.edu.cn"
export const JWZF_SSO = `${JWZF_BASE}/sso/lyiotlogin`
export const JWZF_KB_PAGE = `${JWZF_BASE}/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default`
export const JWZF_KB_API = `${JWZF_BASE}/jwglxt/kbcx/xskbcx_cxXsKb.html?gnmkdm=N2151`
/** 首页「我的课表」挂件：隐藏域里有 xnm / xqm / dqzc(当前周) */
export const JWZF_HOME_AREA = `${JWZF_BASE}/jwglxt/xtgl/index_cxAreaOne.html`
/** 首页「校历」挂件：有「2026-2027学年1学期(2026-08-31至2027-01-17)」 */
export const JWZF_HOME_CALENDAR = `${JWZF_BASE}/jwglxt/xtgl/index_cxAreaFive.html`

const CAS_LOGIN_URL = `${CAS_BASE}/login?service=${encodeURIComponent(JWZF_SSO)}`

export interface FetchOptions {
  username?: string
  password?: string
  onProgress?: (message: string) => void
}

export interface FetchResult {
  raw: any
  manualLogin: boolean
  /** 当前教学周，0 = 没取到 */
  currentWeek: number
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

async function currentURL(wv: WebViewController): Promise<string> {
  try {
    const href = await wv.evaluateJavaScript<string>("return location.href")
    return href ?? ""
  } catch {
    return ""
  }
}

/** 页面是否要求验证码（要求的话自动填表没意义，交给用户） */
async function needsCaptcha(wv: WebViewController): Promise<boolean> {
  try {
    return await wv.evaluateJavaScript<boolean>(
      `return !!(document.querySelector('img[src*=kaptcha]') || document.querySelector('#kaptcha') || (document.body.innerText||'').indexOf('验证码') > -1)`
    )
  } catch {
    return false
  }
}

/** 页面是否真的渲染出了登录表单（比看地址栏可靠：CAS 首页是 SPA，登过也会先停在 cas 域） */
async function hasLoginForm(wv: WebViewController): Promise<boolean> {
  try {
    const q = "return !!(document.querySelector('#userName') && document.querySelector('#password') && document.querySelector('#password').offsetParent !== null)"
    return await wv.evaluateJavaScript<boolean>(q)
  } catch {
    return false
  }
}

/** 自动填账号密码并提交；返回是否成功点到提交 */
async function autoFillLogin(wv: WebViewController, username: string, password: string): Promise<boolean> {
  const js = `return (function(){
    var U=${JSON.stringify(username)}, P=${JSON.stringify(password)};
    var vis=[].slice.call(document.querySelectorAll('input')).filter(function(i){return i.offsetParent!==null && i.type!=='hidden'});
    var u=vis.filter(function(i){return i.type==='text'||i.type==='tel'})[0];
    var p=vis.filter(function(i){return i.type==='password'})[0];
    if(!u||!p) return false;
    function setVal(el,v){
      var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
      d.set.call(el,v);
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
    setVal(u,U); setVal(p,P);
    var all=[].slice.call(document.querySelectorAll('button')), btn=null;
    for(var i=0;i<all.length;i++){ if(/submit/i.test(String(all[i].className))){ btn=all[i]; break; } }
    if(!btn) for(var j=0;j<all.length;j++){ if(all[j].offsetParent!==null){ btn=all[j]; break; } }
    if(!btn) return false;
    btn.click();
    return true;
  })()`
  try {
    const ok = await wv.evaluateJavaScript<boolean>(js)
    return !!ok
  } catch {
    return false
  }
}

/** 等页面离开 CAS 登录页（= 登录成功并跳回教务系统） */
async function waitForJWZF(wv: WebViewController, seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds * 2; i++) {
    await sleep(500)
    const href = await currentURL(wv)
    if (href && href.indexOf("cas.scau.edu.cn") < 0 && href.indexOf("scau.edu.cn") > -1) return true
  }
  return false
}

/** 在页面里发同源请求（复用页面的 cookie / referer），失败给空串 */
async function pageRequest(wv: WebViewController, url: string, body = ""): Promise<string> {
  const js = `return fetch(${JSON.stringify(url)}, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','X-Requested-With':'XMLHttpRequest'}, body:${JSON.stringify(
    body
  )}}).then(function(r){return r.text()}).catch(function(){return ''})`
  try {
    return (await wv.evaluateJavaScript<string>(js)) ?? ""
  } catch {
    return ""
  }
}

/** 读某个元素的 value */
async function readValue(wv: WebViewController, id: string): Promise<string> {
  try {
    return (await wv.evaluateJavaScript<string>(`return (document.getElementById('${id}')||{}).value || ''`)) ?? ""
  } catch {
    return ""
  }
}

/** 页面上的 select 有时是异步填的，轮询等一会儿 */
async function pollValue(wv: WebViewController, id: string, tries: number): Promise<string> {
  for (let i = 0; i < tries; i++) {
    const v = await readValue(wv, id)
    if (v) return v
    await sleep(500)
  }
  return ""
}

/** 从一个 HTML 片段里抠出某个 name 的 input 的 value */
function inputValue(html: string, name: string): string {
  const tag = new RegExp("<input[^>]*" + name + "[^>]*>", "i").exec(html)
  if (!tag) return ""
  const v = /value=["']?([^"'\s>]*)/i.exec(tag[0])
  return v ? v[1] : ""
}

/** 开学日期算第几周（本地时区） */
function weekSince(startISO: string): number {
  const parts = startISO.split("-").map(n => parseInt(n, 10))
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return 0
  const start = new Date(parts[0], parts[1] - 1, parts[2])
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((today.getTime() - start.getTime()) / 86400000)
  if (days < 0 || days > 400) return 0
  return Math.floor(days / 7) + 1
}

/**
 * 退出登录：删掉 WebView 里所有华农（scau.edu.cn）的 cookie —— 登录态就存在这儿，
 * 不删的话“清除已保存的账号”之后照样能免登录读课表。其它站点的 cookie 不动。
 * @param webView 可选；不传就自己开一个（cookie 仓是共用的持久仓）
 * @returns 删掉的条数
 */
export async function logoutSession(webView?: WebViewController): Promise<number> {
  const wv = webView ?? new WebViewController()
  try {
    const all = await wv.getAllCookies()
    let removed = 0
    for (const c of all) {
      if (String(c.domain || "").indexOf("scau.edu.cn") < 0) continue
      if (await wv.deleteCookie({ name: c.name, domain: c.domain, path: c.path })) removed++
    }
    return removed
  } catch {
    return 0
  } finally {
    if (!webView) {
      try {
        wv.dispose()
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * 直接掉出登录页让用户手动登录（不想把密码存在本机时用）
 * @returns 是否登录成功（离开 CAS 回到教务系统）
 */
export async function openLoginPage(): Promise<boolean> {
  const wv = new WebViewController()
  try {
    await wv.loadURL(CAS_LOGIN_URL)
    await wv.waitForLoad()
    await wv.present({ navigationTitle: "登录统一身份认证" })
    return await waitForJWZF(wv, 10)
  } catch {
    return false
  } finally {
    try {
      wv.dispose()
    } catch {
      /* ignore */
    }
  }
}

/**
 * 打开 WebView 走完登录 → 取回课表原始 JSON + 当前教学周
 */
export async function fetchScheduleRaw(opts: FetchOptions = {}): Promise<FetchResult> {
  const report = (m: string) => opts.onProgress?.(m)
  const wv = new WebViewController()
  let manualLogin = false

  try {
    report("连接统一身份认证…")
    await wv.loadURL(CAS_LOGIN_URL)
    await wv.waitForLoad()

    // 先看是不是本来就登录着（CAS 首页是 SPA，单纯看地址栏会误判）
    let loggedIn = !(await hasLoginForm(wv)) && (await waitForJWZF(wv, 8))
    if (!loggedIn) {
      const captcha = await needsCaptcha(wv)
      if (captcha) report("该账号需要验证码，请手动登录")

      if (!captcha && opts.username && opts.password) {
        report("正在登录…")
        if (await autoFillLogin(wv, opts.username, opts.password)) {
          loggedIn = await waitForJWZF(wv, 25)
        }
      }

      if (!loggedIn) {
        manualLogin = true
        report("请在弹出的页面里登录，完成后下拉关闭")
        await wv.present({ navigationTitle: "登录统一身份认证" })
        loggedIn = await waitForJWZF(wv, 8)
      }
    }
    if (!loggedIn) throw new Error("登录没有完成，请重新运行脚本")

    report("读取课表…")
    await wv.loadURL(JWZF_KB_PAGE)
    await wv.waitForLoad()

    const href = await currentURL(wv)
    if (href.indexOf("login_slogin") > -1) throw new Error("登录状态失效，请重新运行脚本")

    // 课表页给出 学年 / 学期（有时是异步填的，轮询）
    let xnm = await pollValue(wv, "xnm", 8)
    let xqm = await pollValue(wv, "xqm", 8)

    // 首页挂件里同样有 学年 / 学期 / 当前周，一次拿全，也当作兜底
    report("读取当前周…")
    const home = await pageRequest(wv, JWZF_HOME_AREA)
    if (!xnm) xnm = inputValue(home, "xnm")
    if (!xqm) xqm = inputValue(home, "xqm")
    if (!xnm || !xqm) throw new Error("没有读出学年/学期，请稍后重试")

    // 校历挂件：学期起止日期。学期起始日要存进缓存，小组件才能本地推算周次
    const cal = await pageRequest(wv, JWZF_HOME_CALENDAR)
    const range = /(\d{4}-\d{2}-\d{2})\s*至\s*(\d{4}-\d{2}-\d{2})/.exec(cal)
    const termStart = range ? range[1] : ""

    let currentWeek = parseInt(inputValue(home, "dqzc"), 10)
    if (!(currentWeek > 0 && currentWeek < 40)) {
      currentWeek = termStart ? weekSince(termStart) : 0
    }

    // ⚠️ zs（周次）必须留空：实测传 zs=7 服务端只回 15 条，留空才拿到全学期 24 条
    const body = `xnm=${xnm}&xqm=${xqm}&zs=&doType=app`
    const text = await pageRequest(wv, JWZF_KB_API, body)

    if (!text || text.indexOf("kbList") < 0) {
      throw new Error("服务端没有返回课表数据（可能这学期还没排课）")
    }

    const parsed = JSON.parse(text)
    if (!parsed.zs) parsed.zs = String(currentWeek || "")
    if (termStart) parsed.termStart = termStart
    return { raw: parsed, manualLogin, currentWeek }
  } finally {
    try {
      wv.dispose()
    } catch {
      /* ignore */
    }
  }
}
