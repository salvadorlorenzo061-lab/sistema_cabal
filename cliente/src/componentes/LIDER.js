import PersonaCrudBase from './PersonaCrudBase';

function LIDER() {
  return (
    <PersonaCrudBase
      apiPath="lideres"
      idField="id_lider"
      entityLabel="lider"
      entityLabelPlural="lideres"
      heading="GESTION DE LIDERES"
      createLabel="AGREGAR LIDER"
      accentClass="success"
    />
  );
}

export default LIDER;
