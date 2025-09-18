import React from 'react';

// Mock for react-syntax-highlighter
export const Prism = ({ children, ...props }) => {
  return React.createElement('pre', {
    'data-testid': 'mocked-syntax-highlighter',
    className: 'syntax-highlighter',
    ...props
  }, React.createElement('code', {}, children));
};

const SyntaxHighlighter = ({ children, ...props }) => {
  return React.createElement('pre', {
    'data-testid': 'mocked-syntax-highlighter',
    className: 'syntax-highlighter',
    ...props
  }, React.createElement('code', {}, children));
};

export default SyntaxHighlighter;