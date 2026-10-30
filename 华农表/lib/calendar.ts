/**
 * 华农表 —— 校历
 *
 * 数据来源（公开页面，不用登录）：
 *   教务处「校历查询」https://jwc.scau.edu.cn/xl/list.htm
 *   → 最新一篇《XXXX-XXXX学年第一、二学期》
 *   → 附件《华南农业大学XXXX-XXXX学年校历及作息时间表.xlsx》
 *
 * xlsx 里就是学校那张校历表：
 *   行 = 周一…周日（+ 末尾一行「周次」），列 = 一个自然周，
 *   节日 / 假期（国庆、中秋、元旦、春节、元宵…）直接写在对应那一天的格子里。
 *
 * 这里用 FileManager.unzip 解开 xlsx，读 sharedStrings.xml + sheet*.xml 自己拼回这张表，
 * 再按列推日期（第一列定位 + 逐列 +7 天，最后用「所有数字格子」反过来校验锚点）。
 */

import { fetch } from "scripting"

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string
  /** 1 = 周一 … 7 = 周日 */
  weekday: number
  /** 节日 / 假期名（平时为空串） */
  holiday: string
}

export interface CalendarWeek {
  /** 「第 1 周」/「暑假」/「寒假」 */
  label: string
  /** 教学周序号；0 = 暑假 / 寒假 这类非教学周 */
  week: number
  /** 这一周的周一 / 周日（YYYY-MM-DD） */
  monday: string
  sunday: string
  /** 「8/31 - 9/6」 */
  rangeText: string
  /** 7 天 */
  days: CalendarDay[]
  /** 这一周里的节日（去重，按天序） */
  holidays: string[]
}

export interface AcademicTerm {
  /** "2026-2027-1" */
  key: string
  /** 华南农业大学2026-2027学年第一学期校历及作息表 */
  title: string
  /** 2026-2027 */
  year: string
  /** 1 / 2 */
  term: number
  weeks: CalendarWeek[]
  /** 教学周数 */
  teachingWeeks: number
  /** 校历下面的说明（注册、教学、考试、放假…） */
  notes: string[]
  /** 调休上课日（从说明里的「9月20日（周日）、10月10日（周六）上班、上课（分别上第6周周二、周三的课程）」解析） */
  makeups: CalendarMakeup[]
  /** 放假的整段日期（从说明里的「国庆节：10月1日至7日放假」解析） */
  offRanges: OffRange[]
}

export interface OffRange {
  start: string
  end: string
  name: string
}

export interface CalendarMakeup {
  /** 调休那一天 YYYY-MM-DD */
  date: string
  /** 上第几教学周的课 */
  week: number
  /** 周几的课（1 = 周一 … 7 = 周日） */
  weekday: number
}

export interface AcademicCalendar {
  /** 缓存结构版本：解析结果改过就加一，旧缓存会自动重抓 */
  schema?: number
  fetchedAt: number
  /** 校历栏目里那一篇文章 */
  pageUrl: string
  /** 附件（xlsx）地址 */
  fileUrl: string
  terms: AcademicTerm[]
}

/** 校历第一次抓不到时用的兜底：7 天内不再自动重抓 */
export const CALENDAR_TTL = 7 * 86400000

/** 缓存结构版本：解析结果改过就加一，旧缓存会被当成没有（自动重抓） */
export const CALENDAR_SCHEMA = 2

const SITE = "https://jwc.scau.edu.cn"
const LIST_URL = `${SITE}/xl/list.htm`
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

// ───────────────────────── 日期小工具 ─────────────────────────

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n)
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseISODate(s: string): Date {
  const p = String(s || "").split("-").map(n => parseInt(n, 10))
  return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

/** 「8/31」 */
export function shortDate(s: string): string {
  const d = parseISODate(s)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 「8/31 - 9/6」 */
export function weekRangeText(monday: string): string {
  const a = parseISODate(monday)
  const b = addDays(a, 6)
  return `${a.getMonth() + 1}/${a.getDate()} - ${b.getMonth() + 1}/${b.getDate()}`
}

/** 这一周是否包含某天 */
export function weekHas(w: CalendarWeek, iso: string): boolean {
  return iso >= w.monday && iso <= w.sunday
}

// ───────────────────────── 抓网页 ─────────────────────────

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } } as any)
  if (!res.ok) throw new Error(`请求失败（HTTP ${res.status}）`)
  return await res.text()
}

