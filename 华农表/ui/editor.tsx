/**
 * 华农表 —— 自定义课表
 *
 * 教务拉的课表只是底稿，这里可以在本机：
 *   · 改课名 / 教师 / 地点 / 星期 / 节次 / 周次
 *   · 删掉某门课（比如早就结课、或者你根本没选）
 *   · 「空白课表」模式：先选周次，再在空课表上点格子加课（辅修、实验、补课…）
 *   · 「恢复教务课表」一键回到学校给的原样
 *
 * 改动存在 scau.overrides 里（见 lib/overrides.ts），不会动到课表缓存本身，
 * 所以重新刷新教务也不会把这些改动弄丢。
 */
import { Button, HStack, Image, Navigation, NavigationStack, ScrollView, Text, Toolbar, ToolbarItem, VStack, useState } from "scripting"
import type { CourseEvent } from "../lib/model"
import {
  applyCourseDelete,
  applyCourseEdit,
  applyCourseRestore,
  applyOverrides,
  clearOverrides,
  formatWeekText,
  loadOverrides,
  makeCustomEvent,
  overrideCount,
  saveOverrides,
  type Overrides,
} from "../lib/overrides"
import { loadCalendarCache, loadCache } from "../lib/store"
import { termForDate } from "../lib/calendar"
import { surface } from "../lib/theme"
import { ACCENT, ACCENT_FILL, shortName } from "../lib/widget"
import { BlankGridEditor } from "./blank_grid"
import { CourseForm } from "./course_form"

const R_CARD = { type: "rect", cornerRadius: 16 } as any
const R_ROW = { type: "rect", cornerRadius: 10 } as any
const R_CHIP = { type: "rect", cornerRadius: 6 } as any

function Card({ title, children }: { title?: string; children: any }) {
  return (
    <VStack
      spacing={8}
      alignment="leading"
      padding={14}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background="secondarySystemGroupedBackground"
      clipShape={R_CARD}
    >
      {title ? (
        <Text font={13} fontWeight="heavy" foregroundStyle="secondaryLabel">
          {title}
        </Text>
      ) : null}
      {children}
    </VStack>
  )
}

export function ScheduleEditor({ onChanged }: { onChanged?: () => void }) {
  const dismiss = Navigation.useDismiss()
  const [ov, setOv] = useState<Overrides>(() => loadOverrides())
  const [confirmReset, setConfirmReset] = useState(false)

  const term = termForDate(loadCalendarCache(), new Date())
  const raw = loadCache()
  const data = raw ? applyOverrides(raw, ov, term?.key) : null
  const counts = overrideCount(ov)

  function commit(next: Overrides) {
    setOv(next)
    saveOverrides(next)
    onChanged?.()
  }

  function openBlank() {
    void Navigation.present(<BlankGridEditor onChanged={() => commit(loadOverrides())} />)
  }

  function openForm(event: CourseEvent, isNew: boolean) {
    const custom = event.key.indexOf("custom:") === 0
    void Navigation.present(
      <CourseForm
        initial={event}
        isNew={isNew}
        onSave={f => {
          if (isNew) {
            commit({ ...ov, added: ov.added.concat([makeCustomEvent({ ...f, term: term?.key })]) })
            return
          }
          commit(applyCourseEdit(ov, event.key, f))
        }}
        onDelete={() => commit(applyCourseDelete(ov, event.key))}
        onRestore={custom || !ov.edited[event.key] ? undefined : () => commit(applyCourseRestore(ov, event.key))}
      />,
    )
  }

  function addCourse() {
    openForm(
      {
        key: "",
        name: "",
        teacher: "",
        room: "",
        campus: "",
        weekday: 1,
        start: 1,
        end: 2,
        sessions: [1, 2],
        weeks: [],
        weekText: "",
        credit: "",
        category: "",
        classGroup: "",
        examType: "",
        raw: {},
      },
      true,
    )
  }

  return (
    <NavigationStack>
      <ScrollView
        navigationTitle="自定义课表"
        navigationBarTitleDisplayMode="inline"
        background="systemGroupedBackground"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="topBarLeading">
              <Button title="关闭" action={dismiss} />
            </ToolbarItem>
            <ToolbarItem placement="topBarTrailing">
              <Button title="添加" systemImage="plus" action={addCourse} />
            </ToolbarItem>
          </Toolbar>
        }
      >
        <VStack
          spacing={12}
          alignment="leading"
          padding={{ horizontal: 16, top: 6, bottom: 28 }}
          frame={{ maxWidth: "infinity", alignment: "leading" }}
        >
          <Card>
            <Text font={13} foregroundStyle="secondaryLabel">
              这里的改动只存在本机，刷新课表也不会丢。想回到学校给的原样，用下面的「恢复教务课表」。
            </Text>

            {/* 主入口：选周次 → 空白课表 → 点格子加课 */}
            <HStack
              spacing={10}
              padding={{ horizontal: 14, vertical: 12 }}
              frame={{ maxWidth: "infinity", alignment: "leading" }}
              background={ACCENT_FILL as any}
              clipShape={R_ROW}
              onTapGesture={openBlank}
            >
              <Image systemName="square.grid.3x3.fill" font={18} foregroundStyle={"white" as any} />
              <VStack spacing={1} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
                <Text font={15} fontWeight="heavy" foregroundStyle={"white" as any}>
                  课表上加课
                </Text>
                <Text font={10} foregroundStyle={"rgba(255,255,255,0.82)" as any}>
                  选周次 → 点空格子（可多选）→ 填课名
                </Text>
              </VStack>
              <Image systemName="chevron.right" font={12} foregroundStyle={"rgba(255,255,255,0.8)" as any} />
            </HStack>

            <HStack spacing={6}>
              <Text font={12} fontWeight="semibold" foregroundStyle={ACCENT as any}>
                改过 {counts.edited}
              </Text>
              <Text font={12} fontWeight="semibold" foregroundStyle={ACCENT as any}>
                删掉 {counts.removed}
              </Text>
              <Text font={12} fontWeight="semibold" foregroundStyle={ACCENT as any}>
                自己加 {counts.added}
              </Text>
            </HStack>
            <Button
              title={confirmReset ? "再点一次：恢复教务课表" : "恢复教务课表"}
              action={() => {
                if (!confirmReset) {
                  setConfirmReset(true)
                  return
                }
                clearOverrides()
                setConfirmReset(false)
                commit(loadOverrides())
              }}
            />
          </Card>

          {!data ? (
            <Card>
              <Text font={13} foregroundStyle="secondaryLabel">
                还没有课表：先在设置里登录读取一次，再回来改。
              </Text>
            </Card>
          ) : null}

          <Text font={10} foregroundStyle="tertiaryLabel">
            小提示：要改 / 删某门课，进「课表上加课」点那张课就行；周次写「1-16」表示 1 到 16 周每周都有，「1-16单」是单周。
          </Text>
        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}
