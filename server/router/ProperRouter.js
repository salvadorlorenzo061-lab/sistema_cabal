const crearRouterCrudPersona = require('./personaCrudFactory');

module.exports = crearRouterCrudPersona({
    tableName: 'problemas_personales',
    idColumn: 'id_propersonal',
    entityLabel: 'problema personal',
    entityLabelPlural: 'problemas personales',
    auditPrefix: 'problema_personal'
});
