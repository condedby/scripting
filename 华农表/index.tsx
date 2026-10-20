import { Navigation, Script } from "scripting"
import { MainView } from "./ui/main"

async function run() {
  await Navigation.present(<MainView />)
  // 页面关闭后退出脚本，避免内存泄漏
  Script.exit()
}

run()
