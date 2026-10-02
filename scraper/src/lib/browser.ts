// Playwright lifecycle: a realistic desktop context, heavy-resource blocking,
// optional proxy and retrying navigation.

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'stylesheet']);

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  close(): Promise<void>;
}

export interface BrowserOptions {
  proxyServer?: string;
}

/**
 * Launch chromium and open a context configured for Pakistani market sites:
 * en-PK locale, Asia/Karachi timezone and an anti-automation flag. Images,
 * media, fonts and stylesheets are aborted to speed up scraping.
 */
export async function createBrowserSession(opts: BrowserOptions = {}): Promise<BrowserSession> {
  const proxy = opts.proxyServer ?? process.env.PROXY_SERVER?.trim();
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    ...(proxy ? { proxy: { server: proxy } } : {}),
  });

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    locale: 'en-PK',
    timezoneId: 'Asia/Karachi',
    viewport: { width: 1366, height: 768 },
    bypassCSP: true,
  });

  await blockHeavyResources(context);

  return {
    browser,
    context,
    close: async () => {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    },
  };
}

export async function blockHeavyResources(context: BrowserContext): Promise<void> {
  await context.route('**/*', (route) => {
    if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) {
      return route.abort();
    }
    return route.continue();
  });
}

export interface FetchOptions {
  attempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  /** Called before each retry with the attempt number (1-based). */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Navigate to `url` and return the page HTML. Retries up to `attempts` times
 * (default 3) with exponential backoff between attempts.
 */
export async function fetchHtml(
  page: Page,
  url: string,
  opts: FetchOptions = {},
): Promise<string> {
  const attempts = opts.attempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1000;
  const timeout = opts.timeoutMs ?? 45_000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      if (response && !response.ok()) {
        throw new Error(`HTTP ${response.status()} ${response.statusText()} for ${url}`);
      }
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
      return await page.content();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const backoff = baseDelay * 2 ** (attempt - 1);
        opts.onRetry?.(attempt, error);
        await page.waitForTimeout(backoff);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
