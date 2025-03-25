const PRECIOS = {
    1: 25000,
    2: 30000,
    3: 35000,
    4: 40000,
    5: 45000,
};

const DESCUENTO = 0.1; // 10% de descuento

const calcularPrecio = (diasEntrenamiento, aplicaDescuento) => {
    const precioBase = PRECIOS[diasEntrenamiento] || 0;
    return aplicaDescuento ? precioBase - precioBase * DESCUENTO : precioBase;
};

module.exports = { PRECIOS, DESCUENTO, calcularPrecio };
