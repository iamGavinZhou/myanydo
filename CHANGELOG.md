# Changelog

All notable changes to MyAnydo. Installers are on the [Releases](https://github.com/iamGavinZhou/myanydo/releases) page.

## [1.1.1] — 2026-10-28

### Fixed
- The buttons at the top of the task detail panel (Mark done, Delete, Close) only responded near their bottom edge. The window drag area was capturing clicks over the top of the panel; the panel and all popover menus now opt out of it.

### Changed
- Larger click targets in the task detail header: the status toggle is a single 40px-tall button labelled "Mark done", and Delete / Close are 40×40 buttons.

## [1.1.0] — 2026-10-10

### Added
- Reorder subtasks by dragging the handle that appears when you hover a subtask.
- The app version is shown at the bottom of Settings.

## [1.0.0] — 2026-10-08

First release.

### Added
- **My Day**: today's tasks as a list you can reorder by dragging; optional grouping by a tag set; overdue and completed sections.
- **This Week**: one card per day (Mon–Sun); drag a task to another day to change its due date.
- **All My Tasks**: all tasks grouped by collection, with status and tag filters.
- **My Calendar**: read-only month view of macOS Calendar events alongside tasks that are due; Today button; per-day detail.
- **Tasks**: title, markdown notes, subtasks, multiple tags, collection, status, due date.
- **Tags**: `set:tag` format, managed in the sidebar. Ships with Priority, Type, Status and Energy sets. Renaming or deleting a tag updates every task that uses it.
- **Settings**: avatar and nickname, light / dark / system theme, data folder location.
- Calendar sync: results cached for 3 hours, manual Sync button, syncs cancelled after 90 seconds, option to skip individual calendars.

### Fixed during development
- Tasks created within the same second could sort in the wrong order.
- Adding a subtask cleared the input without adding it.
- The Today button in My Calendar didn't select or scroll to today.

[1.1.1]: https://github.com/iamGavinZhou/myanydo/releases/tag/v1.1.1
[1.1.0]: https://github.com/iamGavinZhou/myanydo/releases/tag/v1.1.0
[1.0.0]: https://github.com/iamGavinZhou/myanydo/releases/tag/v1.0.0
