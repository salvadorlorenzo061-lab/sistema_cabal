const DEPARTAMENTOS = [
    { id_departamento: 1, nombre_departamento: 'Jalapa', estado: 'activo' }
];

const MUNICIPIOS = [
    { id_municipio: 1, nombre_municipio: 'Jalapa', estado: 'activo', id_departamento: 1 },
    
];

const listarDepartamentos = () => DEPARTAMENTOS.map((item) => ({ ...item }));
const listarMunicipios = () => MUNICIPIOS.map((item) => ({ ...item }));

const obtenerDepartamentoPorId = (idDepartamento) =>
    DEPARTAMENTOS.find((item) => String(item.id_departamento) === String(idDepartamento)) || null;

const obtenerMunicipioPorId = (idMunicipio) =>
    MUNICIPIOS.find((item) => String(item.id_municipio) === String(idMunicipio)) || null;

module.exports = {
    listarDepartamentos,
    listarMunicipios,
    obtenerDepartamentoPorId,
    obtenerMunicipioPorId
};
