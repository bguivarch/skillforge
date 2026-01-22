<script lang="ts">
  import type { SkillState } from '../lib/types';

  interface Props {
    state: SkillState;
    onUpdateClick?: () => void;
    updating?: boolean;
  }

  let { state, onUpdateClick, updating = false }: Props = $props();

  const badges: Record<SkillState, { label: string; class: string }> = {
    managed: { label: '✓', class: 'managed' },
    outdated: { label: '↑ Update', class: 'outdated' },
    orphaned: { label: '⚠ Removed', class: 'orphaned' },
    other: { label: '', class: 'other' },
  };

  const badge = $derived(badges[state]);
  const isClickable = $derived(state === 'outdated' && onUpdateClick && !updating);

  function handleClick(event: MouseEvent) {
    if (isClickable && onUpdateClick) {
      event.stopPropagation();
      onUpdateClick();
    }
  }
</script>

{#if badge.label}
  {#if isClickable}
    <button
      class="badge {badge.class} clickable"
      title="Click to update this skill"
      onclick={handleClick}
      disabled={updating}
    >
      {updating ? '...' : badge.label}
    </button>
  {:else if state === 'outdated' && updating}
    <span class="badge {badge.class}" title="Updating...">
      Updating...
    </span>
  {:else}
    <span class="badge {badge.class}" title={
      state === 'managed' ? 'Managed by company' :
      state === 'outdated' ? 'Update available' :
      state === 'orphaned' ? 'No longer managed by company' : ''
    }>
      {badge.label}
    </span>
  {/if}
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    border: none;
  }

  .managed {
    background: rgba(22, 101, 52, 0.2);
    color: var(--color-success-foreground);
  }

  .outdated {
    background: rgba(168, 85, 247, 0.2);
    color: rgb(216, 180, 254);
  }

  .orphaned {
    background: rgba(153, 27, 27, 0.2);
    color: var(--color-destructive-foreground);
  }

  .clickable {
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clickable:hover:not(:disabled) {
    background: rgba(168, 85, 247, 0.4);
    transform: scale(1.05);
  }

  .clickable:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
