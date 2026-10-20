# 华农表 · SCAU Table

华南农业大学课表的 [Scripting](https://scripting.fun) 脚本：登录正方教务系统拉取课表，在 App 里看整周课程，用主屏 / 锁屏小组件看今天的课和下一节课。

> 只在两种情况下联网：登录 `cas.scau.edu.cn`、读课表 `jwzf.scau.edu.cn`。代码里没有其他域名，也没有任何统计 / 上报。

## 功能

- **周课表**：7 天 × 节次的网格，左右箭头切周，周次也能直接从菜单跳到任意一周
- **焦点卡**：今天还有课就显示今天的课，全上完了自动切到**明天**；明天没课则写「明天没有课 / 今天的课都上完了」，并附下一次有课的日子
- **课程详情**：点任意一节课，看到只高亮该课的小课表 + 周次条
- **主屏小组件**
  - 小号 / 中号：焦点日的课程列表（同样遵循「今天 → 明天」）
  - 大号 / 超大号：整周课表，今天那一列加框
- **锁屏小组件**：矩形（两格）、行内一行、圆形三种样式，都显示**下一节课**
- **上课时间可改**：每节课的起止时间在设置里编辑，格子里可以选择是否显示
- **登录方式**
  - 自动填表：学号 + 密码 → 在 WebView 里自动填并提交 CAS 登录
  - 手动登录：不想把密码存在本机时，直接调出登录页自己点
- **周次起点可切换**：默认周日开头，设置里能改成周一

## 数据存在哪

| 内容 | 位置 | 说明 |
|---|---|---|
| 学号 | `Storage` | 明文，仅本机 |
| 密码 | `Keychain` | **只有勾了「记住密码」才写**，不勾就完全不落盘 |
| 课表缓存 | `Storage`（JSON） | 小组件直接读它；超过 2 天没更新，界面会提示 |
| 登录态 | `scau.edu.cn` 的 Cookie | 存在 WebView 里，「退出登录」会清掉 |

脚本不写任何文件到磁盘，也不往第三方服务发数据。

## 安装

### 一键导入（推荐）

在装好 Scripting 的 iPhone / iPad 上打开这个链接，App 会自动拉取仓库并导入「华农表」：

```
scripting://import_scripts?urls=%5B%22https%3A%2F%2Fgithub.com%2Fcondedby%2Fscripting%2Farchive%2Frefs%2Fheads%2Fmain.zip%22%5D
```

- GitHub 有时会把 `scripting://` 开头的东西当成普通文本，**长按复制整行，粘到 Safari 地址栏**再打开最稳。
- 导入源是本仓库的 main 分支 zip（里面只有 `华农表/` 一个带 `script.json` 的脚本）。如果导入后没出现「华农表」，用下面的手动方式。

### 手动安装

1. 在 iPhone 上装 [Scripting](https://scripting.fun)（需 TestFlight / App Store 版本）
2. 把 `华农表/` 整个文件夹放进 Scripting 的脚本目录：
   `iCloud Drive › Scripting › scripts › 华农表/`
   （或在 App 内新建脚本后，把这里的文件逐个拷进去）
3. 打开脚本 → 设置里填学号密码 → 保存 → 回到课表页刷新

小组件：长按主屏 › 添加小组件 › Scripting › 选「华农表」。

> ⚠️ `__preview.tsx` 是开发用的预览入口，**会往缓存里写一份全占位的假课表**（课名 `示例课程 A`、学号 `00000000000`），只是想用脚本的话别打开它。它覆盖前会把真实缓存备份到 `scau.cache.bak` / `scau.username.bak`，误开可以这样救回来：
>
> ```ts
> Storage.set("scau.cache", Storage.get("scau.cache.bak"))
> Storage.set("scau.username", Storage.get("scau.username.bak"))
> ```

## 设备适配

- **iPhone**：主场景。竖屏 7 列铺满，行高 52pt。
- **iPad**：**未实机验证**。布局没有写死屏幕宽度，7 个日列是等分自适应的，所以不会溢出或错列；但行高（52pt）、序号栏（34pt）、字号（8–18pt）都是按 iPhone 定的，iPad 上格子会被拉得偏扁、字显得偏小。要正经适配得按宽度缩放行高字号，或宽屏改成「今日卡片 + 周课表」两栏。
- **小组件**：iPad 需 iPadOS 17+ 才有桌面 / 锁屏小组件。

## 目录结构

```
华农表/
├── index.tsx            入口：present 课表主页
├── script.json          脚本元数据（名称 / 版本 / 图标 / 描述）
├── lib/
│   ├── model.ts         周次、节次、课程等数据模型与解析
│   ├── session.ts       CAS + 正方 jwglxt 登录（WebView 自动填表 / Cookie 复用 / 退出）
│   ├── store.ts         本地设置与课表缓存（Storage + Keychain）
│   └── widget.ts        小组件取数、行预算、时间线刷新
├── ui/
│   ├── main.tsx         周课表主页面
│   ├── course.tsx       课程详情页
│   └── settings.tsx     设置页
├── widget.tsx           小组件入口（按 family 分发）
├── widget/views.tsx     小 / 中 / 大 / 锁屏视图
└── __preview*.tsx       开发时用的预览入口，非运行时依赖
```

## 实现备注

- **为什么登录走 WebView**：CAS 的 `/v1/tickets` 接口对密码有额外校验，明文提交返回 `PASSERROR`，所以改成在 WebView 里自动填表 + 提交，登录态靠 `scau.edu.cn` 的 Cookie 维持。
- **课表接口**：正方 jwglxt `POST /jwglxt/xskbcx_cxXsKb.html?gnmkdm=N2151`。
- **周次怎么算**：优先用学校返回的学期开始日期（`termStart`）在本地推周次；拿不到就用服务端给的当前周 + 抓取时间推算，离线也不会错。
- **设置即时落盘**：改完立刻写，不依赖「保存」按钮，退出重进不会回滚。

## 免责声明

- 本项目仅供**查询本人课表**使用，不收集、不上传任何账号、密码或课表数据；所有凭据只存在你自己的设备上。
- 脚本会以你的身份自动填写学校统一身份认证页面。使用前请自行确认这符合你所在学校对信息系统的使用规定；**由此产生的任何后果由使用者自负**。
- 学校界面 / 接口变更后脚本可能失效，不做可用性保证。

提问时**不要**贴学号、密码、带姓名或班级的课表截图。

## License

[MIT](./LICENSE)

