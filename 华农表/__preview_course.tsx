// 预览用：直接渲染课程详情页（读真实缓存，挑一门本周有课、且一天有多节课的课）
//
// 用法：scripting-ts preview_ui "<脚本目录>/__preview_course.tsx" --screenshot
import { Text, VStack } from "scripting"
import { loadCache } from "./lib/store"
import { weekOf } from "./lib/widget"
import { CourseDetailView } from "./ui/course"
import { type ScheduleData } from "./lib/model"

export default function () {
  const cache = loadCache() as ScheduleData | null
  if (!cache || !cache.events.length) {
    return (
      <VStack padding={20}>
        <Text>缓存里没有课表，先跑一次脚本登录。</Text>
      </VStack>
    )
  }

  const now = new Date()
  const week = weekOf(cache, now)
  const thisWeek = cache.events.filter(e => !e.weeks.length || e.weeks.indexOf(week) > -1)
  // 挑课名出现次数最多的一门（这样小课表里能看到多个高亮时段）
  const counts: Record<string, number> = {}
  for (const e of thisWeek) counts[e.name] = (counts[e.name] || 0) + 1
  const best = thisWeek.slice().sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0) || a.weekday - b.weekday)[0]

  return <CourseDetailView event={best} data={cache} week={week} weekStart={0} />
}
