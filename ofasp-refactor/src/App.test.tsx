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

test('renders OpenASP AX Login iframe', () => {
  act(() => {
    render(<App />);
  });

  const loginIframe = screen.getByTitle('OpenASP AX Login');
  expect(loginIframe).toBeInTheDocument();
  expect(loginIframe).toHaveAttribute('src', '/login.html');
});

test('renders main container with correct styling', () => {
  act(() => {
    render(<App />);
  });

  const container = screen.getByTitle('OpenASP AX Login').parentElement;
  expect(container).toHaveClass('h-screen');
});
