/**
 * 华农表 —— 校历
 *
 * 就是教务处那张「第一学期 / 第二学期校历」：
 *   · 月历视图（周一开始），放假日标绿、调休上课日标橙，今天描边
 *   · 点某一天 → 课表跳到那一周
 *   · 底下是校历原文的说明（注册、教学、考试、放假安排…）
 *
 * 放假 / 调休会同时影响课表（见 lib/widget.ts 的 eventsOn）：放假那天不上课，
 * 调休那天按校历指定的「第 N 周周几」的课表上。
 */
import {
  Button,
  Device,
  HStack,
  Image,
  Navigation,
  NavigationStack,
  ProgressView,
  RoundedRectangle,
  ScrollView,
  Spacer,
  Text,
  Toolbar,
  ToolbarItem,
  VStack,
  useEffect,
  useState,
} from "scripting"
import {
  CALENDAR_TTL,
  buildDayFlags,
  fetchAcademicCalendar,
  isoDate,
  parseISODate,
  type AcademicCalendar,
  type AcademicTerm,
  type DayFlagMap,
} from "../lib/calendar"
import { greenFill, greenText, orangeFill, orangeText, surface } from "../lib/theme"
import { loadCalendarCache, saveCalendarCache } from "../lib/store"
import { ACCENT, ACCENT_FILL } from "../lib/widget"

const R_CARD = { type: "rect", cornerRadius: 16 } as any
const R_CELL = { type: "rect", cornerRadius: 10 } as any
const R_CHIP = { type: "rect", cornerRadius: 6 } as any

const GREEN_BG = greenFill()
const GREEN_FG = greenText()
const ORANGE_BG = orangeFill()
const ORANGE_FG = orangeText()
const EMPTY_CELL = surface(0.06)
const ARROW_BG = surface(0.10)

const WD_LABEL = ["一", "二", "三", "四", "五", "六", "日"]

// 页面留白 16×2，卡片内边距 12×2，6 个间距 ×4
const CELL_W = Math.floor((Device.screen.width - 32 - 24 - 6 * 4) / 7)

function Card({ children }: { children: any }) {
  return (
    <VStack
      spacing={8}
      alignment="leading"
      padding={14}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background="secondarySystemGroupedBackground"
      clipShape={R_CARD}
    >
      {children}
    </VStack>
  )
}

/** 「9/25」 */
function mdText(iso: string): string {
  const d = parseISODate(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

interface CellInfo {
  date: Date
  iso: string
  day: number
  /** 非空 = 放假（节日名） */
  off: string
  /** 调休上课 */
  makeup: boolean
  /** 在这一学期范围内 */
  inTerm: boolean
  isToday: boolean
}

/** 某个月的 6×7 网格（周一开始），配上放假 / 调休标记 */
function monthCells(
  term: AcademicTerm | null,
  year: number,
  month: number,
  todayISO: string,
  flags: DayFlagMap,
): CellInfo[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // 周一 = 0
  const cells: CellInfo[] = []
  const start = term && term.weeks.length ? term.weeks[0].monday : ""
  const end = term && term.weeks.length ? term.weeks[term.weeks.length - 1].sunday : ""

  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i)
    const iso = isoDate(d)
    const f = flags[iso]
    cells.push({
      date: d,
      iso,
      day: d.getDate(),
      off: f ? f.off : "",
      makeup: !!(f && f.makeWeek > 0),
      inTerm: !!start && iso >= start && iso <= end,
      isToday: iso === todayISO,
    })
  }
  return cells
}

