// 通义听悟每日签到脚本
// 依赖：Playwright + TINGWU_COOKIE 环境变量
// 目标页：https://tingwu.aliyun.com/u/home
// 仅在 GitHub Actions 里跑，不参与 MCP server 本体部署

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const COOKIE_STR = process.env.TINGWU_COOKIE;
if (!COOKIE_STR) {
  console.error('缺少 TINGWU_COOKIE 环境变量');
  process.exit(2);
}

mkdirSync('artifacts', { recursive: true });

function parseCookieString(raw) {
  return raw
    .split(/;\s*/)
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      return {
        name,
        value,
        domain: '.aliyun.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      };
    });
}

const cookies = parseCookieString(COOKIE_STR);
console.log(`加载 ${cookies.length} 个 cookie`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  locale: 'zh-CN',
});
await context.addCookies(cookies);

const page = await context.newPage();

const apiLog = [];
page.on('response', (resp) => {
  const url = resp.url();
  if (/sign|check[-_]?in|task|point|reward/i.test(url)) {
    apiLog.push({ status: resp.status(), url });
  }
});

let exitCode = 0;
try {
  console.log('打开通义听悟首页…');
  await page.goto('https://tingwu.aliyun.com/u/home', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);

  if (/login|passport/.test(page.url())) {
    throw new Error(`cookie 失效，被重定向到登录页：${page.url()}`);
  }
  await page.screenshot({ path: 'artifacts/01-home.png', fullPage: true });

  const entryCandidates = ['签到领时长', '每日签到', '立即签到', '去签到', '签到'];
  let entered = false;
  for (const text of entryCandidates) {
    const locator = page.getByText(text, { exact: false }).first();
    if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log(`点击入口：${text}`);
      await locator.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2500);
      entered = true;
      break;
    }
  }

  await page.screenshot({ path: 'artifacts/02-dialog.png', fullPage: true });

  const confirmTexts = ['立即签到', '今日签到', '签到', 'Sign in'];
  let claimed = false;
  for (const text of confirmTexts) {
    const btn = page.getByRole('button', { name: new RegExp(text) }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      const disabled = await btn.isDisabled().catch(() => false);
      if (disabled) {
        console.log(`按钮 "${text}" 已是禁用态，大概率已签到`);
        claimed = true;
        break;
      }
      console.log(`点击确认按钮：${text}`);
      await btn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2500);
      claimed = true;
      break;
    }
  }

  const alreadyText = await page
    .getByText(/已签到|今日已/)
    .first()
    .textContent({ timeout: 1500 })
    .catch(() => null);

  await page.screenshot({ path: 'artifacts/03-done.png', fullPage: true });

  console.log('---- 相关接口 ----');
  for (const row of apiLog) console.log(`${row.status}  ${row.url}`);
  console.log('------------------');

  if (alreadyText) {
    console.log(`已签到：${alreadyText.trim()}`);
  } else if (claimed) {
    console.log('签到动作已执行');
  } else if (entered) {
    console.log('打开了签到入口但没找到按钮，可能页面结构变了，请看截图');
    exitCode = 1;
  } else {
    console.log('没找到任何签到入口，可能页面结构变了，请看截图');
    exitCode = 1;
  }
} catch (err) {
  console.error('签到失败：', err.message);
  await page.screenshot({ path: 'artifacts/99-error.png', fullPage: true }).catch(() => {});
  exitCode = 1;
} finally {
  await browser.close();
}

process.exit(exitCode);
