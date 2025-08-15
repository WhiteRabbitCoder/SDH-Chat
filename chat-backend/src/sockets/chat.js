import { db } from '../config/firebase.js';

export function initializeSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    // Unirse a una sala por ID de usuario
    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(userId);
        console.log(`Socket ${socket.id} se unió a la sala del usuario ${userId}`);
      }
    });

    // Cuando se envía un mensaje
    socket.on('send_message', async (data) => {
      // <-- INICIO DE LA CORRECCIÓN 1 -->
      // Añadir optimisticId a la desestructuración de los datos recibidos
      const { conversationId, from, content, type, optimisticId } = data;
      // <-- FIN DE LA CORRECCIÓN 1 -->

      if (!conversationId || !from || !content) {
        console.error("Datos de mensaje incompletos:", data);
        return;
      }

      try {
        const messageData = {
          from,
          content,
          type,
          fechaHora: new Date(),
        };

        // 1. Guardar el mensaje en la subcolección de la conversación
        const messageRef = await db.collection('conversaciones').doc(conversationId).collection('mensajes').add(messageData);

        // 2. Actualizar el último mensaje en el documento principal de la conversación
        await db.collection('conversaciones').doc(conversationId).update({
          ultimoMensaje: content,
          fechaUltimoMensaje: messageData.fechaHora,
        });

        // <-- INICIO DE LA CORRECCIÓN 2 -->
        // Crear el objeto de mensaje completo, incluyendo el optimisticId que recibimos
        const fullMessage = { id: messageRef.id, ...messageData, optimisticId };
        // <-- FIN DE LA CORRECCIÓN 2 -->

        // 3. Enviar el mensaje en tiempo real a todos los participantes de la conversación
        const convDoc = await db.collection('conversaciones').doc(conversationId).get();
        if (convDoc.exists) {
          const participants = convDoc.data().participantes;
          participants.forEach(userId => {
            // Enviar a la sala personal de cada usuario
            io.to(userId).emit('receive_message', {
              conversationId: conversationId,
              message: fullMessage, // Enviar el mensaje completo
            });
          });
        }
      } catch (error) {
        console.error("Error al enviar el mensaje:", error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Usuario desconectado: ${socket.id}`);
    });
  });
}