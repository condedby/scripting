/**
 * 华农表 —— 自定义课程表单（新增 / 编辑，「自定义课表」和「空白课表」两边共用）
 *
 * 只填名字也能存；地点 / 教师空着时列表里显示「未排」。
 */
import {
  Button,
  HStack,
  List,
  Menu,
  Navigation,
  NavigationStack,
  RoundedRectangle,
  Section,
  Spacer,
  Text,
  TextField,
  Toolbar,
  ToolbarItem,
  VStack,
  useState,
} from "scripting"
import { PALETTE, WEEKDAY_NAMES, parseWeeks, type CourseEvent } from "../lib/model"
import { formatWeekText } from "../lib/overrides"
import { surface } from "../lib/theme"

/** 节次选择用的 1..14 */
export const PERIODS = Array.from({ length: 14 }, (_, i) => i + 1)

export interface CourseFormFields {
  name: string
  teacher: string
  room: string
  weekday: number
  start: number
  end: number
  weeks: number[]
  weekText: string
  /** 自定义气泡颜色（PALETTE 下标）；undefined = 按课名自动 */
  tint?: number
}

/** 左边固定标签 + 右边输入框（List 里 TextField 的 title 会被当成 placeholder，填了内容就看不到了） */
function FieldRow({
  label,
  prompt,
  value,
  onChanged,
}: {
  label: string
  prompt: string
  value: string
  onChanged: (v: string) => void
}) {
  return (
    <HStack spacing={8}>
      <Text font={15} frame={{ width: 68, alignment: "leading" }} foregroundStyle="secondaryLabel">
        {label}
      </Text>
      <TextField title="" prompt={prompt} value={value} onChanged={onChanged} frame={{ maxWidth: "infinity" }} />
    </HStack>
  )
}

