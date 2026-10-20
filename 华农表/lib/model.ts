/**
 * 华农课表 —— 数据模型与解析
 *
 * 数据来源：正方教务（jwzf.scau.edu.cn）学生课表接口
 * 原始字段：kbList[] 一门课可能拆成多条（不同周次 / 不同教室）
 */

export interface StudentInfo {
  name: string
  studentId: string
  className: string
  major: string
  /** 2026-2027 */
  xnName: string
  /** 2026 */
  xnm: string
  /** 3 = 第一学期，12 = 第二学期 */
  xqm: string
}

/** 一条课表记录（= 某个时间段的一次课） */
export interface CourseEvent {
  key: string
  name: string
  teacher: string
  room: string
  campus: string
  /** 1 = 周一 … 7 = 周日 */
  weekday: number
  /** 起始节次（1 起） */
  start: number
  /** 结束节次 */
  end: number
  sessions: number[]
  weeks: number[]
  weekText: string
  credit: string
  category: string
  classGroup: string
  examType: string
  raw: any
}

export interface ScheduleData {
  fetchedAt: number
  student: StudentInfo
  events: CourseEvent[]
  /** 课表最大节次，用于渲染 */
  maxSession: number
  /** 教务系统当前的周次（0 = 不知道） */
  currentWeek: number
  /**
   * 学期第 1 周的周一（YYYY-MM-DD），来自教务首页「校历」挂件。
   * 小组件靠它 + 今天的日期在本地推算当前周次（不联网也能一直准）。
   */
  termStart?: string
}

// ───────────────────────── 解析 ─────────────────────────

/** "1-2" / "3-5" / "10-11" → [1,2] [3,4,5] [10,11] */
export function parseSessions(jcs: string): number[] {
  const nums = (jcs || "").match(/\d+/g)
  if (!nums || !nums.length) return []
  if (nums.length === 1) return [parseInt(nums[0], 10)]
  const a = parseInt(nums[0], 10)
  const b = parseInt(nums[nums.length - 1], 10)
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out.length ? out : [a]
}

/**
 * 周次解析，支持正方各种写法：
 *   "4-17周" / "第8-8周" / "4-7周,9-17周" / "1-16周(单)" / "1,3,5周"
 */
