<script lang="ts">
  interface Props {
    enabled: boolean;
    disabled?: boolean;
    locked?: boolean;
    loading?: boolean;
    onToggle: (enabled: boolean) => void;
  }

  let { enabled, disabled = false, locked = false, loading = false, onToggle }: Props = $props();

  function handleClick() {
    if (!disabled && !locked && !loading) {
      onToggle(!enabled);
    }
  }
</script>

<button
  class="toggle"
  class:enabled
  class:disabled={disabled || locked || loading}
  class:loading
  onclick={handleClick}
  title={locked ? 'Toggle disabled by admin' : loading ? 'Loading...' : enabled ? 'Disable skill' : 'Enable skill'}
  aria-pressed={enabled}
>
  <span class="track">
    <span class="thumb">
      {#if loading}
        <span class="spinner"></span>
      {/if}
    </span>
  </span>
  {#if locked}
    <span class="lock-icon">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
      </svg>
    </span>
  {/if}
</button>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
  }

  .toggle.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .track {
    width: 36px;
    height: 20px;
    background: var(--color-muted);
    border-radius: 10px;
    position: relative;
    transition: background 0.2s ease;
  }

  .enabled .track {
    background: var(--color-foreground);
  }

  .thumb {
    width: 16px;
    height: 16px;
    background: var(--color-background);
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform 0.2s ease;
  }

  .enabled .thumb {
    transform: translateX(16px);
  }

  .lock-icon {
    color: var(--color-muted);
    display: flex;
    align-items: center;
  }

  .spinner {
    width: 10px;
    height: 10px;
    border: 1.5px solid var(--color-muted);
    border-top-color: var(--color-foreground);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  @keyframes spin {
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }
</style>