export function CalendarView({
  currentWeek = 0,
  onPickWeek,
  initial,
}: {
  /** 课表里当前显示的第几周（校历算不出来时兜底） */
  currentWeek?: number
  /** 点某一天 → 让课表跳到那一周 */
  onPickWeek?: (week: number) => void
  /** 预览用：直接给一份数据 */
  initial?: AcademicCalendar
}) {
  const dismiss = Navigation.useDismiss()
  const [data, setData] = useState<AcademicCalendar | null>(initial ?? loadCalendarCache())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [manual, setManual] = useState<number | null>(null)
  const [monthIdx, setMonthIdx] = useState(() => {
    const d = new Date()
    return d.getFullYear() * 12 + d.getMonth()
  })

  async function refresh(silent: boolean) {
    setLoading(true)
    setError("")
    try {
      const cal = await fetchAcademicCalendar()
      saveCalendarCache(cal)
      setData(cal)
    } catch (e: any) {
      if (!silent) setError(e?.message ? String(e.message) : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const cached = loadCalendarCache()
    const fresh = cached && Date.now() - cached.fetchedAt < CALENDAR_TTL
    if (!initial && !fresh) void refresh(!!cached)
  }, [])

  const terms = data?.terms ?? []
  const now = new Date()
  const today = isoDate(now)
  const autoIdx = (() => {
    const i = terms.findIndex(t => t.weeks.length && today >= t.weeks[0].monday && today <= t.weeks[t.weeks.length - 1].sunday)
    return i >= 0 ? i : 0
  })()
  const idx = Math.min(manual ?? autoIdx, Math.max(0, terms.length - 1))
  const term: AcademicTerm | null = terms[idx] ?? null

  const nowWeek = (() => {
    if (!term) return 0
    const hit = term.weeks.find(w => w.week > 0 && today >= w.monday && today <= w.sunday)
    return hit ? hit.week : currentWeek
  })()

  // 月份边界：这一学期的第一天 / 最后一天
  const bounds = (() => {
    if (!term || !term.weeks.length) return null
    const a = parseISODate(term.weeks[0].monday)
    const b = parseISODate(term.weeks[term.weeks.length - 1].sunday)
    return { min: a.getFullYear() * 12 + a.getMonth(), max: b.getFullYear() * 12 + b.getMonth() }
  })()
  // 夹在学期范围内（暑假里进来也不会停在一个空月份）
  const shownIdx = bounds ? Math.min(bounds.max, Math.max(bounds.min, monthIdx)) : monthIdx
  const y = Math.floor(shownIdx / 12)
  const m = shownIdx % 12
  const flags = buildDayFlags(data)
  const cells = monthCells(term, y, m, today, flags)
  const canPrev = !bounds || shownIdx > bounds.min
  const canNext = !bounds || shownIdx < bounds.max

  /** 点某天：换算成第几教学周 */
  function jumpTo(date: Date) {
    if (!term) return
    const iso = isoDate(date)
    const hit = term.weeks.find(w => iso >= w.monday && iso <= w.sunday)
    if (!hit) return
    if (hit.week > 0) {
      onPickWeek?.(hit.week)
      dismiss()
    }
  }

  const startText = term && term.weeks.length ? mdText(term.weeks.find(w => w.week === 1)?.monday || term.weeks[0].monday) : ""

  return (
    <NavigationStack>
      <ScrollView
        navigationTitle="校历"
        navigationBarTitleDisplayMode="inline"
        background="systemGroupedBackground"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="topBarLeading">
              <Button title="关闭" action={dismiss} />
            </ToolbarItem>
          </Toolbar>
        }
      >
        <VStack spacing={10} alignment="leading" padding={{ horizontal: 16, top: 6, bottom: 28 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          {/* 标题卡 */}
          <VStack
            spacing={6}
            alignment="leading"
            padding={16}
            frame={{ maxWidth: "infinity", alignment: "leading" }}
            background="secondarySystemGroupedBackground"
            clipShape={R_CARD}
          >
            <HStack spacing={8}>
              <Text font={12} foregroundStyle="secondaryLabel">
                华南农业大学 · 校历
              </Text>
              <Spacer />
              {loading ? (
                <ProgressView />
              ) : (
                <HStack
                  spacing={4}
                  padding={{ horizontal: 9, vertical: 5 }}
                  background={"rgba(70,112,143,0.12)" as any}
                  clipShape={R_CHIP}
                  onTapGesture={() => void refresh(false)}
                >
                  <Image systemName="arrow.clockwise" font={11} foregroundStyle={ACCENT as any} />
                  <Text font={12} fontWeight="semibold" foregroundStyle={ACCENT as any}>
                    刷新
                  </Text>
                </HStack>
              )}
            </HStack>
            <Text font={22} fontWeight="heavy" lineLimit={1} minScaleFactor={0.7}>
              {term ? `${term.year} 学年` : "校历"}
            </Text>
            <Text font={13} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.8}>
              {term
                ? `${term.term === 2 ? "第二学期" : "第一学期"} · ${startText} 开学 · ${term.teachingWeeks} 个教学周`
                : "正在读取教务处的校历…"}
            </Text>
            {nowWeek > 0 ? (
              <Text font={12} fontWeight="semibold" foregroundStyle={ACCENT as any}>
                今天是 {mdText(today)}，第 {nowWeek} 周
              </Text>
            ) : null}
          </VStack>

          {/* 学期切换 */}
          {terms.length > 1 ? (
            <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              {terms.map((t, i) => {
                const on = i === idx
                return (
                  <HStack
                    key={t.key}
                    padding={{ horizontal: 14, vertical: 7 }}
                    background={(on ? ACCENT_FILL : "secondarySystemGroupedBackground") as any}
                    clipShape={R_CHIP}
                    onTapGesture={() => {
                      setManual(i)
                      const t2 = terms[i]
                      if (t2 && t2.weeks.length) {
                        const first = parseISODate(t2.weeks[0].monday)
                        setMonthIdx(first.getFullYear() * 12 + first.getMonth())
                      }
                    }}
                  >
                    <Text font={13} fontWeight="semibold" foregroundStyle={(on ? "white" : "label") as any} lineLimit={1}>
                      {t.term === 2 ? "第二学期" : "第一学期"}
                      {/征求意见稿/.test(t.title) ? "（草案）" : ""}
                    </Text>
                  </HStack>
                )
              })}
            </HStack>
          ) : null}

          {error ? (
            <Card>
              <Text font={13} foregroundStyle="systemRed">
                {error}
              </Text>
              <Button title="重试" action={() => void refresh(false)} />
            </Card>
          ) : null}

          {!term && loading ? (
            <Card>
              <HStack spacing={10}>
                <ProgressView />
                <Text font={13} foregroundStyle="secondaryLabel">
                  正在读取教务处的校历…
                </Text>
              </HStack>
            </Card>
          ) : null}

          {/* 月历 */}
          {term ? (
            <VStack
              spacing={8}
              padding={{ horizontal: 12, vertical: 12 }}
              frame={{ maxWidth: "infinity", alignment: "leading" }}
              background="secondarySystemGroupedBackground"
              clipShape={R_CARD}
            >
              <HStack spacing={4}>
                <HStack
                  padding={{ horizontal: 10, vertical: 6 }}
                  background={ARROW_BG as any}
                  clipShape={R_CHIP}
                  opacity={canPrev ? 1 : 0.3}
                  onTapGesture={() => (canPrev ? setMonthIdx(shownIdx - 1) : undefined)}
                >
                  <Image systemName="chevron.left" font={12} foregroundStyle="label" />
                </HStack>
                <Spacer />
                <Text font={17} fontWeight="heavy" monospacedDigit>
                  {y} 年 {m + 1} 月
                </Text>
                <Spacer />
                <HStack
                  padding={{ horizontal: 10, vertical: 6 }}
                  background={ARROW_BG as any}
                  clipShape={R_CHIP}
                  opacity={canNext ? 1 : 0.3}
                  onTapGesture={() => (canNext ? setMonthIdx(shownIdx + 1) : undefined)}
                >
                  <Image systemName="chevron.right" font={12} foregroundStyle="label" />
                </HStack>
              </HStack>

              {/* 星期表头（周一开始） */}
              <HStack spacing={4} frame={{ maxWidth: "infinity" }}>
                {WD_LABEL.map(w => (
                  <VStack key={"w" + w} frame={{ width: CELL_W }}>
                    <Text font={11} foregroundStyle="secondaryLabel">
                      {w}
                    </Text>
                  </VStack>
                ))}
              </HStack>

              {/* 6 × 7 */}
              <VStack spacing={4}>
                {[0, 1, 2, 3, 4, 5].map(r => (
                  <HStack key={"r" + r} spacing={4}>
                    {cells.slice(r * 7, r * 7 + 7).map(c => {
                      const strong = c.off || c.makeup
                      const bg = c.off ? GREEN_BG : c.makeup ? ORANGE_BG : EMPTY_CELL
                      const fg = c.off ? GREEN_FG : c.makeup ? ORANGE_FG : c.inTerm ? "label" : "tertiaryLabel"
                      return (
                        <VStack
                          key={c.iso}
                          spacing={1}
                          padding={{ top: 5, bottom: 4, leading: 1, trailing: 1 }}
                          frame={{ width: CELL_W, height: 50 }}
                          background={bg as any}
                          clipShape={R_CELL}
                          opacity={c.inTerm ? 1 : 0.45}
                          overlay={c.isToday ? <RoundedRectangle cornerRadius={10} stroke={{ shapeStyle: ACCENT as any, strokeStyle: { lineWidth: 2 } } as any} /> : undefined}
                          onTapGesture={() => jumpTo(c.date)}
                        >
                          <Text
                            font={14}
                            fontWeight={strong || c.isToday ? "heavy" : "medium"}
                            monospacedDigit
                            foregroundStyle={fg as any}
                            lineLimit={1}
                          >
                            {c.day}
                          </Text>
                          {c.off ? (
                            <Text font={8} fontWeight="semibold" foregroundStyle={GREEN_FG as any} lineLimit={1} minScaleFactor={0.6}>
                              {c.off}
                            </Text>
                          ) : c.makeup ? (
                            <Text font={8} fontWeight="semibold" foregroundStyle={ORANGE_FG as any} lineLimit={1} minScaleFactor={0.6}>
                              调休
                            </Text>
                          ) : null}
                        </VStack>
                      )
                    })}
                  </HStack>
                ))}
              </VStack>

              {/* 图例 */}
              <HStack spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
                <HStack spacing={3}>
                  <VStack frame={{ width: 8, height: 8 }} background={GREEN_BG as any} clipShape={{ type: "rect", cornerRadius: 2 } as any} />
                  <Text font={10} foregroundStyle="secondaryLabel">
                    放假
                  </Text>
                </HStack>
                <HStack spacing={3}>
                  <VStack frame={{ width: 8, height: 8 }} background={ORANGE_BG as any} clipShape={{ type: "rect", cornerRadius: 2 } as any} />
                  <Text font={10} foregroundStyle="secondaryLabel">
                    调休上课
                  </Text>
                </HStack>
                <HStack spacing={3}>
                  <VStack
                    frame={{ width: 8, height: 8 }}
                    clipShape={{ type: "rect", cornerRadius: 2 } as any}
                    overlay={<RoundedRectangle cornerRadius={2} stroke={{ shapeStyle: ACCENT as any, strokeStyle: { lineWidth: 1.5 } } as any} />}
                  />
                  <Text font={10} foregroundStyle="secondaryLabel">
                    今天
                  </Text>
                </HStack>
              </HStack>

              <Text font={10} foregroundStyle="tertiaryLabel">
                点某一天可以跳到课表那一周；放假 / 调休会同步到课表和小组件
              </Text>
            </VStack>
          ) : null}

          {/* 校历原文的说明 */}
          {term && term.notes.length ? (
            <Card>
              <HStack spacing={6}>
                <Image systemName="info.circle" font={13} foregroundStyle={ACCENT as any} />
                <Text font={14} fontWeight="heavy">
                  校历说明
                </Text>
              </HStack>
              {term.notes.map((n, i) => (
                <Text key={"n" + i} font={12} foregroundStyle="secondaryLabel">
                  {n}
                </Text>
              ))}
            </Card>
          ) : null}

          <Text font={10} foregroundStyle="tertiaryLabel">
            校历来自华南农业大学教务处（jwc.scau.edu.cn）
            {data ? ` · 更新于 ${new Date(data.fetchedAt).toLocaleString()}` : ""}
          </Text>
        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}