function absolute(href: string): string {
  const h = String(href || "").trim()
  if (!h) return ""
  if (/^https?:\/\//i.test(h)) return h
  if (h.startsWith("//")) return "https:" + h
  if (h.startsWith("/")) return SITE + h
  return SITE + "/" + h
}

/** 校历列表页 → 最新那篇文章的地址（标题里带「学年」） */
export function latestCalendarPage(html: string): string {
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi
  let m: any
  while ((m = re.exec(html))) {
    const href = m[1]
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, "")
    if (!/学年/.test(text)) continue
    if (!/\/c\d+a\d+\/page\.htm/i.test(href)) continue
    return absolute(href)
  }
  return ""
}

/** 文章页 → 校历附件（优先 xlsx） */
export function calendarFile(html: string): string {
  const all: string[] = []
  const re = /<a\b[^>]*href=["']([^"']+\.(?:xlsx|xls))["']/gi
  let m: any
  while ((m = re.exec(html))) all.push(absolute(m[1]))
  const xlsx = all.find(u => /\.xlsx$/i.test(u))
  return xlsx || all[0] || ""
}

// ───────────────────────── xlsx 解析 ─────────────────────────

function unescapeXml(s: string): string {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m: string, d: string) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m: string, d: string) => String.fromCharCode(parseInt(d, 16)))
    .replace(/&amp;/g, "&")
}

function columnIndex(letters: string): number {
  let n = 0
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64)
  return n
}

interface SheetCell {
  text: string
  numeric: boolean
}

interface SheetRow {
  index: number
  cells: Map<number, SheetCell>
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  const re = /<si>([\s\S]*?)<\/si>/g
  let m: any
  while ((m = re.exec(xml))) {
    const parts = m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []
    out.push(parts.map((p: string) => unescapeXml(p.replace(/<[^>]+>/g, ""))).join(""))
  }
  return out
}

function parseRows(xml: string, shared: string[]): SheetRow[] {
  const rows: SheetRow[] = []
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g
  let rm: any
  while ((rm = rowRe.exec(xml))) {
    const rAttr = /\br="(\d+)"/.exec(rm[1])
    const index = rAttr ? parseInt(rAttr[1], 10) : rows.length + 1
    const cells = new Map<number, SheetCell>()
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm: any
    while ((cm = cellRe.exec(rm[2]))) {
      const attrs = cm[1] || ""
      const inner = cm[2] || ""
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)
      if (!ref) continue
      const col = columnIndex(ref[1])
      const type = (/ t="([^"]+)"/.exec(attrs) || [])[1] || ""
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)
      let text = v ? v[1] : ""
      let numeric = false
      if (type === "s") {
        text = shared[parseInt(text, 10)] ?? ""
      } else if (type === "inlineStr") {
        const is = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)
        text = is ? unescapeXml(is[1]) : ""
      } else if (type === "str") {
        text = unescapeXml(text)
      } else {
        numeric = !!v
      }
      text = unescapeXml(text).replace(/\u0000/g, "").trim()
      if (text === "") continue
      cells.set(col, { text, numeric })
    }
    rows.push({ index, cells })
  }
  rows.sort((a, b) => a.index - b.index)
  return rows
}

interface Merge {
  c1: number
  r1: number
  c2: number
  r2: number
}

function parseMerges(xml: string): Merge[] {
  const out: Merge[] = []
  const re = /<mergeCell\b[^>]*ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g
  let m: any
  while ((m = re.exec(xml))) {
    out.push({
      c1: columnIndex(m[1]),
      r1: parseInt(m[2], 10),
      c2: columnIndex(m[3]),
      r2: parseInt(m[4], 10),
    })
  }
  return out
}

/** 把合并单元格的值铺到它覆盖的每一列（月分行会用到） */
function expandRow(row: SheetRow | undefined, merges: Merge[]): Map<number, string> {
  const out = new Map<number, string>()
  if (!row) return out
  for (const [col, cell] of row.cells) out.set(col, cell.text)
  for (const mg of merges) {
    if (mg.r1 > row.index || mg.r2 < row.index) continue
    const head = row.cells.get(mg.c1)
    if (!head) continue
    for (let c = mg.c1; c <= mg.c2; c++) out.set(c, head.text)
  }
  return out
}

