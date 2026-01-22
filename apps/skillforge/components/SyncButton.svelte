<script lang="ts">
  interface Props {
    syncing: boolean;
    disabled?: boolean;
    small?: boolean;
    onClick: () => void;
  }

  let { syncing, disabled = false, small = false, onClick }: Props = $props();
</script>

<button
  class="sync-button"
  class:syncing
  class:small
  disabled={disabled || syncing}
  onclick={onClick}
>
  {#if syncing}
    <span class="spinner"></span>
    <span>Syncing...</span>
  {:else}
    <svg class="sync-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </svg>
    <span>Sync Skills</span>
  {/if}
</button>

<style>
  .sync-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--color-primary);
    color: var(--color-primary-foreground);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s ease, transform 0.1s ease;
  }

  .sync-button.small {
    width: auto;
    padding: 6px 12px;
    font-size: 12px;
    border-radius: 6px;
    gap: 6px;
  }

  .sync-button.small .sync-icon {
    width: 14px;
    height: 14px;
  }

  .sync-button.small .spinner {
    width: 14px;
    height: 14px;
  }

  .sync-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .sync-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .sync-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .sync-icon {
    flex-shrink: 0;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(2, 6, 23, 0.3);
    border-top-color: var(--color-primary-foreground);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
