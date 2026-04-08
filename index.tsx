
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from './contexts/ConfirmContext';
import App from './App';
import './index.css';
import 'leaflet/dist/leaflet.css';

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
