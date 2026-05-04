import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register service worker for push notifications and PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
