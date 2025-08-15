import { useState } from 'react';
import axios from 'axios';

const LoginPage = ({ onLogin }) => {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError('El ID de usuario no puede estar vacío.');
      return;
    }
    setError('');
    try {
      // Asegúrate de que la URL coincida con tu backend
      const response = await axios.post('http://localhost:3000/api/auth/login', { userId });
      onLogin(response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión. Verifica el ID.');
      console.error(err);
    }
  };

  return (
    <div className="flex items-center justify-center h-full bg-gray-900 text-gray-200">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center">Iniciar Sesión</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="userId" className="text-sm font-medium">
              ID de Usuario
            </label>
            <input
              id="userId"
              name="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 text-gray-200 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ej: ANG-DES-0194XQ"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 font-bold text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-gray-800"
            >
              Entrar al Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;