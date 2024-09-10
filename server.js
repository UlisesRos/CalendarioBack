const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors')
const dotenv = require('dotenv');
const { initializeCalendar, router } = require('./routes/calendar');
const { routerAdm, initializeAdminCalendar } = require('./routes/adminCalendar');
dotenv.config()

const app = express()
const server = http.createServer(app)
const io = socketIo(server)
app.use(cors({
    origin: [
        'https://calendario-fuerza-integral.vercel.app',  // URL de producción en Vercel
        'http://localhost:3000'                           // Para desarrollo local
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],             // Métodos permitidos
    credentials: true                                      // Para enviar cookies si es necesario
}));

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

// Ruta para verificar si el servidor esta en funcionamiento
app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente.')
});

// Usar las rutas del calendario
app.use(router);
app.use(routerAdm)

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`)
})