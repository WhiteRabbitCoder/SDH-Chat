import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import SearchResults from '../components/SearchResults';

const ChatPage = ({ user, onLogout }) => {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [userStatus, setUserStatus] = useState(user?.estado || 'online');
  const { socket, isConnected } = useSocket();
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' o 'unread'

  // Estados para la creación de grupos
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Estados para notificaciones con persistencia
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('chat-notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [unreadNotifications, setUnreadNotifications] = useState(() => {
    const saved = localStorage.getItem('chat-unread-count');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [showNotifications, setShowNotifications] = useState(false);

  // Efecto para guardar notificaciones en localStorage
  useEffect(() => {
    localStorage.setItem('chat-notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Efecto para guardar contador de no leídos
  useEffect(() => {
    localStorage.setItem('chat-unread-count', unreadNotifications.toString());
  }, [unreadNotifications]);

  // Efecto para establecer al usuario como online cuando inicia sesión
  useEffect(() => {
    if (!socket || !isConnected || !user?.id) return;

    // Actualizar el estado del usuario en el servidor
    socket.emit('join_user_room', user.id);
    setUserStatus('online');

    // Efecto de limpieza - cuando el componente se desmonta, no es necesario
    // hacer nada extra ya que el evento 'disconnect' se maneja automáticamente
  }, [socket, isConnected, user?.id]);

  // Efecto para actualizar el estado del usuario local cuando cambia en el servidor
  useEffect(() => {
    if (!socket || !isConnected || !user?.id) return;

    const handleUserStatusChange = (data) => {
      if (data.userId === user.id) {
        setUserStatus(data.estado);
      }

      // También actualizar el estado en las conversaciones para otros usuarios
      setConversations(prevConversations => {
        return prevConversations.map(conv => {
          const updatedConv = { ...conv };

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

    socket.on('user_status_change', handleUserStatusChange);

    return () => {
      socket.off('user_status_change', handleUserStatusChange);
    };
  }, [socket, isConnected, user?.id, setConversations]);

  // Efecto para cargar usuarios disponibles cuando se abre el modal de crear grupo
  useEffect(() => {
    if (showCreateGroup) {
      loadAvailableUsers();
    }
  }, [showCreateGroup]);

  // Efecto para escuchar nuevas notificaciones
  useEffect(() => {
    if (!socket || !isConnected || !user?.id) return;

    const handleNewMessage = (data) => {
      // Solo crear notificación si el mensaje no es del usuario actual
      if (data.message.from !== user.id) {
        // Buscar la conversación para obtener detalles
        const conversation = conversations.find(c => c.id === data.conversationId);
        if (!conversation) return;

        // Marcar la conversación como no leída si no es la seleccionada
        if (selectedConversation?.id !== data.conversationId) {
          setConversations(prev => prev.map(conv => {
            if (conv.id === data.conversationId) {
              return { ...conv, unreadCount: (conv.unreadCount || 0) + 1 };
            }
            return conv;
          }));
        }

        // Obtener el remitente
        const sender = conversation.participantes.find(p => p.id === data.message.from);
        const senderName = sender?.nombre || sender?.nickname || 'Usuario';

        // Crear notificación
        const newNotification = {
          id: Date.now(),
          type: 'message',
          title: `Nuevo mensaje de ${senderName}`,
          message: data.message.content,
          conversationId: data.conversationId,
          timestamp: new Date(),
          read: false
        };

        // Añadir a la lista de notificaciones
        setNotifications(prev => [newNotification, ...prev].slice(0, 20)); // Limitar a 20 notificaciones
        setUnreadNotifications(prev => prev + 1);

        // Reproducir sonido si la conversación no está activa
        if (selectedConversation?.id !== data.conversationId) {
          playNotificationSound();
        }
      }
    };

    const handleUserStatus = (data) => {
      // Notificación cuando un usuario se conecta o desconecta
      const conversation = conversations.find(c => {
        return !c.esGrupo && c.participantes.some(p => p.id === data.userId);
      });

      if (conversation) {
        const userProfile = conversation.participantes.find(p => p.id === data.userId);
        const userName = userProfile?.nombre || userProfile?.nickname || 'Usuario';

        const newNotification = {
          id: Date.now(),
          type: 'status',
          title: `${userName} está ${data.estado === 'online' ? 'en línea' : 'desconectado'}`,
          conversationId: conversation.id,
          timestamp: new Date(),
          read: false
        };

        setNotifications(prev => [newNotification, ...prev].slice(0, 20));
        setUnreadNotifications(prev => prev + 1);
      }
    };

    // Evento para actualizar el estado "visto" de los mensajes
    const handleMessageSeen = (data) => {
      if (data.userId !== user.id) {
        setConversations(prev => prev.map(conv => {
          if (conv.id === data.conversationId) {
            return {
              ...conv,
              mensajes: conv.mensajes?.map(msg => {
                if (msg.from === user.id && !msg.visto) {
                  return { ...msg, visto: true };
                }
                return msg;
              })
            };
          }
          return conv;
        }));
      }
    };

    socket.on('receive_message', handleNewMessage);
    socket.on('user_status_change', handleUserStatus);
    socket.on('message_seen', handleMessageSeen);

    return () => {
      socket.off('receive_message', handleNewMessage);
      socket.off('user_status_change', handleUserStatus);
      socket.off('message_seen', handleMessageSeen);
    };
  }, [socket, isConnected, user?.id, conversations, selectedConversation]);

  // Efecto para marcar mensajes como leídos al seleccionar una conversación
  useEffect(() => {
    if (selectedConversation) {
      // Resetear contador de no leídos para esta conversación
      setConversations(prev => prev.map(conv => {
        if (conv.id === selectedConversation.id) {
          return { ...conv, unreadCount: 0 };
        }
        return conv;
      }));

      // Notificar al servidor que los mensajes han sido vistos
      if (socket && isConnected) {
        socket.emit('mark_messages_seen', {
          conversationId: selectedConversation.id,
          userId: user.id
        });
      }
    }
  }, [selectedConversation, socket, isConnected, user?.id]);

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
        // Usar la variable de entorno para la URL de la API
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const { data } = await axios.get(`${API_URL}/api/users/search?q=${searchQuery}&currentUserId=${user.id}`);
        setSearchResults(data);
      } catch (error) {
        console.error("Error al buscar usuarios:", error);
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, user.id]);

  // Función para cargar usuarios disponibles para grupos
  const loadAvailableUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const { data } = await axios.get(`${API_URL}/api/users?excludeId=${user.id}`);
      setAvailableUsers(data);
    } catch (error) {
      console.error("Error al cargar usuarios disponibles:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Función para crear un nuevo grupo
  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      alert("Por favor, ingresa un nombre para el grupo y selecciona al menos un usuario");
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const { data: newGroup } = await axios.post(`${API_URL}/api/conversations/group`, {
        creadorId: user.id,
        nombre: groupName,
        participantesIds: [...selectedUsers.map(u => u.id), user.id] // Incluir al creador también
      });

      setConversations(prev => [newGroup, ...prev]);
      setSelectedConversation(newGroup);

      // Limpiar y cerrar el modal
      setGroupName('');
      setSelectedUsers([]);
      setShowCreateGroup(false);
    } catch (error) {
      console.error("Error al crear el grupo:", error);
      alert("No se pudo crear el grupo. Inténtalo de nuevo.");
    }
  };

  // Función para reproducir sonido de notificación usando URL directa
  const playNotificationSound = () => {
    // Sonido profesional similar a Slack/Discord (tono suave de notificación)
    const soundUrl = 'https://cdn.freesound.org/previews/504/504856_9961300-hq.mp3';

    // Crear un nuevo objeto Audio con la URL
    const audio = new Audio(soundUrl);

    // Ajustar volumen para que sea suave pero audible
    audio.volume = 0.4;

    // Reproducir el sonido
    audio.play().catch(err => {
      console.log('Error al reproducir sonido:', err);
    });
  };

  // Función para marcar todas las notificaciones como leídas
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setUnreadNotifications(0);
  };

  // Función actualizada para ir a una conversación y marcar esa notificación como leída
  const goToConversation = (conversationId, notificationId = null) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
      setShowNotifications(false);

      // Si se proporciona un ID de notificación, marcar solo esa como leída
      if (notificationId) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        // Actualizar el contador de no leídas
        setUnreadNotifications(prev => Math.max(0, prev - 1));
      }
    }
  };

  const handleStartConversation = async (recipient) => {
    try {
      // Usar la variable de entorno para la URL de la API
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const { data: newConversation } = await axios.post(`${API_URL}/api/conversations`, {
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

  // Filtrar conversaciones basadas en el filtro activo
  const filteredConversations = activeFilter === 'unread'
    ? conversations.filter(conv => conv.unreadCount && conv.unreadCount > 0)
    : conversations;

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
      {/* Left Side - User List */}
      <div className="w-80 border-r border-gray-700 flex flex-col">
        {/* User Profile Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-gray-200 relative">
              <span className="material-symbols-outlined">person</span>
              {/* Indicador de estado para el usuario actual */}
              <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-gray-800 
                ${userStatus === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}>
              </div>
            </div>
            <div className="ml-3">
              <h3 className="font-medium">{user.nickname}</h3>
              <p className="text-xs text-gray-400 capitalize">{userStatus}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onLogout} className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors" title="Cerrar sesión">
              <span className="material-symbols-outlined text-gray-400 text-sm">logout</span>
            </button>

            {/* Botón de notificaciones con contador y animación */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
              >
                <span className={`material-symbols-outlined text-sm ${unreadNotifications > 0 ? 'notification-active text-primary-400' : 'text-gray-400'}`}>
                  {unreadNotifications > 0 ? 'notifications_active' : 'notifications'}
                </span>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {/* Panel de notificaciones desplegable */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-gray-800 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="font-medium">Notificaciones</h3>
                    {unreadNotifications > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary-400 hover:text-primary-300"
                      >
                        Marcar todas como leídas
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map(notification => (
                        <div
                          key={notification.id}
                          onClick={() => goToConversation(notification.conversationId, notification.id)}
                          className={`p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors ${notification.read ? 'opacity-70' : 'bg-gray-750'}`}
                        >
                          <div className="flex justify-between">
                            <h4 className="text-sm font-medium">{notification.title}</h4>
                            <span className="text-xs text-gray-400">
                              {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {notification.message && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notification.message}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No tienes notificaciones
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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

        {/* Filtros y botón para crear grupo */}
        <div className="p-2 border-b border-gray-700 flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${activeFilter === 'all'
                  ? 'bg-primary-800 text-primary-300 hover:bg-primary-700'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              onClick={() => setActiveFilter('all')}
            >
              Todos
            </button>
            <button
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${activeFilter === 'unread'
                  ? 'bg-primary-800 text-primary-300 hover:bg-primary-700'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              onClick={() => setActiveFilter('unread')}
            >
              No leídos
            </button>
          </div>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="px-3 py-1 text-xs bg-primary-600 text-white rounded-full font-medium hover:bg-primary-500 transition-colors flex items-center"
          >
            <span className="material-symbols-outlined text-sm mr-1">add</span>
            Grupo
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
              conversations={filteredConversations}
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

      {/* Modal para crear grupo */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Crear un nuevo grupo</h2>
              <button
                onClick={() => setShowCreateGroup(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-4">
              <label htmlFor="group-name" className="block text-sm font-medium mb-1">Nombre del grupo</label>
              <input
                type="text"
                id="group-name"
                placeholder="Ej: Soporte Técnico"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full bg-gray-700 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Participantes seleccionados ({selectedUsers.length})</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedUsers.map(user => (
                  <div key={user.id} className="bg-primary-700 text-white px-2 py-1 rounded-full text-xs flex items-center">
                    {user.nombre || user.nickname || user.correo}
                    <button
                      onClick={() => setSelectedUsers(prev => prev.filter(u => u.id !== user.id))}
                      className="ml-1 text-white hover:text-red-300"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Agregar usuarios</label>
              <div className="max-h-48 overflow-y-auto bg-gray-700 rounded-lg p-2">
                {isLoadingUsers ? (
                  <p className="text-center text-gray-400 py-2">Cargando usuarios...</p>
                ) : availableUsers.length > 0 ? (
                  availableUsers.map(availableUser => (
                    <div
                      key={availableUser.id}
                      className={`p-2 rounded-lg mb-1 flex items-center justify-between cursor-pointer hover:bg-gray-600 ${selectedUsers.some(u => u.id === availableUser.id) ? 'bg-gray-600' : ''
                        }`}
                      onClick={() => {
                        if (selectedUsers.some(u => u.id === availableUser.id)) {
                          setSelectedUsers(prev => prev.filter(u => u.id !== availableUser.id));
                        } else {
                          setSelectedUsers(prev => [...prev, availableUser]);
                        }
                      }}
                    >
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-500 flex items-center justify-center mr-2">
                          <span className="material-symbols-outlined text-sm">person</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{availableUser.nombre || availableUser.nickname}</p>
                          <p className="text-xs text-gray-400">{availableUser.correo}</p>
                        </div>
                      </div>
                      {selectedUsers.some(u => u.id === availableUser.id) && (
                        <span className="material-symbols-outlined text-primary-400">check_circle</span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-400 py-2">No hay usuarios disponibles</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg mr-2 hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                disabled={!groupName.trim() || selectedUsers.length === 0}
              >
                Crear grupo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;