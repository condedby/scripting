// 预览用：直接把三种尺寸的课表小组件画出来核对版面（读的是脚本真实缓存）
//
// 用法：scripting-ts preview_ui "<脚本目录>/__preview_widget.tsx" --screenshot
import { HStack, ScrollView, Text, VStack } from "scripting"
import { loadCache } from "./lib/store"
import { type ScheduleData } from "./lib/model"
import { buildWidgetModel } from "./lib/widget"
import { LargeWidget, MediumWidget, SmallWidget } from "./widget/views"

const SMALL = { width: 170, height: 170 }
const MEDIUM = { width: 364, height: 170 }
const LARGE = { width: 364, height: 382 }

function Frame({ title, children }: { title: string; children: any }) {
  return (
    <VStack spacing={4} alignment="leading">
      <Text font={12} foregroundStyle="secondaryLabel">
        {title}
      </Text>
      {children}
    </VStack>
  )
}

function Card({ size, children }: { size: { width: number; height: number }; children: any }) {
  return (
    <VStack
      frame={{ width: size.width, height: size.height }}
      background="secondarySystemBackground"
      clipShape={{ type: "rect", cornerRadius: 20 } as any}
    >
      {children}
    </VStack>
  )
}

/** 今天早上 8:00 / 今天晚上 23:00（用来验证「今天上完了就显示明天」） */
function at(hour: number, minute: number): Date {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d
}

export default function () {
  const cache = loadCache() as ScheduleData | null
  if (!cache || !cache.events.length) {
    return (
      <VStack padding={20}>
        <Text>缓存里没有课表，先跑一次脚本登录。</Text>
      </VStack>
    )
  }

  const morning = buildWidgetModel(cache, at(8, 0), undefined, true)
  const evening = buildWidgetModel(cache, at(23, 0), undefined, true)
  const noTime = buildWidgetModel(cache, at(8, 0), undefined, false)

  return (
    <ScrollView>
      <VStack spacing={18} padding={14} alignment="leading">
        <Frame title="小号 · 早上 8:00（今天）">
          <Card size={SMALL}>
            <SmallWidget model={morning} />
          </Card>
        </Frame>
        <Frame title="小号 · 晚上 23:00（今天的课上完了 → 明天）">
          <Card size={SMALL}>
            <SmallWidget model={evening} />
          </Card>
        </Frame>
        <Frame title="小号 · 关掉「显示上下课时间」">
          <Card size={SMALL}>
            <SmallWidget model={noTime} />
          </Card>
        </Frame>
        <Frame title="中号 · 早上 8:00">
          <Card size={MEDIUM}>
            <MediumWidget model={morning} />
          </Card>
        </Frame>
        <Frame title="大号 · 早上 8:00（今天那一列框起来）">
          <Card size={LARGE}>
            <LargeWidget model={morning} size={LARGE} />
          </Card>
        </Frame>
        <Frame title="大号 · 周日 23:00（焦点应跳到下周）">
          <Card size={LARGE}>
            <LargeWidget model={buildWidgetModel(cache, nextSunday(), undefined, true)} size={LARGE} />
          </Card>
        </Frame>
      </VStack>
    </ScrollView>
  )
}

/** 下一个周日（保证周日后一天是下周一，用来验证跨周） */
function nextSunday(): Date {
  const d = new Date()
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1)
  d.setHours(23, 0, 0, 0)
  return d
}