const WD_CHARS = "一二三四五六日"

/** 一天 7 个字（一…日）→ 1..7 */
function weekdayOf(text: string): number {
  const t = String(text || "").trim()
  // ⚠️ 必须真的匹配到字才认：indexOf("") 会返回 0，把「8月」错认成周一
  if (t.length !== 1 && t.length !== 3) return 0
  const m = /[一二三四五六日]/.exec(t)
  if (!m) return 0
  const i = WD_CHARS.indexOf(m[0])
  return i >= 0 ? i + 1 : 0
}

function yearForMonth(title: string, month: number, now: Date): number {
  const m = /(\d{4})\s*[-–—~至]\s*(\d{4})\s*学年/.exec(title)
  if (m) {
    const y1 = parseInt(m[1], 10)
    const y2 = parseInt(m[2], 10)
    return month >= 8 ? y1 : y2
  }
  // 没有学年信息就按「8 月开学」推
  const y = now.getFullYear()
  if (month >= 8) return now.getMonth() + 1 >= 8 ? y : y - 1
  return now.getMonth() + 1 >= 8 ? y + 1 : y
}

/** 一个 sheet（= 一个学期）→ AcademicTerm */
export function parseTermSheet(xml: string, shared: string[], now: Date = new Date()): AcademicTerm | null {
  const rows = parseRows(xml, shared)
  const merges = parseMerges(xml)
  const at = (row: SheetRow | undefined, col = 1): string => (row ? row.cells.get(col)?.text ?? "" : "")

  // 标题：含「校历」的那一行里最长的一段
  let title = ""
  for (const row of rows) {
    for (const cell of row.cells.values()) {
      if (cell.text.indexOf("校历") > -1 && cell.text.length > title.length) title = cell.text
    }
  }
  if (!title) return null

  const weekRow = rows.find(r => at(r) === "周次")
  if (!weekRow) return null

  // 「一」…「日」七行
  const weekdayRows = new Map<number, SheetRow>()
  for (const row of rows) {
    if (row.index >= weekRow.index) continue
    const wd = weekdayOf(at(row))
    if (wd && !weekdayRows.has(wd)) weekdayRows.set(wd, row)
  }
  if (weekdayRows.size < 7) return null

  // 月分行（在星期行上面、含「N月」的那一行）
  let monthRow: SheetRow | undefined
  const firstWd = Math.min(...Array.from(weekdayRows.values()).map(r => r.index))
  for (const row of rows) {
    if (row.index >= firstWd) continue
    const texts = Array.from(row.cells.values()).map(c => c.text)
    if (texts.some(t => /^\d{1,2}月$/.test(t))) monthRow = row
  }
  const months = expandRow(monthRow, merges)

  const columns = Array.from(weekRow.cells.keys())
    .filter(c => c > 1)
    .sort((a, b) => a - b)
  if (columns.length < 2) return null

  const weekInfo = (col: number) => {
    const t = at(weekRow, col)
    const n = parseInt(t, 10)
    return { text: t, week: n > 0 && n < 60 ? n : 0 }
  }

  // 锚点：找一列「周一格子是日期 + 有月份」，用它定出第一列的周一，
  // 再用所有日期格子反查（有几处对不上就淘汰），这样即使某周跨月也不会算错。
  const mondayOf = (col: number): number => {
    const cell = weekdayRows.get(1)?.cells.get(col)
    if (cell && cell.numeric) return parseInt(cell.text, 10)
    return 0
  }

  let best: { anchor: Date; score: number } | null = null
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const day = mondayOf(col)
    const label = months.get(col) || ""
    const mm = parseInt(label, 10)
    if (!day || !mm) continue
    const first = addDays(new Date(yearForMonth(title, mm, now), mm - 1, day), -7 * i)
    let score = 0
    for (let j = 0; j < columns.length; j++) {
      const monday = addDays(first, 7 * j)
      for (const [wd, row] of weekdayRows) {
        const cell = row.cells.get(columns[j])
        if (!cell || !cell.numeric) continue
        if (parseInt(cell.text, 10) !== addDays(monday, wd - 1).getDate()) score++
      }
    }
    if (!best || score < best.score) best = { anchor: first, score }
  }
  if (!best) return null

  const allWeeks: CalendarWeek[] = columns.map((col, i) => {
    const monday = addDays(best!.anchor, 7 * i)
    const days: CalendarDay[] = []
    const holidays: string[] = []
    for (let wd = 1; wd <= 7; wd++) {
      const cell = weekdayRows.get(wd)?.cells.get(col)
      const holiday = cell && !cell.numeric ? cell.text : ""
      days.push({ date: isoDate(addDays(monday, wd - 1)), weekday: wd, holiday })
      if (holiday && holidays.indexOf(holiday) < 0) holidays.push(holiday)
    }
    const info = weekInfo(col)
    return {
      label: info.week ? `第 ${info.week} 周` : info.text || "假期",
      week: info.week,
      monday: isoDate(monday),
      sunday: isoDate(addDays(monday, 6)),
      rangeText: weekRangeText(isoDate(monday)),
      days,
      holidays,
    }
  })

  const teachingWeeks = allWeeks.reduce((mx, w) => Math.max(mx, w.week), 0)

  // 表格最后几列会顺带画出「下个学期的第 1 周」（例：第一学期表末尾的 2/22），
  // 那不是这一学期，截掉
  const weeks: CalendarWeek[] = []
  let seenLast = false
  for (const w of allWeeks) {
    if (w.week === teachingWeeks) seenLast = true
    if (seenLast && w.week > 0 && w.week < teachingWeeks) break
    weeks.push(w)
  }

  // 说明：周次行下面那些文字（注册、教学、考试、放假安排…）
  // 表格里每行一句，但「1.本科生…」下面几条其实是它的正文（单元格里的缩进被 trim 掉了，
  // 所以按「不以序号开头 = 上一条的续行」来拼）
  const itemStart = /^(\d+[.．、]|[一二三四五六七八九十]+[、.])/
  const notes: string[] = []
  for (const row of rows) {
    if (row.index <= weekRow.index) continue
    const text = Array.from(row.cells.keys())
      .sort((a, b) => a - b)
      .map(c => row.cells.get(c)!.text)
      .join("")
      .replace(/\r/g, "")
      .replace(/_x000D_/g, "")
      .replace(/^备注/, "")
      .trim()
    if (!text || text === "备注") continue
    if (notes.length && !itemStart.test(text)) {
      notes[notes.length - 1] += "\n" + text
      continue
    }
    if (notes.indexOf(text) > -1) continue
    notes.push(text)
  }

  // 表格里用行首空格做缩进，显示时不需要
  for (let i = 0; i < notes.length; i++) {
    notes[i] = notes[i]
      .split("\n")
      .map(l => l.trim())
      .filter(l => !!l)
      .join("\n")
  }

  const ym = /(\d{4})\s*[-–—~至]\s*(\d{4})\s*学年/.exec(title)
  const year = ym ? `${ym[1]}-${ym[2]}` : ""
  const tm = /第([一二三四])学期/.exec(title)
  const term = tm ? "一二三四".indexOf(tm[1]) + 1 : 0

  return {
    key: `${year}-${term}`,
    title,
    year,
    term,
    weeks,
    teachingWeeks,
    notes,
    makeups: parseMakeups(notes, title),
    offRanges: parseOffRanges(notes, title),
  }
}

