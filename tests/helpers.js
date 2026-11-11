export function makeHabit(overrides = {}) {
  return {
    id: overrides.id || 'habit-test',
    name: overrides.name || 'Test habit',
    emoji: overrides.emoji || '✅',
    color: overrides.color || '#5E6AD2',
    createdAt: overrides.createdAt || '2026-11-01',
    archivedAt: overrides.archivedAt ?? null,
    schedule: {
      type: 'daily',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek: 7,
      intervalDays: 1,
      ...overrides.schedule
    },
    goal: {
      type: 'binary',
      target: 1,
      unit: '',
      ...overrides.goal
    },
    reminder: {
      enabled: false,
      time: null,
      ...overrides.reminder
    },
    logs: { ...overrides.logs },
    notes: { ...overrides.notes },
    skips: { ...overrides.skips }
  };
}
