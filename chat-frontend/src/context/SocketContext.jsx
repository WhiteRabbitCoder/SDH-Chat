import React, { createContext, useContext, useState, useEffect } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const SocketProvider = ({ children, userId }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const newSocket = io(socketUrl,{
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Configurar los listeners de eventos
    newSocket.on('connect', () => {
      console.log('Socket conectado con ID:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
      
      // Unirse a la sala personal del usuario
      newSocket.emit('join_user_room', userId);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Error de conexión del socket:', error);
      setIsConnected(false);
      setConnectionError('Error al conectar con el servidor');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket desconectado:', reason);
      setIsConnected(false);
    });

    // Guardar el socket en el estado
    setSocket(newSocket);

    // Limpiar al desmontar
    return () => {
      console.log('Cerrando conexión del socket');
      newSocket.disconnect();
    };
  }, [userId]);

  // Añadir un efecto de depuración para verificar el valor de isConnected
  useEffect(() => {
    console.log('Estado de conexión del socket:', isConnected);
  }, [isConnected]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket debe usarse dentro de un SocketProvider');
  }
  return context;
};