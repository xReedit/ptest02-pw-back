const { to, ReE, ReS }  = require('../service/uitl.service');
const {repartidorCollection, addDoc, setDoc, doc, updateDoc, getDoc} = require('../firebase_config');

// add repartidor
const addRepartidor = async function (req, res) {
    const repartidorData = req.body;
    console.log('data', repartidorData);    
    try {
        const repartidorDoc = doc(repartidorCollection, String(repartidorData.userid));
        await setDoc(repartidorDoc, repartidorData);
        console.log('Documento escrito con ID:', repartidorData.userid);
        res.status(200).send('Documento añadido correctamente');
    } catch (error) {
        console.error('Error añadido documento:', error);
        console.error('Error añadiendo documento:', error);
    }    
}
module.exports.addRepartidor = addRepartidor;

// Actualizar campos en repartidor
const updateRepartidor = async function (req, res) {
    const { userid, ...dataToUpdate } = req.body;
    try {
        const repartidorDoc = doc(repartidorCollection, String(userid));        
        await updateDoc(repartidorDoc, dataToUpdate);

        console.log('Documento actualizado con ID:', userid);
        res.status(200).send('Documento actualizado correctamente');
    } catch (error) {
        console.error('Error actualizando documento:', error);
        res.status(500).send('Error actualizando documento');
    }    
}
module.exports.updateRepartidor = updateRepartidor;

const updateIdPedidosRepartidor = async function (req, res) {
    const { userid, idpedidos } = req.body;
    try {
        const repartidorDoc = doc(repartidorCollection, String(userid));
        const repartidorSnap = await getDoc(repartidorDoc);

        if (repartidorSnap.exists()) {
            const repartidorData = repartidorSnap.data();
            const updatedIdpedidos = repartidorData.idpedidos
                ? repartidorData.idpedidos !==  idpedidos ? `${repartidorData.idpedidos},${idpedidos}` : repartidorData.idpedidos
                : idpedidos;

            await updateDoc(repartidorDoc, { idpedidos: updatedIdpedidos });
            console.log('Documento actualizado con ID:', userid);
            res.status(200).send('Documento actualizado correctamente');
        } else {
            console.log('No existe el documento');
            res.status(404).send('No existe el documento');
        }
    } catch (error) {
        console.error('Error actualizando documento:', error);
        res.status(500).send('Error actualizando documento');
    }
}
module.exports.updateIdPedidosRepartidor = updateIdPedidosRepartidor;

// updata campo show_pedido
const updateShowPedido = async function (userid, show_pedido, idpedidos='') {
    // const { userid, show_pedido } = req.body;
    dataToUpdate = {
        userid: userid,        
        show_pedido: show_pedido,
        idpedidos: idpedidos
    }

    try {
        const repartidorDoc = doc(repartidorCollection, String(userid));        
        await updateDoc(repartidorDoc, dataToUpdate);

        console.log('Documento actualizado con ID:', userid);
        res.status(200).send('Documento actualizado correctamente');
    } catch (error) {
        console.error('Error actualizando documento:', error);
        res.status(500).send('Error actualizando documento');
    }
}
module.exports.updateShowPedido = updateShowPedido;