import PersonaCrudBase from './PersonaCrudBase';

function PROPERSONALES() {
  return (
    <PersonaCrudBase
      apiPath="propersonales"
      idField="id_propersonal"
      entityLabel="problema personal"
      entityLabelPlural="problemas personales"
      heading="GESTION DE PROBLEMAS PERSONALES"
      createLabel="AGREGAR PROBLEMA PERSONAL"
      accentClass="danger"
    />
  );
}

export default PROPERSONALES;
