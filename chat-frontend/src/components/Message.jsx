import React from 'react';

const Message = ({ message, isSender, highlight = null }) => {
  // Formatear la fecha del mensaje
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    // Manejar diferentes formatos de timestamp (Firestore, Date, etc.)
    let date;
    
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp._seconds) {
      // Firestore Timestamp
      date = new Date(timestamp._seconds * 1000);
    } else if (timestamp.seconds) {
      // Otro formato común de Firestore
      date = new Date(timestamp.seconds * 1000);
    } else {
      return '';
    }
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Función para resaltar términos de búsqueda
  const highlightText = (text, term) => {
    if (!term || !text) return text;
    
    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-500 text-gray-900">{part}</mark> : part
    );
  };

  // Determinar si es un mensaje del sistema
  const isSystemMessage = message.isSystemMessage || message.from === 'system';

  // Si es un mensaje del sistema, mostrar un diseño diferente
  if (isSystemMessage) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-gray-800 rounded-full px-4 py-1 text-xs text-gray-400">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`message-bubble ${isSender ? 'sender' : 'receiver'} relative`}>
        <div className="mb-1">
          {highlight ? highlightText(message.content, highlight) : message.content}
        </div>
        <div className="flex items-center justify-end mt-1 space-x-1">
          <span className="text-xs opacity-70">{formatTimestamp(message.timestamp)}</span>
          {isSender && (
            <span className="material-symbols-outlined text-xs">
              {message.visto ? 'done_all' : 'done'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;