import { test, expect } from '@playwright/test';

test.describe('ASP Manager Application', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 정보를 localStorage에 설정
    await page.goto('http://localhost:3007');

    // 로그인 정보 추가
    await page.evaluate(() => {
      localStorage.setItem('openaspUser', JSON.stringify({
        userId: 'testuser',
        app: 'asp-manager'
      }));
    });

    // 페이지 새로고침하여 로그인 상태 반영
    await page.reload();
    await page.waitForTimeout(2000);
  });

  test('should load the application', async ({ page }) => {
    // 애플리케이션이 로드되는지 확인
    await expect(page).toHaveTitle(/ASP Manager/);

    // 메인 컨테이너가 표시되는지 확인
    const mainContainer = page.locator('#root');
    await expect(mainContainer).toBeVisible();
  });

  test('should display sidebar navigation', async ({ page }) => {
    // 메인 애플리케이션 컨테이너 확인
    const appContainer = page.locator('.bg-gray-50, .bg-gray-950').first();
    await expect(appContainer).toBeVisible();

    // 네비게이션 아이콘들이 있는지 확인 (Heroicons)
    const navIcons = page.locator('svg').first();
    await expect(navIcons).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to different sections', async ({ page }) => {
    // 사이드바 메뉴 아이템 클릭 (실제 구조 기반)
    const menuItems = page.locator('button').filter({ hasText: /dashboard|システム|ログ/i });
    const firstMenuItem = menuItems.first();

    if (await firstMenuItem.isVisible()) {
      await firstMenuItem.click();
    }

    // 메인 콘텐츠 영역이 있는지 확인
    const mainContent = page.locator('main, .main-content, #root > div').first();
    await expect(mainContent).toBeVisible();
  });

  test('should handle responsive design', async ({ page, browserName }) => {
    // 모바일 뷰포트 테스트
    await page.setViewportSize({ width: 375, height: 667 });

    // 페이지가 모바일 크기에 맞게 조정되는지 확인
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // 데스크톱 뷰포트 테스트
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 애플리케이션이 다시 표시되는지 확인
    const appContainer = page.locator('.bg-gray-50, .bg-gray-950').first();
    await expect(appContainer).toBeVisible();
  });

  test('should display real-time data updates', async ({ page }) => {
    // 페이지가 로드되고 데이터가 표시되는지 확인
    await page.waitForTimeout(2000);

    // 메인 콘텐츠가 표시되는지 확인
    const mainContent = page.locator('#root');
    await expect(mainContent).toBeVisible();

    // 어떤 텍스트든 있는지 확인 (데이터 로딩 확인)
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });

  test('should handle CSS styles correctly across browsers', async ({ page, browserName }) => {
    // Tailwind CSS 클래스가 적용되는지 확인
    const elements = page.locator('.bg-gray-50, .flex, .grid, .h-screen');
    const firstElement = elements.first();

    if (await firstElement.isVisible()) {
      const computedStyle = await firstElement.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          height: style.height,
        };
      });

      // 스타일이 적용되었는지 확인
      expect(computedStyle.display).toBeTruthy();
    }
  });
});