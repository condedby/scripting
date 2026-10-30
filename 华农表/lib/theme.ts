/**
 * 华农表 —— 明暗两套配色的小工具
 *
 * 原则：
 *   · 文字放在「系统卡片 / 分组背景」上 → 一律用语义色 `label` / `secondaryLabel` / `tertiaryLabel`，
 *     系统自己会在深色模式下变白（以前写死 INK=#2B2B33，暗色模式下就是黑字贴黑底，看不清）。
 *   · 文字放在「马卡龙浅色气泡」上 → 继续用 INK/MUTED，因为那块底色两种模式都是浅色。
 *   · 灰底（空格子、胶囊、进度条槽）在暗色下要更亮一点，用 surface(alpha) 自动加倍。
 *   · 放假绿 / 调休橙也要分两套，深色模式换成亮的那支。
 */
import { Device } from "scripting"

export function isDark(): boolean {
  try {
    return Device.colorScheme === "dark"
  } catch {
    return false
  }
}

/** 系统色板里的灰底："rgba(120,120,128,alpha)"，暗色模式自动提亮 */
export function surface(alpha: number): string {
  const a = isDark() ? Math.min(0.5, alpha * 2.4) : alpha
  return `rgba(120,120,128,${Math.round(a * 1000) / 1000})`
}

/** 放假（绿）文字色 */
export function greenText(): string {
  return isDark() ? "#5BD98F" : "#1F7A4C"
}

/** 放假（绿）底色 */
export function greenFill(): string {
  return isDark() ? "rgba(52,200,120,0.24)" : "rgba(52,168,108,0.16)"
}

/** 把颜色往白色混（深色模式下当文字色用）：#4C9A55 → #A6CBA9 */
export function onDark(color: string, mix = 0.55): string {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(String(color || ""))
  if (!m) return color
  const c = [1, 2, 3].map(i => {
    const v = parseInt(m[i], 16)
    return Math.round(v + (255 - v) * mix)
  })
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("")
}

/** 调休（橙）文字色 */
export function orangeText(): string {
  return isDark() ? "#FFB44A" : "#A96400"
}

/** 调休（橙）底色 */
export function orangeFill(): string {
  return isDark() ? "rgba(255,159,10,0.26)" : "rgba(255,149,0,0.18)"
}
