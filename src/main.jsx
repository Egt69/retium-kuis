import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import { LanguageProvider } from './lib/LanguageContext' // <--- IMPORT BARU

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider> {/* <--- BUNGKUS DI SINI */}
      <App />
    </LanguageProvider>
  </React.StrictMode>,
)
