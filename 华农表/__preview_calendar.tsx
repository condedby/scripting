// 预览用：造一份 2026-2027 第一学期校历（跟教务处那张表同构）渲染校历页
// 真实数据由 lib/calendar.ts 从教务处 xlsx 解析，这里只是为了看版面
import { CalendarView } from "./ui/calendar"
import { addDays, isoDate, parseISODate, weekRangeText, type AcademicCalendar, type CalendarWeek } from "./lib/calendar"

const START = "2026-08-24"

const HOLIDAYS: Record<string, string> = {
  "2026-09-25": "中秋",
  "2026-10-01": "国庆",
  "2027-01-01": "元旦",
  "2027-02-06": "春节",
  "2027-02-20": "元宵",
}

function buildWeeks(): CalendarWeek[] {
  const out: CalendarWeek[] = []
  for (let i = 0; i < 26; i++) {
    const monday = addDays(parseISODate(START), i * 7)
    const week = i === 0 ? 0 : i <= 20 ? i : 0
    const label = i === 0 ? "暑假" : i <= 20 ? `第 ${i} 周` : "寒假"
    const days = []
    const holidays: string[] = []
    for (let wd = 1; wd <= 7; wd++) {
      const date = isoDate(addDays(monday, wd - 1))
      const holiday = HOLIDAYS[date] || ""
      if (holiday && holidays.indexOf(holiday) < 0) holidays.push(holiday)
      days.push({ date, weekday: wd, holiday })
    }
    out.push({
      label,
      week,
      monday: isoDate(monday),
      sunday: isoDate(addDays(monday, 6)),
      rangeText: weekRangeText(isoDate(monday)),
      days,
      holidays,
    })
  }
  return out
}

const DATA: AcademicCalendar = {
  fetchedAt: Date.now(),
  pageUrl: "https://jwc.scau.edu.cn/2026/0427/c6957a433190/page.htm",
  fileUrl: "",
  terms: [
    {
      key: "2026-2027-1",
      title: "华南农业大学2026-2027学年第一学期校历及作息表",
      year: "2026-2027",
      term: 1,
      weeks: buildWeeks(),
      teachingWeeks: 20,
      makeups: [
        { date: "2026-09-20", week: 6, weekday: 2 },
        { date: "2026-10-10", week: 6, weekday: 3 },
      ],
      offRanges: [
        { start: "2026-09-25", end: "2026-09-27", name: "中秋" },
        { start: "2026-10-01", end: "2026-10-07", name: "国庆" },
      ],
      notes: [
        "1.非新生（含本科生、研究生）\n报到注册：2026年8月28日-29日\n本科生教学：1-18周（2026年8月31日-12月31日）；考试：19-20周（2027年1月4日-15日）\n寒假：2027年1月18日-2月21日",
        "2.新生（含本科生、研究生）\n报到注册：2026年8月30日-9月1日\n本科生军训及入学教育：2026年9月2日-20日",
        "3.校田径运动会：11月27日-28日,27日全校本科生停课一天；本科生体质测试：7-10周",
        "4.中秋节：9月25日（周五）至27日（周日）放假，共3天。",
        "5.国庆节：10月1日（周四）至7日（周三）放假调休，共7天。",
        "6.元旦：待国务院通知",
        "7.寒假：2027年1月18日-2月21日，其中含学生注册及各类社会实践活动。",
      ],
    },
    {
      key: "2026-2027-2",
      title: "华南农业大学2026-2027学年第二学期校历及作息表（征求意见稿）",
      year: "2026-2027",
      term: 2,
      weeks: buildWeeks(),
      teachingWeeks: 20,
      makeups: [],
      offRanges: [],
      notes: ["1.本科生、研究生注册：2027年2月20日-21日"],
    },
  ],
}

export default function Preview() {
  return <CalendarView currentWeek={8} initial={DATA} />
}
