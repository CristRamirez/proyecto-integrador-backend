// Punto de entrada para Cloudflare Workers.
// Es la misma app de Express que usa src/server.js, pero en lugar de quedar
// escuchando un puerto real, httpServerHandler la conecta al fetch del Worker.
import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import crearApp from './app.js';
import d1 from './db/d1.js';
import cuotas from './services/cuotas.service.js';
import auditoria from './services/auditoria.service.js';

const PUERTO = 3000;

// Acá la base no se consulta por HTTP: entra directo por el binding DB.
d1.configurarBinding(env.DB);

crearApp().listen(PUERTO);

const servidor = httpServerHandler({ port: PUERTO });

// Además de atender los pedidos, el Worker corre el cron de wrangler.jsonc:
// una vez por día aplica el interés a las cuotas que entraron en mora (BS-11),
// así no depende de que alguien lo haga a mano. Queda en la auditoría sin
// usuario (lo hizo el sistema), y solo si alguna cuota entró en mora.
async function moraDiaria() {
  const enMora = await cuotas.aplicarMora();

  if (enMora.length) {
    await auditoria.registrar(null, auditoria.ACCIONES.MORA, 'cuotas', null, {
      automatica: true,
      aplicadas: enMora.length,
      cuotas: enMora.map((cuota) => cuota.id),
    });
  }
}

export default {
  ...servidor,
  async scheduled(evento, entorno, contexto) {
    contexto.waitUntil(moraDiaria());
  },
};
