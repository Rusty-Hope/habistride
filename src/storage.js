import {
  LEGACY_KEYS,
  LIMITS,
  SCHEMA_VERSION,
  STORAGE_KEYS
} from './constants.js';
import { parseState, serializeHabits, normalizeSettings } from './schema.js';

export class StorageService {
  constructor() {
    this.available = this.testAvailability();
  }

  testAvailability() {
    try {
      const key = `${STORAGE_KEYS.state}:test`;
      window.localStorage.setItem(key, '1');
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  readState() {
    if (!this.available) {
      return { habits: null, source: 'none', error: false };
    }

    const current = this.readRaw(STORAGE_KEYS.state);
    if (current !== null) {
      try {
        return { habits: parseState(JSON.parse(current)), source: 'current', error: false };
      } catch (error) {
        const snapshot = this.readSnapshots()[0];
        if (snapshot) {
          return { habits: snapshot.habits, source: 'snapshot', error: true };
        }
        return { habits: null, source: 'none', error: true };
      }
    }

    const legacy = this.readRaw(LEGACY_KEYS.state);
    if (legacy !== null) {
      try {
        const habits = parseState(JSON.parse(legacy));
        this.writeState(habits);
        return { habits, source: 'legacy', error: false };
      } catch (error) {
        return { habits: null, source: 'none', error: true };
      }
    }

    return { habits: null, source: 'none', error: false };
  }

  writeState(habits) {
    if (!this.available) return false;
    try {
      const payload = {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        habits: serializeHabits(habits)
      };
      window.localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  readSettings() {
    if (!this.available) return normalizeSettings(null);

    const current = this.readRaw(STORAGE_KEYS.settings);
    if (current !== null) {
      try {
        return normalizeSettings(JSON.parse(current));
      } catch (error) {
        return normalizeSettings(null);
      }
    }

    const legacy = this.readRaw(LEGACY_KEYS.settings);
    if (legacy !== null) {
      try {
        const parsed = JSON.parse(legacy);
        return normalizeSettings({ theme: parsed.theme });
      } catch (error) {
        return normalizeSettings(null);
      }
    }

    return normalizeSettings(null);
  }

  writeSettings(settings) {
    if (!this.available) return false;
    try {
      window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(normalizeSettings(settings)));
      return true;
    } catch (error) {
      return false;
    }
  }

  readSnapshots() {
    if (!this.available) return [];
    const raw = this.readRaw(STORAGE_KEYS.snapshots);
    if (raw === null) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map(entry => {
          try {
            if (!entry || typeof entry.at !== 'string' || !Array.isArray(entry.habits)) {
              return null;
            }
            const habits = parseState({ schemaVersion: SCHEMA_VERSION, habits: entry.habits });
            return {
              at: entry.at,
              reason: typeof entry.reason === 'string' ? entry.reason : 'Snapshot',
              habits
            };
          } catch (error) {
            return null;
          }
        })
        .filter(Boolean)
        .slice(0, LIMITS.maxHabitSnapshots);
    } catch (error) {
      return [];
    }
  }

  addSnapshot(habits, reason) {
    if (!this.available) return null;

    const snapshots = this.readSnapshots();
    const snapshot = {
      at: new Date().toISOString(),
      reason,
      habits
    };

    snapshots.unshift(snapshot);
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.snapshots,
        JSON.stringify(snapshots.slice(0, LIMITS.maxHabitSnapshots).map(entry => ({
          at: entry.at,
          reason: entry.reason,
          habits: serializeHabits(entry.habits)
        })))
      );
      return snapshot;
    } catch (error) {
      return null;
    }
  }

  readRaw(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  async requestPersistence() {
    if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
      return false;
    }
    try {
      return await navigator.storage.persist();
    } catch (error) {
      return false;
    }
  }

  async getEstimate() {
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
      return null;
    }
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    } catch (error) {
      return null;
    }
  }
}
