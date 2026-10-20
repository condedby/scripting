/**
 * 华农课表 · 小组件视图（马卡龙风格，参考周课表截图）
 *
 *   小号：今天（上完就顺延到下一个有课的日子）的课，最多 3 门
 *   中号：同一天，单行式，最多 4 门
 *   大号：本周一整张课表，今天那一列淡色高亮 + 日期胶囊填色
 *
 * 色块用「课程深色 @22% 透明度」+ 系统 label 文字色，浅色 / 深色 / 色调（tinted）图标模式下都清晰；今天那列用红色空心框；
 * 教室做成深色小胶囊，教师用灰字。
 */
import { HStack, Image, RoundedRectangle, Spacer, Text, VStack } from "scripting"
import { ACCENT, tint, type WidgetCourse, type WidgetDay, type WidgetModel } from "../lib/widget"
import { shortRoom } from "../lib/model"

export interface Size {
  width: number
  height: number
}

const R1 = { type: "rect", cornerRadius: 6 } as any
const R2 = { type: "rect", cornerRadius: 10 } as any
const R3 = { type: "rect", cornerRadius: 8 } as any
const EMPTY = "rgba(120,120,128,0.07)"
const GAP = 2
const RED = "#FF3B30"

/** 教室胶囊：空心描边（实心填充在色调图标模式下会变成白条） */
function Pill({ text, size = 8 }: { text: string; size?: number }) {
  if (!text) return null
  return (
    <HStack
      padding={{ horizontal: 5, vertical: 1 }}
      clipShape={R3}
      overlay={<RoundedRectangle cornerRadius={8} stroke={"secondaryLabel" as any} />}
    >
      <Text font={size} fontWeight="bold" foregroundStyle="label" lineLimit={1} minScaleFactor={0.6}>
        {text}
      </Text>
    </HStack>
  )
}

/** 窗口：课太多放不下时，先丢掉最早已结束的，保证没上的课优先露出来 */
function windowOf(list: WidgetCourse[], max: number): { shown: WidgetCourse[]; hiddenLeft: number } {
  const arr = list.slice()
  while (arr.length > max && arr[0].state === "done") arr.shift()
  const shown = arr.slice(0, max)
  return { shown, hiddenLeft: list.filter(c => shown.indexOf(c) < 0 && c.state !== "done").length }
}

// ───────────────────────────── 小 / 中号 ─────────────────────────────

/** 「今天 周四 10/15 ……… 第 7 周」 */
function FocusHeader({ model, trailing }: { model: WidgetModel; trailing: string }) {
  const d = model.focus
  return (
    <HStack spacing={4}>
      <Text font={13} fontWeight="heavy" foregroundStyle={ACCENT as any} lineLimit={1}>
        {model.focusLabel}
      </Text>
      <Text font={10} fontWeight="medium" foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.8}>
        {d.label} {d.dateLabel}
      </Text>
      <Spacer />
      <Text font={9} fontWeight="medium" foregroundStyle="tertiaryLabel" lineLimit={1} minScaleFactor={0.75}>
        {trailing}
      </Text>
    </HStack>
  )
}

function NowDot({ c }: { c: WidgetCourse }) {
  if (c.state !== "now") return null
  return <Image systemName="circle.fill" font={6} foregroundStyle={c.deep as any} />
}

/** 小号：左边节次 + 开始时间，右边课名 + 教室胶囊 + 教师 */
function StackRow({ c, showTime }: { c: WidgetCourse; showTime: boolean }) {
  return (
    <HStack
      spacing={6}
      padding={{ horizontal: 7, vertical: 4 }}
      frame={{ maxWidth: "infinity" }}
      background={tint(c.deep, 0.22) as any}
      clipShape={R2}
      opacity={c.state === "done" ? 0.4 : 1}
      overlay={c.state === "now" ? <RoundedRectangle cornerRadius={10} stroke={c.deep as any} /> : undefined}
    >
      <VStack spacing={0} frame={{ width: 32, alignment: "leading" }}>
        <Text font={11} fontWeight="heavy" monospacedDigit foregroundStyle="label" lineLimit={1} minScaleFactor={0.7}>
          {c.start}-{c.end}
        </Text>
        {c.timeText && showTime ? (
          <Text font={8} monospacedDigit foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
            {c.timeText.split("-")[0]}
          </Text>
        ) : null}
        {c.timeText && showTime ? (
          <Text font={8} monospacedDigit foregroundStyle="tertiaryLabel" lineLimit={1} minScaleFactor={0.7}>
            {c.timeText.split("-")[1]}
          </Text>
        ) : null}
      </VStack>
      <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity" }}>
        <Text font={11} fontWeight="heavy" foregroundStyle="label" lineLimit={1} minScaleFactor={0.6}>
          {c.name}
        </Text>
        <HStack spacing={4}>
          <Pill text={shortRoom(c.room)} />
          <Text font={8} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
            {c.teacher}
          </Text>
        </HStack>
      </VStack>
      <NowDot c={c} />
    </HStack>
  )
}

