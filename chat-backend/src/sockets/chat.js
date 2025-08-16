import { db } from "../config/firebase.js";

export function initializeSocket(io) {
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log('Usuario conectado con socket ID:', socket.id);
    let currentUserId = null;

    socket.on('join_user_room', async (userId) => {
      if (!userId) return;

      currentUserId = userId;
      connectedUsers.set(userId, socket.id);
      socket.join(userId);

      console.log(`Usuario ${userId} unido a su sala personal. Total conectados: ${connectedUsers.size}`);

      try {
        await db.collection('usuarios').doc(userId).update({
          estado: 'online',
          ultimaConexion: new Date()
        });

        const convSnap = await db.collection('conversaciones')
          .where('participantes', 'array-contains', userId)
          .get();

        convSnap.docs.forEach(doc => {
          const conv = doc.data();
          conv.participantes.forEach(participanteId => {
            if (participanteId !== userId && connectedUsers.has(participanteId)) {
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

    socket.on('send_message', async (data) => {
      console.log('Mensaje recibido:', data);

      try {
        const { conversationId, from, content, optimisticId, type = 'text' } = data;

        if (!conversationId || !from || !content) {
          return socket.emit('error', { message: 'Datos incompletos para enviar mensaje' });
        }

        const newMessage = {
          from,
          content,
          type,
          fechaHora: new Date(),
          optimisticId,
          leido: false
        };

        const msgRef = await db.collection('conversaciones')
          .doc(conversationId)
          .collection('mensajes')
          .add(newMessage);

        await db.collection('conversaciones').doc(conversationId).update({
          ultimoMensaje: content,
          fechaUltimoMensaje: new Date(),
          ocultadaPor: []
        });

        const convDoc = await db.collection('conversaciones').doc(conversationId).get();
        const conv = convDoc.data();

        if (!conv) {
          return socket.emit('error', { message: 'Conversación no encontrada' });
        }

        conv.participantes.forEach(participanteId => {
          const persistedMessage = {
            ...newMessage,
            id: msgRef.id,
            optimisticId
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

    socket.on('typing_status', (data) => {
      const { conversationId, userId, isTyping } = data;
      if (!conversationId) return;

      socket.to(conversationId).emit('user_typing', {
        conversationId,
        userId,
        isTyping
      });
    });

    socket.on('group_updated', (data) => {
      const { groupId, updatedBy } = data;
      if (!groupId) return;

      try {
        db.collection("conversaciones").doc(groupId).get().then(doc => {
          if (!doc.exists) return;

          const groupData = doc.data();

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

    socket.on('disconnect', async () => {
      if (!currentUserId) return;

      console.log(`Usuario ${currentUserId} desconectado`);

      try {
        await db.collection('usuarios').doc(currentUserId).update({
          estado: 'offline',
          ultimaConexion: new Date()
        });

        connectedUsers.delete(currentUserId);

        const convSnap = await db.collection('conversaciones')
          .where('participantes', 'array-contains', currentUserId)
          .get();

        convSnap.docs.forEach(doc => {
          const conv = doc.data();
          conv.participantes.forEach(participanteId => {
            if (participanteId !== currentUserId && connectedUsers.has(participanteId)) {
              io.to(participanteId).emit('user_status_change', {
                userId: currentUserId,
                estado: 'offline'
              });
            }
          });
        });
      } catch (error) {
        console.error('Error al actualizar estado en desconexión:', error);
      }
    });
  });
}