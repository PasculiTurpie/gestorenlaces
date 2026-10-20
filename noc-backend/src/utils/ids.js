// mongoose.isValidObjectId() acepta cualquier string de 12 caracteres, lo que confundiría
// a un id_nodo/id_enlace con un ObjectId. Aquí exigimos 24 hex exactos.
export const esObjectId = (value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
