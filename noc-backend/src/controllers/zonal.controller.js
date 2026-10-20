import { Link } from '../models/Link.js';
import { Zonal } from '../models/Zonal.js';
import { emitToNoc } from '../sockets/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

const filtroPorId = (id) => (esObjectId(id) ? { _id: id } : { clave: String(id).toUpperCase() });
const avisar = (u) => emitToNoc('zonal:changed', { por: { id: u.id, nombre: u.nombre, rol: u.rol }, ts: new Date().toISOString() });

async function buscarOr404(id) {
  const zonal = await Zonal.findOne(filtroPorId(id));
  if (!zonal) throw new AppError(404, `Zonal no encontrada: ${id}`);
  return zonal;
}

export const listar = asyncHandler(async (_req, res) => {
  const [zonales, usos] = await Promise.all([
    Zonal.find().collation({ locale: 'es' }).sort({ nombre: 1 }).lean(),
    // nº de ENLACES distintos con algún tramo en cada zonal
    Link.aggregate([
      { $unwind: '$tramos' },
      { $group: { _id: { z: '$tramos.zonal', l: '$_id' } } },
      { $group: { _id: '$_id.z', n: { $sum: 1 } } },
    ]),
  ]);
  const enUso = new Map(usos.map((u) => [String(u._id), u.n]));
  res.json({ ok: true, data: zonales.map((z) => ({ ...z, enlaces: enUso.get(String(z._id)) ?? 0 })) });
});

export const crear = asyncHandler(async (req, res) => {
  const zonal = await Zonal.create(req.body);
  avisar(req.user);
  res.status(201).json({ ok: true, data: zonal });
});

export const actualizar = asyncHandler(async (req, res) => {
  const zonal = await buscarOr404(req.params.id);
  Object.assign(zonal, req.body);
  await zonal.save();
  avisar(req.user);
  res.json({ ok: true, data: zonal });
});

export const eliminar = asyncHandler(async (req, res) => {
  const zonal = await buscarOr404(req.params.id);
  const enlaces = await Link.countDocuments({ 'tramos.zonal': zonal._id });
  if (enlaces) throw new AppError(409, `No se puede eliminar: ${enlaces} enlace(s) tienen tramos en esta zonal. Reasígnelos o desactive la zonal.`);
  await zonal.deleteOne();
  avisar(req.user);
  res.json({ ok: true, data: { id: zonal.id, clave: zonal.clave } });
});
