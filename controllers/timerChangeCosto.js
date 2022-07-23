// 260521
// cambia automaticamente el costo de entrega segun hora y dia
const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const timeRefesh = 30000;
let listProgramacionPlaza = [];
let intervalComand;

const runTimerCosto = async function () {

  const read_query = `SELECT * from sede_config_service_delivery where estado = 0`;
  const _list = await emitirRespuesta(read_query); 
  listProgramacionPlaza = _list;
  console.log('lista de configuracion de plazas horarios', _list);

  if ( !intervalComand ) { clearInterval(intervalComand); }

    intervalComand = setInterval(() => {
      comandListChangeCosto();
    }, timeRefesh);
}
module.exports.runTimerCosto = runTimerCosto;

const setChangeCosto = function (_listProgramacionPlaza) {		
	listProgramacionPlaza = _listProgramacionPlaza;
  comandListChangeCosto();	
}
module.exports.setChangeCosto = setChangeCosto;


function comandListChangeCosto() {
	console.log('========== ejecutamos comandListChangeCosto comandListChangeCosto');
    const _date = new Date();
    const _dayNow = _date.getDay();
    const _hourNow = _date.getHours();
    let _hourComand = 0;
    let costoChange = 0;

    listProgramacionPlaza.map(p => {
      const _dayLastChange = p.dia_cambios;
      const _costoNow  = p.c_minimo;

      if ( p.comand_costo ) {
         // verifica dia
         p.comand_costo.map(c => {

           const comand_costo = c;
           const _dayComand = comand_costo.dia.num;

           _hourComand = parseInt(comand_costo.hora, 0);

           // si es -1 es todos los dias
           if ( _dayComand === -1 || _dayComand === _dayNow ) {

              // pasamos a verifcicar la hora de
              if ( _hourNow >= _hourComand ) {
                // si el costo actual es mayor no cambiamos
                costoChange = _costoNow >= comand_costo.costo ? 0 : comand_costo.costo;
                costoChange = _dayLastChange < _dayNow ? comand_costo.costo : costoChange;

              }
           }

        });

        console.log('========== cambiamos costo', costoChange)
        console.log('========== cambiamos _dayNow', _dayNow)
        if (costoChange !== 0 && p.isChangeHours !== _hourComand) {
          p.c_minimo = costoChange;
          p.isChangeHours = _hourComand;
          guardarCambiosChangeCosto(p);
        }

      }
    });
  }

 function guardarCambiosChangeCosto(plazaSelected) {
  	const read_query = `update sede_config_service_delivery set c_minimo = ${plazaSelected.c_minimo} where idsede_config_service_delivery = ${plazaSelected.idsede_config_service_delivery}`;
    emitirRespuesta(read_query);  
  }


function emitirRespuesta(xquery) {
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