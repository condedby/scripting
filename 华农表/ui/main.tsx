/** 华农课表 —— 主页面（周课表，马卡龙风格） */
import {
  Button,
  HStack,
  Image,
  Menu,
  Navigation,
  NavigationStack,
  RoundedRectangle,
  ProgressView,
  ScrollView,
  Spacer,
  Text,
  VStack,
  Widget,
  useEffect,
  useState,
} from "scripting"
import {
  INK,
  MUTED,
  PILL,
  colorForCourse,
  deepForCourse,
  parseSchedule,
  periodTime,
  shortRoom,
  termLabel,
  type CourseEvent,
  type ScheduleData,
} from "../lib/model"
import { fetchScheduleRaw } from "../lib/session"
import { loadCache, loadSettings, saveCache, type Settings } from "../lib/store"
import { ACCENT, buildWidgetModel, midnight, shortName, weekMonday, weekWindow } from "../lib/widget"
import { CourseDetailView } from "./course"
import { SettingsView } from "./settings"

const ROW_H = 52
const GAP = 3
const GUTTER = 34

const WD_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
const EMPTY = "rgba(120,120,128,0.06)"
const RED = "#FF3B30"
const R_PILL = { type: "rect", cornerRadius: 9 } as any
const R_CARD = { type: "rect", cornerRadius: 16 } as any
const R_BLOCK = { type: "rect", cornerRadius: 10 } as any

/** 白底圆角卡片（提示 / 登录 / 今日课程） */
function Card({ children }: { children: any }) {
  return (
    <VStack
      spacing={8}
      alignment="leading"
      padding={14}
      frame={{ maxWidth: "infinity" }}
      background="secondarySystemGroupedBackground"
      clipShape={R_CARD}
    >
      {children}
    </VStack>
  )
}

/** 顶部的白色小胶囊（月份 / 周次 / 刷新 / 设置） */
function Capsule({ children, onTap }: { children: any; onTap?: () => void }) {
  return (
    <HStack
      spacing={4}
      padding={{ horizontal: 12, vertical: 7 }}
      background="secondarySystemGroupedBackground"
      clipShape={{ type: "rect", cornerRadius: 18 } as any}
      onTapGesture={onTap}
    >
      {children}
    </HStack>
  )
}

/** 深色教室胶囊 */
function RoomPill({ room }: { room: string }) {
  const text = shortRoom(room)
  if (!text) return null
  return (
    <HStack padding={{ horizontal: 5, vertical: 2 }} background={PILL as any} clipShape={R_PILL}>
      <Text font={9} fontWeight="bold" foregroundStyle={"white" as any} lineLimit={2} minScaleFactor={0.6}>
        {text}
      </Text>
    </HStack>
  )
}

function CourseBlock({
  event,
  span,
  dim,
  onPick,
}: {
  event: CourseEvent
  span: number
  dim: boolean
  onPick: (e: CourseEvent) => void
}) {
  const height = span * ROW_H + (span - 1) * GAP
  return (
    <VStack
      spacing={3}
      alignment="leading"
      padding={{ horizontal: 4, vertical: 5 }}
      frame={{ maxWidth: "infinity", height }}
      background={colorForCourse(event.name) as any}
      clipShape={R_BLOCK}
      opacity={dim ? 0.4 : 1}
      onTapGesture={() => onPick(event)}
    >
      <Text font={11} fontWeight="heavy" foregroundStyle={INK as any} lineLimit={span >= 3 ? 6 : 3} minScaleFactor={0.7}>
        {shortName(event.name)}
      </Text>
      <RoomPill room={event.room} />
      {span >= 2 && event.teacher ? (
        <Text font={9} foregroundStyle={MUTED as any} lineLimit={2} minScaleFactor={0.7}>
          {event.teacher}
        </Text>
      ) : null}
      <Spacer />
    </VStack>
  )
}

function DayColumn({
  events,
  maxSession,
  isToday,
  isDone,
  onPick,
}: {
  events: CourseEvent[]
  maxSession: number
  isToday: boolean
  isDone: (e: CourseEvent) => boolean
  onPick: (e: CourseEvent) => void
}) {
  const cells: any[] = []
  let s = 1
  while (s <= maxSession) {
    const hit = events.find(e => e.start === s)
    if (hit) {
      const end = Math.min(hit.end, maxSession)
      cells.push(<CourseBlock key={hit.key} event={hit} span={end - s + 1} dim={isDone(hit)} onPick={onPick} />)
      s = end + 1
    } else {
      cells.push(
        <VStack
          key={"gap" + s}
          frame={{ maxWidth: "infinity", height: ROW_H }}
          background={EMPTY as any}
          clipShape={{ type: "rect", cornerRadius: 8 } as any}
        />
      )
      s++
    }
  }
  return (
    <VStack
      spacing={GAP}
      frame={{ maxWidth: "infinity" }}
      overlay={isToday ? <RoundedRectangle cornerRadius={11} stroke={RED as any} /> : undefined}
    >
      {cells}
    </VStack>
  )
}