/**
 * 「国庆节：10月1日（周四）至7日（周三）放假调休」→ 放假的整段日期。
 * 校历表格里只把节日那一天写成文字，其余几天还是日期，所以要把整段补上。
 */
function parseOffRanges(notes: string[], title: string): OffRange[] {
  const out: OffRange[] = []
  for (const note of notes) {
    if (note.indexOf("放假") < 0) continue
    const head = (note.split(/[：:]/)[0] || "").replace(/^\d+[.．、]/, "").trim()
    const name = head.replace(/[（(].*$/, "").trim() || "放假"
    const re = /(\d{1,2})\s*月\s*(\d{1,2})\s*日[^至]{0,12}?至\s*(?:(\d{1,2})\s*月\s*)?(\d{1,2})\s*日/g
    let m: any
    while ((m = re.exec(note))) {
      const m1 = parseInt(m[1], 10)
      const d1 = parseInt(m[2], 10)
      const m2 = m[3] ? parseInt(m[3], 10) : m1
      const d2 = parseInt(m[4], 10)
      const y1 = yearForMonth(title, m1, new Date())
      let end = new Date(yearForMonth(title, m2, new Date()), m2 - 1, d2)
      const start = new Date(y1, m1 - 1, d1)
      if (end.getTime() < start.getTime()) end = new Date(y1 + 1, m2 - 1, d2)
      out.push({ start: isoDate(start), end: isoDate(end), name: shortFestival(name) })
    }
  }
  return out
}

/** 「国庆节」→「国庆」 */
function shortFestival(name: string): string {
  const n = String(name || "").trim()
  return n.length > 2 && n.endsWith("节") ? n.slice(0, -1) : n
}

/**
 * 从校历说明里抳出「调休上课」的日子。
 * 例：「9月20日（周日）、10月10日（周六）上班、上课（分别上第6周周二、周三的课程）」
 *   → 9/20 上第 6 周周二、10/10 上第 6 周周三。
 */
function parseMakeups(notes: string[], title: string): CalendarMakeup[] {
  const out: CalendarMakeup[] = []
  for (const note of notes) {
    if (!/上班|调休|补课|补上/.test(note)) continue
    const spec = /第\s*(\d{1,2})\s*周\s*((?:周?[一二三四五六日][、,，和及\s]*)+)/.exec(note)
    if (!spec || spec.index === undefined) continue
    const week = parseInt(spec[1], 10)
    const weekdays = (spec[2].match(/[一二三四五六日]/g) || [])
      .map(ch => WD_CHARS.indexOf(ch) + 1)
      .filter(d => d > 0)
    if (!week || !weekdays.length) continue
    // 调休日期写在同一句的前半句里：「9月20日（周日）、10月10日（周六）上班…」
    const head = note.slice(0, spec.index).split(/[。\n]/).pop() || ""
    const dates: { month: number; day: number }[] = []
    const dre = /(\d{1,2})\s*月\s*(\d{1,2})\s*日/g
    let dm: any
    while ((dm = dre.exec(head))) dates.push({ month: parseInt(dm[1], 10), day: parseInt(dm[2], 10) })
    for (let i = 0; i < dates.length && i < weekdays.length; i++) {
      const y = yearForMonth(title, dates[i].month, new Date())
      const d = new Date(y, dates[i].month - 1, dates[i].day)
      const iso = isoDate(d)
      if (out.some(m => m.date === iso)) continue
      out.push({ date: iso, week, weekday: weekdays[i] })
    }
  }
  return out
}

// ───────────────────────── 每天是不是「放假 / 调休」 ─────────────────────────

export interface DayFlags {
  /** 放假（非空 = 节日名，这天不上课） */
  off: string
  /** 调休上课：按第 week 周 weekday 的课表上 */
  makeWeek: number
  makeWeekday: number
}

export type DayFlagMap = Record<string, DayFlags>

/** 把一份校历的「放假 / 调休」展开成日期表，课表按它过滤 */
export function buildDayFlags(cal: AcademicCalendar | null | undefined): DayFlagMap {
  const map: DayFlagMap = {}
  if (!cal) return map
  for (const term of cal.terms) {
    for (const w of term.weeks) {
      for (const d of w.days) {
        if (!d.holiday) continue
        const prev = map[d.date]
        map[d.date] = { off: d.holiday, makeWeek: prev?.makeWeek || 0, makeWeekday: prev?.makeWeekday || 0 }
      }
    }
    // 节日放假的整段日期（表格里只标了节日那一天）
    for (const r of term.offRanges || []) {
      let d = parseISODate(r.start)
      const end = parseISODate(r.end)
      for (let i = 0; i < 40 && d.getTime() <= end.getTime(); i++) {
        const iso = isoDate(d)
        const prev = map[iso]
        if (!prev || !prev.off) map[iso] = { off: prev?.off || r.name, makeWeek: prev?.makeWeek || 0, makeWeekday: prev?.makeWeekday || 0 }
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      }
    }
    for (const m of term.makeups || []) {
      const prev = map[m.date]
      map[m.date] = { off: prev?.off || "", makeWeek: m.week, makeWeekday: m.weekday }
    }
  }
  return map
}

/** 这一天在校历上的标记（没有就返回 null） */
export function flagsFor(flags: DayFlagMap | null | undefined, date: Date): DayFlags | null {
  if (!flags) return null
  const f = flags[isoDate(date)]
  return f || null
}

/** 这一天属于哪一份学期校历 */
export function termForDate(cal: AcademicCalendar | null | undefined, date: Date): AcademicTerm | null {
  if (!cal) return null
  const iso = isoDate(date)
  for (const t of cal.terms) {
    if (t.weeks.length && iso >= t.weeks[0].monday && iso <= t.weeks[t.weeks.length - 1].sunday) return t
  }
  return null
}

// ───────────────────────── 下载 + 解包 ─────────────────────────

async function readWorkbook(url: string): Promise<{ shared: string[]; sheets: { name: string; xml: string }[] }> {
  const res = await fetch(url, { headers: { "User-Agent": UA } } as any)
  if (!res.ok) throw new Error(`校历附件下载失败（HTTP ${res.status}）`)
  const buf = await res.arrayBuffer()
  if (!buf || buf.byteLength < 500) throw new Error("校历附件是空的")
  const data = Data.fromArrayBuffer(buf)
  if (!data) throw new Error("无法读取校历附件")

  const root = FileManager.temporaryDirectory + "/scau-calendar"
  const zip = root + "/calendar.xlsx"
  const out = root + "/raw"
  FileManager.createDirectorySync(root, true)
  try {
    await FileManager.remove(out)
  } catch {
    /* 没有就算了 */
  }
  FileManager.writeAsDataSync(zip, data)
  FileManager.unzipSync(zip, out)

  const base = out + "/xl"
  let sharedXml = ""
  try {
    sharedXml = FileManager.readAsStringSync(base + "/sharedStrings.xml", "utf8") ?? ""
  } catch {
    sharedXml = ""
  }
  const shared = sharedXml ? parseSharedStrings(sharedXml) : []

  const names = (FileManager.readDirectorySync(base + "/worksheets") || [])
    .map(p => String(p).split("/").pop() || "")
    .filter(n => /\.xml$/i.test(n))
    .sort((a, b) => {
      const na = parseInt((a.match(/\d+/) || ["0"])[0], 10)
      const nb = parseInt((b.match(/\d+/) || ["0"])[0], 10)
      return na - nb
    })

  const sheets: { name: string; xml: string }[] = []
  for (const name of names) {
    try {
      const xml = FileManager.readAsStringSync(base + "/worksheets/" + name, "utf8") ?? ""
      if (xml) sheets.push({ name, xml })
    } catch {
      /* 跳过读不出来的 */
    }
  }
  return { shared, sheets }
}

/** 抓一遍校历（列表 → 文章 → xlsx → 解析） */
export async function fetchAcademicCalendar(): Promise<AcademicCalendar> {
  const listHtml = await getText(LIST_URL)
  const pageUrl = latestCalendarPage(listHtml)
  if (!pageUrl) throw new Error("没有在教务处「校历查询」里找到校历")

  const pageHtml = await getText(pageUrl)
  const fileUrl = calendarFile(pageHtml)
  if (!fileUrl) throw new Error("这篇校历里没有找到附件（xlsx）")

  const { shared, sheets } = await readWorkbook(fileUrl)
  const now = new Date()
  const terms: AcademicTerm[] = []
  for (const s of sheets) {
    const t = parseTermSheet(s.xml, shared, now)
    if (t && t.weeks.length) terms.push(t)
  }
  if (!terms.length) throw new Error("校历附件解析失败")

  terms.sort((a, b) => a.term - b.term)
  return { schema: CALENDAR_SCHEMA, fetchedAt: Date.now(), pageUrl, fileUrl, terms }
}

/** 按学期挑一份校历（学生是第几学期就看哪一份） */
export function pickTerm(cal: AcademicCalendar, term: number): AcademicTerm {
  return cal.terms.find(t => t.term === term) || cal.terms[0]
}
