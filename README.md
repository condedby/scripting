# 华农表 · SCAU Table

华南农业大学课表的 [Scripting](https://scripting.fun) 脚本：登录正方教务系统拉取课表，配合教务处校历（放假 / 调休）显示每周实际要上的课，用主屏 / 锁屏小组件看今天的课和下一节课。

> 只在三种情况下联网：登录 `cas.scau.edu.cn`、读课表 `jwzf.scau.edu.cn`、抓校历 `jwc.scau.edu.cn`。代码里没有其他域名，也没有任何统计 / 上报。

当前版本 **1.6.4**。

## 功能

- **周课表**：7 天 × 节次的网格，左右箭头切周，周次也能直接从菜单跳到任意一周；七列宽度写死，不会被内容挤变形
- **焦点卡**：今天还有课就显示今天的课，全上完了自动切到**明天**；明天没课则写「明天没有课 / 今天的课都上完了」，并附下一次有课的日子
- **校历联动**：校历上的**放假日**就算有课也不上；**调休上课日**（比如 10/10 周六）按备注里指定的「第 N 周周几」上那天的课
- **校历页**：教务处 xlsx 自己解析成月历，放假日绿底、调休日橙底，点某一天直接跳到课表那一周
- **学期进度条**：第 N/教学周周、已过百分比与剩余天数
- **课程详情**：点任意一节课，看到只高亮该课的小课表 + 周次条（本周填主色）
- **改课 / 加课**
  - 空白课表加课：先选周次（可多选 / 单周 / 双周 / 全选）→ 在真实课表的空格子上多选 → 一次填表单建多门课
  - 改课 / 删课：点课表上的课直接编辑（删除是行内两步确认）；课程气泡颜色可手动指定
  - 「恢复教务课表」一键还原；自定义内容按学期隔离，不会串到下个学期
- **深色模式**：跟随系统，卡片文字改用系统语义色
- **主屏小组件**
  - 小号 / 中号：焦点日的课程列表（同样遵循「今天 → 明天」，今天放假则直接写「今天放假」）
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
| 学号 | `Storage`（`scau.username`） | 明文，仅本机 |
| 密码 | `Keychain`（`scau.password`） | **只有勾了「记住密码」才写**，不勾就完全不落盘 |
| 课表缓存 | `Storage`（`scau.cache`） | 小组件直接读它；超过 2 天没更新，界面会提示 |
| 校历缓存 | `Storage`（`scau.calendar`） | 教务处 xlsx 解析结果，7 天过期 |
| 自定义课表 | `Storage`（`scau.overrides`） | 增 / 改 / 删的覆盖层，刷新教务不会丢 |
| 登录态 | `scau.edu.cn` 的 Cookie | 存在 WebView 里，「退出登录」会清掉 |

脚本不写任何文件到磁盘，也不往第三方服务发数据。

## 安装

### 一键导入（推荐）

1. 装 [Scripting](https://scripting.fun)（TestFlight / App Store 版本）
2. 下载并导入最新发布包：[`Release/SCAU-Table.scripting`](https://raw.githubusercontent.com/condedby/scripting/main/Release/SCAU-Table.scripting)

在 iPhone 上点这个链接就会交给 Scripting 导入；没反应就**长按复制链接，在 Safari 地址栏打开**。

包就是个 zip（后缀改成 `.scripting`），里面是 `华农表/` + `script.json`，导入后脚本名显示「华农表」。

### 用 App 里的「导入远程脚本」填地址

Scripting 的这个入口要的是**脚本本身**的地址，支持三种：

| 形式 | 地址 |
| --- | --- |
| 仓库内的脚本目录 | `https://github.com/condedby/scripting/tree/main/华农表` |
| zip 文件 | `https://raw.githubusercontent.com/condedby/scripting/main/Release/SCAU-Table.zip` |
| 发布包 | `https://raw.githubusercontent.com/condedby/scripting/main/Release/SCAU-Table.scripting` |

> ❌ 直接填 `https://github.com/condedby/scripting` 会报「不支持的脚本文件」——本仓库根目录是合集（README / Release / 脚本子目录），不是一个脚本。只有「仓库根目录就是 `script.json` 所在层」的仓库才能直接填仓库地址。

中文目录名在地址里会被转义成 `%E5%8D%8E%E5%86%9C%E8%A1%A8`，两种写法等价。

### 手动安装

1. 在 iPhone 上装 [Scripting](https://scripting.fun)（需 TestFlight / App Store 版本）
2. 把 `华农表/` 整个文件夹放进 Scripting 的脚本目录：
   `iCloud Drive › Scripting › scripts › 华农表/`
   （或在 App 内新建脚本后，把这里的文件逐个拷进去）
3. 打开脚本 → 设置里填学号密码 → 保存 → 回到课表页刷新

小组件：长按主屏 › 添加小组件 › Scripting › 选「华农表」。

## 自动更新（远程脚本）

`script.json` 的 `remoteResource` 指向**仓库里的脚本目录**：

```json
"remoteResource": {
  "url": "https://github.com/condedby/scripting/tree/main/华农表",
  "autoUpdateInterval": 3600
}
```

含义：App 每小时去这个目录取一次，内容有变化就整包替换本地代码。也就是说——

- **推 `华农表/` 目录 = 发版**；同时会重新打一个 `Release/SCAU-Table.scripting` 给「一键导入」用。
- 也支持直接填 `.scripting` / `.zip` 包地址（见上面那张表），效果一样。

几个必须知道的点：

- 只认 **`url` + `autoUpdateInterval`** 两个字段（这是 `ScriptMetadata` 的官方定义）。（App 自己有时会往 `script.json` 里写一个 `hash`，那是它记录的同步指纹，手写没有意义。）
- **开发时要小心**：如果改了本地文件但没推上去，下一次自动更新会拿远端旧版把本地覆盖掉。改代码期间可以暂时把 `autoUpdateInterval` 改成 `null`，或者只在“准备发布”时再改。
- 想只改本地不被覆盖，就别在 `scripts/华农表` 里改 —— 用一份单独的开发目录，改完同步过去再推。

> ⚠️ `__preview*.tsx` 是开发用的预览入口，其中 `__preview.tsx` **会往缓存里写一份全占位的假课表**（课名 `示例课程 A`、学号 `00000000000`），只是想用脚本的话别打开它。它覆盖前会把真实缓存备份到 `scau.cache.bak` / `scau.username.bak`，误开可以这样救回来：
>
> ```ts
> Storage.set("scau.cache", Storage.get("scau.cache.bak"))
> Storage.set("scau.username", Storage.get("scau.username.bak"))
> ```

## 设备适配

- **iPhone**：主场景。竖屏 7 列铺满，行高 52pt。
- **iPad**：**未实机验证**。7 个日列按屏宽算死宽度，所以不会溢出或错列；但行高（52pt）、序号栏（34pt）、字号（8–18pt）都是按 iPhone 定的，iPad 上格子会被拉得偏扁、字显得偏小。要正经适配得按宽度缩放行高字号，或宽屏改成「今日卡片 + 周课表」两栏。
- **小组件**：iPad 需 iPadOS 17+ 才有桌面 / 锁屏小组件。

## 目录结构

```
华农表/
├── index.tsx            入口：present 课表主页
├── script.json          脚本元数据（名称 / 版本 / 图标 / 描述 / 远程资源）
├── lib/
│   ├── model.ts         周次、节次、课程等数据模型与解析
│   ├── session.ts       CAS + 正方 jwglxt 登录（WebView 自动填表 / Cookie 复用 / 退出）
│   ├── store.ts         本地设置与缓存（Storage + Keychain）
│   ├── calendar.ts      教务处校历抓取 + xlsx 解析 + 放假 / 调休标记
│   ├── overrides.ts     自定义课表（增 / 改 / 删的覆盖层）
│   ├── theme.ts         语义色与深色模式工具
│   └── widget.ts        小组件取数、行预算、时间线刷新
├── ui/
│   ├── main.tsx         周课表主页面
│   ├── course.tsx       课程详情页（小课表 + 周次条）
│   ├── calendar.tsx     校历月历页
│   ├── blank_grid.tsx   空白课表加课（选周次 → 点格子）
│   ├── course_form.tsx  加 / 改课表单
│   ├── editor.tsx       自定义课表入口页
│   └── settings.tsx     设置页
├── widget.tsx           小组件入口（按 family 分发）
├── widget/views.tsx     小 / 中 / 大 / 锁屏视图
└── __preview*.tsx       开发时用的预览入口，非运行时依赖
```

## 实现备注

- **为什么登录走 WebView**：CAS 的 `/v1/tickets` 接口对密码有额外校验，明文提交返回 `PASSERROR`，所以改成在 WebView 里自动填表 + 提交，登录态靠 `scau.edu.cn` 的 Cookie 维持。
- **课表接口**：正方 jwglxt `POST /jwglxt/xskbcx_cxXsKb.html?gnmkdm=N2151`（`zs` 必须留空才拿全学期）。
- **校历**：`jwc.scau.edu.cn/xl/list.htm` → 最新一篇 → 附件 xlsx，`FileManager.unzipSync` 后自己读 `sharedStrings.xml` + `sheet*.xml` 拼表；放假日和调休日从表格 + 备注两边补全。
- **周次怎么算**：优先用学校返回的学期开始日期（`termStart`）在本地推周次；拿不到就用服务端给的当前周 + 抓取时间推算，离线也不会错。
- **设置即时落盘**：改完立刻写，不依赖「保存」按钮，退出重进不会回滚。

## 免责声明

- 本项目仅供**查询本人课表**使用，不收集、不上传任何账号、密码或课表数据；所有凭据只存在你自己的设备上。
- 脚本会以你的身份自动填写学校统一身份认证页面。使用前请自行确认这符合你所在学校对信息系统的使用规定；**由此产生的任何后果由使用者自负**。
- 学校界面 / 接口变更后脚本可能失效，不做可用性保证。

提问时**不要**贴学号、密码、带姓名或班级的课表截图。

## 版权

Copyright (c) 2026 condedby，保留所有权利。

本仓库公开是为了方便查看与安装；**除此之外未授予任何额外许可**（例如修改后再分发、或用于商业用途）。将来如放宽，会在这里补上明确的开源许可（比如 MIT）和 `LICENSE` 文件。

## 目录补充

`Release/SCAU-Table.scripting` 是给一键导入用的发布包（`华农表/` 打成的 zip，不含 `__preview*.tsx`），不是手写代码。
