
const Bluebird = require('bluebird');

const { sequelize, models, sync, clear } = require('./common');
const { Customer, Region, Item, ItemType, Order, Audit, Note, Flag } = models;

const embed = require('../src/index')(sequelize);
const { mkIncludes, mkInclude } = embed.util.helpers;


/* --- tests --- */

describe('nested belongsTo', () => {

  beforeEach(sync);

  describe('within hasMany', () => {

    const include = mkIncludes(mkInclude(Order.Items, mkInclude(Item.ItemType)));
    const opts = { reload: { include } };

    describe('which exists', () => {

      it('should insert nested value if doesn\'t exist', done => {
        Order.create({ name: 'o1' }).then(o =>
          Item.create({ orderId: o.id, quantity: 7 }).then(i =>
            embed.update(Order, { id: o.id, items: [{ id: i.id, type: { dept: 'seafood' } }] }, include, opts)
              .then(result => {
                expect(result.items.length).toBe(1);
                expect(result.items[0].type.dept).toBe('seafood');
                done();
              })));
      });

      it('should insert nested value if doesn\'t exist even if pk is specified', done => {
        Order.create({ name: 'o1' }).then(o =>
          Item.create({ orderId: o.id, quantity: 7 }).then(i =>
            embed.update(Order, { id: o.id, items: [{ id: i.id, type: { id: 123, dept: 'seafood' } }] }, include, opts)
              .then(result => {
                expect(result.items.length).toBe(1);
                expect(result.items[0].type.id).toBe(123);
                expect(result.items[0].type.dept).toBe('seafood');
                done();
              })));
      });

      it('should update nested value if value exists', done => {
        ItemType.create({ dept: 'meat' }).then(it =>
          Order.create({ name: 'o1' }).then(o =>
            Item.create({ orderId: o.id, typeId: it.id, quantity: 7 }).then(i =>
              embed.update(Order, { id: o.id, items: [{ id: i.id, type: { id: it.id, dept: 'seafood' } }] }, include, opts)
                .then(result => {
                  expect(result.items.length).toBe(1);
                  expect(result.items[0].type.id).toBe(it.id);
                  expect(result.items[0].type.dept).toBe('seafood');
                  done();
                }))));
      });

      it('should unlink nested value if set to null', done => {
        ItemType.create({ dept: 'meat' }).then(it =>
          Order.create({ name: 'o1' }).then(o =>
            Item.create({ orderId: o.id, typeId: it.id, quantity: 7 }).then(i =>
              embed.update(Order, { id: o.id, items: [{ id: i.id, type: null }] }, include, opts)
                .then(result => {
                  expect(result.items.length).toBe(1);
                  expect(result.items[0].type).toBeNull();
                  done();
                }))));
      });

      it('should skip nested value if not included', done => {
        const include = mkIncludes(mkInclude(Order.Items));
        ItemType.create({ dept: 'meat' }).then(it =>
          Order.create({ name: 'o1' }).then(o =>
            Item.create({ orderId: o.id, typeId: it.id, quantity: 7 }).then(i =>
              embed.update(Order, { id: o.id, items: [{ id: i.id, type: { id: it.id, dept: 'seafood' } }] }, include, opts)
                .then(result => {
                  expect(result.items.length).toBe(1);
                  expect(result.items[0].type).not.toBeNull();
                  expect(result.items[0].type.dept).toBe('meat');
                  done();
                }))));
      });
    });

    describe('which doesn\'t exist', () => {

      it('should insert nested value if doesn\'t exist', done => {
        embed.insert(Order, { name: 'o1', items: [{ quantity: 7, type: { dept: 'seafood' } }] }, include, opts)
          .then(result => {
            expect(result.items.length).toBe(1);
            expect(result.items[0].type.dept).toBe('seafood');
            done();
          });
      });

      it('should insert nested value if doesn\'t exist even if pk is specified', done => {
        embed.insert(Order, { name: 'o1', items: [{ quantity: 7, type: { id: 123, dept: 'seafood' } }] }, include, opts)
          .then(result => {
            expect(result.items.length).toBe(1);
            expect(result.items[0].type.id).toBe(123);
            expect(result.items[0].type.dept).toBe('seafood');
            done();
          });
      });

      it('should update nested value if value exists', done => {
        ItemType.create({ dept: 'meat' }).then(it =>
          embed.insert(Order, { name: 'o1', items: [{ quantity: 7, type: { id: it.id, dept: 'seafood' } }] }, include, opts)
            .then(result => {
              expect(result.items.length).toBe(1);
              expect(result.items[0].type.id).toBe(it.id);
              expect(result.items[0].type.dept).toBe('seafood');
              done();
            }));
      });
    });
  });

  describe('within belongsTo', () => {

    const include = mkIncludes(mkInclude(Order.Customer, mkInclude(Customer.Region)));
    const opts = { reload: { include } };

    describe('which exists', () => {

      it('should insert nested value if doesn\'t exist', done => {
        Customer.create({ name: 'c1' }).then(c =>
          embed.insert(Order, { name: 'o1', customer: { id: c.id, region: { name: 'northwest' } } }, include, opts)
            .then(result => {
              expect(result.customer).not.toBeNull();
              expect(result.customer.region).not.toBeNull();
              expect(result.customer.region.name).toBe('northwest');
              done();
            }));
      });

      it('should insert nested value if doesn\'t exist even if pk is specified', done => {
        Customer.create({ name: 'c1' }).then(c =>
          embed.insert(Order, { name: 'o1', customer: { id: c.id, region: { id: 123, name: 'northwest' } } }, include, opts)
            .then(result => {
              expect(result.customer).not.toBeNull();
              expect(result.customer.id).toBe(c.id);
              expect(result.customer.region).not.toBeNull();
              expect(result.customer.region.id).toBe(123);
              expect(result.customer.region.name).toBe('northwest');
              done();
            }));
      });

      it('should update nested value if value exists', done => {
        Customer.create({ name: 'c1' }).then(c =>
          Region.create({ name: 'nw' }).then(r =>
            embed.insert(Order, { name: 'o1', customer: { id: c.id, region: { id: r.id, name: 'northwest' } } }, include, opts)
              .then(result => {
                expect(result.customer).not.toBeNull();
                expect(result.customer.id).toBe(c.id);
                expect(result.customer.region).not.toBeNull();
                expect(result.customer.region.id).toBe(r.id);
                expect(result.customer.region.name).toBe('northwest');
                done();
              })));
      });

      it('should unlink nested value if set to null', done => {
        Region.create({ name: 'nw' }).then(r =>
          Customer.create({ name: 'c1', regionId: r.id }).then(c =>
            Order.create({ name: 'o1', customerId: c.id }).then(o =>
              embed.update(Order, { id: o.id, customer: { id: c.id, region: null } }, include, opts)
                .then(result => {
                  expect(result.customer).not.toBeNull();
                  expect(result.customer.region).toBeNull();
                  done();
                }))));
      });

      it('should skip nested value if not included', done => {
        const include = mkIncludes(mkInclude(Order.Customer));
        Region.create({ name: 'nw' }).then(r =>
          Customer.create({ name: 'c1', regionId: r.id }).then(c =>
            Order.create({ name: 'o1' }).then(o =>
              embed.update(Order, { id: o.id, customer: { id: c.id, region: { id: r.id, name: 'northwest' } } }, include, opts)
                .then(result => {
                  expect(result.customer).not.toBeNull();
                  expect(result.customer.id).toBe(c.id);
                  expect(result.customer.region).not.toBeNull();
                  expect(result.customer.region.id).toBe(r.id);
                  expect(result.customer.region.name).toBe('nw');
                  done();
                }))));
      });
    });

    describe('which doesn\'t exist', () => {

      it('should insert nested value if doesn\'t exist', done => {
        embed.insert(Order, { name: 'o1', customer: { id: 123, name: 'c1', region: { name: 'northwest' } } }, include, opts)
          .then(result => {
            expect(result.customer).not.toBeNull();
            expect(result.customer.id).toBe(123);
            expect(result.customer.region).not.toBeNull();
            expect(result.customer.region.name).toBe('northwest');
            done();
          });
      });

      it('should insert nested value if doesn\'t exist even if pk is specified', done => {
        embed.insert(Order, { name: 'o1', customer: { id: 123, name: 'c1', region: { id: 123, name: 'northwest' } } }, include, opts)
          .then(result => {
            expect(result.customer).not.toBeNull();
            expect(result.customer.id).toBe(123);
            expect(result.customer.region).not.toBeNull();
            expect(result.customer.region.id).toBe(123);
            expect(result.customer.region.name).toBe('northwest');
            done();
          });
      });

      it('should update nested value if value exists', done => {
        Region.create({ name: 'nw' }).then(r =>
          embed.insert(Order, { name: 'o1', customer: { name: 'c1', region: { id: r.id, name: 'northwest' } } }, include, opts)
            .then(result => {
              expect(result.customer).not.toBeNull();
              expect(result.customer.region).not.toBeNull();
              expect(result.customer.region.id).toBe(r.id);
              expect(result.customer.region.name).toBe('northwest');
              done();
            }));
      });
    });
  });
});

