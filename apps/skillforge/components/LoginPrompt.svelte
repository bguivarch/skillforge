<script lang="ts">
  function openClaude() {
    browser.tabs.create({ url: 'https://claude.ai' });
  }
</script>

<div class="login-prompt">
  <div class="lock-icon">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  </div>
  <h2 class="title">Not logged in</h2>
  <p class="description">
    Log in to Claude.ai to sync your team's skills.
  </p>
  <button class="login-btn" onclick={openClaude}>
    Open Claude.ai
  </button>
</div>

<style>
  .login-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 48px 24px;
  }

  .lock-icon {
    color: var(--color-muted);
    margin-bottom: 16px;
  }

  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-foreground);
    margin: 0 0 8px 0;
  }

  .description {
    font-size: 13px;
    color: var(--color-muted);
    margin: 0 0 24px 0;
    line-height: 1.5;
  }

  .login-btn {
    padding: 10px 24px;
    background: var(--color-primary);
    color: var(--color-primary-foreground);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .login-btn:hover {
    opacity: 0.9;
  }
</style>
