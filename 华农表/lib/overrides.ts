/**
 * 华农表 —— 本机自定义课表
 *
 * 教务课表拉下来之后，用户还可以在本机改：删掉一门、改时间/教室、或者自己加一门。
 * 这些改动不碰缓存里的原始课表，而是单独存一份「覆盖层」：
 *   removed  —— 删掉哪些（按 key）
 *   edited   —— 改过哪些字段（按 key）
 *   added    —— 自己加的课
 * 想回到教务原样，清掉覆盖层就行（「恢复教务课表」）。
 */
import type { CourseEvent, ScheduleData } from "./model"

const K_OVERRIDES = "scau.overrides"

export interface Overrides {
  removed: string[]
  edited: Record<string, Partial<CourseEvent>>
  added: CourseEvent[]
}

export function emptyOverrides(): Overrides {
  return { removed: [], edited: {}, added: [] }
}

export function loadOverrides(): Overrides {
  const raw = Storage.get<string>(K_OVERRIDES)
  if (!raw) return emptyOverrides()
  try {
    const o = typeof raw === "string" ? JSON.parse(raw) : raw
    return {
      removed: Array.isArray(o?.removed) ? o.removed.map(String) : [],
      edited: o?.edited && typeof o.edited === "object" ? o.edited : {},
      added: Array.isArray(o?.added) ? o.added : [],
    }
  } catch {
    return emptyOverrides()
  }
}

export function saveOverrides(o: Overrides): void {
  Storage.set(K_OVERRIDES, JSON.stringify(o))
}

export function clearOverrides(): void {
  Storage.remove(K_OVERRIDES)
}

export function hasOverrides(o: Overrides): boolean {
  return o.removed.length > 0 || o.added.length > 0 || Object.keys(o.edited).length > 0
}

/** 改了几门 / 删了几门 / 自己加了几门（编辑页顶上显示） */
export function overrideCount(o: Overrides): { edited: number; removed: number; added: number } {
  return { edited: Object.keys(o.edited).length, removed: o.removed.length, added: o.added.length }
}

/**
 * 原始课表 + 覆盖层 = 屏幕上真正要显示的课表。
 * termKey：当前学期（校历里的 `2026-1` 这种）。自己加的课只属于加它的那个学期，
 * 不然下一学年第 1-20 周会又冒出来。
 */
export function applyOverrides(data: ScheduleData, o: Overrides, termKey?: string): ScheduleData {
  if (!data) return data
  if (!hasOverrides(o)) return data
  const removed: Record<string, boolean> = {}
  for (const k of o.removed) removed[k] = true

  const events: CourseEvent[] = []
  for (const e of data.events) {
    if (removed[e.key]) continue
    const patch = o.edited[e.key]
    events.push(patch ? { ...e, ...patch, key: e.key, raw: e.raw } : e)
  }
  for (const e of o.added) {
    if (removed[e.key]) continue
    const t = e.raw && (e.raw as any).term ? String((e.raw as any).term) : ""
    if (termKey && t && t !== termKey) continue
    events.push(e)
  }
  events.sort((a, b) => a.weekday - b.weekday || a.start - b.start || a.name.localeCompare(b.name))

  let maxSession = 12
  for (const e of events) maxSession = Math.max(maxSession, e.end)

  return { ...data, events, maxSession }
}

let seq = 0

/** 新建一门自定义课 */
export function makeCustomEvent(fields: {
  name: string
  teacher: string
  room: string
  weekday: number
  start: number
  end: number
  weeks: number[]
  weekText?: string
  /** 当前学期（校历 key），只在这个学期显示 */
  term?: string
  /** 气泡颜色（PALETTE 下标） */
  tint?: number
}): CourseEvent {
  seq++
  const sessions: number[] = []
  for (let s = fields.start; s <= fields.end; s++) sessions.push(s)
  return {
    key: `custom:${Date.now().toString(36)}:${seq}:${Math.random().toString(36).slice(2, 6)}`,
    name: fields.name,
    teacher: fields.teacher,
    room: fields.room,
    campus: "",
    weekday: fields.weekday,
    start: fields.start,
    end: fields.end,
    sessions,
    weeks: fields.weeks,
    weekText: fields.weekText ?? formatWeekText(fields.weeks),
    credit: "",
    category: "",
    classGroup: "",
    examType: "",
    tint: fields.tint,
    raw: fields.term ? { term: fields.term } : {},
  }
}

/** 表单字段 → 课程补丁（节次区间、周次都要重算） */
export function patchFromForm(f: {
  name: string
  teacher: string
  room: string
  weekday: number
  start: number
  end: number
  weeks: number[]
  weekText: string
  tint?: number
}): Partial<CourseEvent> {
  const sessions: number[] = []
  for (let s = f.start; s <= f.end; s++) sessions.push(s)
  return {
    name: f.name,
    teacher: f.teacher,
    room: f.room,
    weekday: f.weekday,
    start: f.start,
    end: f.end,
    sessions,
    weeks: f.weeks,
    weekText: f.weekText || formatWeekText(f.weeks),
    tint: f.tint,
  }
}

/** 改一门课（自定义的改 added，教务的存 edited 补丁） */
export function applyCourseEdit(
  ov: Overrides,
  key: string,
  f: {
    name: string
    teacher: string
    room: string
    weekday: number
    start: number
    end: number
    weeks: number[]
    weekText: string
    tint?: number
  },
): Overrides {
  const patch = patchFromForm(f)
  if (key.indexOf("custom:") === 0) {
    return { ...ov, added: ov.added.map(a => (a.key === key ? { ...a, ...patch, key: a.key, raw: a.raw } : a)) }
  }
  return { ...ov, edited: { ...ov.edited, [key]: patch } }
}

/** 删一门课（自定义的直接去掉，教务的记进 removed） */
export function applyCourseDelete(ov: Overrides, key: string): Overrides {
  if (key.indexOf("custom:") === 0) {
    return { ...ov, added: ov.added.filter(a => a.key !== key) }
  }
  const edited = { ...ov.edited }
  delete edited[key]
  return {
    ...ov,
    edited,
    removed: ov.removed.indexOf(key) > -1 ? ov.removed : ov.removed.concat([key]),
  }
}

/** 还原一门被改过的教务课 */
export function applyCourseRestore(ov: Overrides, key: string): Overrides {
  const edited = { ...ov.edited }
  delete edited[key]
  return { ...ov, edited }
}

/** [1..16] → "1-16 周" */
export function formatWeekText(weeks: number[]): string {
  if (!weeks.length) return ""
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
  return parts.join(",") + " 周"
}
