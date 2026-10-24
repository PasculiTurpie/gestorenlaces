/**
 * Levanta un NCE SIMULADO para probar la conexión sin un NCE real.
 *   npm run nce:simulador            (puerto 4600)
 *   NCE_SIM_PUERTO=4700 npm run nce:simulador
 * Luego, en el .env del backend:
 *   NCE_ENABLED=true  NCE_BASE_URL=http://127.0.0.1:4600  NCE_USERNAME=integracion  NCE_PASSWORD=cambiar-esta-clave
 * y reinicie el backend. En Administración → Integración NCE pulse «Probar conexión».
 */
import { crearSimuladorNCE } from '../src/integraciones/nce/simulador.js';

const sim = crearSimuladorNCE({ usuario: process.env.NCE_SIM_USUARIO ?? 'integracion', clave: process.env.NCE_SIM_CLAVE ?? 'cambiar-esta-clave' });
await sim.iniciar(Number(process.env.NCE_SIM_PUERTO ?? 4600));
console.log(`NCE simulado escuchando en ${sim.url}  (usuario: ${sim.usuario} · clave: ${sim.clave})`);
console.log(`  ${sim.alarmas.length} alarmas de ejemplo. Agregar una:  curl -X POST ${sim.url}/_sim/alarmas -d '{"alarmId":2001,"alarmName":"R_LOS","severity":"Critical","neName":"VLDV-DWDM-01","location":"Slot 3/Port 1","occurTime":${Date.now()}}'`);
console.log(`  Limpiar la 1001:                curl -X DELETE ${sim.url}/_sim/alarmas/1001`);
