import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

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

test('renders login form when not logged in', () => {
  mockLocalStorage.getItem.mockReturnValue(null);
  render(<App />);

  // Should render login form elements
  expect(screen.getByText(/로그인/i) || screen.getByText(/Login/i) || screen.getByText(/EnduroASP/i)).toBeInTheDocument();
});

test('renders main application when logged in', () => {
  mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
    username: 'testuser',
    role: 'admin'
  }));

  render(<App />);

  // Should render main app elements (dashboard is default)
  expect(screen.getByText(/Dashboard/i) || screen.getByText(/대시보드/i) || document.querySelector('[data-testid="main-app"]')).toBeTruthy();
});
