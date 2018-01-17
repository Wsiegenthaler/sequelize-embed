
function IndexExport(sequelize) {

  const embed = require('./embed')(sequelize);
  embed.Epilogue = epilogue => require('./epilogue')(embed, sequelize, epilogue);

  return embed;
}

module.exports = IndexExport;
