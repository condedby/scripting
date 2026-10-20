/** 华农课表 —— 设置页 */
import {
  Button,
  HStack,
  List,
  Navigation,
  NavigationStack,
  Section,
  SecureField,
  Text,
  TextField,
  Toggle,
  Toolbar,
  ToolbarItem,
  VStack,
  useState,
} from "scripting"
import { logoutSession, openLoginPage } from "../lib/session"
import { type WeekStart } from "../lib/model"
import {
  clearCache,
  forgetCredentials,
  loadSettings,
  saveAccount,
  saveShowTime,
  saveWeekStart,
  type Settings,
} from "../lib/store"

const BODY = { name: ".AppleSystemUIFont", size: 15 }
const NOTE = { name: ".AppleSystemUIFont", size: 12 }


/** 说明（设置页右上角「i」打开） */
function InfoView() {
  const dismiss = Navigation.useDismiss()
  const paras = [
    "课表来自华南农业大学正方教务系统，用你自己的学号密码登录后读取。",
    "设置里的每一处改动都会立即保存，下次进来看到的就是最新值；不需要点「保存」。",
    "主屏幕小组件：小号显示今天（今天的课上完就显示**第二天**）的课，中号是单行版，大号是一整周课表，今天那一列用红色空心框标出；锁屏小组件（两格）显示下一节课。小组件读的是本机缓存的课表，周次按日期自己算，页面不用常开；想更新课表就打开一次脚本（或点小组件）。",
    "勾选「记住密码」时，密码保存在系统钥匙串；不勾选就只保留学号。",
    "登录后的会话保存在系统的网页组件里，所以登录一次能维持较长时间。要彻底退出来，用设置里的「退出登录」——它会删掉本机里华农的登录凭据（不影响其它网站）。",
    "本脚本与学校官方无关，仅供个人学习查询使用。",
  ]
  return (
    <NavigationStack>
      <List
        navigationTitle="说明"
        navigationBarTitleDisplayMode="inline"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="topBarLeading">
              <Button title="关闭" action={dismiss} />
            </ToolbarItem>
          </Toolbar>
        }
      >
        <Section>
          {paras.map((t, i) => (
            <Text key={"p" + i} font={{ name: ".AppleSystemUIFont", size: 14 }} foregroundStyle="secondaryLabel">
              {t}
            </Text>
          ))}
        </Section>
      </List>
    </NavigationStack>
  )
}

