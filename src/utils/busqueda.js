const { sql } = require('drizzle-orm');

// SQLite no tiene una función para sacar acentos y su lower() solo pasa a
// minúscula las letras sin acento, así que se arma con replace(). La ñ también
// se iguala a la n: así "nunez" encuentra a Núñez aunque se escriba sin ñ. Las letras
// van escritas en el SQL (sql.raw) y no como parámetros, porque D1 acepta
// hasta 100 parámetros por consulta y acá serían más de diez por columna.
const ACENTOS = [
  ['á', 'a'], ['é', 'e'], ['í', 'i'], ['ó', 'o'], ['ú', 'u'], ['ü', 'u'],
  ['Á', 'a'], ['É', 'e'], ['Í', 'i'], ['Ó', 'o'], ['Ú', 'u'], ['Ü', 'u'],
  ['ñ', 'n'], ['Ñ', 'n'],
];

function sinAcentos(columna) {
  return ACENTOS.reduce(
    (expresion, [con, sin]) => sql`replace(${expresion}, ${sql.raw(`'${con}'`)}, ${sql.raw(`'${sin}'`)})`,
    sql`lower(${columna})`
  );
}

// El texto buscado se normaliza igual que las columnas, del lado de JS.
function normalizar(texto) {
  return ACENTOS.reduce((resultado, [con, sin]) => resultado.split(con).join(sin), texto.toLowerCase());
}

// % y _ son comodines de LIKE: si vienen en lo buscado se escapan para que
// se busquen tal cual.
function contiene(columna, palabra) {
  const patron = `%${normalizar(palabra).replace(/[\\%_]/g, '\\$&')}%`;

  return sql`${sinAcentos(columna)} LIKE ${patron} ESCAPE '\\'`;
}

module.exports = { sinAcentos, normalizar, contiene };
