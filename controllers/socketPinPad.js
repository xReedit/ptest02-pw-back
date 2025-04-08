// const { use } = require("../routes/v3");
let socketIO;
let socketPP;
const connection = function (dataCliente, socket, io) {    
    socketIO = io;
    socketPP = socket;
    console.log('Cliente conectado: ' + JSON.stringify(dataCliente));
    socket.emit('roomMessage', dataCliente);
    
    let apiRoutes = getApiRoutes();
    socket.emit('setApiRoutes', apiRoutes);
}

const checkServicesPinPad = async (payload) => {
    return assignRoomAndListen(payload.pinPadSN, 'checkService', 'checkServiceResponse', {}, 2000);
}

const setUserPindPad = async (payload) => {
    let apiUser = getApiUser();
    return assignRoomAndListen(payload.pinPadSN, 'setApiUser', 'setApiUserResponse', apiUser, 20000);    
}

const loginPinPad = async (payload) => {
    const apiUser = getApiUser();
    return assignRoomAndListen(payload.pinPadSN, 'loginApiPinPad', 'loginApiPinPadResponse', apiUser, 10000);
}

const testPinPad = async (payload) => {
    const apiUser = getApiUser(payload.idsede);
    return assignRoomAndListen(payload.pinPadSN, 'testApiPinPad', 'testApiPinPadResponse', apiUser, 10000);
}

const transaccionPinPad = async (payload) => {    
    console.log('payload', payload);
    const transaction = getBaseTransaction(payload.transaction);
    console.log('baseTransaction', transaction);    

    return assignRoomAndListen(payload.pinPadSN, 'transaccionApiPinPad', 'transaccionApiPinPadResponse', transaction, 60000);    
}

const convertAmount = (amount) => {
    return Math.round(amount * 100);
}

// const assignRoomAndListen = async (pinPadSN, eventToEmit, responseEvent, payload = {}, timeout = 10000) => {
//     const room = getRoom(pinPadSN);
//     return new Promise((resolve, reject) => {
//         console.log('room pinpad =====>> ', room, 'eventToEmite ===>> ', eventToEmit);
//         socketIO.to(room).emit(eventToEmit, payload);
//         console.log('socketIO', socketIO);
//         const roomExist = socketIO.sockets.adapter.rooms[room];           
//         console.log('¿roomExist ==>', roomExist);
//         if (roomExist) {            
//             // Obtener el socket específico
//             const socket = roomExist.sockets;            
//             const socketId = Object.keys(socket)[0];
//             const specificSocket = socketIO.sockets.sockets[socketId];            
    
//             // Escuchar la respuesta en el contexto del socket específico
//             specificSocket.once(responseEvent, (data) => {                
//                 resolve(
//                     {
//                         success: data.success != undefined ? data.success : true,
//                         data
//                     });
//             });
//         } else {
//             reject({success: false, message: 'PinPad no disponible'});
//         }

//         setTimeout(() => {
//             reject({success: false, message: 'PinPad no disponible - timeout'});
//         }, timeout);
//     });
// }

const assignRoomAndListen = async (pinPadSN, eventToEmit, responseEvent, payload = {}, timeout = 10000) => {
    const room = getRoom(pinPadSN);
    return new Promise(async (resolve, reject) => {
        console.log('room pinpad =====>> ', room, 'eventToEmit ===>> ', eventToEmit);
        
        // Emitir el evento al room
        socketIO.to(room).emit(eventToEmit, payload);
        
        try {
            // Obtener todos los sockets en la sala
            const sockets = await socketIO.in(room).allSockets();
            console.log('Sockets en la sala:', Array.from(sockets));
            
            if (sockets.size === 0) {
                reject({ success: false, message: 'PinPad no disponible' });
                return;
            }

            // Obtener el primer socket en la sala
            const socketId = Array.from(sockets)[0];
            const specificSocket = socketIO.sockets.sockets.get(socketId);
            
            if (!specificSocket) {
                reject({ success: false, message: 'PinPad no disponible' });
                return;
            }

            // Escuchar la respuesta en el contexto del socket específico
            specificSocket.once(responseEvent, (data) => {
                resolve({
                    success: data.success !== undefined ? data.success : true,
                    data
                });
            });

            // Manejar el tiempo de espera
            setTimeout(() => {
                reject({ success: false, message: 'PinPad no disponible - timeout' });
            }, timeout);

        } catch (error) {
            console.error('Error al obtener los sockets en la sala:', error);
            reject({ success: false, message: 'Error al obtener los sockets en la sala' });
        }
    });
}

function getRoom(pinPadSN) {
    let chanelRoom = `pinpad-${pinPadSN}`;
    console.log('chanelRoom conectado ', chanelRoom);
    return chanelRoom;
}

function getApiRoutes() {
    const urlPinPad = "http://localhost:9090/API_PPAD/";
    return {
        "login": urlPinPad + "login",
        "test": urlPinPad + "test",
        "transaccion": urlPinPad + "procesarTransaccion"
    }
}

function getApiUser(idsede) {
    return {
        user: "izipay",
        password: "izipay"
    }
}

const getBaseTransaction = (transaction) => {
    const codigo = transaction.operation;
    const basePayload = {
        ecr_aplicacion: "POS",
        ecr_transaccion: codigo,
        ecr_currency_code: getCurrencyCode(transaction.currency),
    };    

    switch (codigo) {
        case "01": // Compra / Compra DCC
            return {
                ...basePayload,                
                ecr_amount: convertAmount(transaction.amount),
            };
        case "06": // Anulación de Compra
            return {
                ...basePayload,                
                ecr_amount: convertAmount(transaction.amount),
                ecr_data_adicional: transaction.data_adicional,
            };            
        case "09": // Reporte Detallado
        case "10": // Reporte de Totales
        case "11": // Reimpresión
            return {
                ...basePayload,                
                ecr_data_adicional: transaction.data_adicional,
            };
        case "12": // Cierre
        case "19": // Reporte Detallado / Cierre
        case "20": // Reporte Totales / Cierre
            return basePayload;
        default:
            throw new Error(`Operación no soportada: ${codigo}`);
    }
}

getCurrencyCode = (currency) => {
    let codeCurrency = "604";
    switch (currency) {
        case 'PEN':
            codeCurrency = "604";
            break;
        case 'USD':
            codeCurrency = "840";
            break;        
    }         
    return codeCurrency;    
}

module.exports = {
    connection,
    setUserPindPad,
    loginPinPad,
    testPinPad,
    transaccionPinPad,
    checkServicesPinPad
};