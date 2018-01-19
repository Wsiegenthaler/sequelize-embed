
const { sequelize, models, sync, clear } = require('./common');
const { Customer, Note, Item, ItemType, Order, Audit } = models;

const embed = require('../src/index')(sequelize);
const { mkIncludes, mkInclude } = embed.util.helpers;


/* --- setup --- */

const include = mkIncludes(mkInclude(Order.Notes));
const opts = { reload: { include } };


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
