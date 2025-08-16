import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';

// --- Subcomponente para cada elemento de la lista de conversaciones ---
const ConversationItem = ({ conversation, isSelected, onSelect, currentUserId }) => {
  const baseClasses = "p-3 hover:bg-gray-800 transition-colors cursor-pointer";
  const activeClasses = "bg-gray-800 border-l-4 border-primary-600";

  const formatTimestamp = (date) => {
    if (!date) return '';
    
    const seconds = date._seconds ?? date.seconds;
    if (!seconds) {
        // Si no hay 'seconds', podría ser un objeto Date de JS (del socket)
        if (date instanceof Date) {
            const now = new Date();
            if (date.toDateString() === now.toDateString()) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        }
        return '';
    }
    
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

  const getDisplayName = () => {
    if (conversation.nombre && conversation.nombre !== 'Chat') return conversation.nombre;
    if (conversation.esGrupo) return 'Grupo';
    
    if (conversation.participantes) {
      const participantesArray = Array.isArray(conversation.participantes) ? conversation.participantes : Object.values(conversation.participantes);
      const otherParticipant = participantesArray.find(p => (p.id || p.userId || p) !== currentUserId);
      
      if (otherParticipant) {
        if (typeof otherParticipant === 'string') return `Usuario ${otherParticipant.substring(0, 6)}...`;
        if (otherParticipant.nombre && otherParticipant.departamento) return `${otherParticipant.nombre} - ${otherParticipant.departamento}`;
        if (otherParticipant.nombre) return otherParticipant.nombre;
        if (otherParticipant.email) return otherParticipant.email;
      }
    }
    return 'Chat';
  };

  const isConversationOnline = () => {
    if (!conversation.participantes) return false;
    const otherParticipant = conversation.participantes.find(p => p.id !== currentUserId);
    return !conversation.esGrupo && otherParticipant?.estado === 'online';
  };

  return (
    <div className={`${baseClasses} ${isSelected ? activeClasses : ''}`} onClick={() => onSelect(conversation)}>
      <div className="flex items-center w-full">
        <div className="relative">
          <div className="h-12 w-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-3xl text-gray-400">
              {conversation.esGrupo ? 'group' : 'person'}
            </span>
          </div>
          <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-gray-900 ${isConversationOnline() ? 'bg-green-500' : 'bg-gray-500'}`}></div>
        </div>
        {/* CORRECCIÓN: Se añade 'min-w-0' para evitar que el contenido se desborde */}
        <div className="ml-3 flex-1 min-w-0">
          {/* Fila superior: Nombre y Hora */}
          <div className="flex justify-between items-center">
            <h4 className="font-medium truncate">{getDisplayName()}</h4>
            <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
              {formatTimestamp(conversation.fechaUltimoMensaje)}
            </span>
          </div>
          {/* Fila inferior: Último mensaje */}
          <div className="flex items-center mt-1">
            <p className="text-sm text-gray-400 truncate">
              {conversation.ultimoMensaje || 'No hay mensajes...'}
            </p>
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

  useEffect(() => {
    if (!socket || !isConnected || !user?.id) return;
    socket.emit('join_user_room', user.id);
  }, [socket, isConnected, user?.id]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleUserStatusChange = (data) => {
      setConversations(prev => prev.map(conv => {
        const participantIndex = conv.participantes?.findIndex(p => p.id === data.userId);
        if (participantIndex > -1) {
          const newParticipants = [...conv.participantes];
          newParticipants[participantIndex] = { ...newParticipants[participantIndex], estado: data.estado };
          return { ...conv, participantes: newParticipants };
        }
        return conv;
      }));
    };

    const handleReceiveMessage = (data) => {
        setConversations(prev => {
            const convIndex = prev.findIndex(c => c.id === data.conversationId);
            if (convIndex === -1) return prev;

            const updatedConv = {
                ...prev[convIndex],
                ultimoMensaje: data.message.content,
                fechaUltimoMensaje: new Date(data.message.timestamp), // Asegurarse que sea un objeto Date
            };

            const newConversations = [...prev];
            newConversations.splice(convIndex, 1);
            newConversations.unshift(updatedConv);
            return newConversations;
        });
    };

    socket.on('user_status_change', handleUserStatusChange);
    socket.on('receive_message', handleReceiveMessage);
    
    return () => {
      socket.off('user_status_change', handleUserStatusChange);
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, isConnected, setConversations]);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const { data } = await axios.get(`${API_URL}/api/conversations?userId=${user.id}`);
        setConversations(data || []);
      } catch (err) {
        setError("Error al cargar las conversaciones.");
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [user?.id, setConversations]);

  if (loading) return <div className="p-4 text-center text-gray-400">Cargando...</div>;
  if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

  const onlineConversations = conversations.filter(conv => {
    if (conv.esGrupo || !conv.participantes) return false;
    const otherParticipant = conv.participantes.find(p => p.id !== user.id);
    return otherParticipant?.estado === 'online';
  }).sort((a, b) => (b.fechaUltimoMensaje?.seconds || 0) - (a.fechaUltimoMensaje?.seconds || 0));

  const offlineConversations = conversations.filter(conv => !onlineConversations.includes(conv))
    .sort((a, b) => (b.fechaUltimoMensaje?.seconds || 0) - (a.fechaUltimoMensaje?.seconds || 0));

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.length > 0 ? (
        <>
          {onlineConversations.length > 0 && (
            <div>
              <div className="p-2 text-sm font-medium text-green-500 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                Online ({onlineConversations.length})
              </div>
              {onlineConversations.map(conv => (
                <ConversationItem key={`online-${conv.id}`} {...{conversation: conv, isSelected: conv.id === selectedConversationId, onSelect: onConversationSelect, currentUserId: user.id}} />
              ))}
            </div>
          )}
          {offlineConversations.length > 0 && (
            <div className={`${onlineConversations.length > 0 ? 'mt-2' : ''}`}>
              <div className="p-2 text-sm font-medium text-gray-500 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                Offline ({offlineConversations.length})
              </div>
              {offlineConversations.map(conv => (
                <ConversationItem key={`offline-${conv.id}`} {...{conversation: conv, isSelected: conv.id === selectedConversationId, onSelect: onConversationSelect, currentUserId: user.id}} />
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