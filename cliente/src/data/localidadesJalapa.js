export const LOCALIDADES_JALAPA_BASE = [
  { nombre: 'Aldea Sansirisay', tipo: 'aldea' },
  { nombre: 'Sashico', tipo: 'aldea' }
];

export const normalizarLocalidadesJalapa = (extras = []) => {
  const mapa = new Map();

  [...LOCALIDADES_JALAPA_BASE, ...extras].forEach((item) => {
    const nombre = (item?.nombre || item?.nombre_comunidad || '').trim();
    if (!nombre) return;

    const tipo = (item?.tipo || '').trim().toLowerCase();
    const llave = nombre.toLowerCase();

    if (!mapa.has(llave)) {
      mapa.set(llave, {
        nombre,
        tipo
      });
    }
  });

  return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
};
