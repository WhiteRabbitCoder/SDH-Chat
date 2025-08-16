# Chat Corporativo Konecta - Prueba Técnica

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## 📝 Descripción del Proyecto

Este repositorio contiene la solución a la prueba técnica de Konecta, consistente en el desarrollo de una aplicación de chat corporativo en tiempo real. La plataforma permite a los usuarios comunicarse mediante chats privados (1 a 1) y grupales, con un backend robusto y escalable y un frontend moderno y reactivo.

El proyecto está dividido en dos directorios principales:
*   `chat-backend`: Aplicación Node.js con Express, Socket.IO y Firebase Firestore.
*   `chat-frontend`: Aplicación React construida con Vite y estilizada con Tailwind CSS.

---

## ✨ Funcionalidades Implementadas

*   **Autenticación de Usuarios:** Sistema de inicio de sesión seguro.
*   **Chat en Tiempo Real:** Comunicación instantánea gracias a WebSockets (Socket.IO).
*   **Chats Privados y Grupales:** Capacidad de crear y participar en conversaciones 1 a 1 y grupales.
*   **Búsqueda de Usuarios:** Funcionalidad para buscar otros usuarios por correo electrónico e iniciar nuevas conversaciones.
*   **Indicador de Estado:** Muestra visualmente si un usuario está `online` u `offline`.
*   **Notificaciones en la App:** Sistema de notificaciones para mensajes no leídos.
*   **Gestión de Chats:**
    *   Creación de grupos con múltiples participantes.
    *   Opción de "Eliminar" un chat (lo oculta de la vista del usuario).
    *   El chat "eliminado" se reactiva automáticamente al recibir un nuevo mensaje.
*   **Backend Dockerizado:** El backend está contenedorizado con Docker para garantizar un entorno de desarrollo consistente y facilitar el despliegue.

---

## 🛠️ Stack Tecnológico

| Área                | Tecnología                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| **Frontend**        | React, Vite, Tailwind CSS, Axios, `socket.io-client`                    |
| **Backend**         | Node.js, Express, Socket.IO, Firebase Firestore (como base de datos)    |
| **DevOps**          | Docker                                                                  |

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos

*   Node.js (v18 o superior)
*   npm
*   Docker

### 1. Configuración del Backend

```bash
# 1. Navega al directorio del backend
cd ../chat-backend

# 2. Crea un archivo .env y configúralo con tus credenciales de Firebase
# (Puedes usar el archivo .env.example como plantilla)
cp .env.example .env

# 3. Instala las dependencias
npm install

# 4. Inicia el servidor de desarrollo
npm start
```

El backend estará corriendo en `http://localhost:3000`.

### 2. Configuración del Frontend

```bash
# 1. Navega al directorio del frontend (desde la raíz del proyecto)
cd chat-frontend

# 2. Crea un archivo .env y apunta a la URL del backend
cp .env.example .env
# Asegúrate que VITE_API_URL sea http://localhost:3000

# 3. Instala las dependencias
npm install

# 4. Inicia el cliente de desarrollo
npm run dev
```

El frontend estará disponible en `http://localhost:5173`.

### 🐳 Ejecutar Backend con Docker (Alternativa)

Si tienes el backend detenido, puedes levantarlo fácilmente con Docker.

```bash
# 1. Navega al directorio del backend
cd ../chat-backend

# 2. Construye la imagen de Docker
docker build -t konecta-chat-backend .

# 3. Ejecuta el contenedor
docker run -p 3000:3000 -d --name mi-chat-backend konecta-chat-backend
```

---

## 🚧 Tareas Pendientes y Mejoras Futuras

Aunque la funcionalidad principal está completa, el proyecto tiene potencial para crecer. Las siguientes son mejoras que se podrían implementar:

*   **Soporte Multimedia:** Permitir el envío de imágenes, documentos y otros archivos.
*   **Gestión de Mensajes:** Añadir la funcionalidad de editar y eliminar mensajes ya enviados.
*   **Notificaciones Push:** Integrar la API de notificaciones del navegador para alertar a los usuarios incluso si no tienen la pestaña activa.
*   **Roles y Permisos Avanzados:** Implementar roles (ej. administrador de grupo) con permisos específicos.
*   **Testing:** Desarrollar una suite de pruebas unitarias y de integración para garantizar la estabilidad del código.

---

## 🐞 Bugs Conocidos

Actualmente, no se han identificado bugs críticos que impidan el funcionamiento de las características implementadas. La plataforma se encuentra en un estado estable para demostración.

---
