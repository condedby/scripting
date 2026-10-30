/**
 * 华农表 —— 课表加课
 *
 * 就是「正常课表」再叠一个加课模式：
 *   · 顶上选周次（单选 / 多选 / 全选 / 单周 / 双周），橙色 = 选中的周，蓝色 = 本周
 *   · 下面是这一周的课表（教务课 + 自己加的课都在，样式跟主页一致）
 *   · 点空格子可以**多选**（几个格子一起选，按列自动合并成连续的节次），再一次性填课名
 *   · 点已有的课可以改 / 删；课名必填，教师和地点不填就显示「未排」
 *   · 加进去的课只属于当前学期，只在选中的周出现
 */
import {
  Button,
  Device,
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
import { termForDate } from "../lib/calendar"
import {
  INK,
  MUTED,
  WEEKDAY_NAMES,
  colorForEvent,
  shortRoom,
  type CourseEvent,
  type WeekStart,
} from "../lib/model"
import {
  applyCourseDelete,
  applyCourseEdit,
  applyOverrides,
  formatWeekText,
  loadOverrides,
  makeCustomEvent,
  saveOverrides,
  type Overrides,
} from "../lib/overrides"
import { loadCalendarCache, loadCache, loadSettings } from "../lib/store"
import { ACCENT, ACCENT_FILL, shortName, tint, weekOf } from "../lib/widget"
import { isDark, surface } from "../lib/theme"
import { CourseForm } from "./course_form"

const PAGE = 10
const CARD_PAD = 6
const GUTTER = 20
const GAP = 3
const ROW_H = 40
// 七天等宽：跟主页一样，不用 maxWidth:"infinity"（那个会按内容各自伸缩）
const COL_W = Math.floor(((Device.screen.width - PAGE * 2 - CARD_PAD * 2 - GUTTER - 1 - GAP * 8) / 7) * 100) / 100

const R_CARD = { type: "rect", cornerRadius: 16 } as any
const R_CELL = { type: "rect", cornerRadius: 6 } as any
const R_BLOCK = { type: "rect", cornerRadius: 7 } as any
const R_CHIP = { type: "rect", cornerRadius: 7 } as any

/** 选中的周 = 橙，本周 = 蓝 */
const ORANGE = isDark() ? "#C98228" : "#D98A2B"

const WD = ["一", "二", "三", "四", "五", "六", "日"]

interface Pick {
  wd: number
  s: number
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** 选中的格子 → 按星期分组、再按连续节次合并成一段一段 */
function pickRuns(picks: Pick[]): Array<{ weekday: number; start: number; end: number }> {
  const byWd: Record<string, number[]> = {}
  for (const p of picks) {
    const k = String(p.wd)
    if (!byWd[k]) byWd[k] = []
    byWd[k].push(p.s)
  }
  const out: Array<{ weekday: number; start: number; end: number }> = []
  for (const k of Object.keys(byWd)) {
    const list = byWd[k].sort((a, b) => a - b)
    let start = list[0]
    let prev = list[0]
    for (let i = 1; i <= list.length; i++) {
      const cur = list[i]
      if (cur === prev + 1) {
        prev = cur
        continue
      }
      out.push({ weekday: Number(k), start, end: prev })
      start = cur
      prev = cur
    }
  }
  return out.sort((a, b) => a.weekday - b.weekday || a.start - b.start)
}

function Card({ children, gap = 8 }: { children: any; gap?: number }) {
  return (
    <VStack
      spacing={gap}
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

export function BlankGridEditor({ onChanged }: { onChanged?: () => void }) {
  const dismiss = Navigation.useDismiss()
  const [ov, setOv] = useState<Overrides>(() => loadOverrides())
  const [picks, setPicks] = useState<Pick[]>([])

  const settings = loadSettings()
  const weekStart: WeekStart = settings.weekStart
  const order: number[] = weekStart === 0 ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7]

  const cal = loadCalendarCache()
  const term = termForDate(cal, new Date())
  const raw = loadCache()
  const data = raw ? applyOverrides(raw, ov, term?.key) : null

  const totalWeeks = Math.max(1, term?.teachingWeeks || 20)
  const maxSession = Math.min(14, Math.max(10, data?.maxSession || 12))
  const curWeek = data ? weekOf(data, new Date()) || data.currentWeek : 0

  const allWeeks: number[] = []
  for (let w = 1; w <= totalWeeks; w++) allWeeks.push(w)

  const [sel, setSel] = useState<number[]>(allWeeks)
  const selSet = new Set<number>(sel)

  /** 选中的周里会出现的课（教务 + 自定义） */
  const events = (data ? data.events : []).filter(
    e => !e.weeks.length || e.weeks.some(w => selSet.has(w)),
  )

  function commit(next: Overrides) {
    setOv(next)
    saveOverrides(next)
    onChanged?.()
  }

  function toggleWeek(w: number) {
    setSel(selSet.has(w) ? sel.filter(x => x !== w) : sel.concat([w]).sort((a, b) => a - b))
    setPicks([])
  }

  function togglePick(wd: number, s: number) {
    if (!sel.length) return
    const hit = picks.find(p => p.wd === wd && p.s === s)
    setPicks(hit ? picks.filter(p => !(p.wd === wd && p.s === s)) : picks.concat([{ wd, s }]))
  }

  function openAdd(picked: Pick[]) {
    if (!picked.length || !sel.length) return
    const runs = pickRuns(picked)
    const first = runs[0]
    const blank: CourseEvent = {
      key: "",
      name: "",
      teacher: "",
      room: "",
      campus: "",
      weekday: first.weekday,
      start: first.start,
      end: first.end,
      sessions: [],
      weeks: sel,
      weekText: formatWeekText(sel),
      credit: "",
      category: "",
      classGroup: "",
      examType: "",
      raw: {},
    }
    void Navigation.present(
      <CourseForm
        initial={blank}
        isNew
        lockWeeks
        lockTime
        timeText={
          runs.length === 1
            ? `${WEEKDAY_NAMES[first.weekday - 1]} 第 ${first.start}-${first.end} 节`
            : `${runs.map(r => `${WEEKDAY_NAMES[r.weekday - 1]} ${r.start}-${r.end}`).join(" · ")}（共 ${runs.length} 段）`
        }
        onSave={f => {
          const created = runs.map(r =>
            makeCustomEvent({
              name: f.name,
              teacher: f.teacher,
              room: f.room,
              weekday: r.weekday,
              start: r.start,
              end: r.end,
              weeks: f.weeks && f.weeks.length ? f.weeks : sel,
              weekText: f.weekText,
              tint: f.tint,
              term: term?.key,
            }),
          )
          commit({ ...ov, added: ov.added.concat(created) })
          setPicks([])
        }}
        onDelete={() => {}}
      />,
    )
  }

  function openCourse(e: CourseEvent) {
    void Navigation.present(
      <CourseForm
        initial={e}
        isNew={false}
        onSave={f => commit(applyCourseEdit(ov, e.key, f))}
        onDelete={() => commit(applyCourseDelete(ov, e.key))}
      />,
    )
  }

  const rows: number[] = []
  for (let s = 1; s <= maxSession; s++) rows.push(s)

  const pickedSet: Record<string, boolean> = {}
  for (const p of picks) pickedSet[p.wd + "-" + p.s] = true

  return (
    <NavigationStack>
      <ScrollView
        navigationTitle="课表加课"
        navigationBarTitleDisplayMode="inline"
        background="systemGroupedBackground"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="topBarLeading">
              <Button title="完成" action={dismiss} />
            </ToolbarItem>
          </Toolbar>
        }
      >
        <VStack
          spacing={10}
          alignment="leading"
          padding={{ horizontal: 16, top: 6, bottom: 28 }}
          frame={{ maxWidth: "infinity", alignment: "leading" }}
        >
          {/* 1. 选周次 */}
          <Card>
            <HStack spacing={6}>
              <Text font={14} fontWeight="heavy">
                加在哪些周
              </Text>
              <Spacer />
              <Text font={11} foregroundStyle="secondaryLabel">
                {sel.length} / {totalWeeks} 周
              </Text>
            </HStack>

            {chunk(allWeeks, 6).map((row, i) => (
              <HStack key={"wr" + i} spacing={6}>
                {row.map(w => {
                  const on = selSet.has(w)
                  const isCur = curWeek > 0 && w === curWeek
                  const bg = isCur ? (on ? ACCENT_FILL : tint(ACCENT, 0.32)) : on ? ORANGE : surface(0.08)
                  const fg = isCur ? (on ? "white" : ACCENT) : on ? "white" : "label"
                  return (
                    <VStack
                      key={"w" + w}
                      spacing={0}
                      frame={{ width: 44, height: 34 }}
                      background={bg as any}
                      clipShape={R_CHIP}
                      onTapGesture={() => toggleWeek(w)}
                    >
                      <Text font={13} fontWeight={on || isCur ? "heavy" : "medium"} foregroundStyle={fg as any}>
                        {w}
                      </Text>
                      {isCur ? (
                        <Text font={7} fontWeight="semibold" foregroundStyle={fg as any} opacity={0.85}>
                          本周
                        </Text>
                      ) : null}
                    </VStack>
                  )
                })}
                {row.length < 6
                  ? Array.from({ length: 6 - row.length }, (_, k) => <VStack key={"pad" + k} frame={{ width: 44, height: 34 }} />)
                  : null}
              </HStack>
            ))}

            <HStack spacing={6}>
              {[
                { t: "全选", f: () => setSel(allWeeks) },
                { t: "清空", f: () => setSel([]) },
                { t: "单周", f: () => setSel(allWeeks.filter(w => w % 2 === 1)) },
                { t: "双周", f: () => setSel(allWeeks.filter(w => w % 2 === 0)) },
              ].map(b => (
                <HStack
                  key={b.t}
                  spacing={4}
                  padding={{ horizontal: 10, vertical: 6 }}
                  background={surface(0.10) as any}
                  clipShape={R_CHIP}
                  onTapGesture={b.f}
                >
                  <Text font={12} fontWeight="semibold" foregroundStyle="label">
                    {b.t}
                  </Text>
                </HStack>
              ))}
              <Spacer />
              <HStack spacing={4}>
                <VStack frame={{ width: 8, height: 8 }} background={ORANGE as any} clipShape={{ type: "rect", cornerRadius: 2 } as any} />
                <Text font={10} foregroundStyle="secondaryLabel">
                  加课
                </Text>
                <VStack frame={{ width: 8, height: 8 }} background={ACCENT_FILL as any} clipShape={{ type: "rect", cornerRadius: 2 } as any} />
                <Text font={10} foregroundStyle="secondaryLabel">
                  本周
                </Text>
              </HStack>
            </HStack>
          </Card>

          {/* 2. 课表（正常课表 + 空格子加课） */}
          <Card gap={6}>
            <HStack spacing={6}>
              <Text font={14} fontWeight="heavy">
                课表
              </Text>
              <Text font={11} foregroundStyle="secondaryLabel">
                {picks.length ? `已选 ${picks.length} 个格子` : "点空格子加课"}
              </Text>
              <Spacer />
              {picks.length ? (
                <HStack
                  padding={{ horizontal: 10, vertical: 5 }}
                  background={ACCENT_FILL as any}
                  clipShape={R_CHIP}
                  onTapGesture={() => openAdd(picks)}
                >
                  <Text font={12} fontWeight="heavy" foregroundStyle={"white" as any}>
                    加课
                  </Text>
                </HStack>
              ) : null}
            </HStack>

            {sel.length === 0 ? (
              <Text font={11} fontWeight="semibold" foregroundStyle={ACCENT as any}>
                先在上面选至少一周
              </Text>
            ) : null}

            {/* 星期表头 */}
            <HStack spacing={GAP} frame={{ maxWidth: "infinity" }}>
              <VStack frame={{ width: GUTTER }} />
              {order.map(wd => (
                <VStack key={"h" + wd} frame={{ width: COL_W, height: 16 }}>
                  <Text font={10} fontWeight="semibold" foregroundStyle="secondaryLabel">
                    {WD[wd - 1]}
                  </Text>
                </VStack>
              ))}
            </HStack>

            <HStack spacing={GAP} frame={{ maxWidth: "infinity", alignment: "top" }}>
              {/* 节次 */}
              <VStack spacing={GAP} frame={{ width: GUTTER }}>
                {rows.map(n => (
                  <VStack key={"n" + n} frame={{ width: GUTTER, height: ROW_H }}>
                    <Text font={10} fontWeight="heavy" foregroundStyle="tertiaryLabel" monospacedDigit>
                      {n}
                    </Text>
                  </VStack>
                ))}
              </VStack>

              {/* 7 天 */}
              {order.map(wd => {
                const cells: any[] = []
                let s = 1
                while (s <= maxSession) {
                  const hit = events.find(e => e.weekday === wd && e.start === s)
                  if (hit) {
                    const span = Math.min(hit.end, maxSession) - s + 1
                    const custom = hit.key.indexOf("custom:") === 0
                    cells.push(
                      <VStack
                        key={hit.key}
                        spacing={1}
                        alignment="leading"
                        padding={{ horizontal: 3, vertical: 2 }}
                        frame={{ width: COL_W, height: span * ROW_H + (span - 1) * GAP }}
                        background={colorForEvent(hit) as any}
                        clipShape={R_BLOCK}
                        onTapGesture={() => openCourse(hit)}
                      >
                        <Text
                          font={9}
                          fontWeight="heavy"
                          foregroundStyle={INK as any}
                          lineLimit={span >= 3 ? 4 : span >= 2 ? 3 : 1}
                          minScaleFactor={0.6}
                        >
                          {shortName(hit.name)}
                        </Text>
                        {span >= 2 ? (
                          <Text font={8} foregroundStyle={MUTED as any} lineLimit={1} minScaleFactor={0.6}>
                            {shortRoom(hit.room) || "未排"}
                          </Text>
                        ) : null}
                        {span >= 3 && custom ? (
                          <Text font={7} foregroundStyle={MUTED as any}>
                            自定义
                          </Text>
                        ) : null}
                        <Spacer />
                      </VStack>,
                    )
                    s += span
                  } else {
                    // ⚠️ 必须提成 const：s 是 let，直接写在事件里会被捕获成最终值（之前“点哪个格子都弹 14-15 节”）
                    const cur = s
                    const picked = !!pickedSet[wd + "-" + cur]
                    cells.push(
                      <VStack
                        key={"e" + wd + "-" + cur}
                        frame={{ width: COL_W, height: ROW_H }}
                        background={(picked ? tint(ACCENT, 0.22) : surface(0.045)) as any}
                        clipShape={R_CELL}
                        overlay={
                          picked
                            ? <RoundedRectangle cornerRadius={6} stroke={{ shapeStyle: ACCENT as any, strokeStyle: { lineWidth: 1.5 } } as any} />
                            : undefined
                        }
                        onTapGesture={() => togglePick(wd, cur)}
                      >
                        <Image
                          systemName={picked ? "checkmark" : "plus"}
                          font={picked ? 10 : 9}
                          foregroundStyle={(picked ? ACCENT : "tertiaryLabel") as any}
                        />
                      </VStack>,
                    )
                    s++
                  }
                }
                return (
                  <VStack key={"d" + wd} spacing={GAP} frame={{ width: COL_W }}>
                    {cells}
                  </VStack>
                )
              })}
            </HStack>

            <Text font={10} foregroundStyle="tertiaryLabel">
              空格子可以连着点几个，再一起加课（同一列连续的会合成一段）；点已有的课可以改或删。
            </Text>
          </Card>

          <Text font={10} foregroundStyle="tertiaryLabel">
            加进去的课只出现在选中的周、只属于当前学期。想批量恢复教务原样，回「自定义课表」用「恢复教务课表」。
          </Text>
        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}
