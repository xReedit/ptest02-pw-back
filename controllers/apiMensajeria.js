const { to, ReE, ReS } = require('../service/uitl.service');



// get que devuelve url servicio solicitado
const getLitsUrlMensajeria = async function (req, res) {
    const listUrlMensajeria = [        
        {
            servicio: 'Restobar',
            url: 'https://app.restobar.papaya.com.pe' //'http://192.168.1.47:5819' // #TODO: url socket restobar 'https://app.restobar.papaya.com.pe';
            // url: 'http://192.168.1.47:5819'
        },
        // {
        //     servicio: 'Cobranza',
        //     url: 'http://localhost:3001' // #TODO: url socket cobranza
        // }
    ]
    return ReS(res, { success: true, list: listUrlMensajeria });
}
module.exports.getLitsUrlMensajeria = getLitsUrlMensajeria;

