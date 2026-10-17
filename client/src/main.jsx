import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { BrandingProvider } from './context/BrandingContext.jsx';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
// Serif for the certificate template — self-hosted so certificates print the
// same everywhere, with no dependency on a font CDN.
import '@fontsource/merriweather/700.css';
import '@fontsource/merriweather/900.css';
import '@fontsource/merriweather/700-italic.css';
import '@fontsource/merriweather/900-italic.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandingProvider>
        <AuthProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </AuthProvider>
      </BrandingProvider>
    </BrowserRouter>
  </React.StrictMode>
);