describe('nested hasMany', () => {
  beforeEach(sync);

  describe('within hasMany', () => {

    const include = mkIncludes(mkInclude(Order.Notes, mkInclude(Note.Flags)));
    const opts = { reload: { include } };

    describe('which exists', () => {

      it('should insert nested value if doesn\'t exist', done => {
        Order.create({ name: 'o1' }).then(o =>
          Note.create({ orderId: o.id, body: 'foo' }).then(n =>
            embed.update(Order, { id: o.id, notes: [{ flags: [{ code: 'bar' }] }] }, include, opts)
              .then(result => {
                expect(result.notes.length).toBe(1);
                expect(result.notes[0].body).toBe('foo');
                expect(result.notes[0].flags).not.toBeNull();
                expect(result.notes[0].flags.length).toBe(1);
                expect(result.notes[0].flags[0].code).toBe('bar');
                done();
              })));
      });

      it('should insert nested value if doesn\'t exist even if pk is specified', done => {
        Order.create({ name: 'o1' }).then(o =>
          Note.create({ orderId: o.id, body: 'foo' }).then(n =>
            embed.update(Order, { id: o.id, notes: [{ flags: [{ id: 123, code: 'bar' }] }] }, include, opts)
              .then(result => {
                expect(result.notes.length).toBe(1);
                expect(result.notes[0].body).toBe('foo');
                expect(result.notes[0].flags).not.toBeNull();
                expect(result.notes[0].flags.length).toBe(1);
                expect(result.notes[0].flags[0].id).toBe(123);
                expect(result.notes[0].flags[0].code).toBe('bar');
                done();
              })));
      });

      it('should update nested value if value exists', done => {
        Order.create({ name: 'o1' }).then(o =>
          Note.create({ orderId: o.id, body: 'foo' }).then(n =>
            Flag.create({ orderId: o.id, code: 'bar' }).then(f =>
              embed.update(Order, { id: o.id, notes: [{ flags: [{ id: f.id, code: 'baz' }] }] }, include, opts)
                .then(result => {
                  expect(result.notes.length).toBe(1);
                  expect(result.notes[0].body).toBe('foo');
                  expect(result.notes[0].flags).not.toBeNull();
                  expect(result.notes[0].flags.length).toBe(1);
                  expect(result.notes[0].flags[0].id).toBe(f.id);
                  expect(result.notes[0].flags[0].code).toBe('baz');
                  done();
                }))));
      });

      it('should unlink nested values if set to null', done => {
        Order.create({ name: 'o1' }).then(o =>
          Note.create({ orderId: o.id, body: 'foo' }).then(n =>
            Flag.create({ orderId: o.id, code: 'bar' }).then(f =>
              embed.update(Order, { id: o.id, notes: [{ flags: null }] }, include, opts)
                .then(result => {
                  expect(result.notes.length).toBe(1);
                  expect(result.notes[0].body).toBe('foo');
                  expect(result.notes[0].flags.length).toBe(0);
                  done();
                }))));
      });

      it('should unlink nested values if set to []', done => {
        Order.create({ name: 'o1' }).then(o =>
          Note.create({ orderId: o.id, body: 'foo' }).then(n =>
            Flag.create({ orderId: o.id, code: 'bar' }).then(f =>
              embed.update(Order, { id: o.id, notes: [{ flags: [] }] }, include, opts)
                .then(result => {
                  expect(result.notes.length).toBe(1);
                  expect(result.notes[0].body).toBe('foo');
                  expect(result.notes[0].flags.length).toBe(0);
                  done();
                }))));
      });

      it('should skip nested value if not included', done => {
        const include = mkIncludes(mkInclude(Order.Notes));
        Order.create({ name: 'o1' }).then(o =>
          Note.create({ orderId: o.id, body: 'foo' }).then(n =>
            Flag.create({ orderId: o.id, code: 'bar' }).then(f =>
              embed.update(Order, { id: o.id, notes: [{ flags: [{ code: 'baz' }] }] }, include, opts)
                .then(result => {
                  expect(result.notes.length).toBe(1);
                  expect(result.notes[0].body).toBe('foo');
                  expect(result.notes[0].flags.length).toBe(1);
                  expect(result.notes[0].flags[0].code).toBe('bar');
                  done();
                }))));
      });
    });

    describe('which doesn\'t exist', () => {

      it('should insert nested value if doesn\'t exist', done => {
        embed.insert(Order, { name: 'o1', notes: [{ body: 'foo', flags: [{ code: 'bar' }] }] }, include, opts)
          .then(result => {
            expect(result.notes.length).toBe(1);
            expect(result.notes[0].body).toBe('foo');
            expect(result.notes[0].flags).not.toBeNull();
            expect(result.notes[0].flags.length).toBe(1);
            expect(result.notes[0].flags[0].code).toBe('bar');
            done();
          });
      });

      it('should insert nested value if doesn\'t exist even if pk is specified', done => {
        embed.insert(Order, { name: 'o1', notes: [{ body: 'foo', flags: [{ id: 123, code: 'bar' }] }] }, include, opts)
          .then(result => {
            expect(result.notes.length).toBe(1);
            expect(result.notes[0].body).toBe('foo');
            expect(result.notes[0].flags).not.toBeNull();
            expect(result.notes[0].flags.length).toBe(1);
            expect(result.notes[0].flags[0].id).toBe(123);
            expect(result.notes[0].flags[0].code).toBe('bar');
            done();
          });
      });

      it('should update nested value if value exists', done => {
        Flag.create({ code: 'bar' }).then(f =>
          embed.insert(Order, { name: 'o1', notes: [{ body: 'foo', flags: [{ id: f.id, code: 'baz' }] }] }, include, opts)
            .then(result => {
              expect(result.notes.length).toBe(1);
              expect(result.notes[0].body).toBe('foo');
              expect(result.notes[0].flags).not.toBeNull();
              expect(result.notes[0].flags.length).toBe(1);
              expect(result.notes[0].flags[0].id).toBe(f.id);
              expect(result.notes[0].flags[0].code).toBe('baz');
              done();
            }));
      });
    });
  });





  describe('within belongsTo', () => {

    const include = mkIncludes(mkInclude(Order.Customer, mkInclude(Customer.Region)));
    const opts = { reload: { include } };

    describe('which exists', () => {

      it('should insert nested value if doesn\'t exist', done => {
        Customer.create({ name: 'c1' }).then(c =>
          embed.insert(Order, { name: 'o1', customer: { id: c.id, region: { name: 'northwest' } } }, include, opts)
            .then(result => {
              expect(result.customer).not.toBeNull();
              expect(result.customer.id).toBe(c.id);
              expect(result.customer.region).not.toBeNull();
              expect(result.customer.region.name).toBe('northwest');
              done();
            }));
      });

      it('should insert nested value if doesn\'t exist even if pk is specified', done => {
        Customer.create({ name: 'c1' }).then(c =>
          embed.insert(Order, { name: 'o1', customer: { id: c.id, region: { id: 123, name: 'northwest' } } }, include, opts)
            .then(result => {
              expect(result.customer).not.toBeNull();
              expect(result.customer.id).toBe(c.id);
              expect(result.customer.region).not.toBeNull();
              expect(result.customer.region.id).toBe(123);
              expect(result.customer.region.name).toBe('northwest');
              done();
            }));
      });

      it('should update nested value if value exists', done => {
        Region.create({ name: 'nw' }).then(r =>
          Customer.create({ name: 'c1', regionId: r.id }).then(c =>
            embed.insert(Order, { name: 'o1', customer: { id: c.id, region: { id: r.id, name: 'northwest' } } }, include, opts)
              .then(result => {
                expect(result.customer).not.toBeNull();
                expect(result.customer.id).toBe(c.id);
                expect(result.customer.region).not.toBeNull();
                expect(result.customer.region.id).toBe(r.id);
                expect(result.customer.region.name).toBe('northwest');
                done();
              })));
      });

      it('should unlink nested value if set to null', done => {
        Region.create({ name: 'nw' }).then(r =>
          Customer.create({ name: 'c1', regionId: r.id }).then(c =>
            Order.create({ name: 'o1', customerId: c.id }).then(o =>
              embed.update(Order, { id: o.id, customer: { id: c.id, region: null } }, include, opts)
                .then(result => {
                  expect(result.customer).not.toBeNull();
                  expect(result.customer.region).toBeNull();
                  done();
                }))));
      });

      it('should skip nested value if not included', done => {
        const include = mkIncludes(mkInclude(Order.Customer));
        Region.create({ name: 'nw' }).then(r =>
          Customer.create({ name: 'c1', regionId: r.id }).then(c =>
            Order.create({ name: 'o1' }).then(o =>
              embed.update(Order, { id: o.id, customer: { id: c.id, region: { id: r.id, name: 'northwest' } } }, include, opts)
                .then(result => {
                  expect(result.customer).not.toBeNull();
                  expect(result.customer.region).not.toBeNull();
                  expect(result.customer.region.id).toBe(r.id);
                  expect(result.customer.region.name).toBe('nw');
                  done();
                }))));
      });
      
    });

    describe('which doesn\'t exist', () => {

      it('should insert nested value if doesn\'t exist', done => {
        embed.insert(Order, { name: 'o1', customer: { id: 123, name: 'c1', region: { name: 'northwest' } } }, include, opts)
          .then(result => {
            expect(result.customer).not.toBeNull();
            expect(result.customer.region).not.toBeNull();
            expect(result.customer.region.name).toBe('northwest');
            done();
          });
      });

      it('should insert nested value if doesn\'t exist even if pk is specified', done => {
        embed.insert(Order, { name: 'o1', customer: { id: 123, name: 'c1', region: { id: 123, name: 'northwest' } } }, include, opts)
          .then(result => {
            expect(result.customer).not.toBeNull();
            expect(result.customer.region).not.toBeNull();
            expect(result.customer.region.id).toBe(123);
            expect(result.customer.region.name).toBe('northwest');
            done();
          });
      });

      it('should update nested value if value exists', done => {
        Region.create({ name: 'nw' }).then(r =>
          embed.insert(Order, { name: 'o1', customer: { name: 'c1', region: { id: r.id, name: 'northwest' } } }, include, opts)
            .then(result => {
              expect(result.customer).not.toBeNull();
              expect(result.customer.region).not.toBeNull();
              expect(result.customer.region.id).toBe(r.id);
              expect(result.customer.region.name).toBe('northwest');
              done();
            }));
      });
    });
  });
});

