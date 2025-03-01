const PRECIOS = {
    1: 22000,
    2: 25000,
    3: 30000,
    4: 35000,
    5: 39000,
};

const DESCUENTO = 0.1; // 10% de descuento

const calcularPrecio = (diasEntrenamiento, aplicaDescuento) => {
    const precioBase = PRECIOS[diasEntrenamiento] || 0;
    return aplicaDescuento ? precioBase - precioBase * DESCUENTO : precioBase;
};

module.exports = { PRECIOS, DESCUENTO, calcularPrecio };
