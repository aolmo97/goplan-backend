require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB conectado con éxito');
  } catch (err) {
    console.error('Error al conectar con MongoDB:', err.message);
    process.exit(1); // Salir del proceso si hay un error
  }
};

module.exports = connectDB;
