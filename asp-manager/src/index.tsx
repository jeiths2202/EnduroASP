import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Suppress TensorFlow.js verbose warnings in development
if (process.env.NODE_ENV === 'development') {
  // Reduce TensorFlow console warnings
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  console.warn = (...args) => {
    const message = args.join(' ');
    if (
      message.includes('backend') && message.includes('already registered') ||
      message.includes('kernel') && message.includes('already registered') ||
      message.includes('Platform browser has already been set') ||
      message.includes('The kernel') && message.includes('for backend') ||
      message.includes('Overwriting the platform')
    ) {
      return; // Suppress these specific TensorFlow warnings
    }
    originalWarn.apply(console, args);
  };
  
  console.log = (...args) => {
    const message = args.join(' ');
    if (
      message.includes('[webpack-dev-server]') ||
      message.includes('Download the React DevTools')
    ) {
      return; // Suppress development server messages
    }
    originalLog.apply(console, args);
  };
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
