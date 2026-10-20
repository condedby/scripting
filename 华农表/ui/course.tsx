/**
 * 华农表 —— 课程详情
 *
 * 视觉化重点：
 *   1. 顶部大标题卡片：课名 + 教师 / 教室 + 学分 / 类别 / 考核 chip
 *   2. 「本周课表」小课表：**只高亮这门课的气泡**，其它课淡成灰底；
 *      点色块可在同一门课的不同时段之间切换（选中的那一格加深色描边）
 *   3. 上课时间：时段 chip（周四 3-4）+ 图标指标（星期 / 时间 / 地点 / 教学班）
 *   4. 周次：一根一根的周次条，上这门课的周次点亮、本周加圈
 */
import {
  Button,
  HStack,
  Image,
  Navigation,
  NavigationStack,
  RoundedRectangle,
  ScrollView,
  Spacer,
  Text,
  Toolbar,
  ToolbarItem,
  VStack,
  useState,
} from "scripting"
import {
  DEFAULT_PERIODS,
  INK,
  MUTED,
  PILL,
  WEEKDAY_FULL,
  colorForCourse,
  deepForCourse,
  formatWeeks,
  periodTime,
  shortRoom,
  termLabel,
  type CourseEvent,
  type PeriodTime,
  type ScheduleData,
  type WeekStart,
} from "../lib/model"
import { ACCENT, shortName, tint, weekWindow } from "../lib/widget"

const MGAP = 3
const MROW = 30
const GUTTER = 18
const EMPTY = "rgba(120,120,128,0.10)"
const R_CARD = { type: "rect", cornerRadius: 16 } as any
const R_BLOCK = { type: "rect", cornerRadius: 8 } as any
const R_CHIP = { type: "rect", cornerRadius: 9 } as any
const R_SMALL = { type: "rect", cornerRadius: 3 } as any

const WD_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

