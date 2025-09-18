import { test, expect } from '@playwright/test';

test.describe('OpenASP Refactor Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3005');
  });

  test('should load the main application', async ({ page }) => {
    // 타이틀 확인
    await expect(page).toHaveTitle(/OpenASP Refactor/);

    // 메인 컨테이너 확인
    const mainContent = page.locator('#root');
    await expect(mainContent).toBeVisible();
  });

  test('should display the terminal interface', async ({ page }) => {
    // 터미널 컴포넌트 확인
    const terminal = page.locator('[data-testid="terminal-container"]');
    await expect(terminal).toBeVisible();

    // 터미널 입력 필드 확인
    const terminalInput = page.locator('[data-testid="terminal-input"]');
    await expect(terminalInput).toBeEditable();
  });

  test('should handle SMED map display', async ({ page }) => {
    // SMED 맵 디스플레이 컨테이너 확인
    const smedDisplay = page.locator('[data-testid="smed-map-display"]');
    await expect(smedDisplay).toBeVisible();

    // 24x80 그리드 레이아웃 확인
    const gridCells = page.locator('[data-testid="grid-cell"]');
    await expect(gridCells).toHaveCount(1920, { timeout: 10000 }); // 24 * 80 = 1920
  });

  test('should support internationalization', async ({ page }) => {
    // 언어 선택기 확인
    const languageSelector = page.locator('[data-testid="language-selector"]');
    await expect(languageSelector).toBeVisible();

    // 한국어로 변경
    await languageSelector.selectOption('ko');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(/환영합니다/);

    // 일본어로 변경
    await languageSelector.selectOption('ja');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(/ようこそ/);

    // 영어로 복원
    await languageSelector.selectOption('en');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(/Welcome/);
  });

  test('should handle WebSocket connections', async ({ page }) => {
    // WebSocket 연결 상태 확인
    const wsStatus = page.locator('[data-testid="ws-status"]');
    await expect(wsStatus).toHaveAttribute('data-connected', 'true', { timeout: 10000 });

    // WebSocket 메시지 송수신 테스트
    const input = page.locator('[data-testid="terminal-input"]');
    await input.fill('TEST_COMMAND');
    await input.press('Enter');

    // 응답 확인
    const response = page.locator('[data-testid="terminal-output"]');
    await expect(response).toContainText(/Response/, { timeout: 5000 });
  });

  test('should handle code conversion features', async ({ page }) => {
    // 코드 변환 탭으로 이동
    await page.click('[data-testid="tab-conversion"]');

    // COBOL 코드 입력 영역 확인
    const cobolInput = page.locator('[data-testid="cobol-input"]');
    await expect(cobolInput).toBeVisible();

    // 샘플 COBOL 코드 입력
    await cobolInput.fill(`
      IDENTIFICATION DIVISION.
      PROGRAM-ID. TEST-PROG.
      DATA DIVISION.
      WORKING-STORAGE SECTION.
      01 WS-NAME PIC X(30).
    `);

    // 변환 버튼 클릭
    await page.click('[data-testid="convert-button"]');

    // 변환 결과 확인
    const javaOutput = page.locator('[data-testid="java-output"]');
    await expect(javaOutput).toContainText(/public class/, { timeout: 10000 });
  });

  test('should verify CSS rendering across browsers', async ({ page, browserName }) => {
    // Tailwind CSS 클래스가 올바르게 적용되는지 확인
    const tailwindElement = page.locator('.flex.items-center.justify-between');
    const flexDisplay = await tailwindElement.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(flexDisplay).toBe('flex');

    // CSS Grid가 올바르게 작동하는지 확인
    const gridElement = page.locator('[data-testid="smed-grid"]');
    const gridDisplay = await gridElement.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(gridDisplay).toBe('grid');

    // 브라우저별 CSS 접두사 확인
    if (browserName === 'firefox') {
      // Firefox 특정 스타일
      const mozElement = page.locator('[data-testid="firefox-specific"]');
      const mozStyle = await mozElement.evaluate((el) => {
        return window.getComputedStyle(el).MozAppearance;
      });
      expect(mozStyle).toBeDefined();
    }

    // CSS 애니메이션 확인
    const animatedElement = page.locator('[data-testid="loading-spinner"]');
    const animation = await animatedElement.evaluate((el) => {
      return window.getComputedStyle(el).animation;
    });
    expect(animation).toContain('spin');
  });

  test('should handle responsive design properly', async ({ page }) => {
    // 다양한 뷰포트 크기 테스트
    const viewports = [
      { width: 320, height: 568, name: 'iPhone SE' },
      { width: 768, height: 1024, name: 'iPad' },
      { width: 1920, height: 1080, name: 'Desktop HD' },
      { width: 2560, height: 1440, name: 'Desktop QHD' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      // 레이아웃이 뷰포트에 맞게 조정되는지 확인
      const container = page.locator('[data-testid="main-container"]');
      const containerWidth = await container.evaluate((el) => el.offsetWidth);

      expect(containerWidth).toBeLessThanOrEqual(viewport.width);

      // 모바일에서 햄버거 메뉴 표시 확인
      if (viewport.width < 768) {
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      } else {
        await expect(page.locator('[data-testid="desktop-menu"]')).toBeVisible();
      }
    }
  });
});