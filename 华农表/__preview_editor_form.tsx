// 预览用：编辑课程的弹窗（拿一门假课看版面）
import { CourseForm } from "./ui/course_form"
import type { CourseEvent } from "./lib/model"

const SAMPLE: CourseEvent = {
  key: "custom:preview",
  name: "示例课程 A",
  teacher: "教师 1",
  room: "教三 402",
  campus: "",
  weekday: 3,
  start: 3,
  end: 5,
  sessions: [3, 4, 5],
  weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  weekText: "1-16",
  credit: "",
  category: "",
  classGroup: "",
  examType: "",
  raw: {},
}

export default function Preview() {
  return (
    <CourseForm
      initial={SAMPLE}
      isNew={false}
      onSave={() => {}}
      onDelete={() => {}}
      onRestore={() => {}}
    />
  )
}
