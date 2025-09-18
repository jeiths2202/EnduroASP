import React from 'react';
import { render, screen, act } from '@testing-library/react';
import App from './App';

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.reject(new Error('Network request failed'))
);

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

test('renders login iframe when not logged in', () => {
  mockLocalStorage.getItem.mockReturnValue(null);

  act(() => {
    render(<App />);
  });

  // Should render login iframe
  const loginIframe = screen.getByTitle('EnduroASP Manager Login');
  expect(loginIframe).toBeInTheDocument();
  expect(loginIframe).toHaveAttribute('src', '/login.html');
});

test('renders main application when logged in', async () => {
  mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
    username: 'testuser',
    role: 'admin',
    app: 'asp-manager'
  }));

  await act(async () => {
    render(<App />);

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  // Check that login iframe is NOT present when logged in
  expect(screen.queryByTitle('EnduroASP Manager Login')).not.toBeInTheDocument();

  // App should render something other than just the iframe
  expect(document.body.innerHTML.length).toBeGreaterThan(200);
});
