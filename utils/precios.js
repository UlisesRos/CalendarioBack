const PRECIOS = {
    1: 30000,
    2: 35000,
    3: 40000,
    4: 45000,
    5: 50000,
};

const DESCUENTO = 0.1; // 10% de descuento

const calcularPrecio = (diasEntrenamiento, aplicaDescuento) => {
    const precioBase = PRECIOS[diasEntrenamiento] || 0;
    return aplicaDescuento ? precioBase - precioBase * DESCUENTO : precioBase;
};

module.exports = { PRECIOS, DESCUENTO, calcularPrecio };
