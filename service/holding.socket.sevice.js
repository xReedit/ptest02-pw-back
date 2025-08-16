let config = require('../_config');
const io = require("socket.io-client");
// Eliminamos esta importación que causa el ciclo de dependencias
// const { set } = require('../app');

async function sendNumberTableClienteHolding(rooms, numberTable, orderCode, idpedidos) {
    const infoUser = {
        isClienteHolding: '1'        
    }

    try {
        let socketHolding = await connectSocket(infoUser); 

        const _rooms = rooms.map(room => {
            return `room${room.idorg}${room.idsede}`;
        });
        
        const dataSend = {
            rooms: _rooms,
            numberTable,
            orderCode,
            idpedidos
        };

        // console.log('dataSend rooms', dataSend);

        // mandamos al servidor
        socketHolding.emit('restobar-send-number-table-client', dataSend);            
        
        // Esperamos antes de desconectar
        await new Promise(resolve => setTimeout(resolve, 1000));
        socketHolding.disconnect();

    } catch (error) {
        console.error('Error en socket:', error);
    }    
}

function connectSocket(infoUser) {
    return new Promise((resolve, reject) => {
        const urlSocket = `http://127.0.0.1:${config.portSocket}`;
        // console.log('conectando === ', urlSocket);
        const socketHolding = io(urlSocket, {
            query: infoUser,
            transports: ['websocket']
        });

        socketHolding.on('connect', () => {
            console.log('socket connected');            
            resolve(socketHolding);            
        });

        socketHolding.on('connect_error', (error) => {
            console.error('Connection error:', error);
            reject(error);
        });

        // Timeout para la conexión
        setTimeout(() => {
            if (!socketHolding.connected) {
                reject(new Error('Connection timeout'));
            }
        }, 5000);
    });    
}

module.exports.sendNumberTableClienteHolding = sendNumberTableClienteHolding;
