module.exports = {
    testEnvironment: 'node', // Usa el entorno de Node.js para las pruebas;
    collectCoverage: true, // Habilita la recolección de cobertura de código;
    coverageDirectory: 'coverage', // Carpeta donde se almacenará la cobertura;
    coverageReporters: ['text-summary', 'lcov', 'html'], // Genera reportes de cobertura en texto, lcov y HTML
    collectCoverageFrom: [
      'src/**/*.js', // Cubre todos los archivos JavaScript en la carpeta src
      '!src/**/index.js', // Excluye archivos específicos como `index.js` si no quieres cubrirlos
    ],
    testPathIgnorePatterns: [
      '/node_modules/', // Ignora la carpeta node_modules
      '/dist/', // Ignora la carpeta dist si tienes un proceso de construcción
    ],
  };
  