<script lang="ts">
  import type { SkillWithState } from '../lib/types';
  import SkillStateBadge from './SkillStateBadge.svelte';
  import SkillToggle from './SkillToggle.svelte';

  interface Props {
    skillWithState: SkillWithState;
    onToggle: (skillId: string, enabled: boolean) => void;
    toggleLoading?: boolean;
  }

  let { skillWithState, onToggle, toggleLoading = false }: Props = $props();

  const { skill, state, config } = $derived(skillWithState);
  const isLocked = $derived(config?.allowUserToggle === false);
  const isEnabled = $derived(skill.enabled);

  function handleToggle(newEnabled: boolean) {
    onToggle(skill.id, newEnabled);
  }
</script>

<div class="skill-card" class:orphaned={state === 'orphaned'}>
  <div class="skill-header">
    <div class="skill-info">
      <div class="skill-name-row">
        <span class="skill-name">{skill.name}</span>
        <SkillStateBadge {state} />
        {#if !isEnabled}
          <span class="off-badge">OFF</span>
        {/if}
      </div>
      <p class="skill-description">{skill.description}</p>
    </div>
    <SkillToggle
      enabled={isEnabled}
      disabled={toggleLoading}
      locked={isLocked}
      onToggle={handleToggle}
    />
  </div>

  {#if state === 'orphaned'}
    <div class="orphan-warning">
      This skill is no longer managed by your company. It may be outdated or deprecated.
    </div>
  {/if}
</div>

<style>
  .skill-card {
    background: var(--color-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 12px;
    transition: border-color 0.2s ease;
  }

  .skill-card:hover {
    border-color: rgb(248 250 252 / 20%);
  }

  .skill-card.orphaned {
    border-color: rgba(153, 27, 27, 0.4);
  }

  .skill-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .skill-info {
    flex: 1;
    min-width: 0;
  }

  .skill-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  .skill-name {
    font-weight: 600;
    font-size: 13px;
    color: var(--color-foreground);
  }

  .off-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--color-muted);
    color: var(--color-background);
  }

  .skill-description {
    font-size: 12px;
    color: var(--color-muted);
    line-height: 1.4;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .orphan-warning {
    margin-top: 8px;
    padding: 8px;
    background: rgba(153, 27, 27, 0.1);
    border-radius: 4px;
    font-size: 11px;
    color: var(--color-destructive-foreground);
    line-height: 1.4;
  }
</style>
