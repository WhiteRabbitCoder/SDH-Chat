import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';

// --- Subcomponente para cada Mensaje ---
const Message = ({ message, isSender }) => {
  const alignment = isSender ? 'self-end' : 'self-start';
  const colors = isSender ? 'bg-primary-800 rounded-br-none' : 'bg-gray-800 rounded-bl-none';
  
  let timestamp;
  const seconds = message.fechaHora?._seconds ?? message.fechaHora?.seconds;

  if (message.isOptimistic) {
    timestamp = 'Enviando...';
  } else if (seconds !== undefined) {
    timestamp = new Date(seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (message.fechaHora) {
    timestamp = new Date(message.fechaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    timestamp = '';
  }

  return (
    <div className={`flex items-end gap-2 max-w-[80%] ${alignment}`}>
      {!isSender && (
        <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          <span className="material-symbols-outlined text-gray-400">person</span>
        </div>
      )}
      <div className={`rounded-2xl p-3 shadow-sm ${colors}`}>
        <p className="text-sm break-words">{message.content}</p>
        <div className="text-xs text-gray-400 mt-1 flex items-center justify-end gap-1">
          <span>{timestamp}</span>
          {isSender && (
            <span className="material-symbols-outlined text-primary-400" style={{ fontSize: "14px" }}>
              done_all
            </span>
          )}
        </div>
      </div>
    </div>
  );
};


// --- Componente Principal de la Ventana de Chat ---
const ChatWindow = ({ conversation, user }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  
  // <-- INICIO DE LA CORRECCIÓN -->
  // Usamos los estados directamente del contexto. ¡No más estados locales para la conexión!
  const { socket, isConnected, connectionError } = useSocket();
  // <-- FIN DE LA CORRECCIÓN -->

  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Cargar mensajes iniciales
  useEffect(() => {
    if (!conversation?.id) return;
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`http://localhost:3000/api/conversations/${conversation.id}/messages`);
        setMessages(response.data);
      } catch (error) {
        console.error("Error al cargar los mensajes:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [conversation?.id]);

  // Scroll al recibir nuevos mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Escuchar mensajes entrantes del socket
  useEffect(() => {
    // La guarda ahora usa 'isConnected' del contexto
    if (!isConnected || !socket || !conversation?.id) return;

    const handleReceiveMessage = (data) => {
      if (data.conversationId === conversation.id) {
        setMessages(prevMessages => {
          const existingMsgIndex = prevMessages.findIndex(msg => msg.optimisticId && msg.optimisticId === data.message.optimisticId);
          
          if (existingMsgIndex > -1) {
            const updatedMessages = [...prevMessages];
            updatedMessages[existingMsgIndex] = data.message;
            return updatedMessages;
          } else {
            return [...prevMessages, data.message];
          }
        });
      }
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [isConnected, socket, conversation?.id]);

  const handleSendMessage = () => {
    // La guarda ahora usa 'isConnected' del contexto
    if (!isConnected || !newMessage.trim()) return;

    const optimisticId = Date.now().toString();
    const optimisticMessage = {
      id: optimisticId,
      optimisticId: optimisticId,
      from: user.id,
      content: newMessage,
      fechaHora: new Date(),
      isOptimistic: true,
    };

    setMessages(prevMessages => [...prevMessages, optimisticMessage]);

    const payload = {
      conversationId: conversation.id,
      from: user.id,
      content: newMessage,
      type: 'text',
      optimisticId: optimisticId,
    };

    socket.emit('send_message', payload);
    setNewMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!conversation) return null;

  const isGroup = conversation.esGrupo || (conversation.participantes && conversation.participantes.length > 2);

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Chat Header */}
      <div className="h-16 border-b border-gray-700 px-4 flex items-center justify-between">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-gray-400">
              {isGroup ? 'group' : 'person'}
            </span>
          </div>
          <div className="ml-3">
            <h3 className="font-medium">{conversation.nombre || 'Chat'}</h3>
            <p className="text-xs text-green-500">
              {connectionError 
                ? <span className="text-red-400">Error de conexión</span> 
                : isConnected ? 'En línea' : 'Conectando...'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="h-9 w-9 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors">
            <span className="material-symbols-outlined text-gray-400">search</span>
          </button>
          <button className="h-9 w-9 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors">
            <span className="material-symbols-outlined text-gray-400">more_vert</span>
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {loading ? (
          <div className="text-center text-gray-400">Cargando mensajes...</div>
        ) : (
          messages.map(msg => (
            <Message key={msg.id || msg.optimisticId} message={msg} isSender={msg.from === user.id} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              id="message-input"
              name="message-input"
              placeholder={isConnected ? "Escribe un mensaje..." : "Conectando..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              disabled={!isConnected}
              className="w-full bg-gray-800 rounded-full py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-200 disabled:opacity-50"
            />
          </div>
          <button 
            onClick={handleSendMessage} 
            disabled={!isConnected || !newMessage.trim()}
            className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center hover:bg-primary-700 transition-colors flex-shrink-0 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-white">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;