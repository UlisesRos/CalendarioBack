const PRECIOS = {
    1: 32500,
    2: 37500,
    3: 42500,
    4: 47500,
    5: 52500,
};

const DESCUENTO = 0.1; // 10% de descuento

const calcularPrecio = (diasEntrenamiento, aplicaDescuento) => {
    const precioBase = PRECIOS[diasEntrenamiento] || 0;
    return aplicaDescuento ? precioBase - precioBase * DESCUENTO : precioBase;
};

module.exports = { PRECIOS, DESCUENTO, calcularPrecio };