/** 中号：节次 · 课名 · 教室胶囊 · 教师 */
function LineRow({ c }: { c: WidgetCourse }) {
  return (
    <HStack
      spacing={7}
      padding={{ horizontal: 8, vertical: 4 }}
      frame={{ maxWidth: "infinity" }}
      background={tint(c.deep, 0.22) as any}
      clipShape={R2}
      opacity={c.state === "done" ? 0.4 : 1}
      overlay={c.state === "now" ? <RoundedRectangle cornerRadius={10} stroke={c.deep as any} /> : undefined}
    >
      <VStack spacing={0} frame={{ width: 52, alignment: "leading" }}>
        <Text font={11} fontWeight="heavy" monospacedDigit foregroundStyle="label" lineLimit={1} minScaleFactor={0.7}>
          {c.start}-{c.end}
        </Text>
        <Text font={8} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
          {c.timeText}
        </Text>
      </VStack>
      <Text font={12} fontWeight="heavy" foregroundStyle="label" frame={{ maxWidth: "infinity", alignment: "leading" }} lineLimit={1} minScaleFactor={0.6}>
        {c.name}
      </Text>
      <Pill text={shortRoom(c.room)} size={9} />
      <Text font={9} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7} frame={{ width: 44, alignment: "trailing" }}>
        {c.teacher}
      </Text>
      <NowDot c={c} />
    </HStack>
  )
}

function NothingToday({ model }: { model: WidgetModel }) {
  const title = model.focusOffset === 1 ? "明天没有课" : model.todayFinished ? "今天的课都上完了" : "今天没有课"
  return (
    <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      <Spacer />
      <Text font={13} fontWeight="semibold" foregroundStyle="secondaryLabel">
        {title}
      </Text>
      {model.nextClassText ? (
        <VStack spacing={1} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={10} foregroundStyle="tertiaryLabel">
            下次有课
          </Text>
          <Text font={11} fontWeight="semibold" foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
            {model.nextClassText}
          </Text>
        </VStack>
      ) : (
        <Text font={10} foregroundStyle="tertiaryLabel">
          接下来几天都没有课
        </Text>
      )}
      <Spacer />
    </VStack>
  )
}

export function SmallWidget({ model }: { model: WidgetModel }) {
  const { shown: courses, hiddenLeft: rest } = windowOf(model.focusCourses, 3)
  return (
    <VStack alignment="leading" spacing={6} padding={{ top: 7, leading: 11, trailing: 11, bottom: 8 }} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      <FocusHeader model={model} trailing={`第 ${model.focus.week} 周`} />
      {courses.length === 0 ? (
        <NothingToday model={model} />
      ) : (
        <VStack spacing={4} frame={{ maxWidth: "infinity" }}>
          {courses.map(c => (
            <StackRow key={c.key} c={c} showTime={model.showTime} />
          ))}
        </VStack>
      )}
      {rest > 0 ? (
        <Text font={8} foregroundStyle="tertiaryLabel">
          还有 {rest} 门课
        </Text>
      ) : null}
      <Spacer />
    </VStack>
  )
}

export function MediumWidget({ model }: { model: WidgetModel }) {
  const { shown: courses, hiddenLeft: rest } = windowOf(model.focusCourses, 4)
  return (
    <VStack alignment="leading" spacing={6} padding={{ top: 8, leading: 12, trailing: 12, bottom: 8 }} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      <FocusHeader model={model} trailing={`第 ${model.focus.week} 周 · 更新 ${model.updatedText}`} />
      {courses.length === 0 ? (
        <NothingToday model={model} />
      ) : (
        <VStack spacing={4} frame={{ maxWidth: "infinity" }}>
          {courses.map(c => (
            <LineRow key={c.key} c={c} />
          ))}
        </VStack>
      )}
      {rest > 0 ? (
        <Text font={8} foregroundStyle="tertiaryLabel">
          还有 {rest} 门课
        </Text>
      ) : null}
      <Spacer />
    </VStack>
  )
}

