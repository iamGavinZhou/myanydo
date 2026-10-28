# MyAnydo

[English](README.md) | **简体中文**

一款 macOS 待办应用，所有数据都保存在你的 Mac 上。无需注册账号，也不会同步到云端。

![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-black) ![Electron](https://img.shields.io/badge/Electron-React-blue)

## 安装

1. 从 [最新发布](https://github.com/iamGavinZhou/myanydo/releases/latest) 下载 `MyAnydo-<版本号>-arm64.dmg`。
2. 打开 dmg，把 **MyAnydo** 拖进 **应用程序** 文件夹。
3. 应用没有经过 Apple 开发者签名，macOS 会拦截首次打开。在终端执行一次下面的命令，之后就能正常打开：

   ```bash
   xattr -dr com.apple.quarantine /Applications/MyAnydo.app
   ```

   也可以先尝试打开应用，然后到 **系统设置 → 隐私与安全性** 点击 **仍要打开**。

需要搭载 Apple 芯片（M1 及以后）的 Mac。

## 功能

- **My Day**：今天的任务。可以拖动排序，也可以按 Priority 等 tag 集合分组查看。
- **This Week**：每天一张卡片。把任务拖到另一天即可改期。
- **All My Tasks**：全部任务，按集合（collection）分组。
- **My Calendar**：在月视图里查看 macOS 日历事件和到期任务（只读）。
- **任务**：支持 markdown 备注、子任务、截止日期、所属集合和多个 tag。
- **Tag**：格式为 `集合:tag`，例如 `Priority:high`。在侧边栏统一管理，重命名或删除 tag 会同步到所有任务。
- 浅色、深色或跟随系统主题。

## 数据存储

数据以 JSON 文件保存在 `~/Documents/MyAnydo`。可以在 **设置** 里换成其他文件夹，已有文件会一并移过去。

## 日历权限

第一次打开 **My Calendar** 时，macOS 会询问是否允许 MyAnydo 访问日历，点 **好**。之后想修改，可以到 **系统设置 → 隐私与安全性 → 自动化 → MyAnydo**。

完整同步最长可能需要一分钟左右，因为要通过日历的脚本接口读取。同步结果缓存 3 小时，单次同步超过 90 秒会自动停止。不需要的日历可以在 **Calendars** 选择器里排除。

## 从源码构建

需要 Node.js 18 或更高版本。

```bash
npm install
npm run dist    # 生成 release/MyAnydo-<版本号>-arm64.dmg
```

开发调试时，在一个终端运行 `npm run dev`，另一个终端运行 `VITE_DEV_SERVER_URL=http://localhost:5173 npm start`。

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。
