
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Shim an toàn: Chỉ tạo nếu chưa tồn tại, không ghi đè dữ liệu cũ
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
