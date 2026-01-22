<script lang="ts">
  import { onMount } from 'svelte';
  import type { StatusResponse, SyncResult, SkillWithState } from '../../lib/types';
  import { getStatus, triggerSync, toggleSkill, syncSingleSkill } from '../../lib/messaging';
  import LoginPrompt from '../../components/LoginPrompt.svelte';
  import PendingAlert from '../../components/PendingAlert.svelte';
  import SkillCard from '../../components/SkillCard.svelte';
  import SyncButton from '../../components/SyncButton.svelte';

  // State
  let loading = $state(true);
  let syncing = $state(false);
  let toggleLoadingId = $state<string | null>(null);
  let updatingSkillName = $state<string | null>(null);
  let error = $state<string | null>(null);
  let status = $state<StatusResponse | null>(null);
  let showResults = $state(false);

  // Derived state
  const companySkills = $derived(
    status?.skills.filter(s => s.state !== 'other') ?? []
  );
  const otherSkills = $derived(
    status?.skills.filter(s => s.state === 'other') ?? []
  );

  onMount(async () => {
    await loadStatus();
  });

  async function loadStatus(showLoading = true) {
    if (showLoading) {
      loading = true;
    }
    error = null;

    try {
      status = await getStatus();
    } catch (e) {
      error = 'Failed to load status';
      console.error('[SkillForge] Failed to load status:', e);
    } finally {
      loading = false;
    }
  }

  async function handleSync() {
    syncing = true;
    error = null;
    showResults = false;

    try {
      const result = await triggerSync();

      if (!result.success) {
        error = result.error ?? 'Sync failed';
      } else {
        showResults = true;
        // Hide results after 5 seconds
        setTimeout(() => {
          showResults = false;
        }, 5000);
      }

      await loadStatus();
    } catch (e) {
      error = 'Sync failed unexpectedly';
      console.error('[SkillForge] Sync failed:', e);
    } finally {
      syncing = false;
    }
  }

  async function handleToggle(skillId: string, enabled: boolean) {
    toggleLoadingId = skillId;

    try {
      await toggleSkill(skillId, enabled);
      await loadStatus(false); // Don't show full-page loading when refreshing after toggle
    } catch (e) {
      error = 'Failed to toggle skill';
      console.error('[SkillForge] Toggle failed:', e);
    } finally {
      toggleLoadingId = null;
    }
  }

  async function handleUpdate(skillName: string) {
    updatingSkillName = skillName;
    error = null;

    try {
      const result = await syncSingleSkill(skillName);

      if (result.action === 'error') {
        error = result.message ?? 'Update failed';
      }

      await loadStatus(false);
    } catch (e) {
      error = 'Failed to update skill';
      console.error('[SkillForge] Update failed:', e);
    } finally {
      updatingSkillName = null;
    }
  }

  function getResultIcon(action: SyncResult['action']): string {
    switch (action) {
      case 'created': return '✓';
      case 'updated': return '✓';
      case 'skipped': return '−';
      case 'error': return '✗';
    }
  }

  function getResultClass(action: SyncResult['action']): string {
    switch (action) {
      case 'created': return 'success';
      case 'updated': return 'info';
      case 'skipped': return 'muted';
      case 'error': return 'error';
    }
  }

  function formatTimeAgo(timestamp: number | null): string {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return new Date(timestamp).toLocaleDateString();
  }
</script>

