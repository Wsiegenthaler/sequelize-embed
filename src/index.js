
function IndexExport(sequelize) {

  const embed = require('./embed')(sequelize);

  embed.Epilogue = epilogue => require('./middleware/epilogue')(embed, sequelize, epilogue);
  
  embed.Finale = finale => require('./middleware/finale')(embed, sequelize, finale);

  return embed;
}

module.exports = IndexExport;
