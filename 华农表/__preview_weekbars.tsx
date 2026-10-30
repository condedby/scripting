// 预览用：课程详情里的周次条（看本周的蓝色高亮）
import { VStack, Text } from "scripting"
import { WeekBars } from "./ui/course"

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

export default function Preview() {
  return (
    <VStack spacing={18} padding={16} alignment="leading" frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
      <Text font={15} fontWeight="heavy">
        周次（第 8 周，本周有课）
      </Text>
      <WeekBars weeks={ALL} maxWeek={20} currentWeek={8} color="#4C9A55" />

      <Text font={15} fontWeight="heavy">
        周次（第 9 周，这门课本周没课）
      </Text>
      <WeekBars weeks={[2, 4, 6, 10, 12]} maxWeek={20} currentWeek={9} color="#D0627A" />
    </VStack>
  )
}
