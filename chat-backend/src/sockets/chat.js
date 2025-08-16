import { db } from "../config/firebase.js";

export function initializeSocket(io) {
  // Almacenar usuarios conectados: userId -> socketId
  const connectedUsers = new Map();
  
  io.on('connection', (socket) => {
    console.log('Usuario conectado con socket ID:', socket.id);
    let currentUserId = null;

    // Cuando un usuario se une a su sala personal
    socket.on('join_user_room', async (userId) => {
      if (!userId) return;
      
      currentUserId = userId;
      
      // Almacenar la conexión del usuario
      connectedUsers.set(userId, socket.id);
      
      // Unirse a la sala personal del usuario
      socket.join(userId);
      
      console.log(`Usuario ${userId} unido a su sala personal. Total conectados: ${connectedUsers.size}`);
      
      try {
        // Actualizar estado a 'online' en la base de datos
        await db.collection('usuarios').doc(userId).update({
          estado: 'online',
          ultimaConexion: new Date()
        });
        
        // Obtener las conversaciones del usuario para notificar su estado
        const convSnap = await db.collection('conversaciones')
          .where('participantes', 'array-contains', userId)
          .get();
        
        // Notificar a todos los participantes de sus conversaciones que está online
        convSnap.docs.forEach(doc => {
          const conv = doc.data();
          conv.participantes.forEach(participanteId => {
            if (participanteId !== userId && connectedUsers.has(participanteId)) {
              // Enviar actualización de estado al otro participante
              io.to(participanteId).emit('user_status_change', {
                userId: userId,
                estado: 'online'
              });
            }
          });
        });
      } catch (error) {
        console.error('Error al actualizar estado del usuario:', error);
      }
    });

    // Manejar envío de mensajes
    socket.on('send_message', async (data) => {
      console.log('Mensaje recibido:', data);
      
      try {
        const { conversationId, from, content, optimisticId, type = 'text' } = data;
        
        if (!conversationId || !from || !content) {
          return socket.emit('error', { message: 'Datos incompletos para enviar mensaje' });
        }
        
        // Crear el nuevo mensaje
        const newMessage = {
          from,
          content,
          type,
          fechaHora: new Date(),
          optimisticId,
          leido: false
        };
        
        // Guardar en Firestore
        const msgRef = await db.collection('conversaciones')
          .doc(conversationId)
          .collection('mensajes')
          .add(newMessage);
        
        // Actualizar la conversación con el último mensaje
        await db.collection('conversaciones').doc(conversationId).update({
          ultimoMensaje: content,
          fechaUltimoMensaje: new Date()
        });
        
        // Obtener la conversación para enviar a todos los participantes
        const convDoc = await db.collection('conversaciones').doc(conversationId).get();
        const conv = convDoc.data();
        
        if (!conv) {
          return socket.emit('error', { message: 'Conversación no encontrada' });
        }
        
        // Enviar el mensaje a todos los participantes de la conversación
        conv.participantes.forEach(participanteId => {
          // Mensaje persistente con ID real de la base de datos
          const persistedMessage = {
            ...newMessage,
            id: msgRef.id,
            optimisticId // Mantener el ID optimista para que el frontend pueda hacer la correspondencia
          };
          
          io.to(participanteId).emit('receive_message', {
            conversationId,
            message: persistedMessage
          });
        });
      } catch (error) {
        console.error('Error al enviar mensaje:', error);
        socket.emit('error', { message: 'Error al procesar el mensaje' });
      }
    });

    // Manejar cambios de estado (escribiendo, etc.)
    socket.on('typing_status', (data) => {
      const { conversationId, userId, isTyping } = data;
      
      if (!conversationId) return;
      
      socket.to(conversationId).emit('user_typing', {
        conversationId,
        userId,
        isTyping
      });
    });

    // Manejar actualización de grupos
    socket.on('group_updated', (data) => {
      const { groupId, updatedBy } = data;
      
      if (!groupId) return;
      
      try {
        // Obtener el grupo actualizado
        db.collection("conversaciones").doc(groupId).get().then(doc => {
          if (!doc.exists) return;
          
          const groupData = doc.data();
          
          // Notificar a todos los participantes
          groupData.participantes.forEach(participanteId => {
            if (connectedUsers.has(participanteId)) {
              io.to(participanteId).emit('group_updated', {
                groupId,
                updatedBy,
                timestamp: new Date()
              });
            }
          });
        });
      } catch (error) {
        console.error('Error al notificar actualización de grupo:', error);
      }
    });

    // Cuando un usuario se desconecta
    socket.on('disconnect', async () => {
      if (!currentUserId) return;
      
      console.log(`Usuario ${currentUserId} desconectado`);
      
      try {
        // Actualizar estado a 'offline' en la base de datos
        await db.collection('usuarios').doc(currentUserId).update({
          estado: 'offline',
          ultimaConexion: new Date()
        });
        
        // Eliminar del mapa de usuarios conectados
        connectedUsers.delete(currentUserId);
        
        // Obtener las conversaciones del usuario para notificar su estado
        const convSnap = await db.collection('conversaciones')
          .where('participantes', 'array-contains', currentUserId)
          .get();
        
        // Notificar a todos los participantes de sus conversaciones que está offline
        convSnap.docs.forEach(doc => {
          const conv = doc.data();
          conv.participantes.forEach(participanteId => {
            if (participanteId !== currentUserId && connectedUsers.has(participanteId)) {
              // Enviar actualización de estado al otro participante
              io.to(participanteId).emit('user_status_change', {
                userId: currentUserId,
                estado: 'offline'
              });
            }
          });
        });
      } catch (error) {
        console.error('Error al actualizar estado del usuario:', error);
      }
    });
  });
}