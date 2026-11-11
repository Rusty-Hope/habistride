# Changelog

All notable changes to HabiStride are documented here.

## [2.0.0] — 2026-11-11

A complete product-focused rewrite.

### Added

- Flexible schedules: daily, selected weekdays, weekly targets, and every-N-days intervals.
- Check-off and numeric goals with units.
- Schedule-aware streaks, including today's grace period and neutral rest days.
- Focused Today view with quick check-ins, count controls, and day details.
- Intentional rest days and per-day notes.
- Archive and restore habits without losing history.
- Insights: completion rate, check-ins, best streak, 12-month heatmap, weekday patterns, and per-habit breakdown.
- Onboarding with a fresh-start or demo path, plus starter templates.
- JSON backup/restore with schema validation and v1 migration.
- CSV export, `.ics` calendar reminders, and last-backup tracking.
- Restore points before destructive actions and undo toasts.
- Cross-tab sync, storage persistence requests, and offline PWA support.
- Full English interface, responsive layout, accessible dialogs, and keyboard support.

### Changed

- Replaced the original single-file implementation with native ES modules.
- Updated the visual system to a quieter, Linear-inspired productivity interface.
- Renamed storage keys to `habit_tracker_v2:*` and added a migration from the previous format.

### Fixed

- Streaks no longer reset before a day has ended.
- Weekday and weekly habits no longer treat non-scheduled days as misses.
- Imported data is validated before replacing current habits.

## [1.0.0]

Initial habit calendar with a monthly check-in matrix, streaks, local storage, and JSON export/import.
