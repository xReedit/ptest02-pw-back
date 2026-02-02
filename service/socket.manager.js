/**
 * Socket Manager - Singleton para acceder a la instancia de Socket.IO
 * desde cualquier parte de la aplicación
 */

let io = null;

const setIO = (socketIO) => {
    io = socketIO;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO no ha sido inicializado');
    }
    return io;
};

const emitToRoom = (room, event, data) => {
    if (io) {
        io.to(room).emit(event, data);
    }
};

module.exports = {
    setIO,
    getIO,
    emitToRoom
};
