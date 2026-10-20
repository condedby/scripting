/**
 * 华农课表 · 小组件数据层
 *
 * 小组件里不可能登录教务（登录必须走 WebView 真实登录页、还要 cookie），
 * 所以这里只读脚本抓回来的课表缓存，再用「学期起始日 + 今天的日期」在**本地**推算周次。
 * 好处：缓存放上两三周，小组件显示的周次依然是对的；没有网络也照样工作。
 */
import {
  DEFAULT_PERIODS,
  deepForCourse,
  WEEKDAY_NAMES,
  colorForCourse,
  periodTime,
  type CourseEvent,
  type PeriodTime,
  type ScheduleData,
  type WeekStart,
} from "./model"

/** 脚本主色（= script.json 里的颜色），小组件里当作「今天」的高亮色 */
export const ACCENT = "#46708F"

const DAY_MS = 86400000

export type CourseState = "done" | "now" | "next" | "later"

export interface WidgetCourse {
  key: string
  name: string
  room: string
  teacher: string
  /** 起始节次 */
  start: number
  /** 结束节次 */
  end: number
  startMin: number
  endMin: number
  /** "09:55-11:20"，作息表里查不到就是空串 */
  timeText: string
  /** "3-5 节" */
  periodText: string
  /** 浅底色 */
  color: string
  /** 深色（强调） */
  deep: string
  state: CourseState
}

export interface WidgetDay {
  /** 1 = 周一 … 7 = 周日 */
  weekday: number
  /** "周一" */
  label: string
  /** "10/15" */
  dateLabel: string
  month: number
  date: number
  /** 这天属于第几教学周（跨周时和今天不同） */
  week: number
  isToday: boolean
  courses: WidgetCourse[]
}

export interface WidgetModel {
  /** 今天所在的教学周 */
  week: number
  today: WidgetDay
  /** 本周周一到周日（大号用） */
  days: WidgetDay[]
  /** 小号 / 中号要显示的那一天：今天还有课就是今天，全上完了就顺延 */
  focus: WidgetDay
  /** 焦点日距离今天几天：0 = 今天，1 = 明天 */
  focusOffset: number
  /** "今天" / "明天" / "周一" */
  focusLabel: string
  /** 焦点日要列的课（全部；今天已结束的 state = done，视图里变暗） */
  focusCourses: WidgetCourse[]
  /** 焦点日没课时给的提示（如「周一 10/19 · 4 门课」）；往后 8 天都没课就是空串 */
  nextClassText: string
  /** 网格要画几节 */
  maxSession: number
  periods: PeriodTime[]
  /** 建议下一次让系统来要时间线的时刻（毫秒） */
  nextWake: number
  /** 今天的课全上完了（且今天本来有课） */
  todayFinished: boolean
  /** 今天已经没课了，小号显示的是往后某一天 */
  showingNextDay: boolean
  /** "10/14 21:30" —— 课表缓存的时间 */
  updatedText: string
  /** 课表缓存超过 2 天没更新（界面上提醒一下） */
  stale: boolean
  /** 设置里的「在课表格子里显示上下课时间」 */
  showTime: boolean
  studentName: string
}

// ───────────────────────── 时间小工具 ─────────────────────────

export function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  const x = midnight(d)
  x.setDate(x.getDate() + n)
  return x
}

function parseISODate(text?: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(text || ""))
  if (!m) return null
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
  return isFinite(d.getTime()) ? d : null
}

/** 1 = 周一 … 7 = 周日（本地时区） */
export function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1
}

/** "09:55" → 595；认不出来返回 -1 */
function minutesOf(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || ""))
  if (!m) return -1
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n)
}

/** 把「今天的第 N 分钟」变成具体时刻 */
function atMinuteOf(day: Date, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minute / 60), minute % 60)
}

/**
 * 这天是第几教学周。
 * ① 缓存里有学期起始日（首页校历）→ 直接按日期算，最稳；
 * ② 没有（老缓存）→ 用「抓取当天的周次 + 之后过了几周」兜底。
 */
