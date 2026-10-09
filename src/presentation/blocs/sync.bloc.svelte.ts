import type { SyncConfig, SyncEngine, SyncStatus } from '../../data/sync/sync_engine';

/** Reactive view of the sync engine for the UI. */
export class SyncBloc {
  status = $state<SyncStatus>({ phase: 'disabled', pending: 0, lastSyncedAt: null, error: null });
  config = $state<SyncConfig>({ enabled: false, token: '' });
  online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);

  constructor(private engine: SyncEngine) {
    this.config = { ...engine.config };
    engine.subscribe((status) => {
      this.status = status;
      this.online = navigator.onLine;
    });
  }

  save(config: SyncConfig) {
    this.engine.setConfig(config);
    this.config = { ...this.engine.config };
  }

  syncNow() {
    return this.engine.syncNow();
  }
}
