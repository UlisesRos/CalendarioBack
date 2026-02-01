const PRECIOS = {
    1: 35000,
    2: 40000,
    3: 45000,
    4: 50000,
    5: 55000,
};

const DESCUENTO = 0.1; // 10% de descuento

const calcularPrecio = (diasEntrenamiento, aplicaDescuento) => {
    const precioBase = PRECIOS[diasEntrenamiento] || 0;
    return aplicaDescuento ? precioBase - precioBase * DESCUENTO : precioBase;
};

module.exports = { PRECIOS, DESCUENTO, calcularPrecio };
