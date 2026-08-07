import { useState, useEffect } from 'react';
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';

const MODULOS = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'usuarios',      label: 'Usuarios' },
  { key: 'bitacora',      label: 'Bitacora' },
  { key: 'municipios',    label: 'Municipios' },
  { key: 'comunidades',   label: 'Aldeas / Caserios' },
  { key: 'departamentos', label: 'Departamentos' },
  { key: 'roles',         label: 'Roles' },
  { key: 'cocode',        label: 'Cocode' },
  { key: 'problemas',     label: 'Problemas' },
];

const parsePermisos = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch (_) { return []; }
};

function Roles() {
  const API_URL = "https://sistema-cabal.onrender.com/api/roles";

  const [id_rol, setId_rol]           = useState("");
  const [nombre_rol, setNombre_rol]   = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado]           = useState("Activo");
  const [permisos, setPermisos]       = useState([]);

  const [rolesList, setRolesList]         = useState([]);
  const [busqueda, setBusqueda]           = useState("");
  const [showRegModal, setShowRegModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const getRoles = () => {
    Axios.get(API_URL)
      .then((res) => setRolesList(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error(err));
  };

  useEffect(() => { getRoles(); }, []);

  const limpiar = () => {
    setId_rol(""); setNombre_rol(""); setDescripcion("");
    setEstado("Activo"); setPermisos([]);
  };

  const togglePermiso = (key) =>
    setPermisos((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const add = () => {
    if (!nombre_rol.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Ingrese el nombre del rol.' });
      return;
    }
    Axios.post(`${API_URL}/crear`, { nombre_rol, descripcion, estado, permisos })
      .then(() => {
        getRoles(); limpiar(); setShowRegModal(false);
        Swal.fire({ icon: 'success', title: 'Rol creado', timer: 2000, showConfirmButton: false });
      })
      .catch((err) => Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data || 'No se pudo crear el rol' }));
  };

  const actualizar = () => {
    if (!id_rol || !nombre_rol.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Ingrese el nombre del rol.' });
      return;
    }
    Axios.put(`${API_URL}/actualizar`, { id_rol, nombre_rol, descripcion, estado, permisos })
      .then(() => {
        getRoles(); limpiar(); setShowEditModal(false);
        Swal.fire({ icon: 'success', title: 'Rol actualizado', timer: 2000, showConfirmButton: false });
      })
      .catch((err) => Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data || 'No se pudo actualizar el rol' }));
  };

  const eliminar = (val) => {
    Swal.fire({
      title: 'Confirmar eliminacion',
      text: `Eliminar el rol "${val.nombre_rol}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;
      Axios.delete(`${API_URL}/delete/${val.id_rol}`)
        .then(() => { getRoles(); Swal.fire({ icon: 'success', title: 'Eliminado', timer: 2000, showConfirmButton: false }); })
        .catch((err) => Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data || 'No se pudo eliminar el rol' }));
    });
  };

  const abrirEditar = (val) => {
    setId_rol(val.id_rol);
    setNombre_rol(val.nombre_rol);
    setDescripcion(val.descripcion || "");
    setEstado(val.estado || "Activo");
    setPermisos(parsePermisos(val.permisos));
    setShowEditModal(true);
  };

  const rolesFiltrados = rolesList.filter((r) =>
    r.nombre_rol?.toLowerCase().includes(busqueda.toLowerCase()) ||
    (r.descripcion || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const checkboxPermisos = (
    <div className="mb-1">
      <label className="form-label fw-bold">Acceso a modulos:</label>
      <div className="border rounded p-3 bg-light">
        <div className="row g-2">
          {MODULOS.map((mod) => (
            <div key={mod.key} className="col-6">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={"perm-" + mod.key}
                  checked={permisos.includes(mod.key)}
                  onChange={() => togglePermiso(mod.key)}
                />
                <label className="form-check-label" htmlFor={"perm-" + mod.key}>
                  {mod.label}
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm"
            onClick={() => setPermisos(MODULOS.map((m) => m.key))}>
            Seleccionar todos
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm"
            onClick={() => setPermisos([])}>
            Quitar todos
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container-fluid mt-3 px-2 px-md-3">

      <div className="row mb-4 align-items-center bg-light p-3 rounded shadow-sm module-toolbar">
        <div className="col-md-4">
          <h3 className="m-0 text-dark fw-bold">GESTION DE ROLES</h3>
          <small className="text-muted">Administra los niveles de acceso del sistema</small>
        </div>
        <div className="col-md-5">
          <div className="input-group">
            <span className="input-group-text bg-primary text-white">&#128269;</span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre o descripcion..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-3 text-end">
          <button className="btn btn-primary fw-bold w-100"
            onClick={() => { limpiar(); setShowRegModal(true); }}>
            + NUEVO ROL
          </button>
        </div>
      </div>

      <div className="table-responsive module-table-wrap">
        <table className="table table-striped table-bordered align-middle shadow-sm module-table-centered">
          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>NOMBRE DEL ROL</th>
              <th>DESCRIPCION</th>
              <th>MODULOS CON ACCESO</th>
              <th>ESTADO</th>
              <th className="text-center">OPERACION</th>
            </tr>
          </thead>
          <tbody>
            {rolesFiltrados.length > 0 ? (
              rolesFiltrados.map((val) => {
                const permsVal = parsePermisos(val.permisos);
                return (
                  <tr key={val.id_rol}>
                    <td className="fw-bold text-muted">#{val.id_rol}</td>
                    <td className="fw-bold">{val.nombre_rol}</td>
                    <td>{val.descripcion || <span className="text-muted fst-italic">Sin descripcion</span>}</td>
                    <td>
                      {permsVal.length > 0
                        ? permsVal.map((p) => {
                            const mod = MODULOS.find((m) => m.key === p);
                            return (
                              <span key={p} className="badge bg-primary me-1 mb-1" style={{ fontSize: '0.7rem' }}>
                                {mod ? mod.label : p}
                              </span>
                            );
                          })
                        : <span className="text-muted fst-italic">Sin accesos</span>}
                    </td>
                    <td>
                      <span className={"badge bg-" + (val.estado === 'Activo' ? 'success' : 'secondary')}>
                        {val.estado}
                      </span>
                    </td>
                    <td className="text-center">
                      <select
                        className="form-select form-select-sm fw-bold bg-light border-secondary module-action-select"
                        defaultValue=""
                        onChange={(e) => {
                          const accion = e.target.value;
                          if (!accion) return;
                          if (accion === 'editar') abrirEditar(val);
                          if (accion === 'eliminar') eliminar(val);
                          e.target.value = "";
                        }}
                      >
                        <option value="" disabled>Acciones</option>
                        <option value="editar">Editar</option>
                        <option value="eliminar">Eliminar</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="text-center text-muted py-3">No se encontraron roles.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showRegModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">Crear Nuevo Rol</h5>
                <button type="button" className="btn-close btn-close-white"
                  onClick={() => { setShowRegModal(false); limpiar(); }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Nombre del Rol:</label>
                  <input type="text" className="form-control" placeholder="Ej: Coordinador Regional"
                    value={nombre_rol} onChange={(e) => setNombre_rol(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Descripcion (opcional):</label>
                  <input type="text" className="form-control" placeholder="Breve descripcion del nivel de acceso"
                    value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Estado:</label>
                  <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
                {checkboxPermisos}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowRegModal(false); limpiar(); }}>Cancelar</button>
                <button className="btn btn-primary fw-bold" onClick={add}>Guardar Rol</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">Editar Rol #{id_rol}</h5>
                <button type="button" className="btn-close"
                  onClick={() => { setShowEditModal(false); limpiar(); }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Nombre del Rol:</label>
                  <input type="text" className="form-control"
                    value={nombre_rol} onChange={(e) => setNombre_rol(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Descripcion (opcional):</label>
                  <input type="text" className="form-control"
                    value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Estado:</label>
                  <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
                {checkboxPermisos}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowEditModal(false); limpiar(); }}>Cancelar</button>
                <button className="btn btn-warning fw-bold" onClick={actualizar}>Guardar Cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Roles;