export function CourseForm({
  initial,
  isNew,
  onSave,
  onDelete,
  onRestore,
  lockWeeks = false,
  lockTime = false,
  timeText = "",
}: {
  initial: CourseEvent
  isNew: boolean
  onSave: (fields: CourseFormFields) => void
  onDelete: () => void
  onRestore?: () => void
  /** 周次由外面的「选周次」决定，表单里只显示不编辑 */
  lockWeeks?: boolean
  /** 星期 / 节次由外面选中的格子决定，表单里只显示不编辑 */
  lockTime?: boolean
  /** lockTime 时显示的时间说明 */
  timeText?: string
}) {
  const dismiss = Navigation.useDismiss()
  const [name, setName] = useState(initial.name)
  const [teacher, setTeacher] = useState(initial.teacher)
  const [room, setRoom] = useState(initial.room)
  const [weekday, setWeekday] = useState(initial.weekday)
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [weekText, setWeekText] = useState(initial.weekText || formatWeekText(initial.weeks))
  const [tintIdx, setTintIdx] = useState<number | undefined>(typeof initial.tint === "number" ? initial.tint : undefined)
  const [note, setNote] = useState("")
  const [confirmDel, setConfirmDel] = useState(false)

  function save() {
    const n = name.trim()
    if (!n) {
      setNote("课程名称不能为空")
      return
    }
    const weeks = parseWeeks(weekText)
    const a = Math.max(1, Math.min(start, end))
    const b = Math.min(14, Math.max(start, end))
    if (!weeks.length) {
      setNote("周次看不懂：可以写 1-16、1-16单（单周）、1,3,5")
      return
    }
    onSave({ name: n, teacher: teacher.trim(), room: room.trim(), weekday, start: a, end: b, weeks, weekText: weekText.trim(), tint: tintIdx })
    dismiss()
  }

  return (
    <NavigationStack>
      <List
        navigationTitle={isNew ? "添加课程" : "编辑课程"}
        navigationBarTitleDisplayMode="inline"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="topBarLeading">
              <Button title="取消" action={dismiss} />
            </ToolbarItem>
            <ToolbarItem placement="topBarTrailing">
              <Button title="保存" action={save} />
            </ToolbarItem>
          </Toolbar>
        }
      >
        <Section>
          <FieldRow label="课程名称" prompt="必填，例如：高等数学" value={name} onChanged={setName} />
          <FieldRow label="教师" prompt="不填就显示「未排」" value={teacher} onChanged={setTeacher} />
          <FieldRow label="地点" prompt="不填就显示「未排」" value={room} onChanged={setRoom} />
        </Section>

        <Section title="气泡颜色">
          <HStack spacing={8}>
            <HStack
              frame={{ width: 34, height: 34 }}
              background={surface(0.12) as any}
              clipShape={{ type: "rect", cornerRadius: 17 } as any}
              overlay={
                tintIdx === undefined ? <RoundedRectangle cornerRadius={17} stroke={{ shapeStyle: "label" as any, strokeStyle: { lineWidth: 2 } } as any} /> : undefined
              }
              onTapGesture={() => setTintIdx(undefined)}
            >
              <Text font={9} fontWeight="semibold" foregroundStyle="secondaryLabel">
                自动
              </Text>
            </HStack>
            {PALETTE.map((p, i) => (
              <VStack
                key={p.name}
                frame={{ width: 34, height: 34 }}
                background={p.bg as any}
                clipShape={{ type: "rect", cornerRadius: 17 } as any}
                overlay={
                  tintIdx === i ? <RoundedRectangle cornerRadius={17} stroke={{ shapeStyle: p.deep as any, strokeStyle: { lineWidth: 2.5 } } as any} /> : undefined
                }
                onTapGesture={() => setTintIdx(i)}
              />
            ))}
          </HStack>
        </Section>

        <Section title="上课时间">
          {lockTime ? (
            <HStack>
              <Text font={15}>时间</Text>
              <Spacer />
              <Text font={14} foregroundStyle="secondaryLabel" lineLimit={2} minScaleFactor={0.7}>
                {timeText || `${WEEKDAY_NAMES[weekday - 1]} 第 ${start}-${end} 节`}
              </Text>
            </HStack>
          ) : (
            <HStack>
              <Text font={15}>星期</Text>
              <Spacer />
              <Menu title={WEEKDAY_NAMES[weekday - 1]}>
                {WEEKDAY_NAMES.map((w, i) => (
                  <Button key={"w" + i} title={w} action={() => setWeekday(i + 1)} />
                ))}
              </Menu>
            </HStack>
          )}
          {lockTime ? null : (
            <HStack>
              <Text font={15}>开始节次</Text>
              <Spacer />
              <Menu title={"第 " + start + " 节"}>
                {PERIODS.map(n => (
                  <Button
                    key={"s" + n}
                    title={"第 " + n + " 节"}
                    action={() => {
                      setStart(n)
                      if (n > end) setEnd(n)
                    }}
                  />
                ))}
              </Menu>
            </HStack>
          )}
          {lockTime ? null : (
            <HStack>
              <Text font={15}>结束节次</Text>
              <Spacer />
              <Menu title={"第 " + end + " 节"}>
                {PERIODS.map(n => (
                  <Button
                    key={"e" + n}
                    title={"第 " + n + " 节"}
                    action={() => {
                      setEnd(n)
                      if (n < start) setStart(n)
                    }}
                  />
                ))}
              </Menu>
            </HStack>
          )}
          {lockWeeks ? (
            <HStack>
              <Text font={15}>周次</Text>
              <Spacer />
              <Text font={15} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.7}>
                {weekText || "未选"}
              </Text>
            </HStack>
          ) : (
            <FieldRow label="周次" prompt="1-16 / 1-16单 / 1,3,5" value={weekText} onChanged={setWeekText} />
          )}
        </Section>

        {note ? (
          <Section>
            <Text font={13} foregroundStyle="systemRed">
              {note}
            </Text>
          </Section>
        ) : null}

        {!isNew ? (
          <Section>
            <Button
              title={confirmDel ? "再点一次就删除" : "删除这门课"}
              role="destructive"
              action={() => {
                if (!confirmDel) {
                  setConfirmDel(true)
                  return
                }
                onDelete()
                dismiss()
              }}
            />
            {onRestore ? <Button title="还原教务的这门课" action={onRestore} /> : null}
          </Section>
        ) : null}
      </List>
    </NavigationStack>
  )
}
