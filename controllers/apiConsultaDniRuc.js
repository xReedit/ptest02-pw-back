
const { to, ReE, ReS }  = require('../service/uitl.service');
const sendMsjsService = require('./sendMsj.js')
let Sequelize = require('sequelize');
let config = require('../config');
const fetch = require("node-fetch");
let managerFilter = require('../utilitarios/filters');
const url_service = 'https://restobar.papaya.com.pe/consulta/';

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};


// consulta dni o ruc del cliente si no encuentra en la bd lo busca en el servicio
const getConsultaDatosCliente = async function (req, res) {
	const idorg = managerFilter.getInfoToken(req,'idorg');	
    const doc = req.body.documento;
    // const idorg = req.body.idorg;
    const servicio = req.body.servicio; // dni o ruc

    // console.log('cuenta de mesa: ', mesa);
	const read_query = `SELECT * FROM cliente where (estado=0 and ruc='${doc}') limit 1`;
    const response = await emitirRespuesta(read_query);

    console.log('response dni', response);
    console.log('response dni length', response.length);


    if ( response.length === 0 ) {    	
    	xGetFindDniRuc(doc, servicio, (response) => {
    		console.log('desde api consulta', response);
    		return ReS(res, {
				data: response
			});
    	})
    } else {
    	return ReS(res, {
				data: response[0]
			});
    }    
    // return response;
}
module.exports.getConsultaDatosCliente = getConsultaDatosCliente;

const setGuardarClienteNuevo = function (req, res) {	
    const idorg = managerFilter.getInfoToken(req,'idorg');
    const dataCliente = req.body.cliente;    
    
    const read_query = `call procedure_pwa_guardar_nuevo_cliente(${idorg}, '${JSON.stringify(dataCliente)}');`;	
    emitirRespuestaSP_RES(read_query, res);

}
module.exports.setGuardarClienteNuevo = setGuardarClienteNuevo;


function emitirRespuesta(xquery, res) {
	console.log(xquery);
	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
	.then(function (rows) {
		
		// return ReS(res, {
		// 	data: rows
		// });
		return rows;
	})
	.catch((err) => {
		return false;
	});
}

function emitirRespuestaSP_RES(xquery, res) {
	console.log(xquery);
	sequelize.query(xquery, {		
		type: sequelize.QueryTypes.SELECT
	})
	.then(function (rows) {

		// convertimos en array ya que viene en object
		var arr = [];
		arr = Object.values(rows[0]) ;
		
		return ReS(res, {
			data: arr
		});
	})
	.catch((err) => {
		return ReE(res, err);
	});
}



// servicio de consulta

async function xGetFindDniRuc(valor, servicio, callback) {
	var esFacturacionElectronica=false;
	var rpt = [];
	var token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.BX0t4nmgikjpVjZUTSJaj06R3i2Wn-dRwlAMntb_drI";
	var label_num = servicio === "dni" ? "ndni" : "ruc"; 
	var _url_servicio;
	servicio = servicio.toLowerCase();
				
						
				xValidarToken(token, (t)=> {

					_url_servicio = url_service+servicio+"/api/service.php?"+label_num+"="+valor+"&token="+token;

					console.log('url', _url_servicio);
								
					var nombres='', direccion='', telefono='';
					var num_doc = valor;
					var fnacimiento = '';

					fetch(_url_servicio, {
				        method: 'POST',        
				    }).then(function (response) {
				        return response.json();
				    }).then(function (dt) { 
				    	// console.log(dt);						

						if (dt.success && dt.haydatos) {			
							if (servicio === 'ruc') {
								nombres = dt.result.RazonSocial;
								direccion = dt.result.Direccion;
							} else {
								
								const ap_paterno = dt.result.ApellidoPaterno || '';
								const ap_materno = dt.result.ApellidoMaterno || '';
								const apellidos = ap_paterno === '' ? dt.result.apellidos || '' : ap_paterno + ' ' + ap_materno;
								nombres = dt.result.Nombres + " " + apellidos;
								nombres = nombres===' '? '' : nombres;
								direccion = '';								
								fnacimiento = dt.result.FechaNacimiento || '';
							}
						} else {
							if (!esFacturacionElectronica) { // si no esta habilitado para facturacion electronica 
								rpt = {success: true, idcliente:'', nombres:'', direccion:'',num_doc:num_doc, telefono: telefono, msg: 'ok'};
								// responde(rpt); return;
								// return rpt;
								callback(rpt);
							}
						}

						rpt = { success: dt.haydatos, idcliente: "", nombres: nombres, direccion: direccion, num_doc: num_doc, f_nac: fnacimiento, telefono: telefono, msg: dt.msg };

						// responde(rpt);
						callback(rpt);
				    }).catch(async function (error) {
				    	rpt = { success: false, idcliente: "", nombres: "", direccion: "", f_nac: "", num_doc: num_doc, telefono: "", msg: "Problemas de conexion. intente nuevamente en un momento." };
						// responde(rpt); return;
						// return rpt;
						callback(rpt);
				    });


				});
			// }
		// });
		// });
	// });
}

//1
function xValidarToken(token, callback) {
	var _token = token;
	var _url_servicio = url_service+"dni/api/validar.php?token=" + _token;

	fetch(_url_servicio, {
        method: 'POST',        
    }).then(function (response) {
        return response.json();
    }).then(function (res) { 
    	if (!ValRpt.success) {
			xRefreshToken((t)=>{
				_token = t;
				callback(_token);
			});
		} else {
			callback(_token);
		}
    }).catch(async function (error) {
    	callback("error");
    });

}

//*2
function xRefreshToken(callback) {	
	var token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.BX0t4nmgikjpVjZUTSJaj06R3i2Wn-dRwlAMntb_drI";
	callback(token);
}





