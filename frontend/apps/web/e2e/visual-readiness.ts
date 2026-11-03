import type { Page } from '@playwright/test';

/** Capture settled product motion rather than a screenshot-triggered animation finish. */
export async function waitForVisualReadiness(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Allow hydration effects and IntersectionObserver to register entrance animations.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const entranceAnimations = document.getAnimations().filter((animation) => {
      const iterations = animation.effect?.getTiming().iterations;
      return iterations !== Infinity && (animation.playState === 'running' || animation.pending);
    });
    await Promise.all(entranceAnimations.map((animation) => animation.finished.catch(() => {})));
  });
  // Hydration does not guarantee that IO has revealed every visible content item.
  // Wait for that registration and any resulting finite motion without altering it.
  await page.waitForFunction(() => {
    const pendingVisibleItems = [...document.querySelectorAll('[data-reveal="pending"]')].some(
      (element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
      },
    );
    const moving = document.getAnimations().some((animation) => {
      const iterations = animation.effect?.getTiming().iterations;
      return iterations !== Infinity && (animation.playState === 'running' || animation.pending);
    });
    return !pendingVisibleItems && !moving;
  });
}
