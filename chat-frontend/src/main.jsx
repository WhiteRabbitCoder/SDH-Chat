import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'  // Asegúrate de que este import esté presente
import App from './App.jsx'
import { SocketProvider } from './context/SocketContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </StrictMode>,
)