export function weekOf(data: ScheduleData, at: Date): number {
  const today = midnight(at).getTime()
  const start = parseISODate(data.termStart)
  if (start) {
    const days = Math.round((today - start.getTime()) / DAY_MS)
    if (days >= -3 && days < 400) return Math.max(1, Math.floor(days / 7) + 1)
  }
  if (data.currentWeek > 0) {
    const fetched = midnight(new Date(data.fetchedAt || Date.now())).getTime()
    const weeks = Math.floor((today - fetched) / (7 * DAY_MS))
    return data.currentWeek + Math.max(0, weeks)
  }
  return 1
}

/** "#4C7DF0" → "rgba(76,125,240,0.16)"：课程色块的浅底 */
export function tint(color: string, alpha: number): any {
  const m = /^#([0-9a-fA-F]{6})$/.exec(String(color || ""))
  if (!m) return color
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** "体育Ⅰ[无等级][足球01][足球]" → "体育Ⅰ"；没有括号就原样（整名都在括号里时也不动） */
export function shortName(name: string): string {
  const raw = String(name || "")
  const cut = raw.replace(/[（(\[【][^）)\]】]*[）)\]】]/g, "").trim()
  return cut || raw
}

/** "10/14 21:30" */
export function stampText(ms: number): string {
  if (!ms) return ""
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// ───────────────────────── 组装 ─────────────────────────

function buildDay(data: ScheduleData, date: Date, periods: PeriodTime[], now: Date): WidgetDay {
  const weekday = isoWeekday(date)
  const week = weekOf(data, date)
  const isToday = midnight(date).getTime() === midnight(now).getTime()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const events = data.events
    .filter(e => e.weekday === weekday && (!e.weeks.length || e.weeks.indexOf(week) > -1))
    .sort((a, b) => a.start - b.start)

  let nextTaken = false
  const courses: WidgetCourse[] = events.map(e => {
    const a = periodTime(periods, e.start)
    const b = periodTime(periods, e.end) || a
    const startMin = a ? minutesOf(a.start) : -1
    const endMin = b ? minutesOf(b.end) : startMin + 45
    let state: CourseState = "later"
    if (isToday && startMin >= 0) {
      if (nowMin >= endMin) state = "done"
      else if (nowMin >= startMin) state = "now"
      else if (!nextTaken) {
        state = "next"
        nextTaken = true
      }
    }
    return {
      key: e.key,
      name: shortName(e.name),
      room: e.room,
      teacher: e.teacher,
      start: e.start,
      end: e.end,
      startMin,
      endMin,
      timeText: a && b ? `${a.start}-${b.end}` : "",
      periodText: e.end > e.start ? `${e.start}-${e.end} 节` : `${e.start} 节`,
      color: colorForCourse(e.name),
      deep: deepForCourse(e.name),
      state,
    }
  })

  return {
    weekday,
    label: WEEKDAY_NAMES[weekday - 1],
    dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
    month: date.getMonth() + 1,
    date: date.getDate(),
    week,
    isToday,
    courses,
  }
}

/** 第 week 周的周一（周课表页的日期条用） */
export function weekMonday(data: ScheduleData, week: number, now: Date = new Date()): Date {
  const start = parseISODate(data.termStart)
  if (start) return addDays(start, (week - 1) * 7 - (isoWeekday(start) - 1))
  const thisMonday = addDays(now, -(isoWeekday(now) - 1))
  return addDays(thisMonday, (week - weekOf(data, now)) * 7)
}

/** 这一天所在「显示周」的第一天：weekStart = 0 → 周日，1 → 周一 */
export function startOfDisplayWeek(d: Date, weekStart: WeekStart = 0): Date {
  const wd = isoWeekday(d)
  return addDays(d, -(weekStart === 0 ? wd % 7 : wd - 1))
}

/** 某一天要上的课（周次按这一天的日期自己算，周日开头时也不会串周） */
export function eventsOn(data: ScheduleData, date: Date): CourseEvent[] {
  const wd = isoWeekday(date)
  const week = weekOf(data, date)
  return data.events
    .filter(e => e.weekday === wd && (!e.weeks.length || e.weeks.indexOf(week) > -1))
    .sort((a, b) => a.start - b.start)
}

export interface WeekDayInfo {
  date: Date
  /** 1 = 周一 … 7 = 周日 */
  weekday: number
  /** 这天属于第几教学周 */
  week: number
  isToday: boolean
  events: CourseEvent[]
}

/**
 * 某一教学周要显示的 7 天（顺序由 weekStart 决定，周日开头就是「上周日 → 本周六」）。
 * 每一天的课按**这一天的日期**过滤周次，所以周首跨到上一周那天也不会串。
 */
export function weekWindow(
  data: ScheduleData,
  week: number,
  weekStart: WeekStart = 0,
  now: Date = new Date(),
): WeekDayInfo[] {
  const first = startOfDisplayWeek(weekMonday(data, week, now), weekStart)
  const todayTime = midnight(now).getTime()
  return [0, 1, 2, 3, 4, 5, 6].map(i => {
    const date = addDays(first, i)
    return {
      date,
      weekday: isoWeekday(date),
      week: weekOf(data, date),
      isToday: midnight(date).getTime() === todayTime,
      events: eventsOn(data, date),
    }
  })
}

/** 这天还有没有没上完的课 */
export function hasRemaining(day: WidgetDay): boolean {
  return day.courses.some(c => c.state !== "done")
}

/** 这天的课全上完了（今天才用得上） */
export function isFinished(day: WidgetDay): boolean {
  return day.courses.length > 0 && !hasRemaining(day)
}

export function buildWidgetModel(
  data: ScheduleData,
  now: Date = new Date(),
  periods: PeriodTime[] = DEFAULT_PERIODS,
  showTime = true,
  weekStart: WeekStart = 0,
): WidgetModel {
  const today = buildDay(data, now, periods, now)

  // 大号：显示周（weekStart = 0 时从周日开头）
  const first = startOfDisplayWeek(now, weekStart)
  const days: WidgetDay[] = []
  for (let i = 0; i < 7; i++) days.push(buildDay(data, addDays(first, i), periods, now))

  // 小号 / 中号：今天的课没上完就显示今天；上完了就显示**第二天**（如果第二天也没课，
  // 就写「明天没有课」+ 下一次有课的提示，而不是跳过去找下一个有课的日子）
  let focus = today
  let focusOffset = 0
  if (!hasRemaining(today)) {
    focus = buildDay(data, addDays(now, 1), periods, now)
    focusOffset = 1
  }

  const focusLabel = focusOffset === 0 ? "今天" : "明天"
  const focusCourses = focus.courses

  // 焦点日没课：往后找一个最近的「有课的日子」当作提示，界面不至于空着
  let nextClassText = ""
  if (focusCourses.length === 0) {
    for (let i = 1; i <= 8; i++) {
      const d = buildDay(data, addDays(now, focusOffset + i), periods, now)
      if (d.courses.length) {
        nextClassText = `${d.label} ${d.dateLabel} · ${d.courses.length} 门课`
        break
      }
    }
  }

  // 网格节数：至少 10 节（版面不至于太空），最多 15 节（再高就挤了）
  const termMax = data.events.reduce((m, e) => Math.max(m, e.end), 0)
  const weekMax = days.reduce((m, d) => d.courses.reduce((n, c) => Math.max(n, c.end), m), 0)
  const maxSession = Math.min(15, Math.max(10, termMax, weekMax, data.maxSession || 0))

  // 下次希望系统来刷新：最近的「一节课下课」/ 明天零点 / 一小时后，取最早
  const nowMs = now.getTime()
  let wake = addDays(now, 1).getTime() + 5 * 60 * 1000
  const ends = today.courses.map(c => c.endMin).filter(m => m > now.getHours() * 60 + now.getMinutes()).sort((a, b) => a - b)
  if (ends.length) wake = Math.min(wake, atMinuteOf(now, ends[0]).getTime() + 60 * 1000)
  wake = Math.min(wake, nowMs + 60 * 60 * 1000)
  const nextWake = Math.max(wake, nowMs + 2 * 60 * 1000)

  return {
    week: today.week,
    today,
    days,
    focus,
    focusOffset,
    focusLabel,
    focusCourses,
    nextClassText,
    maxSession,
    periods,
    nextWake,
    todayFinished: isFinished(today),
    showingNextDay: focusOffset > 0,
    updatedText: stampText(data.fetchedAt),
    stale: Date.now() - (data.fetchedAt || 0) > 2 * DAY_MS,
    showTime,
    studentName: data.student?.name || "",
  }
}
