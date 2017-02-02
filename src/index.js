
function IndexExport(sequelize) {

  var embed = require('./embed')(sequelize);
  embed.EpilogueEmbed = epilogue => require('./epilogue')(sequelize, epilogue);

  return embed;
}

module.exports = IndexExport;
