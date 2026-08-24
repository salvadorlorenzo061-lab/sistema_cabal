import PersonaCrudBase from './PersonaCrudBase';

function PROPERSONALES() {
  return (
    <PersonaCrudBase
      apiPath="propersonales"
      idField="id_propersonal"
      entityLabel="incidente personal"
      entityLabelPlural="incidentes personales"
      heading="GESTIÓN DE INCIDENTES PERSONALES"
      createLabel="AGREGAR INCIDENTE PERSONAL"
      accentClass="danger"
      useLocalidadesEnDireccion={true}
      showAssignmentSelect={true}
    />
  );
}

export default PROPERSONALES;
