import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import { SocketProvider } from './context/SocketContext';

function App() {
  const [user, setUser] = useState(null);

  // Al cargar, intentar recuperar el usuario de localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('chatUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('chatUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('chatUser');
  };

  // El id="webcrumbs" es crucial para que el nuevo tailwind.config.js funcione
  return (
    <div id="webcrumbs">
      {user ? (
        <SocketProvider userId={user.id}>
          <ChatPage user={user} onLogout={handleLogout} />
        </SocketProvider>
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;