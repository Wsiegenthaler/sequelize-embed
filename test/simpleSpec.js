
var { sequelize, models, sync, clear } = require('./common');
var { Customer, Item, ItemType, Order, Audit } = models;

var embed = require('../src/index')(sequelize);
var helpers = embed.util.helpers;
var mkIncludes = helpers.includes, mkInclude = helpers.include;


/* --- setup --- */

var include = mkIncludes(mkInclude(Order.Audit));


/* --- tests --- */

describe('simple', () => {
  beforeEach(sync);

  it('insert', done => {
    embed.insert(Order, { name: 'o1' }, [], {})
      .then(result => {
        expect(result.name).toBe('o1');
        done();
      });
  });

  it('update', done => {
    Order.create({ name: 'o1' }).then(o =>
      embed.update(Order, { id: o.id, name: 'o1.1' }, [], {})
        .then(result => {
          expect(result.name).toBe('o1.1');
          done();
        }))
  });
});
