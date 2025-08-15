import { useEffect, useState } from 'react';
import axios from 'axios';

// --- Subcomponente para cada elemento de la lista de conversaciones ---
const ConversationItem = ({ conversation, isSelected, onSelect }) => {
  // Clases condicionales para el elemento activo
  const baseClasses = "p-3 hover:bg-gray-800 transition-colors cursor-pointer";
  const activeClasses = "bg-gray-800 border-l-4 border-primary-600";

  // Formatear la fecha del último mensaje para que sea más legible
  const formatTimestamp = (date) => {
    if (!date) return '';
    const messageDate = new Date(date.seconds * 1000);
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

  return (
    <div className={`${baseClasses} ${isSelected ? activeClasses : ''}`} onClick={() => onSelect(conversation)}>
      <div className="flex items-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            {/* Usamos un icono como avatar por defecto */}
            <span className="material-symbols-outlined text-3xl text-gray-400">
              {conversation.esGrupo ? 'group' : 'person'}
            </span>
          </div>
          {/* Indicador de estado (lógica de ejemplo, no funcional aún) */}
          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-gray-900"></div>
        </div>
        <div className="ml-3 flex-1">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">{conversation.nombre || 'Chat'}</h4>
            <span className="text-xs text-gray-400">{formatTimestamp(conversation.fechaUltimoMensaje)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className="text-sm text-gray-400 truncate w-48">
              {conversation.ultimoMensaje || 'No hay mensajes...'}
            </p>
            {/* Contador de no leídos (UI estática por ahora) */}
            {/* <span className="bg-primary-600 text-gray-200 text-xs h-5 w-5 rounded-full flex items-center justify-center">3</span> */}
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

  // Cargar las conversaciones iniciales al montar el componente
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const response = await axios.get(`http://localhost:3000/api/conversations?userId=${user.id}`);
        setConversations(response.data);
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

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.length > 0 ? (
        conversations.map(conv => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isSelected={conv.id === selectedConversationId}
            onSelect={onConversationSelect}
          />
        ))
      ) : (
        <div className="p-4 text-center text-gray-500">
          No tienes conversaciones. ¡Busca a alguien por su correo para empezar!
        </div>
      )}
    </div>
  );
};

export default ConversationList;