<div class="popup">
  <!-- Header -->
  <header class="header">
    <div class="header-left">
      {#if status?.loggedIn && status.config}
        <div class="header-title">{status.config.name}</div>
        <div class="header-meta">
          <span class="header-version">v{status.config.version}</span>
          <span class="header-dot connected"></span>
          <span class="header-status">Connected</span>
          {#if status.lastSyncTime}
            <span class="header-separator">·</span>
            <span class="header-sync">Last synced: {formatTimeAgo(status.lastSyncTime)}</span>
          {/if}
        </div>
      {:else}
        <h1 class="title">SkillForge</h1>
      {/if}
    </div>
    {#if status?.loggedIn}
      <SyncButton
        {syncing}
        onClick={handleSync}
        small
      />
    {/if}
  </header>

  <!-- Loading state -->
  {#if loading}
    <div class="loading">
      <div class="loading-spinner"></div>
      <span>Loading...</span>
    </div>

  <!-- Not logged in -->
  {:else if !status?.loggedIn}
    <LoginPrompt />

  <!-- Main content -->
  {:else}
    <main class="content">
      <!-- Pending alert -->
      {#if status.pendingCounts.newCount > 0 || status.pendingCounts.updateCount > 0}
        <PendingAlert
          counts={status.pendingCounts}
          onSyncClick={handleSync}
          {syncing}
        />
      {/if}

      <!-- Error banner -->
      {#if error}
        <div class="error-banner">
          {error}
        </div>
      {/if}

      <!-- Sync results -->
      {#if showResults && status.syncResults.length > 0}
        <section class="section">
          <h2 class="section-title">Sync Results</h2>
          <div class="results-list">
            {#each status.syncResults as result}
              <div class="result-item {getResultClass(result.action)}">
                <span class="result-icon">{getResultIcon(result.action)}</span>
                <span class="result-name">{result.skillName}</span>
                <span class="result-action">{result.action}</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Company Skills -->
      {#if companySkills.length > 0}
        <section class="section">
          <h2 class="section-title">Company Skills</h2>
          <div class="skills-list">
            {#each companySkills as skillWithState (skillWithState.skill.id)}
              <SkillCard
                {skillWithState}
                onToggle={handleToggle}
                onUpdate={handleUpdate}
                toggleLoading={toggleLoadingId === skillWithState.skill.id}
                updateLoading={updatingSkillName === skillWithState.skill.name}
              />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Other Skills -->
      {#if otherSkills.length > 0}
        <section class="section">
          <h2 class="section-title">Other Skills</h2>
          <div class="skills-list">
            {#each otherSkills as skillWithState (skillWithState.skill.id)}
              <SkillCard
                {skillWithState}
                onToggle={handleToggle}
                onUpdate={handleUpdate}
                toggleLoading={toggleLoadingId === skillWithState.skill.id}
                updateLoading={updatingSkillName === skillWithState.skill.name}
              />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Empty state -->
      {#if companySkills.length === 0 && otherSkills.length === 0}
        <div class="empty-state">
          <p>No skills found. Click sync to get started.</p>
        </div>
      {/if}

      <!-- Sync button -->
      <div class="sync-container">
        <SyncButton
          {syncing}
          onClick={handleSync}
        />
      </div>
    </main>
  {/if}
</div>

<style>
  .popup {
    display: flex;
    flex-direction: column;
    min-height: 400px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-foreground);
    margin: 0;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-foreground);
  }

  .header-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--color-muted);
  }

  .header-version {
    color: var(--color-muted);
  }

  .header-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-destructive);
    flex-shrink: 0;
  }

  .header-dot.connected {
    background: var(--color-success-foreground);
  }

  .header-status {
    color: var(--color-muted);
  }

  .header-separator {
    color: var(--color-border);
  }

  .header-sync {
    color: var(--color-muted);
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 24px;
    color: var(--color-muted);
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-foreground);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .content {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .error-banner {
    padding: 10px 12px;
    background: rgba(153, 27, 27, 0.1);
    border: 1px solid var(--color-destructive);
    border-radius: 8px;
    color: var(--color-destructive-foreground);
    font-size: 13px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .skills-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--color-secondary);
    border-radius: 8px;
    padding: 8px;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .result-icon {
    font-weight: 600;
    width: 16px;
    text-align: center;
  }

  .result-name {
    flex: 1;
    font-weight: 500;
  }

  .result-action {
    text-transform: capitalize;
    font-size: 11px;
  }

  .result-item.success {
    color: var(--color-success-foreground);
  }

  .result-item.info {
    color: rgb(147, 197, 253);
  }

  .result-item.muted {
    color: var(--color-muted);
  }

  .result-item.error {
    color: var(--color-destructive-foreground);
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: var(--color-muted);
    font-size: 13px;
  }

  .sync-container {
    margin-top: auto;
    padding-top: 8px;
  }
</style>
