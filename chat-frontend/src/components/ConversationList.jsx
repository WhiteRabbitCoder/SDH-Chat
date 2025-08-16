import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';

// --- Subcomponente para cada elemento de la lista de conversaciones ---
const ConversationItem = ({ conversation, isSelected, onSelect, currentUserId }) => {
  // Clases condicionales para el elemento activo
  const baseClasses = "p-3 hover:bg-gray-800 transition-colors cursor-pointer";
  const activeClasses = "bg-gray-800 border-l-4 border-primary-600";

  // Formatear la fecha del último mensaje para que sea más legible
  const formatTimestamp = (date) => {
    if (!date) return '';
    
    // Manejar el formato de fecha de Firebase correctamente
    const seconds = date._seconds ?? date.seconds;
    if (!seconds) return '';
    
    const messageDate = new Date(seconds * 1000);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    if (messageDate >= startOfToday) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (messageDate >= startOfYesterday) {
      return 'Ayer';
    }
    return messageDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  };

  // Obtener el nombre y rol del interlocutor con depuración mejorada
  const getDisplayName = () => {
    // Si ya tiene un nombre definido, usarlo
    if (conversation.nombre && conversation.nombre !== 'Chat') {
      return conversation.nombre;
    }
    
    // Si es un grupo, mostrar el nombre del grupo
    if (conversation.esGrupo) {
      return 'Grupo';
    }
    
    // Verificar si participantes es un array o un objeto
    if (conversation.participantes) {
      let participantesArray;
      
      // A veces Firebase devuelve un objeto de objetos en lugar de un array
      if (Array.isArray(conversation.participantes)) {
        participantesArray = conversation.participantes;
      } else if (typeof conversation.participantes === 'object') {
        // Convertir el objeto a array si es necesario
        participantesArray = Object.values(conversation.participantes);
      } else {
        return 'Chat';
      }
      
      // Buscar el otro participante (no el usuario actual)
      const otherParticipant = participantesArray.find(p => {
        // Puede ser que el id esté en diferentes formatos
        const participantId = p.id || p.userId || p;
        return participantId !== currentUserId;
      });
      
      if (otherParticipant) {
        // Si el participante es solo un ID
        if (typeof otherParticipant === 'string') {
          return `Usuario ${otherParticipant.substring(0, 6)}...`;
        }
        
        // Si tiene nombre y departamento
        if (otherParticipant.nombre && otherParticipant.departamento) {
          return `${otherParticipant.nombre} - ${otherParticipant.departamento}`;
        }
        
        // Si tiene solo nombre
        if (otherParticipant.nombre) {
          return otherParticipant.nombre;
        }
        
        // Si tiene email
        if (otherParticipant.email) {
          return otherParticipant.email;
        }
      }
    }
    
    // Fallback
    return 'Chat';
  };

  // Verificar si la conversación tiene al menos un participante online
  const isConversationOnline = () => {
    if (!conversation.participantes) return false;
    
    // Para chats 1-a-1, buscar si el otro participante está online
    if (!conversation.esGrupo) {
      const otherParticipant = conversation.participantes.find(p => p.id !== currentUserId);
      return otherParticipant?.estado === 'online';
    }
    
    // Para grupos, consideramos online si algún miembro está online
    return conversation.participantes.some(p => p.id !== currentUserId && p.estado === 'online');
  };

  return (
    <div className={`${baseClasses} ${isSelected ? activeClasses : ''}`} onClick={() => onSelect(conversation)}>
      <div className="flex items-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-3xl text-gray-400">
              {conversation.esGrupo ? 'group' : 'person'}
            </span>
          </div>
          {/* Indicador de estado con color dinámico */}
          <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-gray-900 
            ${isConversationOnline() ? 'bg-green-500' : 'bg-gray-500'}`}></div>
        </div>
        <div className="ml-3 flex-1">
          {/* El nombre ya no tiene la hora al lado */}
          <h4 className="font-medium">{getDisplayName()}</h4>
          
          <div className="flex items-center mt-1">
            {/* Mensaje con la hora a su lado */}
            <p className="text-sm text-gray-400 truncate flex-1">
              {conversation.ultimoMensaje || 'No hay mensajes...'}
            </p>
            <span className="text-xs text-gray-500 ml-2">
              {formatTimestamp(conversation.fechaUltimoMensaje)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- Componente principal de la lista ---
const ConversationList = ({ user, conversations, setConversations, onConversationSelect, selectedConversationId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { socket, isConnected } = useSocket();

  // 1. Notificar al servidor cuando el usuario se conecta
  useEffect(() => {
    if (!socket || !isConnected || !user?.id) return;
    
    console.log('Enviando join_user_room al servidor con ID:', user.id);
    // Unirse a la sala personal del usuario
    socket.emit('join_user_room', user.id);
    
    return () => {
      // No es necesario hacer nada al desmontar, el evento disconnect 
      // se maneja automáticamente por Socket.IO
    };
  }, [socket, isConnected, user?.id]);

  // 2. Escuchar cambios de estado de usuarios
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleUserStatusChange = (data) => {
      console.log('Cambio de estado de usuario recibido:', data);
      setConversations(prevConversations => {
        return prevConversations.map(conv => {
          // Crear una copia de la conversación
          const updatedConv = { ...conv };
          
          // Actualizar el estado del participante si está en esta conversación
          if (updatedConv.participantes) {
            updatedConv.participantes = updatedConv.participantes.map(p => {
              if (p.id === data.userId) {
                return { ...p, estado: data.estado };
              }
              return p;
            });
          }
          
          return updatedConv;
        });
      });
    };

    // Registrar el listener para cambios de estado
    socket.on('user_status_change', handleUserStatusChange);
    
    // Limpiar el listener al desmontar
    return () => {
      socket.off('user_status_change', handleUserStatusChange);
    };
  }, [socket, isConnected, setConversations]);

  // Depuración - Ver la estructura de las conversaciones
  useEffect(() => {
    if (conversations.length > 0) {
      console.log('Estructura de todas las conversaciones:', 
        JSON.stringify(conversations.slice(0, 1), null, 2)); // Solo la primera para no saturar
      console.log('Current User ID:', user.id);
    }
  }, [conversations, user?.id]);

  // Cargar las conversaciones iniciales al montar el componente
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        // Usar la variable de entorno para la URL de la API
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await axios.get(`${API_URL}/api/conversations?userId=${user.id}`);
        
        // Procesar las conversaciones para asegurar estructura correcta
        const processedConversations = response.data.map(conv => {
          // Asegurar que participantes sea un array
          if (conv.participantes && !Array.isArray(conv.participantes)) {
            conv.participantes = Object.values(conv.participantes);
          }
          return conv;
        });
        
        setConversations(processedConversations);
        setError(null);
      } catch (err) {
        setError("Error al cargar las conversaciones.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user?.id, setConversations]);

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Cargando conversaciones...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-400">{error}</div>;
  }

  // Separar conversaciones en online y offline
  const onlineConversations = conversations
    .filter(conv => {
      if (!conv.participantes) return false;
      
      // Para chats 1-a-1, verificar si el otro participante está online
      if (!conv.esGrupo) {
        const otherParticipant = conv.participantes.find(p => p.id !== user.id);
        return otherParticipant?.estado === 'online';
      }
      
      // Para grupos, verificar si algún participante está online
      return conv.participantes.some(p => p.id !== user.id && p.estado === 'online');
    })
    .sort((a, b) => {
      // Ordenar por fecha de último mensaje
      const fechaA = a.fechaUltimoMensaje?.seconds || 0;
      const fechaB = b.fechaUltimoMensaje?.seconds || 0;
      return fechaB - fechaA;
    });

  const offlineConversations = conversations
    .filter(conv => !onlineConversations.includes(conv))
    .sort((a, b) => {
      const fechaA = a.fechaUltimoMensaje?.seconds || 0;
      const fechaB = b.fechaUltimoMensaje?.seconds || 0;
      return fechaB - fechaA;
    });

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.length > 0 ? (
        <>
          {/* Sección de usuarios online */}
          {onlineConversations.length > 0 && (
            <div>
              <div className="p-2 text-sm font-medium text-green-500 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                <div className="flex items-center">
                  <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                  Online ({onlineConversations.length})
                </div>
              </div>
              {onlineConversations.map(conv => (
                <ConversationItem
                  key={`online-${conv.id}`}
                  conversation={conv}
                  isSelected={conv.id === selectedConversationId}
                  onSelect={onConversationSelect}
                  currentUserId={user.id}
                />
              ))}
            </div>
          )}
          
          {/* Sección de usuarios offline */}
          {offlineConversations.length > 0 && (
            <div className={`${onlineConversations.length > 0 ? 'mt-2' : ''}`}>
              <div className="p-2 text-sm font-medium text-gray-500 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                <div className="flex items-center">
                  <span className="h-2 w-2 rounded-full bg-gray-500 mr-2"></span>
                  Offline ({offlineConversations.length})
                </div>
              </div>
              {offlineConversations.map(conv => (
                <ConversationItem
                  key={`offline-${conv.id}`}
                  conversation={conv}
                  isSelected={conv.id === selectedConversationId}
                  onSelect={onConversationSelect}
                  currentUserId={user.id}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="p-4 text-center text-gray-500">
          No tienes conversaciones. ¡Busca a alguien para empezar!
        </div>
      )}
    </div>
  );
};

export default ConversationList;