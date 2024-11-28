import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno antes de importar app
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
