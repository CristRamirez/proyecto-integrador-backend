// Punto de entrada para Cloudflare Workers.
// Es la misma app de Express que usa src/server.js, pero en lugar de quedar
// escuchando un puerto real, httpServerHandler la conecta al fetch del Worker.
import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import crearApp from './app.js';
import d1 from './db/d1.js';

const PUERTO = 3000;

// Acá la base no se consulta por HTTP: entra directo por el binding DB.
d1.configurarBinding(env.DB);

crearApp().listen(PUERTO);

export default httpServerHandler({ port: PUERTO });
