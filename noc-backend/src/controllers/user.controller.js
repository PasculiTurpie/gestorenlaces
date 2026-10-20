import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

async function buscarOr404(id) {
  if (!esObjectId(id)) throw new AppError(400, 'Id de usuario inválido');
  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'Usuario no encontrado');
  return user;
}

export const listar = asyncHandler(async (_req, res) => {
  const data = await User.find().collation({ locale: 'es' }).sort({ nombre: 1 }).select('-__v').lean();
  res.json({ ok: true, data });
});

export const crear = asyncHandler(async (req, res) => {
  const user = await User.create(req.body); // el hook hashea la contraseña
  res.status(201).json({ ok: true, data: user }); // toJSON no incluye password
});

/**
 * Salvaguardas para no dejar el sistema sin administración:
 *  - un Admin no puede desactivarse ni quitarse el rol a sí mismo;
 *  - nunca puede quedar sin ningún Admin activo.
 */
export const actualizar = asyncHandler(async (req, res) => {
  const user = await buscarOr404(req.params.id);
  const { rol, activo } = req.body;

  const dejaDeSerAdminActivo = user.rol === 'Admin' && user.activo && (activo === false || (rol !== undefined && rol !== 'Admin'));
  if (dejaDeSerAdminActivo) {
    if (user._id.equals(req.user._id)) {
      throw new AppError(409, 'No puedes desactivar tu propia cuenta ni quitarte el rol de Admin.');
    }
    const otros = await User.countDocuments({ rol: 'Admin', activo: true, _id: { $ne: user._id } });
    if (otros === 0) throw new AppError(409, 'Debe quedar al menos un Admin activo.');
  }

  Object.assign(user, req.body);
  await user.save();
  res.json({ ok: true, data: user });
});

export const restablecerPassword = asyncHandler(async (req, res) => {
  const user = await buscarOr404(req.params.id);
  user.password = req.body.password;
  await user.save();
  res.json({ ok: true, data: { id: user.id } });
});
