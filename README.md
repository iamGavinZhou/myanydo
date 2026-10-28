# MyAnydo

**English** | [简体中文](README.zh-CN.md)

A to-do app for macOS that keeps everything on your Mac. No account, no cloud sync.

![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-black) ![Electron](https://img.shields.io/badge/Electron-React-blue)

## Install

1. Download `MyAnydo-<version>-arm64.dmg` from the [latest release](https://github.com/iamGavinZhou/myanydo/releases/latest).
2. Open the dmg and drag **MyAnydo** into **Applications**.
3. The app isn't signed by an Apple developer, so macOS blocks the first launch. Run this once in Terminal, then open the app normally:

   ```bash
   xattr -dr com.apple.quarantine /Applications/MyAnydo.app
   ```

   Or: try to open the app, then go to **System Settings → Privacy & Security** and click **Open Anyway**.

Requires a Mac with Apple Silicon (M1 or later).

## Features

- **My Day**: today's tasks. Drag to reorder, or group them by a tag set such as Priority.
- **This Week**: one card per day. Drag a task to another day to reschedule it.
- **All My Tasks**: every task, grouped by collection.
- **My Calendar**: your macOS Calendar events and due tasks in a month view (read-only).
- **Tasks**: markdown notes, subtasks, due date, collection, and multiple tags.
- **Tags**: written as `set:tag`, for example `Priority:high`. Manage them in the sidebar; renaming or deleting a tag updates every task.
- Light, dark, or system theme.

## Your data

Data is saved as plain JSON files in `~/Documents/MyAnydo`. You can choose another folder in **Settings**; existing files are moved there.

## Calendar access

The first time you open **My Calendar**, macOS asks whether MyAnydo can access Calendar. Click **OK**. To change this later, go to **System Settings → Privacy & Security → Automation → MyAnydo**.

A full sync can take up to a minute, because it goes through Calendar's scripting interface. Results are cached for 3 hours, and a sync stops after 90 seconds. Use the **Calendars** picker to skip calendars you don't need.

## Build from source

Requires Node.js 18 or later.

```bash
npm install
npm run dist    # builds release/MyAnydo-<version>-arm64.dmg
```

For development, run `npm run dev` in one terminal and `VITE_DEV_SERVER_URL=http://localhost:5173 npm start` in another.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
