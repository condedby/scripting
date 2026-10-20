/**
 * 华农课表 · 小组件入口
 *
 * 小组件里不可能登录教务（登录必须走 WebView 真实登录页 + cookie），
 * 所以这里只读脚本抓回来的课表缓存：
 *   · 缓存里存了「学期第 1 周周一」，周次按今天的日期在本地算 —— 缓存放几周也依然准；
 *   · 想要最新课表，打开一次「华农课表」脚本刷新即可（刷新完会通知小组件重画）。
 *
 * 时间线策略：把下次刷新定在「最近一节课下课 / 明天零点 / 一小时后」里最早的时刻，
 * 这样最后一节课上完它会自己翻到第二天（iOS 会按自己的预算延后，属正常现象）。
 */
import { Script, VStack, Widget } from "scripting"
import { loadCache, loadSettings } from "./lib/store"
import { buildWidgetModel } from "./lib/widget"
import {
  EmptyWidget,
  LargeWidget,
  LockCircularWidget,
  LockInlineWidget,
  LockRectWidget,
  MediumWidget,
  SmallWidget,
  type Size,
} from "./widget/views"

const EMPTY_RELOAD_MS = 30 * 60 * 1000

function sizeOf(): Size {
  try {
    const s = Widget.displaySize
    if (s && s.width > 0 && s.height > 0) return { width: s.width, height: s.height }
  } catch {
    /* ignore */
  }
  return { width: 170, height: 170 }
}

// 点小组件：直接跑一次脚本（顺便刷新课表）；系统里「交互时」的自定义动作会被这个覆盖
let runURL = ""
try {
  runURL = Script.createRunURLScheme(Script.name)
} catch {
  /* ignore */
}

function present(node: any, wake: number) {
  Widget.present(
    <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} widgetURL={runURL || undefined}>
      {node}
    </VStack>,
    { reloadPolicy: { policy: "after", date: new Date(wake) } },
  )
}

function run() {
  const family = String(Widget.family)
  const size = sizeOf()
  const cache = loadCache()

  const lock = family.indexOf("accessory") === 0

  if (!cache || !cache.events.length) {
    if (lock) {
      present(<EmptyWidget message="先打开脚本登录" compact />, Date.now() + EMPTY_RELOAD_MS)
      return
    }
    present(
      <EmptyWidget message="先打开一次「华农课表」脚本，用学号密码登录取到课表，这里就会出现每天的课。" />,
      Date.now() + EMPTY_RELOAD_MS,
    )
    return
  }

  const settings = loadSettings()
  const model = buildWidgetModel(cache, new Date(), undefined, settings.showTime, settings.weekStart)

  if (family === "accessoryRectangular") {
    present(<LockRectWidget model={model} />, model.nextWake)
  } else if (family === "accessoryInline") {
    present(<LockInlineWidget model={model} />, model.nextWake)
  } else if (family === "accessoryCircular") {
    present(<LockCircularWidget model={model} />, model.nextWake)
  } else if (family === "systemLarge" || family.indexOf("ExtraLarge") > -1) {
    present(<LargeWidget model={model} size={size} />, model.nextWake)
  } else if (family === "systemMedium") {
    present(<MediumWidget model={model} />, model.nextWake)
  } else {
    present(<SmallWidget model={model} />, model.nextWake)
  }
}

try {
  run()
} catch (e: any) {
  const message = String(e?.message ?? e)
  console.log("widget error:", message)
  present(<EmptyWidget message={"小组件出错了：" + message} />, Date.now() + EMPTY_RELOAD_MS)
} finally {
  // 文档要求：小组件脚本结束前退出，否则这次时间线会被当成「还没结束」，
  // reloadPolicy 里写的「下次几点再来」也就不生效。
  try {
    Script.exit()
  } catch {
    /* ignore */
  }
}
