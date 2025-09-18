import React from 'react';

const ReactMarkdown = ({ children, ...props }) => {
  return React.createElement('div', {
    'data-testid': 'mocked-markdown',
    className: 'markdown-content',
    ...props
  }, children);
};

export default ReactMarkdown;