// ───────────────────────────── 大号 ─────────────────────────────

const WD_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

/** 日期胶囊：今天用红字，其余中性灰底 */
function WeekdayHead({ day }: { day: WidgetDay }) {
  const t = day.isToday
  const main: any = t ? RED : "label"
  const sub: any = t ? RED : "secondaryLabel"
  return (
    <VStack spacing={0} padding={{ vertical: 3 }} frame={{ maxWidth: "infinity" }} background={EMPTY as any} clipShape={R3}>
      <Text font={11} fontWeight="heavy" monospacedDigit foregroundStyle={main} lineLimit={1} minScaleFactor={0.7}>
        {day.date}
      </Text>
      <Text font={7} fontWeight="semibold" foregroundStyle={sub} lineLimit={1} minScaleFactor={0.7}>
        {WD_EN[day.weekday - 1]}
      </Text>
    </VStack>
  )
}

function GridBlock({ c, span, rowH }: { c: WidgetCourse; span: number; rowH: number }) {
  const height = span * rowH + (span - 1) * GAP
  return (
    <VStack
      spacing={2}
      alignment="leading"
      padding={{ horizontal: 3, vertical: 2 }}
      frame={{ maxWidth: "infinity", height }}
      background={tint(c.deep, 0.22) as any}
      clipShape={R1}
      overlay={c.state === "now" ? <RoundedRectangle cornerRadius={6} stroke={c.deep as any} /> : undefined}
    >
      <Text
        font={9}
        fontWeight="heavy"
        foregroundStyle="label"
        lineLimit={span >= 3 ? 4 : span >= 2 ? 2 : 1}
        minScaleFactor={0.55}
      >
        {c.name}
      </Text>
      {span >= 2 && c.room ? <Pill text={shortRoom(c.room)} size={7} /> : null}
      <Spacer />
    </VStack>
  )
}

/** 一天的竖列；今天这一列套红色空心框 */
function DayColumn({ day, rows, rowH }: { day: WidgetDay; rows: number; rowH: number }) {
  const cells: any[] = []
  let s = 1
  while (s <= rows) {
    const hit = day.courses.find(c => c.start === s)
    if (hit) {
      const end = Math.min(hit.end, rows)
      cells.push(<GridBlock key={hit.key} c={hit} span={end - s + 1} rowH={rowH} />)
      s = end + 1
    } else {
      cells.push(<VStack key={"e" + s} frame={{ maxWidth: "infinity", height: rowH }} background={EMPTY as any} clipShape={R1} />)
      s++
    }
  }

  const body = (
    <VStack spacing={GAP} frame={{ maxWidth: "infinity" }}>
      {cells}
    </VStack>
  )

  if (!day.isToday) return <VStack spacing={0} frame={{ maxWidth: "infinity" }}>{body}</VStack>

  // 今天：红色空心边框
  return (
    <VStack
      spacing={0}
      padding={{ horizontal: 1 }}
      frame={{ maxWidth: "infinity" }}
      overlay={<RoundedRectangle cornerRadius={8} stroke={RED as any} />}
    >
      {body}
    </VStack>
  )
}

export function LargeWidget({ model, size }: { model: WidgetModel; size: Size }) {
  const rows = model.maxSession
  const gutter = 12
  // 标题行 + 日期胶囊 + 上下内边距，剩下的都给网格
  const headerH = 16 + 5 + 26 + 3 + 20
  const avail = Math.max(120, size.height - headerH)
  const rowH = Math.max(13, Math.floor((avail - GAP * (rows - 1)) / rows))

  const todayCount = model.today.courses.length
  const rightText = model.stale ? `课表更新于 ${model.updatedText}` : todayCount ? `今天 ${todayCount} 门课` : "今天没课"

  return (
    <VStack alignment="leading" spacing={5} padding={10} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      <HStack spacing={5}>
        <Text font={13} fontWeight="heavy" lineLimit={1}>
          第 {model.week} 周
        </Text>
        <Text font={9} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.8}>
          {model.today.label} {model.today.dateLabel}
        </Text>
        <Spacer />
        <Text font={9} fontWeight="medium" foregroundStyle={model.stale ? "tertiaryLabel" : (ACCENT as any)} lineLimit={1} minScaleFactor={0.75}>
          {rightText}
        </Text>
      </HStack>

      <VStack spacing={3} frame={{ maxWidth: "infinity" }}>
        <HStack spacing={GAP} frame={{ maxWidth: "infinity" }}>
          <VStack frame={{ width: gutter }} />
          {model.days.map(d => (
            <WeekdayHead key={d.weekday} day={d} />
          ))}
        </HStack>

        <HStack spacing={GAP} frame={{ maxWidth: "infinity" }}>
          <VStack spacing={GAP} frame={{ width: gutter }}>
            {Array.from({ length: rows }, (_, i) => i + 1).map(n => (
              <VStack key={"n" + n} frame={{ height: rowH, alignment: "top" }}>
                <Text font={9} fontWeight="heavy" foregroundStyle="tertiaryLabel">
                  {n}
                </Text>
              </VStack>
            ))}
          </VStack>
          {model.days.map(d => (
            <DayColumn key={d.weekday} day={d} rows={rows} rowH={rowH} />
          ))}
        </HStack>
      </VStack>
    </VStack>
  )
}

