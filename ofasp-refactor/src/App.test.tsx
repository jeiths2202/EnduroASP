import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders OpenASP AX Login iframe', () => {
  render(<App />);
  const loginIframe = screen.getByTitle('OpenASP AX Login');
  expect(loginIframe).toBeInTheDocument();
  expect(loginIframe).toHaveAttribute('src', '/login.html');
});

test('renders main container with correct styling', () => {
  render(<App />);
  const container = screen.getByTitle('OpenASP AX Login').parentElement;
  expect(container).toHaveClass('h-screen');
});
