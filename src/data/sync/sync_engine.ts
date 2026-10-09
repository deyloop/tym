import type { CollectionName, LocalStore, SyncRecord } from './local_store';

const CONFIG_KEY = 'tym_sync_config_v1';
const SYNC_URL = '/api/sync';
/** Wait this long after a local edit before pushing, so a burst of edits goes in one request. */
const PUSH_DELAY_MS = 1500;
/** Pull for other devices' changes this often while the app is open. */
const POLL_INTERVAL_MS = 30_000;

export interface SyncConfig {
  enabled: boolean;
  token: string;
}

export type SyncPhase = 'disabled' | 'offline' | 'unreachable' | 'idle' | 'syncing' | 'error' | 'unauthorized';

export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
}

type StatusListener = (status: SyncStatus) => void;

/**
 * Pushes local changes to the server and pulls everyone else's. The app keeps
 * working entirely offline; sync runs whenever it's enabled and the network is up.
 */
export class SyncEngine {
  config: SyncConfig;
  status: SyncStatus;
  private listeners = new Set<StatusListener>();
  private running: Promise<void> | null = null;
  private again = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private store: LocalStore,
    private onRemoteChange: (collections: Set<CollectionName>) => void,
  ) {
    this.config = loadConfig();
    this.status = { phase: 'idle', pending: store.pendingCount(), lastSyncedAt: null, error: null };
    this.status.phase = this.idlePhase();
  }

  /** Starts syncing in the background: on load, after edits, when back online, and periodically. */
  start() {
    this.store.onLocalChange(() => {
      this.update({ pending: this.store.pendingCount() });
      this.schedulePush();
    });
    window.addEventListener('online', () => this.syncNow());
    window.addEventListener('offline', () => this.update({ phase: this.idlePhase() }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.syncNow();
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') this.syncNow();
    }, POLL_INTERVAL_MS);
    this.syncNow();
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  setConfig(config: SyncConfig) {
    const tokenChanged = config.token !== this.config.token;
    this.config = { enabled: config.enabled, token: config.token.trim() };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    this.update({ phase: this.idlePhase(), error: null });
    if (tokenChanged) this.store.resetCursor();
    this.syncNow();
  }

  /** Runs a sync now (or right after the one in progress). */
  async syncNow(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        this.syncNow();
      }
    });
    return this.running;
  }

  private async run() {
    if (!this.config.enabled || !this.config.token || !navigator.onLine) {
      this.update({ phase: this.idlePhase() });
      return;
    }

    this.update({ phase: 'syncing', error: null });
    const pushed: SyncRecord[] = this.store.pendingChanges();
    let response: Response;
    try {
      response = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.token}` },
        body: JSON.stringify({ cursor: this.store.cursor, changes: pushed }),
      });
    } catch {
      // No response at all: we're offline or the server is down. Changes stay queued.
      this.update({ phase: navigator.onLine ? 'unreachable' : 'offline', error: null });
      return;
    }
    try {
      if (response.status === 401) {
        this.update({ phase: 'unauthorized', error: 'The server rejected the sync token.' });
        return;
      }
      if (!response.ok) throw new Error(`Server responded ${response.status}: ${await response.text()}`);

      const result: { cursor: number; changes: SyncRecord[] } = await response.json();
      const changed = this.store.applySyncResult(pushed, result.changes, result.cursor);
      this.update({ phase: 'idle', pending: this.store.pendingCount(), lastSyncedAt: Date.now() });
      if (changed.size > 0) this.onRemoteChange(changed);
    } catch (err) {
      this.update({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }

  private schedulePush() {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.syncNow();
    }, PUSH_DELAY_MS);
  }

  private idlePhase(): SyncPhase {
    if (!this.config.enabled || !this.config.token) return 'disabled';
    return navigator.onLine ? 'idle' : 'offline';
  }

  private update(changes: Partial<SyncStatus>) {
    this.status = { ...this.status, ...changes };
    for (const listener of this.listeners) listener(this.status);
  }
}

function loadConfig(): SyncConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return { enabled: false, token: '', ...JSON.parse(stored) };
  } catch {
    // Fall through to defaults.
  }
  return { enabled: false, token: '' };
}
