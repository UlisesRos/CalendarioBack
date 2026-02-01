const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors')
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRouter')
const { initializeCalendar, router } = require('./routes/calendar');
const { routerAdm, initializeAdminCalendar } = require('./routes/adminCalendar');
const ingresoRouter = require('./routes/ingresoRouter')
const historialMensualRouter = require('./routes/historialMensualRouter')
const nutricionRouter = require('./routes/nutricionRouter');    
const { ReinicioMensual, ReinicioHistorialMensual, enviarRecordatorioPagoMensual, recordatorioTurnoNutricion } = require('./utils/cronJobs')
dotenv.config()

const app = express()
const server = http.createServer(app)
const io = socketIo(server)
app.use(cors({
    origin: [
        //'https://calendario-fuerza-integral.vercel.app',          // Para producción
        'http://localhost:3000'                           // Para desarrollo local
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],             // Métodos permitidos
    credentials: true                                      // Para enviar cookies si es necesario
}));

// Ejecutando funcion el reinicio mensual
ReinicioMensual()
// Ejecutando funcion reinicio historial menusal
ReinicioHistorialMensual()
// Ejecutando funcion enviar recordatorio de pago
enviarRecordatorioPagoMensual()
// Ejecutando funcion para enviar recordatorio de nutricion
recordatorioTurnoNutricion()

app.use(express.json());

// Conectamos a MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(async () => {
    console.log('MongoDB conectado')

    await initializeCalendar();
    await initializeAdminCalendar();
})
.catch((error) => console.error(error));

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');

    socket.on('disconnect', () => {
        console.log('Cliente desconectado')
    })
})

app.use((req, res, next) => {
    req.io = io;
    next();
})

// Ruta de Login y Register
app.use('/api/auth', authRoutes);

// Usar las rutas del calendario
app.use(router);
app.use(routerAdm)

// Ruta de pagos
app.use('/api/payments', paymentRoutes)

// Ruta de ingreso
app.use('/api', ingresoRouter)

// Ruta de historial mensual
app.use('/api', historialMensualRouter);

// Ruta de nutrición
app.use('/api/nutricion', nutricionRouter);

// Ruta para verificar si el servidor esta en funcionamiento
app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente.')
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`)
})