import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('[Global] Unhandled error:', event.error);
  console.error('[Global] Error message:', event.message);
  console.error('[Global] Error source:', event.filename, ':', event.lineno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global] Unhandled promise rejection:', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[index] Root element not found!');
  throw new Error("Could not find root element to mount to");
}

console.log('[index] Initializing React app...');

const root = ReactDOM.createRoot(rootElement);

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('[index] React app rendered successfully');
} catch (error) {
  console.error('[index] Error rendering app:', error);
  console.error('[index] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
}