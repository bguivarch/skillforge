<script lang="ts">
  import { onMount } from 'svelte';
  import type { StatusResponse, SyncResult, SkillWithState } from '../../lib/types';
  import { getStatus, triggerSync, toggleSkill, syncSingleSkill, deleteSkill } from '../../lib/messaging';
  import LoginPrompt from '../../components/LoginPrompt.svelte';
  import PendingAlert from '../../components/PendingAlert.svelte';
  import SkillCard from '../../components/SkillCard.svelte';
  import SyncButton from '../../components/SyncButton.svelte';

  // State
  let loading = $state(true);
  let syncing = $state(false);
  let toggleLoadingId = $state<string | null>(null);
  let updatingSkillName = $state<string | null>(null);
  let deletingSkillId = $state<string | null>(null);
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

      await loadStatus(false);
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

  async function handleDelete(skillId: string, skillName: string) {
    deletingSkillId = skillId;
    error = null;

    try {
      await deleteSkill(skillId, skillName);
      await loadStatus(false);
    } catch (e) {
      error = 'Failed to delete skill';
      console.error('[SkillForge] Delete failed:', e);
    } finally {
      deletingSkillId = null;
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
                onDelete={handleDelete}
                toggleLoading={toggleLoadingId === skillWithState.skill.id}
                updateLoading={updatingSkillName === skillWithState.skill.name}
                deleteLoading={deletingSkillId === skillWithState.skill.id}
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
                onDelete={handleDelete}
                toggleLoading={toggleLoadingId === skillWithState.skill.id}
                updateLoading={updatingSkillName === skillWithState.skill.name}
                deleteLoading={deletingSkillId === skillWithState.skill.id}
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

  <!-- Footer -->
  <footer class="footer">
    <a href="https://github.com/bguivarch/skillforge/issues" target="_blank" rel="noopener noreferrer" class="footer-link">
      <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      Report issue
    </a>
    <a href="https://x.com/BGuivarch" target="_blank" rel="noopener noreferrer" class="footer-link">
      <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
      @BGuivarch
    </a>
  </footer>
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

  .footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 12px 16px;
    border-top: 1px solid var(--color-border);
    margin-top: auto;
  }

  .footer-link {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    text-decoration: none;
    font-size: 12px;
    transition: color 0.15s ease;
  }

  .footer-link:hover {
    color: var(--color-foreground);
  }

  .footer-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
</style>
