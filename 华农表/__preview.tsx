// 预览用：造一份**纯占位**的课表塞进缓存，然后渲染主页面
//
// 这里的数据只为了看清版面（列宽、行高、跨节、颜色），刻意不含任何真实课程 / 教室 / 教师。
// 注意：运行会把假数据写进 Storage 的 scau.cache 和 scau.username。
import { MainView } from "./ui/main"
import type { CourseEvent, ScheduleData } from "./lib/model"

// 名称, 地点, 教师, 星期, 节次, 周次
const COURSES: Array<[string, string, string, number[], number[], number[]]> = [
  ["示例课程 A", "101", "教师 1", [1], [1, 2], [1, 2, 3, 4, 5, 6, 7, 8]],
  ["示例课程 B", "102", "教师 2", [1], [3, 4, 5], [1, 2, 3, 4, 5, 6]],
  ["示例课程 C", "201", "教师 3", [1], [8, 9], [1, 2, 3, 4, 5, 6, 7, 8]],
  ["示例课程 D", "202", "教师 4", [1], [10, 11], [1, 2, 3]],
  ["示例课程 D", "203", "教师 4", [1], [13, 14], [7, 8]],
  ["示例课程 E", "301", "教师 5", [2], [3, 4], [1, 2, 3, 4, 5, 6, 7, 8]],
  ["示例课程 C", "204", "教师 3", [3], [1, 2], [1, 2, 3, 4, 5, 6, 7, 8]],
  ["示例课程 F", "302", "教师 6", [3], [3, 4, 5], [1, 2, 3, 4, 5, 6]],
  ["示例课程 G", "303", "教师 7", [3], [6, 7], [4, 5, 6, 7, 8]],
  ["示例课程 G", "304", "教师 7", [3], [8, 9], [1, 2, 3, 4, 5]],
  ["示例课程 H", "305", "教师 8", [4], [3, 4], [1, 2, 3, 4, 5, 6, 7, 8]],
  ["示例课程 A", "401", "教师 1", [4], [8, 9], [1, 2, 3, 4, 5, 6, 7, 8]],
  ["示例课程 G", "305", "教师 7", [4], [10, 11], [1, 2, 3, 4, 5, 6]],
  ["示例课程 A", "204", "教师 1", [5], [1, 2], [1, 2, 3, 4, 5, 6, 7, 8]],
  ["示例课程 I", "306", "教师 9", [5], [3, 4, 5], [5]],
  ["示例课程 I", "307", "教师 9", [5], [3, 4, 5], [1, 2, 3, 4, 6, 7]],
  ["示例课程 J", "402", "教师 10", [6], [1, 2], [3, 4, 5, 6]],
]

function mockData(): ScheduleData {
  const events: CourseEvent[] = COURSES.map((c, i) => {
    const sessions = c[4]
    return {
      key: "mock" + i,
      name: c[0],
      room: c[1],
      teacher: c[2],
      campus: "示例校区",
      weekday: c[3][0],
      start: sessions[0],
      end: sessions[sessions.length - 1],
      sessions,
      weeks: c[5],
      weekText: "",
      credit: "3",
      category: "示例类别",
      classGroup: "示例班级",
      examType: "示例考核",
      raw: {},
    }
  })
  return {
    fetchedAt: Date.now(),
    student: {
      name: "示例同学",
      studentId: "00000000000",
      className: "示例班级",
      major: "示例专业",
      xnName: "2026-2027",
      xnm: "2026",
      xqm: "3",
    },
    events,
    maxSession: 14,
    currentWeek: 3,
  }
}

// 覆盖前先备份真实缓存（只备第一次），误开预览也能救回来：
//   Storage.set("scau.cache", Storage.get("scau.cache.bak"))
const realCache = Storage.get<string>("scau.cache")
if (realCache && !Storage.get<string>("scau.cache.bak")) Storage.set("scau.cache.bak", realCache)
const realUser = Storage.get<string>("scau.username")
if (realUser && !Storage.get<string>("scau.username.bak")) Storage.set("scau.username.bak", realUser)

Storage.set("scau.cache", JSON.stringify(mockData()))
Storage.set("scau.username", "00000000000")
export default MainView
