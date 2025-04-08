
const fechaService = require('./fecha');
const sequelize = require('sequelize');
const Op = sequelize.Op;

let filter = {
    getFilters: (filtros) => {
        // traduce los operadores ej: categoria/filterBy/estado=0-y-idsede=1-o-idorg=0
        let rpt = filtros.replace(/~y~/g, ' and ');
        rpt = rpt.replace(/~o~/g, ' or ');

        rpt = rpt.replace(/:contains:/g, ' like ');
        rpt = rpt.replace(/!/g, '%'); // para like
        rpt = rpt.replace(/:eq:/g, '='); //eq => igual
        return rpt;        
    },
    getOrder: (orden, direccion) => {
        const orderDireccion = direccion === '' ? 'ASC' : direccion || 'ASC';
        return ` ORDER BY ${orden} ${orderDireccion.toUpperCase()}`;
    },
    getOrderModel: (orden, direccion) => {        
        const orderDireccion = direccion === '' ? 'ASC' : direccion || 'ASC';
        orden = orden.indexOf('.') >= 0 ? sequelize.col(orden) : orden;
        return [[orden, orderDireccion.toUpperCase()]];        
    },
    getFiltersModel: (filtros) =>{
        let arrfilter = filtros.split('~'); // alt ñ(~)
        let arrRpt = {};

        let logic = null;

        arrfilter.map(x => {
            const partCol = x.split(':');
            const nomCol = partCol[0].indexOf('.') >= 0 ? `$${partCol[0]}$` : partCol[0];
            const operadorCol = partCol[1];
            const valCol = partCol[2];

            console.log('nomCol ', nomCol);

            console.log('partCol.length: ', partCol.length);

            if ( partCol.length > 1) {            

                // valor con operador
                let _valCol;
                switch (operadorCol) {
                    case "eq": _valCol = valCol; break;
                    case "gt": _valCol = { [Op.gt]: valCol}; break;
                    case "contains":                        

                    // para utilizar like(contains) se concatena
                    // el formato es: `producto_detalle->producto`.`descripcion`,`producto_detalle`.`codigobarra`:contains:1165

                        let cols = nomCol.split(',');
                        let cols_s=[];
                        let where;
                        
                        
                        if (cols.length > 1) { 
                            
                            cols.map((x,i) => {
                                _nomCol = x.replace('$', '');                                                                
                                cols_s[i] = _nomCol;                             
                            });

                            let args = Array.from(cols_s);
                            args = args.map((arg) => sequelize.literal(arg));
                            args.unshift("concat");

                            args = sequelize.fn.apply(sequelize, args);

                            where = sequelize.where(args, {
                                [Op.like]: '%' + valCol + '%'
                            });

                            _valCol = where;                                              
                        }
                    break;                    
                }

                // logic
                switch (logic) {
                    case 'y': arrRpt[nomCol] = _valCol; break;
                    case 'o': arrRpt[nomCol] = arrRpt[nomCol] ? arrRpt[nomCol] + ',' + _valCol : [_valCol]; break;
                    default: arrRpt[nomCol] = _valCol; break;
                }

            } else {
                // evaluar operador
                logic = x;                
            }
        })

        console.log('filtros :', arrRpt);

        return arrRpt;
    },

    getInfoToken: (req, key) => {        
        // obtiene los valores del token segun key: idorg=idorg => val a buscar idorg        
        console.log('req.usuariotoken', req.usuariotoken);
        return req.usuariotoken[key] || null;
    },
    
    getFecha: (key, val) => {
        var rpt = val;
        switch (key) {
            case 'fecha':
                rpt = fechaService.getFechaActual();
                break;
            case 'hora':
                rpt = fechaService.getHoraActual();
                break;            
        }

        return rpt
    }
}

module.exports = filter;

