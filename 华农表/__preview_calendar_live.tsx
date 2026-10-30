// 临时：不喂数据，走真实「教务处 → xlsx → 解析 → 缓存」链路
import { CalendarView } from "./ui/calendar"

export default function Preview() {
  return <CalendarView currentWeek={8} />
}