function Card({ children, gap = 10 }: { children: any; gap?: number }) {
  return (
    <VStack
      spacing={gap}
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

/** 「第 3-4 节」+「09:55-11:20」 */
function sessionTime(periods: PeriodTime[], start: number, end: number): string {
  const a = periodTime(periods, start)
  const b = periodTime(periods, end) || a
  if (!a) return ""
  if (!b || b === a) return a.start
  return `${a.start}-${b.end}`
}

function Chip({ text, color }: { text: string; color: string }) {
  if (!text) return null
  return (
    <HStack padding={{ horizontal: 8, vertical: 4 }} background={tint(color, 0.18)} clipShape={R_CHIP}>
      <Text font={11} fontWeight="semibold" foregroundStyle={color as any} lineLimit={1} minScaleFactor={0.7}>
        {text}
      </Text>
    </HStack>
  )
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  if (!value) return null
  return (
    <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
      <Image systemName={icon} font={12} foregroundStyle={ACCENT as any} frame={{ width: 16 }} />
      <VStack spacing={1} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font={9} foregroundStyle="secondaryLabel">
          {label}
        </Text>
        <Text font={13} fontWeight="semibold" lineLimit={2} minScaleFactor={0.7}>
          {value}
        </Text>
      </VStack>
    </HStack>
  )
}

/** 小课表里的一格：hot = 是这门课；selected = 当前查看的时段（深色描边） */
function MiniBlock({
  c,
  span,
  hot,
  selected,
  onPick,
}: {
  c: CourseEvent
  span: number
  hot: boolean
  selected: boolean
  onPick: (e: CourseEvent) => void
}) {
  const height = span * MROW + (span - 1) * MGAP
  return (
    <VStack
      spacing={2}
      alignment="leading"
      padding={{ horizontal: 3, vertical: 2 }}
      frame={{ maxWidth: "infinity", height }}
      background={(hot ? colorForCourse(c.name) : tint(deepForCourse(c.name), 0.10)) as any}
      clipShape={R_BLOCK}
      overlay={selected ? <RoundedRectangle cornerRadius={8} stroke={deepForCourse(c.name) as any} /> : undefined}
      onTapGesture={hot ? () => onPick(c) : undefined}
    >
      <Text
        font={hot ? 9 : 8}
        fontWeight={hot ? "heavy" : "medium"}
        foregroundStyle={(hot ? INK : "secondaryLabel") as any}
        lineLimit={span >= 3 ? 4 : span >= 2 ? 3 : 1}
        minScaleFactor={0.6}
      >
        {hot ? shortName(c.name) : ""}
      </Text>
      {hot && span >= 2 && c.room ? (
        <HStack padding={{ horizontal: 4, vertical: 1 }} background={PILL as any} clipShape={{ type: "rect", cornerRadius: 7 } as any}>
          <Text font={7} fontWeight="bold" foregroundStyle={"white" as any} lineLimit={1} minScaleFactor={0.6}>
            {shortRoom(c.room)}
          </Text>
        </HStack>
      ) : null}
      <Spacer />
    </VStack>
  )
}

/** 周次条：上这门课的周次点亮，本周加圈 */
function WeekBars({
  weeks,
  maxWeek,
  currentWeek,
  color,
}: {
  weeks: number[]
  maxWeek: number
  currentWeek: number
  color: string
}) {
  const list: number[] = []
  for (let w = 1; w <= maxWeek; w++) list.push(w)
  // ⚠️ 色块用 RoundedRectangle：空 VStack + background 在 HStack 里会被压成 0 宽，什么都画不出来
  //（在竖直的列里没问题，但横着排就不行 —— 已用对照实验确认）
  return (
    <HStack spacing={2} frame={{ maxWidth: "infinity" }} alignment="top">
      {list.map(w => {
        const on = weeks.indexOf(w) > -1
        return (
          <VStack key={"w" + w} spacing={4} frame={{ maxWidth: "infinity" }}>
            <VStack
              frame={{ maxWidth: "infinity", height: 22 }}
              overlay={w === currentWeek ? <RoundedRectangle cornerRadius={3} stroke={INK as any} /> : undefined}
            >
              <RoundedRectangle cornerRadius={3} fill={(on ? color : EMPTY) as any} />
            </VStack>
            <Text
              font={7}
              fontWeight={w === currentWeek ? "heavy" : "medium"}
              monospacedDigit
              foregroundStyle={(w === currentWeek ? INK : "tertiaryLabel") as any}
              lineLimit={1}
              minScaleFactor={0.5}
            >
              {w}
            </Text>
          </VStack>
        )
      })}
    </HStack>
  )
}

export function CourseDetailView({
  event,
  data,
  week,
  weekStart = 0,
  periods = DEFAULT_PERIODS,
}: {
  event: CourseEvent
  data: ScheduleData
  week: number
  weekStart?: WeekStart
  periods?: PeriodTime[]
}) {
  const dismiss = Navigation.useDismiss()
  const [picked, setPicked] = useState<string>(event.key)

  // 同一门课（同名）的所有时段
  const sessions = data.events
    .filter(e => e.name === event.name)
    .sort((a, b) => a.weekday - b.weekday || a.start - b.start)
  const cur = sessions.find(s => s.key === picked) || event
  const hotKeys = sessions.map(s => s.key)

  const days = weekWindow(data, week, weekStart)

  // 小课表只画用得到的节次范围（这门课 + 本周其它课）
  let minRow = cur.start
  let maxRow = cur.end
  for (const d of days) {
    for (const e of d.events) {
      if (e.start < minRow) minRow = e.start
      if (e.end > maxRow) maxRow = e.end
    }
  }
  const from = Math.max(1, minRow)
  const to = Math.min(data.maxSession, maxRow)
  const rowNums: number[] = []
  for (let n = from; n <= to; n++) rowNums.push(n)

  const weeks = (() => {
    const set = new Set<number>(cur.weeks)
    for (const s of sessions) for (const w of s.weeks) set.add(w)
    return Array.from(set).sort((a, b) => a - b)
  })()
  const maxWeek = Math.min(30, Math.max(20, week, weeks.length ? Math.max(...weeks) : 0))
  const deep = deepForCourse(event.name)

  return (
    <NavigationStack>
      <ScrollView
        navigationTitle="课程详情"
        navigationBarTitleDisplayMode="inline"
        background="systemGroupedBackground"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="topBarTrailing">
              <Button title="关闭" action={dismiss} />
            </ToolbarItem>
          </Toolbar>
        }
      >
        <VStack spacing={12} padding={{ horizontal: 10, top: 6, bottom: 24 }}>
          {/* 1. 大标题卡片 */}
          <Card>
            <VStack spacing={5} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Text font={22} fontWeight="heavy" foregroundStyle={INK as any} lineLimit={2} minScaleFactor={0.7}>
                {shortName(event.name)}
              </Text>
              <Text font={13} foregroundStyle={MUTED as any} lineLimit={1} minScaleFactor={0.75}>
                {[cur.teacher || "教师待定", shortRoom(cur.room) || "地点待定", cur.campus].filter(Boolean).join(" · ")}
              </Text>
            </VStack>
            <HStack spacing={6}>
              <Chip text={cur.credit ? `${cur.credit} 学分` : ""} color={deep} />
              <Chip text={cur.category} color={deep} />
              <Chip text={cur.examType} color={deep} />
            </HStack>
          </Card>

          {/* 2. 本周课表：只高亮这门课 */}
          <Card gap={8}>
            <HStack spacing={6}>
              <Text font={16} fontWeight="heavy">
                本周课表
              </Text>
              <Text font={11} foregroundStyle="secondaryLabel">
                第 {week} 周
              </Text>
              <Spacer />
              <Text font={10} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
                只高亮这门课
              </Text>
            </HStack>

            <HStack spacing={MGAP} frame={{ maxWidth: "infinity" }}>
              <VStack frame={{ width: GUTTER }} />
              {days.map(d => (
                <VStack
                  key={"h" + d.weekday}
                  spacing={1}
                  padding={{ vertical: 5 }}
                  frame={{ maxWidth: "infinity" }}
                  background={(d.isToday ? tint(ACCENT, 0.16) : EMPTY) as any}
                  clipShape={{ type: "rect", cornerRadius: 10 } as any}
                >
                  <Text font={12} fontWeight="heavy" monospacedDigit foregroundStyle={(d.isToday ? ACCENT : INK) as any} lineLimit={1} minScaleFactor={0.7}>
                    {d.date.getDate()}
                  </Text>
                  <Text font={7} fontWeight="semibold" foregroundStyle={(d.isToday ? ACCENT : "secondaryLabel") as any} lineLimit={1} minScaleFactor={0.7}>
                    {WD_EN[d.weekday - 1]}
                  </Text>
                </VStack>
              ))}
            </HStack>

            <HStack spacing={MGAP} frame={{ maxWidth: "infinity" }}>
              <VStack spacing={MGAP} frame={{ width: GUTTER }}>
                {rowNums.map(n => (
                  <VStack key={"n" + n} frame={{ height: MROW, alignment: "top" }}>
                    <Text
                      font={10}
                      fontWeight="heavy"
                      foregroundStyle={(n >= cur.start && n <= cur.end ? ACCENT : "tertiaryLabel") as any}
                    >
                      {n}
                    </Text>
                  </VStack>
                ))}
              </VStack>
              {days.map(d => {
                const cells: any[] = []
                let s = from
                while (s <= to) {
                  const hit = d.events.find(e => e.start === s)
                  if (hit) {
                    const end = Math.min(hit.end, to)
                    cells.push(
                      <MiniBlock
                        key={hit.key}
                        c={hit}
                        span={end - s + 1}
                        hot={hotKeys.indexOf(hit.key) > -1}
                        selected={hit.key === cur.key}
                        onPick={e => setPicked(e.key)}
                      />,
                    )
                    s = end + 1
                  } else {
                    cells.push(
                      <VStack
                        key={"g" + s}
                        frame={{ maxWidth: "infinity", height: MROW }}
                        background={EMPTY as any}
                        clipShape={{ type: "rect", cornerRadius: 6 } as any}
                      />,
                    )
                    s++
                  }
                }
                return (
                  <VStack key={"c" + d.weekday} spacing={MGAP} frame={{ maxWidth: "infinity" }}>
                    {cells}
                  </VStack>
                )
              })}
            </HStack>

            <Text font={10} foregroundStyle="tertiaryLabel">
              深色描边＝当前查看的时段，点其它色块可切换
            </Text>
          </Card>

          {/* 3. 上课时间 */}
          <Card gap={10}>
            <Text font={16} fontWeight="heavy">
              上课时间
            </Text>
            <HStack spacing={6}>
              {sessions.map(s => {
                const on = s.key === cur.key
                return (
                  <HStack
                    key={s.key}
                    spacing={4}
                    padding={{ horizontal: 9, vertical: 5 }}
                    background={(on ? deep : tint(deep, 0.16)) as any}
                    clipShape={R_CHIP}
                    onTapGesture={() => setPicked(s.key)}
                  >
                    <Text
                      font={12}
                      fontWeight="heavy"
                      foregroundStyle={(on ? "white" : deep) as any}
                      lineLimit={1}
                      minScaleFactor={0.7}
                    >
                      {WEEKDAY_FULL[s.weekday - 1]?.replace("星期", "周")} {s.start}-{s.end}
                    </Text>
                  </HStack>
                )
              })}
            </HStack>

            <HStack spacing={10} frame={{ maxWidth: "infinity" }}>
              <InfoItem icon="calendar" label="星期" value={`${WEEKDAY_FULL[cur.weekday - 1] || ""}（第 ${week} 周）`} />
              <InfoItem icon="clock" label="节次 · 时间" value={`第 ${cur.start}-${cur.end} 节 · ${sessionTime(periods, cur.start, cur.end)}`} />
            </HStack>
            <HStack spacing={10} frame={{ maxWidth: "infinity" }}>
              <InfoItem icon="mappin.and.ellipse" label="上课地点" value={[cur.campus, cur.room].filter(Boolean).join(" ") || "待定"} />
              <InfoItem icon="person.2" label="教学班" value={cur.classGroup} />
            </HStack>
          </Card>

          {/* 4. 周次 */}
          <Card gap={10}>
            <HStack spacing={6}>
              <Text font={16} fontWeight="heavy">
                周次
              </Text>
              <Spacer />
              <Text font={11} foregroundStyle="secondaryLabel">
                共 {weeks.length} 周
              </Text>
            </HStack>
            <WeekBars weeks={weeks} maxWeek={maxWeek} currentWeek={week} color={deep} />
            <Text font={11} foregroundStyle="secondaryLabel" lineLimit={2}>
              {formatWeeks(weeks)}
              {cur.weekText && cur.weekText.replace(/\s/g, "") !== formatWeeks(weeks).replace(/\s/g, "") ? `（原文：${cur.weekText}）` : ""}
            </Text>
          </Card>

          {/* 5. 课程信息 */}
          <Card gap={10}>
            <Text font={16} fontWeight="heavy">
              课程信息
            </Text>
            <InfoItem icon="graduationcap" label="学期" value={`${data.student.xnName} ${termLabel(data.student.xqm)}`} />
            <InfoItem icon="person.crop.circle" label="教师" value={cur.teacher} />
            <InfoItem icon="number" label="学生" value={[data.student.name, data.student.className].filter(Boolean).join(" · ")} />
          </Card>
        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}
