
const lo = require('lodash');
const Bluebird = require('bluebird');


/* --------- Test Database --------- */

const Sequelize = require('sequelize')
const sequelize = new Sequelize('testdb', null, null, { dialect: 'sqlite' })

/* --------- Models --------- */

const Customer = sequelize.define('Customer', {
  name: Sequelize.STRING
})

const Region = sequelize.define('Region', {
  name: Sequelize.STRING
})

const Item = sequelize.define('Item', {
  quantity: Sequelize.INTEGER
})

const ItemType = sequelize.define('ItemType', {
  dept: Sequelize.STRING
})

const Note = sequelize.define('Note', {
  body: Sequelize.STRING,
  orderId: { type: Sequelize.INTEGER, primaryKey: true }
})

const Flag = sequelize.define('Flag', {
  code: Sequelize.STRING
})

const Audit = sequelize.define('Audit', {
  manager: Sequelize.STRING,
  authorized: { type: Sequelize.BOOLEAN, defaultValue: false }
})

const Order = sequelize.define('Order', {
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

const sync = done => sequelize.sync({ force: true, logging: false }).then(() => done())

const clear = () => Bluebird.all(lo.values(models).map(m => m.destroy({ truncate: true })));

/* --------- Export --------- */
module.exports = {
  Sequelize,
  sequelize,
  models: sequelize.models,
  sync,
  clear
}
  
