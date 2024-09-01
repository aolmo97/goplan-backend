const express = require('express');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/auth');
const app = express();
app.use(express.json());

connectDB();

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('API de GoPlan funcionando');
});

// Usar rutas
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
