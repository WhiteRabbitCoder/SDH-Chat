import { useState, useEffect } from 'react';
import axios from 'axios';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import SearchResults from '../components/SearchResults';

const ChatPage = ({ user, onLogout }) => {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [conversations, setConversations] = useState([]);

  // Efecto para la búsqueda con "debounce"
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data } = await axios.get(`http://localhost:3000/api/users/search?q=${searchQuery}&currentUserId=${user.id}`);
        setSearchResults(data);
      } catch (error) {
        console.error("Error al buscar usuarios:", error);
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, user.id]);

  const handleStartConversation = async (recipient) => {
    try {
      const { data: newConversation } = await axios.post('http://localhost:3000/api/conversations', {
        creadorId: user.id,
        correoDestinatario: recipient.correo,
      });
      
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
      setSelectedConversation(newConversation);
      
      setConversations(prev => {
        const existing = prev.find(c => c.id === newConversation.id);
        return existing ? prev : [newConversation, ...prev];
      });

    } catch (error) {
      console.error("Error al iniciar la conversación:", error);
      alert("No se pudo iniciar la conversación.");
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
      {/* Left Side - User List */}
      <div className="w-80 border-r border-gray-700 flex flex-col">
        {/* User Profile Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-gray-200">
              <span className="material-symbols-outlined">person</span>
            </div>
            <div className="ml-3">
              <h3 className="font-medium">{user.nickname}</h3>
              <p className="text-xs text-gray-400 capitalize">{user.estado}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onLogout} className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors" title="Cerrar sesión">
              <span className="material-symbols-outlined text-gray-400 text-sm">logout</span>
            </button>
            <button className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors">
              <span className="material-symbols-outlined text-gray-400 text-sm">more_vert</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por correo..."
              className="w-full bg-gray-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              search
            </span>
          </div>
        </div>

        {/* Filters (UI estática por ahora) */}
        <div className="p-2 border-b border-gray-700 flex space-x-2">
          <button className="px-3 py-1 text-xs bg-primary-800 text-primary-300 rounded-full font-medium hover:bg-primary-700 transition-colors">
            Todos
          </button>
          <button className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded-full font-medium hover:bg-gray-700 transition-colors">
            No leídos
          </button>
        </div>

        {/* Conditional Rendering: Search Results or Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <SearchResults 
              results={searchResults} 
              onStartConversation={handleStartConversation} 
            />
          ) : (
            <ConversationList 
              user={user} 
              conversations={conversations}
              setConversations={setConversations}
              onConversationSelect={setSelectedConversation} 
              selectedConversationId={selectedConversation?.id}
            />
          )}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      {selectedConversation ? (
        <ChatWindow conversation={selectedConversation} user={user} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-center text-gray-500 px-10">
          <div>
            <h2 className="text-2xl font-medium text-gray-300">Bienvenido, {user.nickname}</h2>
            <p className="mt-2">Selecciona una conversación o busca a alguien por su correo para empezar a chatear.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;