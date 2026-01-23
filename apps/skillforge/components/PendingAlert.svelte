<script lang="ts">
  import type { PendingCounts } from '../lib/types';

  interface Props {
    counts: PendingCounts;
    onSyncClick: () => void;
    syncing?: boolean;
  }

  let { counts, onSyncClick, syncing = false }: Props = $props();

  const hasNew = $derived(counts.newCount > 0);
  const hasUpdates = $derived(counts.updateCount > 0);
  const hasNewConnectors = $derived(counts.newConnectorCount > 0);
  const total = $derived(counts.newCount + counts.updateCount + counts.newConnectorCount);

  function formatNames(names: string[]): string {
    return names.join(', ');
  }
</script>

{#if total > 0}
  <div class="pending-alerts">
    {#if hasNewConnectors}
      <div class="pending-alert connector">
        <div class="alert-content">
          <svg class="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <div class="alert-text-container">
            <span class="alert-text">
              {counts.newConnectorCount} new connector{counts.newConnectorCount > 1 ? 's' : ''} required
            </span>
            <span class="alert-connector-names">{formatNames(counts.newConnectorNames)}</span>
          </div>
        </div>
      </div>
    {/if}

    {#if hasNew}
      <div class="pending-alert new">
        <div class="alert-content">
          <svg class="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          <div class="alert-text-container">
            <span class="alert-text">
              {counts.newCount} new skill{counts.newCount > 1 ? 's' : ''} available
            </span>
            <span class="alert-skill-names">{formatNames(counts.newSkillNames)}</span>
          </div>
        </div>
      </div>
    {/if}

    {#if hasUpdates}
      <div class="pending-alert update">
        <div class="alert-content">
          <svg class="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58s9.14-3.47 12.65 0L21 3v7.12z"/>
          </svg>
          <div class="alert-text-container">
            <span class="alert-text">
              {counts.updateCount} skill update{counts.updateCount > 1 ? 's' : ''} available
            </span>
            <span class="alert-skill-names">{formatNames(counts.updatedSkillNames)}</span>
          </div>
        </div>
      </div>
    {/if}

    <button
      class="sync-now-btn"
      onclick={onSyncClick}
      disabled={syncing}
    >
      {syncing ? 'Syncing...' : 'Sync Now'}
    </button>
  </div>
{/if}

<style>
  .pending-alerts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pending-alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
  }

  .pending-alert.new {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgb(59, 130, 246);
  }

  .pending-alert.update {
    background: rgba(168, 85, 247, 0.1);
    border: 1px solid rgb(168, 85, 247);
  }

  .pending-alert.connector {
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgb(234, 179, 8);
  }

  .alert-content {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .alert-text-container {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .alert-skill-names {
    font-size: 11px;
    opacity: 0.8;
  }

  .pending-alert.new .alert-skill-names {
    color: rgb(147, 197, 253);
  }

  .pending-alert.update .alert-skill-names {
    color: rgb(216, 180, 254);
  }

  .pending-alert.connector .alert-connector-names {
    color: rgb(253, 224, 71);
  }

  .pending-alert.new .alert-icon {
    color: rgb(59, 130, 246);
  }

  .pending-alert.update .alert-icon {
    color: rgb(168, 85, 247);
  }

  .pending-alert.connector .alert-icon {
    color: rgb(234, 179, 8);
  }

  .alert-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .pending-alert.new .alert-text {
    color: rgb(147, 197, 253);
  }

  .pending-alert.update .alert-text {
    color: rgb(216, 180, 254);
  }

  .pending-alert.connector .alert-text {
    color: rgb(253, 224, 71);
  }

  .alert-text {
    font-size: 13px;
    font-weight: 500;
  }

  .sync-now-btn {
    padding: 6px 12px;
    background: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.2s ease;
  }

  .sync-now-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .sync-now-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
