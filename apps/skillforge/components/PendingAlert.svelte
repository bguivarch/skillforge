<script lang="ts">
  interface Props {
    count: number;
    onSyncClick: () => void;
    syncing?: boolean;
  }

  let { count, onSyncClick, syncing = false }: Props = $props();
</script>

{#if count > 0}
  <div class="pending-alert">
    <div class="alert-content">
      <svg class="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      <span class="alert-text">
        {count} new skill{count > 1 ? 's' : ''} available
      </span>
    </div>
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
  .pending-alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgb(59, 130, 246);
    border-radius: 8px;
  }

  .alert-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .alert-icon {
    color: rgb(59, 130, 246);
    flex-shrink: 0;
  }

  .alert-text {
    font-size: 13px;
    font-weight: 500;
    color: rgb(147, 197, 253);
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
