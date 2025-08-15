import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// GET /api/conversations?userId=<ID> (Ya existente)
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

    const conversations = convSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(conversations);
  } catch (error) {
    console.error("Error listando conversaciones:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// POST /api/conversations (NUEVO para chats 1-a-1)
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
      return res.status(200).json({ id: convExistente.id, ...convExistente.data(), message: "La conversación ya existe." });
    }

    const nuevaConversacion = {
      esGrupo: false,
      participantes: participantes,
      fechaCreacion: new Date(),
      fechaUltimoMensaje: new Date(),
      ultimoMensaje: "Conversación iniciada."
    };

    const docRef = await db.collection("conversaciones").add(nuevaConversacion);
    res.status(201).json({ id: docRef.id, ...nuevaConversacion });

  } catch (error) {
    console.error("Error al crear la conversación:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// GET /api/conversations/:id/messages (NUEVO)
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

// POST /api/conversations/group (Existente)
router.post("/group", async (req, res) => {
  const { nombreGrupo, creadorId, miembrosIds } = req.body;

  if (!nombreGrupo || !creadorId || !Array.isArray(miembrosIds) || miembrosIds.length === 0) {
    return res.status(400).json({ error: "Datos inválidos para crear el grupo." });
  }

  // Asegurarse de que el creador esté en la lista de participantes
  const participantes = [...new Set([creadorId, ...miembrosIds])];

  const nuevaConversacion = {
    nombre: nombreGrupo,
    esGrupo: true,
    creador: creadorId,
    participantes: participantes,
    admins: [creadorId], // El creador es el primer admin
    fechaCreacion: new Date(),
    fechaUltimoMensaje: new Date(),
    ultimoMensaje: `Grupo "${nombreGrupo}" creado.`
  };

  try {
    const docRef = await db.collection("conversaciones").add(nuevaConversacion);
    res.status(201).json({ id: docRef.id, ...nuevaConversacion });
  } catch (error) {
    console.error("Error al crear el grupo:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;