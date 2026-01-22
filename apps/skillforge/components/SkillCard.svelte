<script lang="ts">
  import type { SkillWithState } from '../lib/types';
  import SkillStateBadge from './SkillStateBadge.svelte';
  import SkillToggle from './SkillToggle.svelte';

  interface Props {
    skillWithState: SkillWithState;
    onToggle: (skillId: string, enabled: boolean) => void;
    onUpdate?: (skillName: string) => void;
    onDelete?: (skillId: string, skillName: string) => void;
    toggleLoading?: boolean;
    updateLoading?: boolean;
    deleteLoading?: boolean;
  }

  let { skillWithState, onToggle, onUpdate, onDelete, toggleLoading = false, updateLoading = false, deleteLoading = false }: Props = $props();

  const { skill, state, config } = $derived(skillWithState);
  const isLocked = $derived(config?.allowUserToggle === false);
  const isEnabled = $derived(skill.enabled);

  function handleToggle(newEnabled: boolean) {
    onToggle(skill.id, newEnabled);
  }

  function handleUpdate() {
    if (onUpdate && state === 'outdated') {
      onUpdate(skill.name);
    }
  }

  function handleDelete() {
    if (onDelete && state === 'orphaned') {
      onDelete(skill.id, skill.name);
    }
  }
</script>

<div class="skill-card" class:orphaned={state === 'orphaned'}>
  <div class="skill-header">
    <div class="skill-info">
      <div class="skill-name-row">
        <span class="skill-name">{skill.name}</span>
        <SkillStateBadge
          {state}
          onUpdateClick={state === 'outdated' ? handleUpdate : undefined}
          updating={updateLoading}
        />
        {#if !isEnabled}
          <span class="off-badge">OFF</span>
        {/if}
      </div>
      <p class="skill-description">{skill.description}</p>
    </div>
    <SkillToggle
      enabled={isEnabled}
      loading={toggleLoading}
      locked={isLocked}
      onToggle={handleToggle}
    />
  </div>

  {#if state === 'orphaned'}
    <div class="orphan-warning">
      <span>This skill is no longer managed by your company. It may be outdated or deprecated.</span>
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
