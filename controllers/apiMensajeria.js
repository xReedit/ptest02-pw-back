const { to, ReE, ReS } = require('../service/uitl.service');



// get que devuelve url servicio solicitado
const getLitsUrlMensajeria = async function (req, res) {
    const listUrlMensajeria = [
        {
            servicio: 'Cobranza',
            url: 'http://localhost:3001' // #TODO: url socket cobranza
        },
        {
            servicio: 'Restobar',
            url: 'http://192.168.1.47:5819' // #TODO: url socket restobar 'https://app.restobar.papaya.com.pe';
        }
    ]
    return ReS(res, { success: true, list: listUrlMensajeria });
}
module.exports.getLitsUrlMensajeria = getLitsUrlMensajeria;