export function MainView() {
  const [settings, setSettings] = useState<Settings>(loadSettings())
  const [data, setData] = useState<ScheduleData | null>(loadCache())
  const [week, setWeek] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")

  const currentWeek = data?.currentWeek || 0
  const curWeek = week || currentWeek || 1

  async function refresh(creds?: { username: string; password: string }) {
    const username = creds ? creds.username : settings.username
    const password = creds ? creds.password : settings.password
    // 退出登录 / 从没填过账号时，刷新不再“偷偷”去读课表（登录态在 WebView 的 cookie 里，
    // 只有真的退出登录把它删了才算下线）
    if (!creds && !username && !password) {
      setError("还没有登录：请点右上角「设置」填写学号密码，或点设置里的「手动登录（打开网页）」")
      setStatus("")
      return
    }
    setLoading(true)
    setError("")
    setStatus("准备中…")
    try {
      const res = await fetchScheduleRaw({
        username,
        password,
        onProgress: setStatus,
      })
      const parsed = parseSchedule(res.raw)
      saveCache(parsed)
      setData(parsed)
      setWeek(parsed.currentWeek || 1)
      setStatus("")
      // 顺手把主屏小组件也刷一遍（课表变了）
      try {
        Widget.reloadAll()
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e))
      setStatus("")
    } finally {
      setLoading(false)
    }
  }

  function openSettings() {
    void Navigation.present(
      <SettingsView
        onLogin={(u, p) => {
          setSettings(loadSettings())
          void refresh({ username: u, password: p })
        }}
        onChanged={() => {
          setSettings(loadSettings())
          setError("")
          const c = loadCache()
          setData(c)
          if (!c) setWeek(0)
          // 设置（比如「显示上下课时间」）也会影响小组件
          try {
            Widget.reloadAll()
          } catch {
            /* ignore */
          }
        }}
      />
    )
  }

  function openCourse(event: CourseEvent) {
    if (!data) return
    void Navigation.present(
      <CourseDetailView
        event={event}
        data={data}
        week={curWeek}
        weekStart={settings.weekStart}
        periods={settings.periods}
      />,
    )
  }

  useEffect(() => {
    const cached = loadCache()
    if (!cached && loadSettings().username) void refresh()
  }, [])

  // 本周七天的日期（顶部日期条与网格列都用它）；顺序由「每周从周日开始」设置决定
  const now = new Date()
  const monday = data ? weekMonday(data, curWeek, now) : midnight(now)
  const weekDays = data ? weekWindow(data, curWeek, settings.weekStart, now) : []
  const todayTime = midnight(now).getTime()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  /** 这节课在 date 那天是否已经结束（过去的日子整天算结束） */
  function isDoneOn(e: CourseEvent, date: Date): boolean {
    const t = midnight(date).getTime()
    if (t < todayTime) return true
    if (t > todayTime) return false
    const end = periodTime(settings.periods, e.end)?.end ?? ""
    const m = /^(\d{1,2}):(\d{2})/.exec(end)
    return m ? nowMin >= parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : false
  }
  // 今日卡片：今天的课全上完（或今天没课）就顺延显示下一个有课的日子
  const wm = data ? buildWidgetModel(data, now, settings.periods, settings.showTime, settings.weekStart) : null
  const maxWeek = Math.max(20, currentWeek, curWeek)
  const weekChoices = Array.from({ length: maxWeek }, (_, i) => i + 1)

  return (
    <NavigationStack>
      <ScrollView navigationTitle="" navigationBarTitleDisplayMode="inline" background="systemGroupedBackground">
        <VStack spacing={12} padding={{ horizontal: 10, top: 6, bottom: 24 }}>
          {/* 标题行 */}
          <HStack spacing={8}>
            <Text font={28} fontWeight="heavy">
              华农表
            </Text>
            <Spacer />
            <Capsule onTap={() => void refresh()}>
              <Image systemName="arrow.clockwise" font={13} foregroundStyle={ACCENT as any} />
              <Text font={14} fontWeight="semibold">
                刷新
              </Text>
            </Capsule>
            <Capsule onTap={openSettings}>
              <Image systemName="gearshape" font={13} foregroundStyle={ACCENT as any} />
              <Text font={14} fontWeight="semibold">
                设置
              </Text>
            </Capsule>
          </HStack>

          {loading ? (
            <Card>
              <HStack spacing={10}>
                <ProgressView />
                <Text font={13} foregroundStyle="secondaryLabel">
                  {status || "正在获取课表…"}
                </Text>
              </HStack>
            </Card>
          ) : null}

          {error ? (
            <Card>
              <Text font={13} foregroundStyle="systemRed">
                {error}
              </Text>
              <Button title="重试" action={() => void refresh()} />
            </Card>
          ) : null}

          {!data ? (
            <Card>
              <Text font={17} fontWeight="bold">
                还没有课表数据
              </Text>
              <Text font={13} foregroundStyle="secondaryLabel">
                用你的华农学号密码登录统一身份认证，就能自动获取本学期课表。登录信息只保存在本机。
              </Text>
              <Button title="去登录" action={openSettings} />
            </Card>
          ) : (
            <>
              {/* 今日课程：今天上完了就显示第二天（第二天没课就写提示），已结束的变暗 */}
              {wm ? (
                <Card>
                  <HStack>
                    <Text font={16} fontWeight="heavy">
                      {wm.focusLabel}
                    </Text>
                    <Text font={12} foregroundStyle="secondaryLabel">
                      {wm.focus.label} {wm.focus.dateLabel} · 第 {wm.focus.week} 周
                    </Text>
                    <Spacer />
                    <Text font={12} foregroundStyle="secondaryLabel">
                      {wm.focusCourses.length ? `${wm.focusCourses.length} 门课` : ""}
                    </Text>
                  </HStack>
                  {wm.focusCourses.length === 0 ? (
                    <Text font={13} foregroundStyle="secondaryLabel">
                      {wm.focusOffset === 1 ? "明天没有课" : wm.todayFinished ? "今天的课都上完了" : "今天没有课"}
                      {wm.nextClassText ? ` · 下次有课 ${wm.nextClassText}` : ""}
                    </Text>
                  ) : null}
                  {wm.focusCourses.map(c => (
                    <HStack
                      key={c.key}
                      spacing={10}
                      padding={{ horizontal: 10, vertical: 8 }}
                      frame={{ maxWidth: "infinity" }}
                      background={c.color as any}
                      clipShape={R_BLOCK}
                      opacity={c.state === "done" ? 0.4 : 1}
                      onTapGesture={() => {
                        const ev = data.events.find(x => x.key === c.key)
                        if (ev) openCourse(ev)
                      }}
                    >
                      <VStack spacing={0} frame={{ width: 62, alignment: "leading" }}>
                        <Text font={14} fontWeight="heavy" monospacedDigit foregroundStyle={INK as any}>
                          {c.start}-{c.end} 节
                        </Text>
                        {settings.showTime ? (
                          <Text font={9} foregroundStyle={MUTED as any}>
                            {c.timeText}
                          </Text>
                        ) : null}
                      </VStack>
                      <VStack spacing={3} alignment="leading" frame={{ maxWidth: "infinity" }}>
                        <Text font={15} fontWeight="heavy" foregroundStyle={INK as any} lineLimit={1} minScaleFactor={0.7}>
                          {c.name}
                        </Text>
                        <HStack spacing={6}>
                          <RoomPill room={c.room || "地点待定"} />
                          <Text font={11} foregroundStyle={MUTED as any} lineLimit={1}>
                            {c.teacher || "教师待定"}
                          </Text>
                        </HStack>
                      </VStack>
                      <Image
                        systemName={c.state === "done" ? "checkmark.circle.fill" : "circle.fill"}
                        font={c.state === "done" ? 12 : 8}
                        foregroundStyle={c.deep as any}
                      />
                    </HStack>
                  ))}
                </Card>
              ) : null}

              {/* 月份 / 周次 */}
              <HStack spacing={8}>
                <Capsule>
                  <Text font={14} fontWeight="semibold">
                    {monday.getMonth() + 1}月
                  </Text>
                </Capsule>
                <Image
                  systemName="chevron.left"
                  font={13}
                  foregroundStyle="secondaryLabel"
                  padding={6}
                  onTapGesture={() => setWeek(Math.max(1, curWeek - 1))}
                />
                <HStack
                  padding={{ horizontal: 6, vertical: 2 }}
                  background="secondarySystemGroupedBackground"
                  clipShape={{ type: "rect", cornerRadius: 18 } as any}
                >
                  <Menu title={`第 ${curWeek} 周`}>
                    {weekChoices.map(w => (
                      <Button key={"w" + w} title={w === currentWeek ? `第 ${w} 周（本周）` : `第 ${w} 周`} action={() => setWeek(w)} />
                    ))}
                  </Menu>
                </HStack>
                <Image
                  systemName="chevron.right"
                  font={13}
                  foregroundStyle="secondaryLabel"
                  padding={6}
                  onTapGesture={() => setWeek(curWeek + 1)}
                />
                <Spacer />
                {currentWeek && curWeek !== currentWeek ? (
                  <Capsule onTap={() => setWeek(currentWeek)}>
                    <Text font={13} fontWeight="semibold" foregroundStyle={ACCENT as any}>
                      回到本周
                    </Text>
                  </Capsule>
                ) : null}
              </HStack>

              {/* 日期条（左边留出与网格完全一致的序号线宽度，列才对得齐） */}
              <HStack spacing={GAP} padding={{ horizontal: 6 }}>
                <VStack frame={{ width: GUTTER + GAP * 2 + 1 }} />
                {weekDays.map(day => {
                  const isToday = day.isToday
                  return (
                    <VStack
                      key={"h" + day.weekday}
                      spacing={1}
                      padding={{ vertical: 7 }}
                      frame={{ maxWidth: "infinity" }}
                      background={(isToday ? ACCENT : "secondarySystemGroupedBackground") as any}
                      clipShape={{ type: "rect", cornerRadius: 12 } as any}
                    >
                      <Text
                        font={16}
                        fontWeight="heavy"
                        monospacedDigit
                        foregroundStyle={(isToday ? "white" : INK) as any}
                        lineLimit={1}
                        minScaleFactor={0.7}
                      >
                        {day.date.getDate()}
                      </Text>
                      <Text
                        font={8}
                        fontWeight="semibold"
                        foregroundStyle={(isToday ? "rgba(255,255,255,0.85)" : "secondaryLabel") as any}
                        lineLimit={1}
                        minScaleFactor={0.7}
                      >
                        {WD_EN[day.weekday - 1]}
                      </Text>
                    </VStack>
                  )
                })}
              </HStack>

              {/* 课表大白卡 */}
              <HStack
                spacing={GAP}
                padding={{ horizontal: 6, vertical: 10 }}
                background="secondarySystemGroupedBackground"
                clipShape={{ type: "rect", cornerRadius: 26 } as any}
              >
                <VStack spacing={GAP} frame={{ width: GUTTER }}>
                  {Array.from({ length: data.maxSession }, (_, n) => n + 1).map(n => (
                    <VStack key={"n" + n} spacing={0} frame={{ height: ROW_H }}>
                      <Text font={18} fontWeight="heavy" foregroundStyle={INK as any}>
                        {n}
                      </Text>
                      {settings.showTime ? (
                        <VStack spacing={0}>
                          <Text font={8} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
                            {periodTime(settings.periods, n)?.start ?? ""}
                          </Text>
                          <Text font={8} foregroundStyle="tertiaryLabel" lineLimit={1} minScaleFactor={0.7}>
                            {periodTime(settings.periods, n)?.end ?? ""}
                          </Text>
                        </VStack>
                      ) : null}
                    </VStack>
                  ))}
                </VStack>
                <VStack
                  frame={{ width: 1, maxHeight: "infinity" }}
                  background={"rgba(120,120,128,0.25)" as any}
                  clipShape={{ type: "rect", cornerRadius: 1 } as any}
                />
                {weekDays.map(day => (
                  <DayColumn
                    key={"c" + day.weekday}
                    events={day.events}
                    maxSession={data.maxSession}
                    isToday={day.isToday}
                    isDone={e => isDoneOn(e, day.date)}
                    onPick={openCourse}
                  />
                ))}
              </HStack>

              <Text font={10} foregroundStyle="tertiaryLabel">
                {data.student.xnName} {termLabel(data.student.xqm)}
                {data.student.className ? " · " + data.student.className : ""} · 更新于{" "}
                {new Date(data.fetchedAt).toLocaleString()} · 点课程看详情
              </Text>
            </>
          )}
        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}
