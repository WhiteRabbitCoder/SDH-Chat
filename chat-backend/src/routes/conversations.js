import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// --- FUNCIÓN CORREGIDA ---
// Función auxiliar para filtrar datos sensibles del usuario
const filtrarDatosUsuario = (userData) => {
  // Solo devolver los campos seguros para mostrar
  return {
    id: userData.id,
    // CORRECCIÓN: Usar 'nickname' como fuente principal del nombre.
    nombre: userData.nickname || userData.nombre || 'Usuario sin nombre',
    departamento: userData.departamento || '',
    avatarUrl: userData.fotoPerfilURL || null,
    // AÑADIDO: Incluir el estado para el indicador online/offline en el frontend.
    estado: userData.estado || 'offline'
  };
};

// GET /api/conversations?userId=<ID>
router.get("/", async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "El query param 'userId' es requerido." });
  }

  try {
    // Obtener todas las conversaciones donde el usuario es participante
    const convSnap = await db.collection("conversaciones")
      .where("participantes", "array-contains", userId)
      .orderBy("fechaUltimoMensaje", "desc")
      .get();

    // Array para almacenar las conversaciones con datos completos
    const conversationsPromises = convSnap.docs.map(async (doc) => {
      const convData = doc.data();
      const convWithId = { id: doc.id, ...convData };
      
      // Obtener información FILTRADA de cada participante
      const participantesPromises = convData.participantes.map(async (participanteId) => {
        try {
          const userDoc = await db.collection("usuarios").doc(participanteId).get();
          if (userDoc.exists) {
            // Filtrar para solo devolver datos no sensibles
            return filtrarDatosUsuario({ id: participanteId, ...userDoc.data() });
          }
          // Si el usuario no existe, devolver solo el ID con formato amigable
          return { 
            id: participanteId,
            nombre: `Usuario ${participanteId.substring(0, 6)}...`
          };
        } catch (error) {
          console.error(`Error al obtener datos del participante ${participanteId}:`, error);
          return { 
            id: participanteId,
            nombre: `Usuario ${participanteId.substring(0, 6)}...`
          };
        }
      });
      
      // Esperar a que se resuelvan todas las promesas de participantes
      convWithId.participantes = await Promise.all(participantesPromises);
      
      return convWithId;
    });
    
    // Esperar a que se resuelvan todas las promesas de conversaciones
    const conversations = await Promise.all(conversationsPromises);
    
    res.json(conversations);
  } catch (error) {
    console.error("Error listando conversaciones:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// POST /api/conversations (para chats 1-a-1)
router.post("/", async (req, res) => {
  const { creadorId, correoDestinatario } = req.body;

  if (!creadorId || !correoDestinatario) {
    return res.status(400).json({ error: "Los campos 'creadorId' y 'correoDestinatario' son requeridos." });
  }

  try {
    // Buscar al destinatario por su correo
    const userQuery = await db.collection("usuarios").where("correo", "==", correoDestinatario).limit(1).get();
    if (userQuery.empty) {
      return res.status(404).json({ error: "Usuario destinatario no encontrado." });
    }
    const destinatario = userQuery.docs[0];
    const destinatarioId = destinatario.id;
    const destinatarioData = destinatario.data();

    // Evitar crear chat con uno mismo
    if (creadorId === destinatarioId) {
        return res.status(400).json({ error: "No se puede crear una conversación con uno mismo." });
    }

    const participantes = [creadorId, destinatarioId].sort(); // Ordenar para consistencia

    // Verificar si ya existe una conversación 1-a-1
    const convExistenteQuery = await db.collection("conversaciones")
      .where("esGrupo", "==", false)
      .where("participantes", "==", participantes)
      .limit(1)
      .get();

    if (!convExistenteQuery.empty) {
      const convExistente = convExistenteQuery.docs[0];
      const convData = convExistente.data();
      
      // Obtener información FILTRADA de los participantes para la respuesta
      const participantesCompletos = await Promise.all(
        convData.participantes.map(async (participanteId) => {
          const userDoc = await db.collection("usuarios").doc(participanteId).get();
          if (userDoc.exists) {
            return filtrarDatosUsuario({ id: participanteId, ...userDoc.data() });
          }
          return { 
            id: participanteId,
            nombre: `Usuario ${participanteId.substring(0, 6)}...`
          };
        })
      );
      
      return res.status(200).json({ 
        id: convExistente.id, 
        ...convData, 
        participantes: participantesCompletos,
        message: "La conversación ya existe." 
      });
    }

    // Obtener datos del creador
    const creadorDoc = await db.collection("usuarios").doc(creadorId).get();
    const creadorData = creadorDoc.exists ? creadorDoc.data() : {};

    const nuevaConversacion = {
      esGrupo: false,
      participantes: participantes,
      fechaCreacion: new Date(),
      fechaUltimoMensaje: new Date(),
      ultimoMensaje: "Conversación iniciada."
    };

    const docRef = await db.collection("conversaciones").add(nuevaConversacion);
    
    // Preparar los datos FILTRADOS de los participantes para la respuesta
    const participantesCompletos = [
      filtrarDatosUsuario({ id: creadorId, ...creadorData }),
      filtrarDatosUsuario({ id: destinatarioId, ...destinatarioData })
    ];
    
    res.status(201).json({ 
      id: docRef.id, 
      ...nuevaConversacion, 
      participantes: participantesCompletos 
    });

  } catch (error) {
    console.error("Error al crear la conversación:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// GET /api/conversations/:id/messages
router.get("/:id/messages", async (req, res) => {
  const { id } = req.params;

  try {
    const messagesSnap = await db.collection("conversaciones").doc(id).collection("mensajes")
      .orderBy("fechaHora", "asc")
      .get();

    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(messages);
  } catch (error) {
    console.error(`Error listando mensajes para la conversación ${id}:`, error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// POST /api/conversations/group
router.post("/group", async (req, res) => {
  const { nombre, creadorId, participantesIds } = req.body;

  if (!nombre || !creadorId || !Array.isArray(participantesIds) || participantesIds.length === 0) {
    return res.status(400).json({ error: "Datos inválidos para crear el grupo." });
  }

  // Asegurarse de que el creador esté en la lista de participantes y no haya duplicados
  const participantes = [...new Set([creadorId, ...participantesIds])];

  const nuevaConversacion = {
    nombre: nombre,
    esGrupo: true,
    creador: creadorId,
    participantes: participantes,
    admins: [creadorId], // El creador es el primer admin
    fechaCreacion: new Date(),
    fechaUltimoMensaje: new Date(),
    ultimoMensaje: `Grupo "${nombre}" creado.`
  };

  try {
    const docRef = await db.collection("conversaciones").add(nuevaConversacion);
    
    // Obtener información FILTRADA de todos los participantes
    const participantesPromises = participantes.map(async (participanteId) => {
      const userDoc = await db.collection("usuarios").doc(participanteId).get();
      if (userDoc.exists) {
        return filtrarDatosUsuario({ id: participanteId, ...userDoc.data() });
      }
      return { 
        id: participanteId,
        nombre: `Usuario ${participanteId.substring(0, 6)}...`
      };
    });
    
    const participantesCompletos = await Promise.all(participantesPromises);
    
    res.status(201).json({ 
      id: docRef.id, 
      ...nuevaConversacion,
      participantes: participantesCompletos
    });
  } catch (error) {
    console.error("Error al crear el grupo:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});


// Añadir miembros a un grupo
router.post("/group/:groupId/members", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { newMemberIds } = req.body;
    
    if (!newMemberIds || !newMemberIds.length) {
      return res.status(400).json({ error: "No se proporcionaron nuevos miembros" });
    }
    
    // Obtener el grupo
    const groupDoc = await db.collection("conversaciones").doc(groupId).get();
    
    if (!groupDoc.exists) {
      return res.status(404).json({ error: "Grupo no encontrado" });
    }
    
    const groupData = groupDoc.data();
    
    if (!groupData.esGrupo) {
      return res.status(400).json({ error: "Esta conversación no es un grupo" });
    }
    
    // Obtener IDs de participantes actuales
    const currentParticipantIds = groupData.participantes;
    
    // Filtrar solo los nuevos miembros que no están ya en el grupo
    const actualNewMemberIds = newMemberIds.filter(id => !currentParticipantIds.includes(id));
    
    if (actualNewMemberIds.length === 0) {
      return res.status(400).json({ error: "Todos los usuarios ya son miembros del grupo" });
    }
    
    // Actualizar el grupo con los nuevos miembros
    const updatedParticipantes = [...currentParticipantIds, ...actualNewMemberIds];
    
    await db.collection("conversaciones").doc(groupId).update({
      participantes: updatedParticipantes,
      ultimoMensaje: "Se añadieron nuevos miembros al grupo",
      fechaUltimoMensaje: new Date()
    });
    
    // Obtener información de todos los participantes
    const participantesCompletos = await Promise.all(
      updatedParticipantes.map(async (participanteId) => {
        const userDoc = await db.collection("usuarios").doc(participanteId).get();
        if (userDoc.exists) {
          return filtrarDatosUsuario({ id: participanteId, ...userDoc.data() });
        }
        return { 
          id: participanteId,
          nombre: `Usuario ${participanteId.substring(0, 6)}...`
        };
      })
    );
    
    // Obtener el grupo actualizado para la respuesta
    const updatedGroup = {
      id: groupId,
      ...groupData,
      participantes: participantesCompletos,
      ultimoMensaje: "Se añadieron nuevos miembros al grupo",
      fechaUltimoMensaje: new Date()
    };
    
    res.json(updatedGroup);
  } catch (error) {
    console.error('Error al añadir miembros al grupo:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Eliminar una conversación o salir de un grupo
router.delete("/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: "Se requiere ID de usuario" });
    }
    
    const conversationDoc = await db.collection("conversaciones").doc(conversationId).get();
    
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: "Conversación no encontrada" });
    }
    
    const conversationData = conversationDoc.data();
    
    // Si es un grupo, simplemente eliminar al usuario de los participantes
    if (conversationData.esGrupo) {
      const updatedParticipantes = conversationData.participantes.filter(id => id !== userId);
      
      // Si no quedan participantes, eliminar el grupo
      if (updatedParticipantes.length === 0) {
        await db.collection("conversaciones").doc(conversationId).delete();
        return res.json({ message: "Grupo eliminado" });
      }
      
      // Actualizar el grupo sin el usuario
      await db.collection("conversaciones").doc(conversationId).update({
        participantes: updatedParticipantes,
        ultimoMensaje: "Un usuario abandonó el grupo",
        fechaUltimoMensaje: new Date()
      });
      
      return res.json({ message: "Usuario eliminado del grupo" });
    }
    
    // Si es una conversación 1-a-1, eliminarla completamente
    await db.collection("conversaciones").doc(conversationId).delete();
    
    res.json({ message: "Conversación eliminada" });
  } catch (error) {
    console.error('Error al eliminar conversación:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;