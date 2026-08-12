const crearRouterCrudPersona = require('./personaCrudFactory');

module.exports = crearRouterCrudPersona({
    tableName: 'lideres',
    idColumn: 'id_lider',
    entityLabel: 'lider',
    entityLabelPlural: 'lideres',
    auditPrefix: 'lider'
});
