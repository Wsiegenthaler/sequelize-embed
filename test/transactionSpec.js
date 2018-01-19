
const { sequelize, models, sync, clear } = require('./common');
const { Customer, Item, ItemType, Order, Audit } = models;

const embed = require('../src/index')(sequelize);
const { mkIncludes, mkInclude } = embed.util.helpers;


/* --- setup --- */

const include = mkIncludes(mkInclude(Order.Audit));


/* --- tests --- */

describe('internal transaction', () => {
  beforeEach(sync);

  it('is rolled back on error', done => {
    Order.create({ name: 'o1' }).then(o =>
      embed.update(Order, { id: o.id, name: 'o1.1', audit: { id: 'bad-id', } }, include, { reload: { include } })
        .catch(sequelize.DatabaseError, err => 
          Order.findById(o.id, { include }).then(inst => {
            expect(inst.name).toBe('o1');
            expect(inst.audit).toBeNull();
            done();
          })
        ));
  });

});

describe('external transaction', () => {
  beforeEach(sync);

  it('can be committed after insert', done => {
    return sequelize.transaction().then(t =>
      embed.insert(Order, { id: 123, name: 'o1', audit: { id: 123, manager: 'm1' } }, include, { transaction: t, reload: { include } }).then(result => {
        t.commit().then(() => {
          Order.findById(123, { include }).then(inst => {
            expect(inst.name).toBe('o1');
            expect(inst.audit.id).toBe(123);
            expect(inst.audit.manager).toBe('m1');
            done();
            });
        });
      }));
  });

  it('can be committed after update', done => {
    Order.create({ name: 'o1' }).then(o =>
      sequelize.transaction().then(t =>
        embed.update(Order, { id: o.id, name: 'o1.1', audit: { id: 123, manager: 'm1' } }, include, { transaction: t, reload: { include } }).then(result => {
          t.commit().then(() => {
            Order.findById(o.id, { include }).then(inst => {
              expect(inst.name).toBe('o1.1');
              expect(inst.audit.id).toBe(123);
              expect(inst.audit.manager).toBe('m1');
              done();
              });
          });
        })));
  });

  it('can be rolled back after insert', done => {
      sequelize.transaction().then(t =>
        embed.insert(Order, { id: 123, name: 'o1', audit: { id: 123, manager: 'm1' } }, include, { transaction: t, reload: { include } }).then(result => 
          t.rollback().then(() => 
            Order.findById(123, { include }).then(inst => {
              expect(inst).toBeNull();
              done();
            }))));
  });

  it('can be rolled back after update', done => {
    Order.create({ name: 'o1' }).then(o =>
      sequelize.transaction().then(t =>
        embed.update(Order, { id: o.id, name: 'o1.1', audit: { id: 123, manager: 'm1' } }, include, { transaction: t, reload: { include } }).then(result => 
          t.rollback().then(() => 
            Order.findById(o.id, { include }).then(inst => {
              expect(inst.name).toBe('o1');
              expect(inst.audit).toBeNull();
              done();
            })))));
  });
});
