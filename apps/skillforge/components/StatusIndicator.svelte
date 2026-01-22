<script lang="ts">
  interface Props {
    configName: string;
    configVersion: string;
    lastSyncTime: number | null;
    connected: boolean;
  }

  let { configName, configVersion, lastSyncTime, connected }: Props = $props();

  function formatTime(timestamp: number | null): string {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  const timeAgo = $derived(formatTime(lastSyncTime));
</script>

<div class="status">
  <div class="status-header">
    <span class="config-name">{configName}</span>
    <span class="config-version">v{configVersion}</span>
  </div>
  <div class="status-line">
    <span class="connection-dot" class:connected></span>
    <span class="connection-text">
      {connected ? 'Connected' : 'Not connected'}
    </span>
    {#if lastSyncTime}
      <span class="separator">·</span>
      <span class="sync-time">Last synced: {timeAgo}</span>
    {/if}
  </div>
</div>

<style>
  .status {
    padding: 12px 0;
  }

  .status-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }

  .config-name {
    font-weight: 600;
    font-size: 14px;
    color: var(--color-foreground);
  }

  .config-version {
    font-size: 12px;
    color: var(--color-muted);
  }

  .status-line {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-muted);
  }

  .connection-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-destructive);
    flex-shrink: 0;
  }

  .connection-dot.connected {
    background: var(--color-success-foreground);
  }

  .separator {
    color: var(--color-border);
  }
</style>
