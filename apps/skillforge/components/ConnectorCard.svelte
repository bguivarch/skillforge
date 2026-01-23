<script lang="ts">
  import type { ConnectorWithState } from '../lib/types';

  interface Props {
    connectorWithState: ConnectorWithState;
    onDelete?: (connectorId: string, connectorName: string) => void;
    deleteLoading?: boolean;
  }

  let { connectorWithState, onDelete, deleteLoading = false }: Props = $props();

  const { connector, state, config } = $derived(connectorWithState);
  const description = $derived(config?.description ?? connector.url);

  function handleDelete() {
    if (onDelete && state === 'orphaned') {
      // Use uuid as the connector ID (Claude.ai API uses uuid, not id)
      const connectorId = connector.uuid || connector.id;
      onDelete(connectorId, connector.name);
    }
  }

  function getStateBadgeClass(): string {
    switch (state) {
      case 'managed': return 'badge-managed';
      case 'orphaned': return 'badge-orphaned';
      default: return '';
    }
  }

  function getStateBadgeText(): string {
    switch (state) {
      case 'managed': return '✓';
      case 'orphaned': return '⚠ Removed';
      default: return '';
    }
  }
</script>

<div class="connector-card" class:orphaned={state === 'orphaned'}>
  <div class="connector-header">
    <div class="connector-info">
      <div class="connector-name-row">
        <svg class="connector-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <span class="connector-name">{connector.name}</span>
        {#if state !== 'other'}
          <span class="state-badge {getStateBadgeClass()}">{getStateBadgeText()}</span>
        {/if}
      </div>
      <p class="connector-description">{description}</p>
    </div>
  </div>

  {#if state === 'orphaned'}
    <div class="orphan-warning">
      <span>This connector is no longer in the config.</span>
      {#if onDelete}
        <button class="delete-btn" onclick={handleDelete} disabled={deleteLoading}>
          {#if deleteLoading}
            Removing...
          {:else}
            Remove
          {/if}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .connector-card {
    background: var(--color-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 12px;
    transition: border-color 0.2s ease;
  }

  .connector-card:hover {
    border-color: rgb(248 250 252 / 20%);
  }

  .connector-card.orphaned {
    border-color: rgba(153, 27, 27, 0.4);
  }

  .connector-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .connector-info {
    flex: 1;
    min-width: 0;
  }

  .connector-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  .connector-icon {
    color: var(--color-muted);
    flex-shrink: 0;
  }

  .connector-name {
    font-weight: 600;
    font-size: 13px;
    color: var(--color-foreground);
  }

  .state-badge {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .badge-managed {
    background: rgba(22, 163, 74, 0.15);
    color: var(--color-success-foreground);
  }

  .badge-orphaned {
    background: rgba(153, 27, 27, 0.15);
    color: var(--color-destructive-foreground);
  }

  .connector-description {
    font-size: 12px;
    color: var(--color-muted);
    line-height: 1.4;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .orphan-warning {
    margin-top: 8px;
    padding: 8px;
    background: rgba(153, 27, 27, 0.1);
    border-radius: 4px;
    font-size: 11px;
    color: var(--color-destructive-foreground);
    line-height: 1.4;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .orphan-warning span {
    flex: 1;
  }

  .delete-btn {
    flex-shrink: 0;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 4px;
    border: none;
    background: rgba(153, 27, 27, 0.8);
    color: white;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .delete-btn:hover:not(:disabled) {
    background: rgba(153, 27, 27, 1);
  }

  .delete-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
