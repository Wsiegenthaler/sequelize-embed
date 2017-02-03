
var { sequelize, models, sync, clear } = require('./common');
var { Customer, Note, Item, ItemType, Order, Audit } = models;

var embed = require('../src/index')(sequelize);
var helpers = embed.util.helpers;
var mkIncludes = helpers.includes, mkInclude = helpers.include;


/* --- setup --- */

var include = mkIncludes(mkInclude(Order.Notes));
var opts = { reload: { include } };


/* --- tests --- */

describe('misc', () => {
  beforeEach(sync);

  it('shouldn\'t lose pk to pruning if it\'s also the fk', done => {
    Order.create({ name: 'o1' }).then(o =>
      Note.create({ orderId: o.id, body: 'foo'}).then(n =>
        embed.update(Order, { id: o.id }, include, opts).then(pruned => {
          pruned.notes[0].body = 'bar';
          embed.update(Order, pruned, include, opts).then(result => {
            expect(result.notes.length).toBe(1);
            expect(result.notes[0].body).toBe('bar');
            done();
          });
        })));
  });
});
