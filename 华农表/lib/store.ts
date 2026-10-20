/**
 * 华农课表 —— 本地存储（设置 / 缓存）
 *
 * 账号密码只存在本机：学号用 Storage，密码用 Keychain（仅在勾选「记住密码」时保存）。
 * 课表缓存用 Storage 存 JSON。
 */
import { DEFAULT_PERIODS, type PeriodTime, type ScheduleData, type WeekStart } from "./model"

const K_USERNAME = "scau.username"
const K_REMEMBER = "scau.remember"
const K_PASSWORD = "scau.password" // Keychain
const K_PERIODS = "scau.periods"
const K_SHOW_TIME = "scau.showTime"
const K_WEEK_START = "scau.weekStart"
const K_CACHE = "scau.cache"

export interface Settings {
  username: string
  remember: boolean
  password: string
  periods: PeriodTime[]
  /** 课表格子里是否显示上下课时间 */
  showTime: boolean
  /** 每周从周几开始显示：0 = 周日（默认），1 = 周一 */
  weekStart: WeekStart
}

export function loadSettings(): Settings {
  let periods: PeriodTime[] = DEFAULT_PERIODS
  const saved = Storage.get<PeriodTime[]>(K_PERIODS)
  if (Array.isArray(saved) && saved.length) periods = saved
  return {
    username: Storage.get<string>(K_USERNAME) ?? "",
    remember: Storage.get<boolean>(K_REMEMBER) ?? false,
    password: Keychain.get(K_PASSWORD) ?? "",
    periods,
    showTime: Storage.get<boolean>(K_SHOW_TIME) ?? true,
    weekStart: Storage.get<number>(K_WEEK_START) === 1 ? 1 : 0,
  }
}

export function saveAccount(username: string, remember: boolean, password: string): void {
  Storage.set(K_USERNAME, username)
  Storage.set(K_REMEMBER, remember)
  if (remember && password) Keychain.set(K_PASSWORD, password)
  else Keychain.remove(K_PASSWORD)
}

export function savePeriods(periods: PeriodTime[]): void {
  Storage.set(K_PERIODS, periods)
}

export function saveShowTime(v: boolean): void {
  Storage.set(K_SHOW_TIME, v)
}

/** 每周从周几开始显示（0 = 周日） */
export function saveWeekStart(v: WeekStart): void {
  Storage.set(K_WEEK_START, v)
}

export function forgetCredentials(): void {
  Keychain.remove(K_PASSWORD)
  Storage.remove(K_USERNAME)
  Storage.remove(K_REMEMBER)
}

// ───────────────────────────── 课表缓存 ─────────────────────────────

export function loadCache(): ScheduleData | null {
  const raw = Storage.get<string>(K_CACHE)
  if (!raw) return null
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw
    if (!data || !Array.isArray(data.events)) return null
    return data as ScheduleData
  } catch {
    return null
  }
}

export function saveCache(data: ScheduleData): void {
  Storage.set(K_CACHE, JSON.stringify(data))
}

export function clearCache(): void {
  Storage.remove(K_CACHE)
}
