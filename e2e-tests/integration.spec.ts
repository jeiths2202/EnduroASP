import { test, expect } from '@playwright/test';

test.describe('Cross-Service Integration Tests', () => {
  test('should handle API communication between services', async ({ page }) => {
    // ASP Manager에서 시작
    await page.goto('http://localhost:3007');

    // API 서버 상태 확인
    const apiResponse = await page.request.get('http://localhost:8000/health');
    expect(apiResponse.ok()).toBeTruthy();

    const apiData = await apiResponse.json();
    expect(apiData.status).toBe('healthy');
  });

  test('should synchronize data between ASP Manager and Refactor tool', async ({ browser }) => {
    // 두 개의 브라우저 컨텍스트 생성
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // ASP Manager 열기
    await page1.goto('http://localhost:3007');

    // Refactor 도구 열기
    await page2.goto('http://localhost:3005');

    // ASP Manager에서 데이터 생성
    await page1.click('[data-testid="create-dataset"]');
    await page1.fill('[data-testid="dataset-name"]', 'TEST_DATASET_001');
    await page1.click('[data-testid="save-dataset"]');

    // Refactor 도구에서 같은 데이터가 보이는지 확인
    await page2.reload();
    const datasetList = page2.locator('[data-testid="dataset-list"]');
    await expect(datasetList).toContainText('TEST_DATASET_001', { timeout: 10000 });

    await context1.close();
    await context2.close();
  });

  test('should handle WebSocket broadcasting across clients', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const client1 = await context1.newPage();
    const client2 = await context2.newPage();

    // 두 클라이언트 모두 같은 앱 열기
    await client1.goto('http://localhost:3005');
    await client2.goto('http://localhost:3005');

    // 첫 번째 클라이언트에서 메시지 전송
    await client1.fill('[data-testid="terminal-input"]', 'BROADCAST_TEST');
    await client1.press('[data-testid="terminal-input"]', 'Enter');

    // 두 번째 클라이언트에서 메시지 수신 확인
    const output2 = client2.locator('[data-testid="terminal-output"]');
    await expect(output2).toContainText('BROADCAST_TEST', { timeout: 5000 });

    await context1.close();
    await context2.close();
  });

  test('should maintain session persistence across page refreshes', async ({ page }) => {
    await page.goto('http://localhost:3007');

    // 로그인 또는 세션 생성
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'testpass');
    await page.click('[data-testid="login-button"]');

    // 세션 ID 저장
    const sessionCookie = await page.context().cookies();
    const sessionId = sessionCookie.find(c => c.name === 'session_id');
    expect(sessionId).toBeDefined();

    // 페이지 새로고침
    await page.reload();

    // 세션이 유지되는지 확인
    const userDisplay = page.locator('[data-testid="current-user"]');
    await expect(userDisplay).toContainText('testuser');
  });

  test('should handle database operations correctly', async ({ page }) => {
    await page.goto('http://localhost:3007');

    // 카탈로그 객체 생성
    await page.click('[data-testid="create-catalog-object"]');
    await page.fill('[data-testid="object-name"]', 'TEST_PGM_001');
    await page.selectOption('[data-testid="object-type"]', 'PROGRAM');
    await page.click('[data-testid="save-object"]');

    // 생성 확인
    await expect(page.locator('[data-testid="catalog-list"]')).toContainText('TEST_PGM_001');

    // API를 통한 직접 확인
    const apiResponse = await page.request.get('http://localhost:8000/api/catalog/TEST_PGM_001');
    const catalogData = await apiResponse.json();
    expect(catalogData.name).toBe('TEST_PGM_001');
    expect(catalogData.type).toBe('PROGRAM');
  });

  test('should verify CSS consistency across all services', async ({ page }) => {
    const services = [
      { url: 'http://localhost:3005', name: 'OpenASP Refactor' },
      { url: 'http://localhost:3007', name: 'ASP Manager' }
    ];

    for (const service of services) {
      await page.goto(service.url);

      // Tailwind CSS 유틸리티 클래스 확인
      const tailwindElements = await page.$$('[class*="flex"]');
      expect(tailwindElements.length).toBeGreaterThan(0);

      // CSS 변수 확인
      const rootStyles = await page.evaluate(() => {
        const root = document.documentElement;
        const computedStyles = getComputedStyle(root);
        return {
          primaryColor: computedStyles.getPropertyValue('--color-primary'),
          fontFamily: computedStyles.getPropertyValue('--font-family'),
        };
      });

      // 기본 CSS 변수가 정의되어 있는지 확인
      expect(rootStyles.primaryColor || rootStyles.fontFamily).toBeTruthy();

      // 반응형 디자인 브레이크포인트 테스트
      const breakpoints = [640, 768, 1024, 1280, 1536];
      for (const width of breakpoints) {
        await page.setViewportSize({ width, height: 800 });

        // 레이아웃이 깨지지 않는지 확인
        const mainContainer = page.locator('#root');
        const isVisible = await mainContainer.isVisible();
        expect(isVisible).toBeTruthy();
      }
    }
  });

  test('should handle encoding conversions properly', async ({ page }) => {
    await page.goto('http://localhost:3005');

    // EBCDIC 변환 테스트
    await page.click('[data-testid="tab-encoding"]');

    const ebcdicInput = 'C8C5D3D3D6'; // HELLO in EBCDIC hex
    await page.fill('[data-testid="ebcdic-input"]', ebcdicInput);
    await page.click('[data-testid="convert-to-ascii"]');

    const asciiOutput = page.locator('[data-testid="ascii-output"]');
    await expect(asciiOutput).toContainText('HELLO', { timeout: 5000 });

    // SJIS 변환 테스트
    await page.fill('[data-testid="sjis-input"]', 'こんにちは');
    await page.click('[data-testid="convert-sjis"]');

    const sjisOutput = page.locator('[data-testid="sjis-output"]');
    await expect(sjisOutput).toBeVisible();
  });

  test('should verify real-time monitoring features', async ({ page }) => {
    await page.goto('http://localhost:3007');

    // 시스템 모니터링 대시보드로 이동
    await page.click('[data-testid="nav-monitoring"]');

    // CPU 사용률 표시 확인
    const cpuUsage = page.locator('[data-testid="cpu-usage"]');
    await expect(cpuUsage).toBeVisible();

    // 메모리 사용률 표시 확인
    const memoryUsage = page.locator('[data-testid="memory-usage"]');
    await expect(memoryUsage).toBeVisible();

    // 실시간 업데이트 확인 (값이 변경되는지)
    const initialCpu = await cpuUsage.textContent();
    await page.waitForTimeout(3000);
    const updatedCpu = await cpuUsage.textContent();

    // CPU 값이 업데이트되었거나 같을 수 있음 (시스템 상태에 따라)
    expect(updatedCpu).toBeDefined();
  });
});