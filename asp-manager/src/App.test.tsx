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

test('renders main application when logged in', async () => {
  mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
    username: 'testuser',
    role: 'admin',
    app: 'asp-manager'
  }));

  render(<App />);

  // Wait for state updates to complete
  await new Promise(resolve => setTimeout(resolve, 10));

  // Check that login iframe is NOT present when logged in
  expect(screen.queryByTitle('EnduroASP Manager Login')).not.toBeInTheDocument();

  // App should render something other than just the iframe
  expect(document.body.innerHTML.length).toBeGreaterThan(200);
});
