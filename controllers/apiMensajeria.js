const { to, ReE, ReS } = require('../service/uitl.service');



// get que devuelve url servicio solicitado
const getLitsUrlMensajeria = async function (req, res) {
    const { code } = req.query || {};
    const listUrlMensajeria = [        
        {
            code:1,
            servicio: 'Restobar',
            url: 'https://app.restobar.papaya.com.pe' //'http://192.168.1.47:5819' // #TODO: url socket restobar 'https://app.restobar.papaya.com.pe';            
        },
        {
            code: 2,
            servicio: 'Print Server',
            url: 'http://localhost:5819' // #TODO: url socket restobar 'https://app.restobar.papaya.com.pe';            
        },
        // {
        //     servicio: 'Cobranza',
        //     url: 'http://localhost:3001' // #TODO: url socket cobranza
        // }
    ]

    if (code !== undefined && code !== null && String(code).trim() !== '') {
        const codeNumber = Number(code);

        if (Number.isNaN(codeNumber)) {
            return ReS(res, { success: true, list: [] });
        }

        const filteredList = listUrlMensajeria.filter((x) => Number(x.code) === codeNumber);
        return ReS(res, { success: true, list: filteredList });
    }

    return ReS(res, { success: true, list: listUrlMensajeria });
}
module.exports.getLitsUrlMensajeria = getLitsUrlMensajeria;
