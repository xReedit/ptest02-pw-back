let fecha = {
        getFechaActual: () => {                
                return new Date().toJSON().slice(0, 10);
        },
        getFechaActualFormatLocal: () => {                
                return new Date().toJSON().slice(0, 10).split('-').reverse().join('/');
        },
        getHoraActual: () => {
                return new Date().toLocaleTimeString();
        }
}

module.exports = fecha;