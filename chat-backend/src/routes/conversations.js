import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// Función auxiliar para filtrar datos sensibles del usuario
const filtrarDatosUsuario = (userData) => {
  // Solo devolver los campos seguros para mostrar
  return {
    id: userData.id,
    // Corregido: Usar 'nickname' como fuente principal para el nombre
    nombre: userData.nickname || userData.nombre || 'Usuario sin nombre',
    departamento: userData.departamento || '',
    // Corregido: Usar 'fotoPerfilURL' para el avatar
    avatarUrl: userData.fotoPerfilURL || null,
    // Añadido: Incluir el estado para la UI
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
    const convSnap = await db.collection("conversaciones")
      .where("participantes", "array-contains", userId)
      .orderBy("fechaUltimoMensaje", "desc")
      .get();

    const conversationsPromises = convSnap.docs.map(async (doc) => {
      const convData = doc.data();
      if (Array.isArray(convData.ocultadaPor) && convData.ocultadaPor.includes(userId)) {
        return null;
      }
      const convWithId = { id: doc.id, ...convData };
      
      const participantesPromises = convData.participantes.map(async (participanteId) => {
        try {
          const userDoc = await db.collection("usuarios").doc(participanteId).get();
          if (userDoc.exists) {
            return filtrarDatosUsuario({ id: participanteId, ...userDoc.data() });
          }
          return { id: participanteId, nombre: `Usuario ${participanteId.substring(0, 6)}...` };
        } catch (error) {
          console.error(`Error al obtener datos del participante ${participanteId}:`, error);
          return { id: participanteId, nombre: `Usuario ${participanteId.substring(0, 6)}...` };
        }
      });
      
      convWithId.participantes = await Promise.all(participantesPromises);
      return convWithId;
    });
    
    const conversations = (await Promise.all(conversationsPromises)).filter(c => c !== null);
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
    const userQuery = await db.collection("usuarios").where("correo", "==", correoDestinatario).limit(1).get();
    if (userQuery.empty) {
      return res.status(404).json({ error: "Usuario destinatario no encontrado." });
    }
    const destinatario = userQuery.docs[0];
    const destinatarioId = destinatario.id;
    const destinatarioData = destinatario.data();

    if (creadorId === destinatarioId) {
        return res.status(400).json({ error: "No se puede crear una conversación con uno mismo." });
    }

    const participantes = [creadorId, destinatarioId].sort();

    const convExistenteQuery = await db.collection("conversaciones")
      .where("esGrupo", "==", false)
      .where("participantes", "==", participantes)
      .limit(1)
      .get();

    if (!convExistenteQuery.empty) {
      const convExistente = convExistenteQuery.docs[0];
      const convData = convExistente.data();
      
      const participantesCompletos = await Promise.all(
        convData.participantes.map(async (participanteId) => {
          const userDoc = await db.collection("usuarios").doc(participanteId).get();
          return userDoc.exists ? filtrarDatosUsuario({ id: participanteId, ...userDoc.data() }) : { id: participanteId, nombre: `Usuario ${participanteId.substring(0, 6)}...` };
        })
      );
      
      return res.status(200).json({ 
        id: convExistente.id, 
        ...convData, 
        participantes: participantesCompletos,
        message: "La conversación ya existe." 
      });
    }

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
  const { nombreGrupo, creadorId, miembrosIds } = req.body;

  if (!nombreGrupo || !creadorId || !Array.isArray(miembrosIds) || miembrosIds.length === 0) {
    return res.status(400).json({ error: "Datos inválidos para crear el grupo." });
  }

  const participantes = [...new Set([creadorId, ...miembrosIds])];

  const nuevaConversacion = {
    nombre: nombreGrupo,
    esGrupo: true,
    creador: creadorId,
    participantes: participantes,
    admins: [creadorId],
    fechaCreacion: new Date(),
    fechaUltimoMensaje: new Date(),
    ultimoMensaje: `Grupo "${nombreGrupo}" creado.`
  };

  try {
    const docRef = await db.collection("conversaciones").add(nuevaConversacion);
    
    const participantesPromises = participantes.map(async (participanteId) => {
      const userDoc = await db.collection("usuarios").doc(participanteId).get();
      return userDoc.exists ? filtrarDatosUsuario({ id: participanteId, ...userDoc.data() }) : { id: participanteId, nombre: `Usuario ${participanteId.substring(0, 6)}...` };
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

export default router;