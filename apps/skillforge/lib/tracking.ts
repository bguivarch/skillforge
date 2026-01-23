/**
 * Tracking endpoint
 */
const TRACKING_ENDPOINT = 'https://bguivarch.val.run/';

/**
 * Storage key for install tracking
 */
const INSTALL_KEY = 'skillforge_installed';

/**
 * Track an event to the analytics endpoint
 */
export async function trackEvent(event: string): Promise<void> {
  try {
    await fetch(TRACKING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        version: browser.runtime.getManifest().version,
      }),
    });
  } catch (e) {
    // Silent fail - don't break the app if tracking fails
  }
}

/**
 * Track install (once per browser)
 */
export async function trackInstall(): Promise<void> {
  try {
    const result = await browser.storage.local.get(INSTALL_KEY);
    if (!result[INSTALL_KEY]) {
      await trackEvent('install');
      await browser.storage.local.set({ [INSTALL_KEY]: true });
    }
  } catch (e) {
    // Silent fail
  }
}
