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

test('renders login iframe when not logged in', () => {
  mockLocalStorage.getItem.mockReturnValue(null);
  render(<App />);

  // Should render login iframe
  const loginIframe = screen.getByTitle('EnduroASP Manager Login');
  expect(loginIframe).toBeInTheDocument();
  expect(loginIframe).toHaveAttribute('src', '/login.html');
});

test('renders main application when logged in', () => {
  mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
    username: 'testuser',
    role: 'admin'
  }));

  render(<App />);

  // Should render main app elements - check for the main container
  const mainContainer = document.querySelector('.h-screen.bg-gray-50');
  expect(mainContainer).toBeTruthy();

  // Alternative check for any main app element
  expect(document.body.innerHTML.includes('TabSystem') ||
         document.body.innerHTML.includes('Sidebar') ||
         document.querySelector('.h-screen.bg-gray-50')).toBeTruthy();
});
