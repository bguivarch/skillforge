<script lang="ts">
  import { onMount } from 'svelte';
  import type { StatusResponse, SkillWithState, ConnectorWithState } from '../../lib/types';
  import { getStatus, triggerSync, toggleSkill, syncSingleSkill, deleteSkill, deleteConnector } from '../../lib/messaging';
  import LoginPrompt from '../../components/LoginPrompt.svelte';
  import PendingAlert from '../../components/PendingAlert.svelte';
  import SkillCard from '../../components/SkillCard.svelte';
  import ConnectorCard from '../../components/ConnectorCard.svelte';
  import SyncButton from '../../components/SyncButton.svelte';

  // State
  let loading = $state(true);
  let syncing = $state(false);
  let toggleLoadingId = $state<string | null>(null);
  let updatingSkillName = $state<string | null>(null);
  let deletingSkillId = $state<string | null>(null);
  let deletingConnectorId = $state<string | null>(null);
  let error = $state<string | null>(null);
  let status = $state<StatusResponse | null>(null);

  // Navigation state
  let scope = $state<'company' | 'personal'>('company');
  let activeView = $state<'skills' | 'mcp'>('skills');

  // Derived state
  const companySkills = $derived(
    status?.skills.filter(s => s.state !== 'other') ?? []
  );
  const personalSkills = $derived(
    status?.skills.filter(s => s.state === 'other') ?? []
  );
  const companyConnectors = $derived(
    status?.connectors.filter(c => c.state !== 'other') ?? []
  );
  const personalConnectors = $derived(
    status?.connectors.filter(c => c.state === 'other') ?? []
  );

  // Current view data
  const currentSkills = $derived(scope === 'company' ? companySkills : personalSkills);
  const currentConnectors = $derived(scope === 'company' ? companyConnectors : personalConnectors);

  // Counts for footer badges
  const skillsCount = $derived(currentSkills.length);
  const mcpCount = $derived(currentConnectors.length);

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

    try {
      const result = await triggerSync();

      if (!result.success) {
        error = result.error ?? 'Sync failed';
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
      await loadStatus(false);
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

  async function handleDeleteConnector(connectorId: string, connectorName: string) {
    deletingConnectorId = connectorId;
    error = null;

    try {
      await deleteConnector(connectorId, connectorName);
      await loadStatus(false);
    } catch (e) {
      error = 'Failed to delete connector';
      console.error('[SkillForge] Delete connector failed:', e);
    } finally {
      deletingConnectorId = null;
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
            <span class="header-sync">{formatTimeAgo(status.lastSyncTime)}</span>
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
      <!-- Scope selector -->
      <div class="scope-bar">
        <div class="scope-selector">
          <select bind:value={scope} class="scope-dropdown">
            <option value="company">Company</option>
            <option value="personal">Personal</option>
          </select>
          <svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      <!-- Pending alert -->
      {#if scope === 'company' && (status.pendingCounts.newCount > 0 || status.pendingCounts.updateCount > 0 || status.pendingCounts.newConnectorCount > 0)}
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

      <!-- Skills View -->
      {#if activeView === 'skills'}
        <div class="view-content">
          {#if currentSkills.length > 0}
            <div class="items-list">
              {#each currentSkills as skillWithState (skillWithState.skill.id)}
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
          {:else}
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              </div>
              <p>{scope === 'company' ? 'No company skills. Click sync to get started.' : 'No personal skills.'}</p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- MCP View -->
      {#if activeView === 'mcp'}
        <div class="view-content">
          {#if currentConnectors.length > 0}
            <div class="items-list">
              {#each currentConnectors as connectorWithState (connectorWithState.connector.uuid)}
                <ConnectorCard
                  {connectorWithState}
                  onDelete={scope === 'company' ? handleDeleteConnector : undefined}
                  deleteLoading={deletingConnectorId === (connectorWithState.connector.uuid || connectorWithState.connector.id)}
                />
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <p>{scope === 'company' ? 'No company MCP connectors.' : 'No personal MCP connectors.'}</p>
            </div>
          {/if}
        </div>
      {/if}

    </main>

    <!-- Footer Navigation -->
    <nav class="footer-nav">
      <button
        class="nav-tab"
        class:active={activeView === 'skills'}
        onclick={() => activeView = 'skills'}
      >
        <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <span class="nav-label">Skills</span>
        {#if skillsCount > 0}
          <span class="nav-badge">{skillsCount}</span>
        {/if}
      </button>
      <button
        class="nav-tab"
        class:active={activeView === 'mcp'}
        onclick={() => activeView = 'mcp'}
      >
        <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <span class="nav-label">MCP</span>
        {#if mcpCount > 0}
          <span class="nav-badge">{mcpCount}</span>
        {/if}
      </button>
    </nav>
  {/if}
</div>

<style>
  .popup {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-background);
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
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 10px;
    padding: 1px 5px;
    background: var(--color-secondary);
    border-radius: 3px;
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
    box-shadow: 0 0 6px var(--color-success-foreground);
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
    flex: 1;
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
    flex: 1 1 auto;
    padding: 12px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    min-height: 0;
  }

  /* Scope selector */
  .scope-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .scope-selector {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .scope-dropdown {
    appearance: none;
    background: var(--color-secondary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 6px 28px 6px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-foreground);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .scope-dropdown:hover {
    border-color: var(--color-muted);
  }

  .scope-dropdown:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .dropdown-chevron {
    position: absolute;
    right: 8px;
    pointer-events: none;
    color: var(--color-muted);
  }

  .error-banner {
    padding: 10px 12px;
    background: rgba(153, 27, 27, 0.1);
    border: 1px solid var(--color-destructive);
    border-radius: 8px;
    color: var(--color-destructive-foreground);
    font-size: 13px;
  }

  .view-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    color: var(--color-muted);
    text-align: center;
    gap: 12px;
  }

  .empty-icon {
    opacity: 0.4;
  }

  .empty-state p {
    font-size: 13px;
    margin: 0;
  }

  /* Footer Navigation */
  .footer-nav {
    display: flex;
    flex-shrink: 0;
    border-top: 1px solid var(--color-border);
    background: var(--color-background);
    margin-top: auto;
  }

  .nav-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 8px;
    border: none;
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .nav-tab::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 2px;
    background: var(--color-primary);
    transition: width 0.2s ease;
  }

  .nav-tab:hover {
    color: var(--color-foreground);
    background: var(--color-secondary);
  }

  .nav-tab.active {
    color: var(--color-primary);
  }

  .nav-tab.active::before {
    width: 32px;
  }

  .nav-icon {
    flex-shrink: 0;
  }

  .nav-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .nav-badge {
    position: absolute;
    top: 6px;
    right: calc(50% - 24px);
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
    background: var(--color-accent);
    color: var(--color-foreground);
    border-radius: 8px;
  }

  .nav-tab.active .nav-badge {
    background: var(--color-primary);
    color: var(--color-primary-foreground);
  }
</style>
