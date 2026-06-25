const express = require('express');
const routerConfig = express.Router();
const Config = require('../models/Config');
const isAdmin = require('../middleware/isAdmin');

// Configuración por defecto en caso de no existir
const defaultProps = {
    precios: {
        1: 35000,
        2: 40000,
        3: 45000,
        4: 50000,
        5: 55000
    },
    descuento: 0.1
};

// Obtener precios
routerConfig.get('/config/precios', async (req, res) => {
    try {
        let config = await Config.findOne({});
        if (!config) {
            config = new Config(defaultProps);
            await config.save();
        }
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener la configuración de precios', error });
    }
});

// Actualizar precios y descuentos (sólo administradores)
routerConfig.put('/config/precios', isAdmin, async (req, res) => {
    try {
        const { precios, descuento } = req.body;
        
        let config = await Config.findOne({});
        if (!config) {
            config = new Config({ precios, descuento });
        } else {
            config.precios = precios;
            config.descuento = descuento;
        }

        await config.save();
        res.status(200).json({ msg: 'Configuración actualizada exitosamente', config });
    } catch (error) {
        res.status(500).json({ msg: 'Error al actualizar la configuración de precios', error });
    }
});

module.exports = routerConfig;
