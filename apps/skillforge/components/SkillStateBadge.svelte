<script lang="ts">
  import type { SkillState } from '../lib/types';

  interface Props {
    state: SkillState;
  }

  let { state }: Props = $props();

  const badges: Record<SkillState, { label: string; class: string }> = {
    managed: { label: '✓', class: 'managed' },
    outdated: { label: '↑ Update', class: 'outdated' },
    orphaned: { label: '⚠ Removed', class: 'orphaned' },
    other: { label: '', class: 'other' },
  };

  const badge = $derived(badges[state]);
</script>

{#if badge.label}
  <span class="badge {badge.class}" title={
    state === 'managed' ? 'Managed by company' :
    state === 'outdated' ? 'Update available' :
    state === 'orphaned' ? 'No longer managed by company' : ''
  }>
    {badge.label}
  </span>
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
  }

  .managed {
    background: rgba(22, 101, 52, 0.2);
    color: var(--color-success-foreground);
  }

  .outdated {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(147, 197, 253);
  }

  .orphaned {
    background: rgba(153, 27, 27, 0.2);
    color: var(--color-destructive-foreground);
  }
</style>
