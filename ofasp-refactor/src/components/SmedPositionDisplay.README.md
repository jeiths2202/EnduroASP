# SmedPositionDisplay Component

Position-based SMED 렌더링을 위한 React 컴포넌트입니다. 기존 field name 기반 방식 대신 position과 index 기반으로 데이터를 매핑합니다.

## 주요 특징

### 🎯 Position-based Rendering
- **24x80 터미널 그리드**: 정확한 픽셀 단위 (800px × 480px)
- **Absolute positioning**: row, col, length 기반 필드 배치
- **Index-based data matching**: field name 없이 배열 인덱스로 데이터 매칭
- **Monospace 폰트**: 14px Courier New 고정폭 글꼴

### 🌐 실시간 WebSocket 연동
- **실시간 데이터 업데이트**: WebSocket을 통한 양방향 통신
- **키보드 이벤트 전송**: F키, Enter 등 특수키 처리
- **Hub 아키텍처 지원**: 기존 WebSocket Hub와 완전 호환

### 🎨 사용자 경험
- **다크모드 지원**: isDarkMode prop으로 테마 전환
- **UTF-8 텍스트 처리**: 한국어, 일본어, 중국어 등 다국어 지원
- **Full-width 문자 지원**: CJK 문자에 대한 올바른 렌더링
- **접근성 지원**: 키보드 네비게이션 완전 지원

## 설치 및 설정

### 1. 컴포넌트 파일
```
src/components/
├── SmedPositionDisplay.tsx          # 메인 컴포넌트
├── SmedPositionDisplay.css          # 스타일 시트
├── SmedPositionDisplay.example.tsx  # 사용 예제
└── SmedPositionDisplay.README.md    # 이 문서
```

### 2. 타입 정의
```
src/types/
└── smedPosition.ts                  # TypeScript 인터페이스
```

### 3. 의존성
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "socket.io-client": "^4.0.0"
  }
}
```

## 사용법

### 기본 사용
```tsx
import React, { useState } from 'react';
import SmedPositionDisplay from './components/SmedPositionDisplay';

const MyComponent = () => {
  const [mapData] = useState([
    { row: 1, col: 1, length: 20 },   // 첫 번째 필드
    { row: 3, col: 5, length: 15 },   // 두 번째 필드
    { row: 5, col: 10, length: 30 },  // 세 번째 필드
  ]);

  const [fieldData, setFieldData] = useState([
    'EMPLOYEE FORM',     // 인덱스 0 → 첫 번째 필드
    'TANAKA HIROSHI',    // 인덱스 1 → 두 번째 필드
    'DEVELOPMENT DEPT',  // 인덱스 2 → 세 번째 필드
  ]);

  return (
    <SmedPositionDisplay
      mapName="EMPLOYEE_FORM"
      mapData={mapData}
      initialData={fieldData}
      onDataChange={setFieldData}
      onKeyEvent={(key, data) => console.log('Key pressed:', key)}
      isDarkMode={false}
    />
  );
};
```

### API 연동
```tsx
// 새로운 position-render API 사용
const response = await fetch('/api/smed/position-render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    map_name: 'EMPLOYEE_FORM',
    field_data: ['value1', 'value2', 'value3'],
    terminal_id: 'TERM001',
    wsname: 'WSNAME00'
  })
});
```

## Props API

### SmedPositionDisplayProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mapName` | `string` | ✅ | - | SMED 맵 이름 |
| `mapData` | `PositionField[]` | ❌ | `[]` | 필드 위치 정의 배열 |
| `initialData` | `string[]` | ❌ | `[]` | 초기 필드 데이터 배열 |
| `onDataChange` | `(data: string[]) => void` | ❌ | - | 데이터 변경 콜백 |
| `onKeyEvent` | `(key: string, data: string[]) => void` | ❌ | - | 키 이벤트 콜백 |
| `isDarkMode` | `boolean` | ❌ | `false` | 다크모드 활성화 |

### PositionField

```typescript
interface PositionField {
  row: number;    // 행 위치 (1-24)
  col: number;    // 열 위치 (1-80)
  length: number; // 필드 길이
}
```

## 키보드 단축키

