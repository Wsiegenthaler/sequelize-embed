
var lo = require('lodash');
var Bluebird = require('bluebird');


/* --------- Test Database --------- */

var Sequelize = require('sequelize')
var sequelize = new Sequelize('testdb', null, null, { dialect: 'sqlite' })

/* --------- Models --------- */

var Customer = sequelize.define('Customer', {
  name: Sequelize.STRING
})

var Region = sequelize.define('Region', {
  name: Sequelize.STRING
})

var Item = sequelize.define('Item', {
  quantity: Sequelize.INTEGER
})

var ItemType = sequelize.define('ItemType', {
  dept: Sequelize.STRING
})

var Note = sequelize.define('Note', {
  body: Sequelize.STRING,
  orderId: { type: Sequelize.INTEGER, primaryKey: true }
})

var Flag = sequelize.define('Flag', {
  code: Sequelize.STRING
})

var Audit = sequelize.define('Audit', {
  manager: Sequelize.STRING,
  authorized: { type: Sequelize.BOOLEAN, defaultValue: false }
})

var Order = sequelize.define('Order', {
  name: Sequelize.STRING
}, { timestamps: false })


/* --------- Associations --------- */

Order.Items = Order.hasMany(Item, { as: 'items', foreignKey: 'orderId' })
Order.Notes = Order.hasMany(Note, { as: 'notes', foreignKey: 'orderId' })
Order.Audit = Order.hasOne(Audit, { as: 'audit', foreignKey: 'orderId' })
Order.Customer = Order.belongsTo(Customer, { as: 'customer' })

Customer.Region = Customer.belongsTo(Region, { as: 'region', foreignKey: 'regionId' });

Item.ItemType = Item.belongsTo(ItemType, { as: 'type', foreignKey: 'typeId' });

Note.Flags = Note.hasMany(Flag, { as: 'flags', foreignKey: 'orderId' });

/* --------- Util --------- */

var sync = done => sequelize.sync({ force: true, logging: false }).then(() => done())

var clear = () => Bluebird.all(lo.values(models).map(m => m.destroy({ truncate: true })));

/* --------- Export --------- */
module.exports = {
  sequelize,
  models: sequelize.models,
  sync,
  clear
}
  