export function parseWeeks(zcd: string): number[] {
  const set = new Set<number>()
  const text = String(zcd || "").replace(/[（(]/g, "(")
  for (const part of text.split(/[,，、;；]/)) {
    const nums = part.match(/\d+/g)
    if (!nums || !nums.length) continue
    const odd = /单/.test(part)
    const even = /双/.test(part)
    const isRange = nums.length >= 2 && /[-–—~～至]/.test(part)
    const push = (w: number) => {
      if (!isFinite(w) || w <= 0 || w > 40) return
      if (odd && w % 2 === 0) return
      if (even && w % 2 === 1) return
      set.add(w)
    }
    if (isRange) {
      const a = parseInt(nums[0], 10)
      const b = parseInt(nums[nums.length - 1], 10)
      for (let w = a; w <= b; w++) push(w)
    } else {
      for (const n of nums) push(parseInt(n, 10))
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}

/** 把周的数组压成 "4-7, 9-17" 这种紧凑写法 */
export function formatWeeks(weeks: number[]): string {
  if (!weeks.length) return "—"
  const parts: string[] = []
  let start = weeks[0]
  let prev = weeks[0]
  for (let i = 1; i <= weeks.length; i++) {
    const cur = weeks[i]
    if (cur === prev + 1) {
      prev = cur
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = cur
    prev = cur
  }
  return parts.join(", ") + " 周"
}

export const WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
export const WEEKDAY_FULL = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]

function str(v: any): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

export function termLabel(xqm: string): string {
  switch (String(xqm)) {
    case "3":
      return "第一学期"
    case "12":
      return "第二学期"
    case "16":
      return "第三学期"
    default:
      return `${xqm} 学期`
  }
}

/** 原始接口返回 → 课表数据模型 */
export function parseSchedule(raw: any): ScheduleData {
  const xsxx = raw?.xsxx ?? {}
  const student: StudentInfo = {
    name: str(xsxx.XM),
    studentId: str(xsxx.XH),
    className: str(xsxx.BJMC),
    major: str(xsxx.ZYMC),
    xnName: str(xsxx.XNMC),
    xnm: str(xsxx.XNM),
    xqm: str(xsxx.XQM),
  }

  const list: any[] = Array.isArray(raw?.kbList) ? raw.kbList : []
  const events: CourseEvent[] = []
  const seen = new Set<string>()

  for (const item of list) {
    const name = str(item.kcmc)
    if (!name) continue
    const weekday = parseInt(str(item.xqj), 10)
    if (!weekday || weekday < 1 || weekday > 7) continue
    const sessions = parseSessions(str(item.jcs))
    if (!sessions.length) continue
    const weeks = parseWeeks(str(item.zcd))
    const key = [
      name,
      str(item.jxb_id) || str(item.jxbmc),
      weekday,
      sessions[0],
      str(item.cdmc),
      str(item.zcd),
    ].join("|")
    if (seen.has(key)) continue
    seen.add(key)
    events.push({
      key,
      name,
      teacher: str(item.xm),
      room: str(item.cdmc),
      campus: str(item.xqmc),
      weekday,
      start: sessions[0],
      end: sessions[sessions.length - 1],
      sessions,
      weeks,
      weekText: str(item.zcd),
      credit: str(item.xf),
      category: str(item.kclb) || str(item.kcxz),
      classGroup: str(item.jxbzc),
      examType: str(item.ksfsmc) || str(item.khfsmc),
      raw: item,
    })
  }

  events.sort((a, b) => a.weekday - b.weekday || a.start - b.start || a.name.localeCompare(b.name))

  const maxSession = Math.max(12, ...events.map(e => e.end))
  const currentWeek = parseInt(str(raw?.zs), 10) || 0

  return {
    fetchedAt: Date.now(),
    student,
    events,
    maxSession,
    currentWeek,
    termStart: str(raw?.termStart) || undefined,
  }
}

/** 某一周、某一天的课（自动过滤周次） */
export function eventsOfWeek(data: ScheduleData, week: number): CourseEvent[] {
  return data.events.filter(e => !e.weeks.length || e.weeks.indexOf(week) > -1)
}

// ───────────────────────── 上课时间 ─────────────────────────

export interface PeriodTime {
  /** 节次，从 1 开始 */
  index: number
  start: string
  end: string
}

/**
 * 官方作息（华南农业大学 2026-2027 学年校历及作息时间表，jwc.scau.edu.cn 附件）
 *   上午 1-5 节 / 中午 6-7 节 / 下午 8-12 节 / 晚上 13-15 节（教室熄灯 22:30）
 */
export const DEFAULT_PERIODS: PeriodTime[] = [
  { index: 1, start: "08:00", end: "08:40" },
  { index: 2, start: "08:45", end: "09:25" },
  { index: 3, start: "09:55", end: "10:35" },
  { index: 4, start: "10:40", end: "11:20" },
  { index: 5, start: "11:25", end: "12:05" },
  { index: 6, start: "12:40", end: "13:20" },
  { index: 7, start: "13:25", end: "14:05" },
  { index: 8, start: "14:30", end: "15:10" },
  { index: 9, start: "15:15", end: "15:55" },
  { index: 10, start: "16:25", end: "17:05" },
  { index: 11, start: "17:10", end: "17:50" },
  { index: 12, start: "17:55", end: "18:35" },
  { index: 13, start: "19:30", end: "20:10" },
  { index: 14, start: "20:15", end: "20:55" },
  { index: 15, start: "21:00", end: "21:40" },
]

export function periodTime(periods: PeriodTime[], index: number): PeriodTime | undefined {
  return periods.find(p => p.index === index)
}

/** 「08:00 起」（作息表里没有这节就返回空串） */
export function startTimeText(periods: PeriodTime[], index: number): string {
  const p = periodTime(periods, index)
  return p ? `${p.start} 起` : ""
}

// ───────────────────────── 配色 ─────────────────────────
// 马卡龙浅底 + 对应的深色（强调点 / 边框用）；文字统一用 INK，浅色深色模式都清晰

export const INK = "#2B2B33"
export const MUTED = "#6E6E7A"
export const PILL = "rgba(43,43,51,0.88)"

const PALETTE: Array<{ bg: string; deep: string }> = [
  { bg: "#E1CFEF", deep: "#8E5BB8" }, // 薰衣草
  { bg: "#D8F2D6", deep: "#4C9A55" }, // 薄荷
  { bg: "#F8DFE4", deep: "#D0627A" }, // 粉
  { bg: "#FAEBD2", deep: "#D49A3A" }, // 奶油
  { bg: "#D3E7F1", deep: "#3F8FB5" }, // 天蓝
  { bg: "#FBDDCB", deep: "#E0794A" }, // 蜜桃
]

function paletteIndex(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100000
  return h % PALETTE.length
}

/** 课程浅底色 */
export function colorForCourse(name: string): string {
  return PALETTE[paletteIndex(name)].bg
}

/** 课程深色（强调） */
export function deepForCourse(name: string): string {
  return PALETTE[paletteIndex(name)].deep
}

/** 「未排地点」→「未排」，其余原样 */
export function shortRoom(room: string): string {
  const r = String(room || "").trim()
  if (!r) return ""
  return r.indexOf("未排") > -1 ? "未排" : r
}

/** 0 = 每周从周日开始显示，1 = 从周一开始（只影响排版，不改周次本身） */
export type WeekStart = 0 | 1
