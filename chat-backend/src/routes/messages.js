import express from 'express';
import { db } from '../config/firebase.js';

const router = express.Router();

// Buscar mensajes dentro de una conversación
router.get('/search', async (req, res) => {
  try {
    const { conversationId, query } = req.query;
    
    if (!conversationId || !query || query.trim() === '') {
      return res.status(400).json({ error: "Se requiere ID de conversación y término de búsqueda" });
    }
    
    const messagesRef = db.collection("conversaciones").doc(conversationId).collection("mensajes");
    const messagesSnap = await messagesRef.get();
    
    if (messagesSnap.empty) {
      return res.json([]);
    }
    
    // Filtrar mensajes que contienen el término de búsqueda
    const matchingMessages = [];
    messagesSnap.forEach(doc => {
      const msgData = doc.data();
      if (msgData.content && msgData.content.toLowerCase().includes(query.toLowerCase())) {
        matchingMessages.push({
          id: doc.id,
          ...msgData
        });
      }
    });
    
    res.json(matchingMessages);
  } catch (error) {
    console.error('Error al buscar mensajes:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;