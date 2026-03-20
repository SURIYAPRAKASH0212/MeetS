const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);


// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));
const path = require("path");

app.use(express.static(path.join(__dirname, "../client")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/index.html"));
});
// Store room states (how many users in a room)
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // User joins a room
    socket.on('join-room', ({ roomId, username }) => {
        const roomSize = rooms.get(roomId) || 0;

        if (roomSize >= 2) {
            socket.emit('room-full');
            return;
        }

        socket.join(roomId);
        rooms.set(roomId, roomSize + 1);
        socket.roomId = roomId; // store room and username on socket
        socket.username = username;

        // Tell the joining user about the existing user (if any)
        if (roomSize === 1) {
            const clients = io.sockets.adapter.rooms.get(roomId);
            if (clients) {
                for (const clientId of clients) {
                    if (clientId !== socket.id) {
                        const otherSocket = io.sockets.sockets.get(clientId);
                        if (otherSocket) {
                            socket.emit('existing-user', { id: otherSocket.id, username: otherSocket.username });
                        }
                    }
                }
            }
        }

        // Notify others in the room
        socket.to(roomId).emit('user-joined', { id: socket.id, username });
    });

    // WebRTC Signaling
    socket.on('offer', (offer) => {
        socket.to(socket.roomId).emit('offer', offer);
    });

    socket.on('answer', (answer) => {
        socket.to(socket.roomId).emit('answer', answer);
    });

    socket.on('ice-candidate', (candidate) => {
        socket.to(socket.roomId).emit('ice-candidate', candidate);
    });

    // Chat Message
    socket.on('chat-message', (data) => {
        socket.to(socket.roomId).emit('chat-message', {
            username: socket.username,
            message: data.message,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (socket.roomId) {
            const currentUsers = rooms.get(socket.roomId);
            if (currentUsers > 1) {
                rooms.set(socket.roomId, currentUsers - 1);
            } else {
                rooms.delete(socket.roomId);
            }
            socket.to(socket.roomId).emit('user-left', { id: socket.id, username: socket.username });
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});