export function SettingsView({
  onLogin,
  onChanged,
}: {
  onLogin: (username: string, password: string) => void
  onChanged?: () => void
}) {
  const dismiss = Navigation.useDismiss()
  // 只在首次挂载时读一次本地存储（含钥匙串），之后由本地 state 与「即时落盘」保持一致。
  // （原来在每次渲染里 loadSettings()，既浪费又会读到旧值，容易掩盖没落盘的问题）
  const [initial] = useState<Settings>(() => loadSettings())
  const [username, setUsername] = useState(initial.username)
  const [password, setPassword] = useState(initial.password)
  const [remember, setRemember] = useState(initial.remember)
  const [showTime, setShowTime] = useState(initial.showTime)
  const [weekStart, setWeekStart] = useState<WeekStart>(initial.weekStart)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [note, setNote] = useState("")

  /**
   * 即时落盘：每一处编辑都立刻写进本地存储。
   *
   * 之前只有点「保存并获取课表」才调用 saveAccount，改完直接关闭设置页 → 什么都没写，
   * 重新进来 loadSettings() 读回的还是初始值（这就是「改完退出再进又变回初始值」的根因）。
   */
  function persistAccount(u: string, r: boolean, p: string) {
    saveAccount(u, r, p)
  }

  function changeUsername(v: string) {
    setUsername(v)
    persistAccount(v, remember, password)
  }

  function changePassword(v: string) {
    setPassword(v)
    // 勾了「记住密码」才写进钥匙串；没勾就顺手把钥匙串里的旧值删掉
    persistAccount(username, remember, v)
  }

  function changeRemember(v: boolean) {
    setRemember(v)
    persistAccount(username, v, password)
    setNote(v ? "已开启「记住密码」，密码已写入系统钥匙串" : "已关闭「记住密码」，钥匙串里的密码已删除")
  }

  function changeShowTime(v: boolean) {
    setShowTime(v)
    saveShowTime(v)
    onChanged?.()
  }

  /** 每周从周日开始（关掉 = 周一开头）——主页面和小组件都跟着变 */
  function changeWeekStart(sunFirst: boolean) {
    const v: WeekStart = sunFirst ? 0 : 1
    setWeekStart(v)
    saveWeekStart(v)
    onChanged?.()
  }

  /** 关闭设置页：先让主页面重新读一次设置（如「显示上下课时间」），再退出 */
  function close() {
    onChanged?.()
    dismiss()
  }

  function doLogin() {
    const u = username.trim()
    saveAccount(u, remember, password)
    onLogin(u, password)
    dismiss()
  }

  /** 不保存密码，直接打开网页登录；成功后顺手取一次课表 */
  async function doManualLogin() {
    setNote("已打开登录页，完成后下拉关闭…")
    const ok = await openLoginPage()
    if (ok) {
      setNote("手动登录成功，正在读取课表…")
      onLogin("", "")
    } else {
      setNote("没有检测到登录完成，可以再试一次")
    }
  }

  /** 真正的退出登录：账号 + 课表缓存 + WebView 里的华农 cookie */
  async function doLogout() {
    forgetCredentials()
    clearCache()
    const removed = await logoutSession()
    setUsername("")
    setPassword("")
    setRemember(false)
    setConfirmLogout(false)
    setNote(`已退出登录：账号已删除，并清除了 ${removed} 条登录凭据`)
    onChanged?.()
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="设置"
        navigationBarTitleDisplayMode="inline"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="topBarLeading">
              <Button title="关闭" action={close} />
            </ToolbarItem>
            <ToolbarItem placement="topBarTrailing">
              <Button title="说明" systemImage="info.circle" action={() => void Navigation.present(<InfoView />)} />
            </ToolbarItem>
          </Toolbar>
        }
      >
        <Section title="账号（华南农业大学统一身份认证）">
          <HStack spacing={8}>
            <Text font={BODY} frame={{ width: 56 }} foregroundStyle="secondaryLabel">
              学号
            </Text>
            <TextField
              title=""
              prompt="请输入学号"
              value={username}
              onChanged={changeUsername}
              frame={{ maxWidth: "infinity" }}
            />
          </HStack>
          <HStack spacing={8}>
            <Text font={BODY} frame={{ width: 56 }} foregroundStyle="secondaryLabel">
              密码
            </Text>
            <SecureField
              title=""
              prompt="请输入密码"
              value={password}
              onChanged={changePassword}
              frame={{ maxWidth: "infinity" }}
            />
          </HStack>
          <Toggle title="记住密码" value={remember} onChanged={changeRemember} />
          <Text font={NOTE} foregroundStyle="secondaryLabel">
            {remember
              ? "改动会自动保存。「记住密码」已开启，密码存在系统钥匙串里。"
              : "改动会自动保存。「记住密码」未开启，只保存学号，密码不会写进钥匙串。"}
          </Text>
          <Button title="保存并获取课表" action={doLogin} />
          <Button title="手动登录（打开网页）" action={() => void doManualLogin()} />
        </Section>

        <Section title="显示">
          <Toggle
            title="在课表格子里显示上下课时间"
            value={showTime}
            onChanged={changeShowTime}
          />
          <Toggle
            title="每周从周日开始"
            value={weekStart === 0}
            onChanged={changeWeekStart}
          />
          <Text font={NOTE} foregroundStyle="secondaryLabel">
            课表与小组件的第一列就是周日。关掉就恢复成周一开头（周次编号仍是学校口径，不受影响）。
          </Text>
        </Section>

        <Section title="数据">
          <Button
            title="清除课表缓存（保留登录状态）"
            action={() => {
              clearCache()
              setNote("课表缓存已清除（登录状态不变）")
              onChanged?.()
            }}
          />
          <Button
            title={confirmLogout ? "再点一次确认退出登录" : "退出登录（清账号、清缓存并下线）"}
            action={() => {
              if (!confirmLogout) {
                setConfirmLogout(true)
                setNote("退出登录会删除保存的账号，并让本机的登录状态失效")
                return
              }
              void doLogout()
            }}
          />
          {note ? (
            <Text font={NOTE} foregroundStyle="secondaryLabel">
              {note}
            </Text>
          ) : null}
        </Section>

      </List>
    </NavigationStack>
  )
}