// ───────────────────────────── 没有数据 ─────────────────────────────

export function EmptyWidget({ message, compact }: { message: string; compact?: boolean }) {
  if (compact) return <Text font={12}>{message}</Text>
  return (
    <VStack alignment="leading" spacing={8} padding={14} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      <Text font={13} fontWeight="heavy" foregroundStyle={ACCENT as any}>
        华农课表
      </Text>
      <Spacer />
      <Image systemName="calendar.badge.exclamationmark" font={22} foregroundStyle="secondaryLabel" />
      <Text font={10} foregroundStyle="secondaryLabel" lineLimit={4}>
        {message}
      </Text>
      <Spacer />
    </VStack>
  )
}

// ───────────────────────────── 锁屏小组件 ─────────────────────────────
// 锁屏只有单色，所以不放色块：用 label / secondaryLabel 文字，系统会自己着色。

function nextCourse(model: WidgetModel): WidgetCourse | undefined {
  return model.focusCourses.find(c => c.state !== "done")
}

function nextTag(model: WidgetModel, c: WidgetCourse): string {
  if (c.state === "now") return "正在上课"
  if (model.focusOffset === 0) return `下一节 · ${c.start}-${c.end}节`
  return `${model.focusLabel} ${model.focus.label} · ${c.start}-${c.end}节`
}

/** 锁屏矩形（占两格）：下一节课 —— 提示 + 时间 / 课名 / 教室 · 教师 */
export function LockRectWidget({ model }: { model: WidgetModel }) {
  const c = nextCourse(model)
  if (!c) {
    return (
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
        <Text font={11} fontWeight="semibold" foregroundStyle="secondaryLabel">
          华农表
        </Text>
        <Text font={14} fontWeight="heavy">
          近期没有课
        </Text>
      </VStack>
    )
  }
  const info = [shortRoom(c.room), c.teacher].filter(x => !!x).join(" · ")
  return (
    <VStack alignment="leading" spacing={1} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
      <HStack spacing={4}>
        <Text font={10} fontWeight="semibold" foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
          {nextTag(model, c)}
        </Text>
        <Spacer />
        <Text font={10} fontWeight="semibold" monospacedDigit foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
          {c.timeText}
        </Text>
      </HStack>
      <Text font={15} fontWeight="heavy" lineLimit={1} minScaleFactor={0.6}>
        {c.name}
      </Text>
      <Text font={11} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
        {info}
      </Text>
    </VStack>
  )
}

/** 锁屏一行文字 */
export function LockInlineWidget({ model }: { model: WidgetModel }) {
  const c = nextCourse(model)
  if (!c) return <Text>近期没有课</Text>
  return (
    <Text lineLimit={1}>
      {c.timeText ? c.timeText.split("-")[0] + " " : ""}
      {c.name} {shortRoom(c.room)}
    </Text>
  )
}

/** 锁屏圆形：节次 + 教室 */
export function LockCircularWidget({ model }: { model: WidgetModel }) {
  const c = nextCourse(model)
  if (!c) return <Text font={11}>无课</Text>
  return (
    <VStack spacing={0}>
      <Text font={9} foregroundStyle="secondaryLabel">
        {c.state === "now" ? "正在" : "下节"}
      </Text>
      <Text font={15} fontWeight="heavy" monospacedDigit>
        {c.start}-{c.end}
      </Text>
      <Text font={8} lineLimit={1} minScaleFactor={0.6}>
        {shortRoom(c.room)}
      </Text>
    </VStack>
  )
}
