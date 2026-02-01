## 🎯 Sistema de Pagos Mercado Pago - Guía Rápida

### ✅ Implementación Completada

El sistema de pagos con Mercado Pago está totalmente integrado y listo para usar. Aquí está cómo funciona:

---

## 📋 Flujo de Pago Completo

```
1. Usuario hace click en "Ir a Pagar"
        ↓
2. Frontend envía: dias, nombre, apellido, userId
        ↓
3. Backend calcula el monto: calcularPrecio(dias, descuento)
        ↓
4. Backend crea preferencia en Mercado Pago
        ↓
5. Redirige a Mercado Pago Checkout
        ↓
6. Usuario paga (tarjeta/transferencia/wallet)
        ↓
7. Mercado Pago aprueba el pago
        ↓
8. [WEBHOOK] MP notifica al backend
        ↓
9. Backend registra pago en BD:
   - usuario.pago = true
   - usuario.fechaPago = "fecha"
   - Agrega al historialPagos
        ↓
10. Frontend ve "PAGADO" ✅ en verde
```

---

## 🔧 Configuración Necesaria

### 1. Variables de Entorno (.env)

```dotenv
# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx...

# Frontend URL (para URLs de retorno)
FRONTEND_URL=https://calendario-fuerza-integral.vercel.app
```

### 2. Configurar Webhook en Mercado Pago

1. Ir a: https://www.mercadopago.com.ar/developers/es/dashboard
2. Seleccionar tu aplicación
3. Ir a "Configuración" → "Webhooks"
4. Agregar URL: `https://tu-backend.com/api/payments/webhook`
5. Seleccionar eventos: `payment`

---

## 🚀 APIs Disponibles

### 1. Crear Preferencia de Pago
```
POST /api/payments/create_preference
Headers: Authorization: Bearer {token}
Body: {
  name: "Juan",
  lastname: "Pérez",
  days: 3,
  descuento: false,
  userId: "65abc123..."
}
Response: {
  id: "...",
  init_point: "https://www.mercadopago.com.ar/checkout/..."
}
```

### 2. Registrar Pago (después de retorno)
```
POST /api/payments/registrarpago
Headers: Authorization: Bearer {token}
Body: {
  userId: "65abc123...",
  monto: 45000,
  metodo: "MP"
}
```

### 3. Webhook de Mercado Pago (automático)
```
POST /api/payments/webhook
Body enviado por Mercado Pago con:
- type: "payment"
- action: "payment.approved"
- data.id: payment_id
```

---

## 🔄 Características Implementadas

✅ **Seguridad:**
- Token en `.env` (no hardcodeado)
- Autenticación con JWT en rutas sensibles
- Webhook protegido contra duplicados (idempotencia)
- Validación de estructura en webhooks

✅ **Confiabilidad:**
- MongoDB transactions para registrar pagos
- Evita procesar el mismo pago 2 veces
- Validación de datos en backend y frontend
- Manejo robusto de errores

✅ **UX:**
- Página de éxito mejorada con feedback
- Indicadores visuales del estado de pago
- Iconos y colores para mejor comprensión
- Timeout de 10 segundos en peticiones

✅ **Automatización:**
- CRON JOB: Reset automático el 1ro de mes (pago=false)
- Recordatorio de pago el 11 de cada mes
- Historial de pagos guardado

---

## 📊 Precios Configurables

En `CalendarioBack/utils/precios.js`:

```javascript
const PRECIOS = {
  1: 35000,  // 1 día
  2: 40000,  // 2 días
  3: 45000,  // 3 días
  4: 50000,  // 4 días
  5: 55000,  // 5 días
};

const DESCUENTO = 0.1; // 10%
```

Edita estos valores según tus tarifas.

---

## 🔍 Debugging

### Ver logs de backend:
```bash
# Ver qué está pasando con los pagos
tail -f nombre-log.log | grep "Pago\|Webhook\|Pagado"
```

### Probar webhook manualmente:
```bash
curl -X POST http://localhost:8080/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "action": "payment.approved",
    "data": {"id": "123456"}
  }'
```

---

## ⚠️ Importante para PRODUCCIÓN

Antes de deployar:

1. ✅ Cambiar FRONTEND_URL a tu dominio real
2. ✅ Configurar el webhook en Mercado Pago Dashboard
3. ✅ Verificar que las URLs de retorno funcionan
4. ✅ Revisar que MERCADOPAGO_ACCESS_TOKEN sea correcta
5. ✅ Hacer pagos de prueba en sandbox
6. ✅ Verificar emails de confirmación

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| "Token no válido" | Verificar JWT_SECRET en .env |
| Webhook no llega | Configurar URL en MP Dashboard |
| Pago no se registra | Revisar logs de registrarPago() |
| "Usuario no encontrado" | Validar que userId sea correcto |
| Duplicado de pagos | Sistema de idempotencia activo |

---

## 📞 Soporte

Para problemas con Mercado Pago:
- Docs: https://www.mercadopago.com.ar/developers/es/docs
- Forum: https://www.mercadopago.com.ar/developers/es/community
