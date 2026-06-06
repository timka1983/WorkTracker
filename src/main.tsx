import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '../contexts/ConfirmContext';
import App from '../App';
import '../index.css';
import 'leaflet/dist/leaflet.css';

// Global error handlers to prevent app crashes from network errors
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (event.reason?.name === 'TypeError' && (msg === 'Failed to fetch' || msg.includes('NetworkError'))) {
    event.preventDefault();
    console.warn('🌐 Net error intercepted cleanly:', msg);
  }
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    event.preventDefault();
    console.warn('🌐 Net error intercepted cleanly:', msg);
  }
});

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
