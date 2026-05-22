import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import AboutUsPage from './AboutUsPage.tsx'
import ProductDetailPage from './ProductDetailPage.tsx'
import SignupPage from './SignupPage.tsx'
import { AuthProvider } from './auth-context.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/brand/:brandParam" element={<App />} />
          <Route path="/about-us" element={<AboutUsPage />} />
          <Route path="/v3" element={<Navigate to="/" replace />} />
          <Route path="/product/:ean" element={<ProductDetailPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
