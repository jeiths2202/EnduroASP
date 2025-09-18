import { test, expect } from '@playwright/test';

test.describe('ASP Manager Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3007');
  });

  test('should load the application', async ({ page }) => {
    // 애플리케이션이 로드되는지 확인
    await expect(page).toHaveTitle(/ASP Manager/);

    // 메인 컨테이너가 표시되는지 확인
    const mainContainer = page.locator('#root');
    await expect(mainContainer).toBeVisible();
  });

  test('should display sidebar navigation', async ({ page }) => {
    // 사이드바가 표시되는지 확인
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();

    // 네비게이션 항목들이 있는지 확인
    const navItems = page.locator('[data-testid="nav-item"]');
    await expect(navItems).toHaveCount(5, { timeout: 10000 });
  });

  test('should navigate to different sections', async ({ page }) => {
    // Dashboard 섹션으로 이동
    await page.click('[data-testid="nav-dashboard"]');
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();

    // System Overview 섹션으로 이동
    await page.click('[data-testid="nav-system"]');
    await expect(page.locator('[data-testid="system-content"]')).toBeVisible();
  });

  test('should handle responsive design', async ({ page, browserName }) => {
    // 모바일 뷰포트 테스트
    await page.setViewportSize({ width: 375, height: 667 });

    // 모바일 메뉴 버튼이 표시되는지 확인
    const mobileMenuButton = page.locator('[data-testid="mobile-menu"]');
    await expect(mobileMenuButton).toBeVisible();

    // 데스크톱 뷰포트 테스트
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 사이드바가 다시 표시되는지 확인
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();
  });

  test('should display real-time data updates', async ({ page }) => {
    // WebSocket 연결 상태 확인
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await expect(connectionStatus).toHaveText(/Connected/, { timeout: 15000 });

    // 실시간 데이터 업데이트 확인
    const dataDisplay = page.locator('[data-testid="real-time-data"]');
    const initialText = await dataDisplay.textContent();

    // 5초 후 데이터가 변경되었는지 확인
    await page.waitForTimeout(5000);
    const updatedText = await dataDisplay.textContent();

    expect(updatedText).not.toBe(initialText);
  });

  test('should handle CSS styles correctly across browsers', async ({ page, browserName }) => {
    // CSS Grid 레이아웃이 올바르게 적용되는지 확인
    const gridContainer = page.locator('[data-testid="grid-container"]');
    const computedStyle = await gridContainer.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(computedStyle).toBe('grid');

    // Flexbox 레이아웃 확인
    const flexContainer = page.locator('[data-testid="flex-container"]');
    const flexStyle = await flexContainer.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(flexStyle).toBe('flex');

    // 브라우저별 특정 스타일 확인
    if (browserName === 'webkit') {
      // WebKit 특정 CSS 속성 테스트
      const webkitElement = page.locator('[data-testid="webkit-specific"]');
      const webkitStyle = await webkitElement.evaluate((el) => {
        return window.getComputedStyle(el).webkitBoxReflect;
      });
      expect(webkitStyle).toBeDefined();
    }
  });
});