| 키 | 동작 |
|----|------|
| `Tab` | 다음 필드로 이동 |
| `Enter` | 폼 제출 |
| `F1` | 도움말 표시 |
| `F3` | 종료/닫기 |
| `F12` | 다크모드 토글 (예제에서) |
| `Backspace` | 문자 삭제 |
| `Arrow Keys` | 커서 이동 |

## WebSocket 이벤트

### 송신 이벤트
```typescript
// 키 이벤트 전송
webSocketService.sendKeyEventToHub('F1', fieldData);

// 커맨드 전송
webSocketService.sendCommandToHub('CALL PGM-MENU');
```

### 수신 이벤트
```typescript
// SMED 데이터 수신
webSocketService.on('smed_data_received', (data) => {
  // data.fields 배열로 필드 데이터 업데이트
});
```

## 스타일링

### CSS 클래스
- `.smed-position-display` - 메인 컨테이너
- `.terminal-grid` - 24x80 그리드 컨테이너
- `.grid-row` - 각 행 (20px 높이)
- `.grid-char` - 각 문자 셀 (10px 폭)
- `.input-field` - 입력 가능한 필드
- `.focused-field` - 포커스된 필드
- `.cursor` - 커서 위치
- `.full-width` - 전각 문자 (20px 폭)

### 다크모드
```css
.smed-position-display.dark-mode {
  background-color: #1a1a1a;
  color: #cccccc;
}
```

## 개발 및 디버깅

### 디버깅 모드
```typescript
// 콘솔에서 상태 확인
console.log('Grid state:', grid);
console.log('Field data:', fieldData);
console.log('WebSocket connection:', webSocketService.getHubConnectionInfo());
```

### 성능 최적화
- `useCallback`으로 함수 메모이제이션
- `useMemo`로 계산 결과 캐싱
- WebSocket 중복 이벤트 필터링
- 에러 바운더리로 안정성 확보

## 예제 실행

### 개발 서버 시작
```bash
# React 개발 서버
npm start

# WebSocket 서버 (포트 8000)
python server/api_server.py
```

### 예제 컴포넌트 확인
```tsx
import SmedPositionDisplayExample from './components/SmedPositionDisplay.example';

// App.tsx에서 사용
<SmedPositionDisplayExample />
```

## 트러블슈팅

### 일반적인 문제

1. **그리드가 렌더링되지 않음**
   - `mapData` 배열이 올바른 형식인지 확인
   - 브라우저 개발자 도구에서 에러 메시지 확인

2. **WebSocket 연결 실패**
   - API 서버가 포트 8000에서 실행 중인지 확인
   - CORS 설정 확인

3. **한글/일본어 문자가 깨짐**
   - 폰트 설정 확인 (Courier New, MS Gothic 등)
   - `isFullWidth` 함수가 올바르게 동작하는지 확인

4. **필드 클릭이 작동하지 않음**
   - `mapData`의 position 값이 올바른지 확인 (1-based)
   - CSS에서 `pointer-events` 설정 확인

### 로그 확인
```typescript
// 컴포넌트 내부 로그
console.log('SmedPositionDisplay: Grid initialization completed');

// WebSocket 로그
console.log('[WebSocket Hub] Connected to Hub');
```

## 호환성

- **React**: 16.8+ (Hooks 지원 필요)
- **TypeScript**: 4.0+
- **브라우저**: Chrome 70+, Firefox 65+, Safari 12+
- **WebSocket**: socket.io-client 4.0+

## 라이선스

이 컴포넌트는 프로젝트의 기존 라이선스를 따릅니다.

---

## 개발자 노트

### 설계 원칙
1. **타입 안전성**: TypeScript를 활용한 강력한 타입 검증
2. **성능 최적화**: 불필요한 리렌더링 방지
3. **접근성**: 키보드 네비게이션 완전 지원
4. **국제화**: 다국어 문자 완벽 지원
5. **확장성**: 새로운 요구사항에 대한 유연한 대응

### 향후 개선 사항
- [ ] Virtual scrolling for large grids
- [ ] Field validation rules
- [ ] Custom themes
- [ ] Accessibility improvements (ARIA labels)
- [ ] Unit tests with Jest/React Testing Library
- [ ] Storybook integration for component documentation