
const Bluebird = require('bluebird');

const { sequelize, models, sync, clear } = require('./common');
const { Customer, Item, ItemType, Order } = models;

const embed = require('../src/index')(sequelize);
const { mkIncludes, mkInclude } = embed.util.helpers;


/* --- setup --- */

const include = mkIncludes(mkInclude(Order.Items));
const opts = { reload: { include } };


/* --- tests --- */

describe('insert record with hasMany', () => {

  beforeEach(sync);

  it('should insert if value doesn\'t exist', done => {
    embed.insert(Order, { name: 'o1', items: [{quantity: 7 }] }, include, opts)
      .then(result => {
        expect(result.items.length).not.toBe(0);
        expect(result.items[0].quantity).toBe(7);
        done();
      });
  });

  it('should insert if value doesn\'t exist even if pk is specified', done => {
    embed.insert(Order, { name: 'o1', items: [{ id: 123, quantity: 7 }] }, include, opts)
      .then(result => {
        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe(123);
        expect(result.items[0].quantity).toBe(7);
        done();
      });
  });

  it('should update if value exists', done => {
    Item.create({ quantity: 7 }).then(i =>
      embed.insert(Order, { name: 'o1', items: [{ id: i.id, quantity: 7 }] }, include, opts)
        .then(result => {
          expect(result.items.length).toBe(1);
          expect(result.items[0].id).toBe(i.id);
          expect(result.items[0].quantity).toBe(7);
          done();
        }));
  });

  it('should skip if not included', done => {
    embed.insert(Order, { name: 'o1', items: [{ quantity: 7 }] }, [], opts)
      .then(result => {
        expect(result.items.length).toBe(0);
        done();
      });
  });
});

describe('update record with hasMany', () => {

  beforeEach(sync);

  describe('previously unset', () => {

    it('should insert if value doesn\'t exist', done => {
      Order.create({ name: 'o1' }).then(o =>
        embed.update(Order, { id: o.id, items: [{ quantity: 7 }] }, include, opts)
          .then(result => {
            expect(result.items.length).toBe(1);
            expect(result.items[0].quantity).toBe(7);
            done();
          })
        );
    });

    it('should insert if value doesn\'t exist even if pk is specified', done => {
      Order.create({ name: 'o1' }).then(o =>
        embed.update(Order, { id: o.id, items: [{ id: 123, quantity: 7 }] }, include, opts)
          .then(result => {
            expect(result.items.length).toBe(1);
            expect(result.items[0].id).toBe(123);
            expect(result.items[0].quantity).toBe(7);
            done();
          })
        );
    });

    it('should update if value exists', done => {
      Item.create({ quantity: 7 }).then(i =>
        Order.create({ name: 'o1' }).then(o =>
          embed.update(Order, { id: o.id, items: [{ id: i.id, quantity: 8 }] }, include, opts)
            .then(result => {
              expect(result.items.length).toBe(1);
              expect(result.items[0].id).toBe(i.id);
              expect(result.items[0].quantity).toBe(8);
              done();
            })));
    });

    it('should skip if not included', done => {
      Order.create({ name: 'o1' }).then(o =>
        embed.update(Order, { id: o.id, items: [{ quantity: 7 }] }, [], opts)
          .then(result => {
            expect(result.items.length).toBe(0);
            done();
          }));
    });
  });

  describe('previously set', () => {

    it('should update existing value on matching pk', done => {
      Order.create({ name: 'o1' }).then(o =>
        Item.create({ orderId: o.id, quantity: 7 }).then(i =>
          embed.update(Order, { id: o.id, items: [{ id: i.id, quantity: 8 }] }, include, opts)
            .then(result => {
              expect(result.items.length).toBe(1);
              expect(result.items[0].id).toBe(i.id);
              expect(result.items[0].quantity).toBe(8);
              done();
            })));
    });

    it('should insert new value on pk mismatch', done => {
      Order.create({ name: 'o1' }).then(o =>
        Item.create({ orderId: o.id, quantity: 7 }).then(i =>
          embed.update(Order, { id: o.id, items: [{ quantity: 8 }] }, include, opts)
            .then(result => {
              expect(result.items.length).toBe(1);
              expect(result.items[0].id).not.toBe(i.id);
              expect(result.items[0].quantity).toBe(8);
              done();
            })));
    });

    it('should insert new value on pk mismatch even if pk specified', done => {
      Order.create({ name: 'o1' }).then(o =>
        Item.create({ orderId: o.id, quantity: 7 }).then(i =>
          embed.update(Order, { id: o.id, items: [{ id: 123, quantity: 8 }] }, include, opts)
            .then(result => {
              expect(result.items.length).toBe(1);
              expect(result.items[0].id).toBe(123);
              expect(result.items[0].quantity).toBe(8);
              done();
            })));
    });


    it('should clear values when assigned null', done => {
      Order.create({ name: 'o1' }).then(o =>
        Item.create({ orderId: o.id, quantity: 7 }).then(c =>
          embed.update(Order, { id: o.id, items: null }, include, opts)
            .then(result => {
              expect(result.items.length).toBe(0);
              done();
            })));
    });

    it('should clear values when assigned []', done => {
      Order.create({ name: 'o1' }).then(o =>
        Item.create({ orderId: o.id, quantity: 7 }).then(c =>
          embed.update(Order, { id: o.id, items: [] }, include, opts)
            .then(result => {
              expect(result.items.length).toBe(0);
              done();
            })));
    });

    it('should skip if assignment is undefined', done => {
      Order.create({ name: 'o1' }).then(o =>
        Item.create({ orderId: o.id, quantity: 7 }).then(i =>
          embed.update(Order, { id: o.id, name: 'o1.1' }, include, opts)
            .then(result => {
              expect(result.name).toBe('o1.1');
              expect(result.items.length).toBe(1);
              expect(result.items[0].quantity).toBe(7);
              done();
            })));
    });

    it('should skip if not included', done => {
      Order.create({ name: 'o1' }).then(o =>
        Item.create({ orderId: o.id, quantity: 7 }).then(i =>
          embed.update(Order, { id: o.id, name: 'o1.1', items: [{ id: i.id, quantity: 8 }] }, [], opts)
            .then(result => {
              expect(result.name).toBe('o1.1')
              expect(result.items.length).toBe(1);
              expect(result.items[0].id).toBe(i.id);
              expect(result.items[0].quantity).toBe(7);
              done();
            })));
    });

    describe('and now reassigned', () => {

      describe('to non-existent record', () => {

        it('should delete and insert', done => {
          Order.create({ name: 'o1' }).then(o =>
            Item.create({ orderId: o.id, quantity: 7 }).then(i =>
              embed.update(Order, { id: o.id, items: [{ quantity: 8 }] }, include, opts)
                .then(result => {
                  expect(result.items.length).toBe(1);
                  expect(result.items[0].id).not.toBe(i.id);
                  expect(result.items[0].quantity).toBe(8);
                  done();
                })));
        });

        it('should delete and insert even if pk is specified', done => {
          Order.create({ name: 'o1' }).then(o =>
            Item.create({ orderId: o.id, quantity: 7 }).then(i =>
              embed.update(Order, { id: o.id, items: [{ id: 123, quantity: 8 }] }, include, opts)
                .then(result => {
                  expect(result.items.length).toBe(1);
                  expect(result.items[0].id).toBe(123);
                  expect(result.items[0].quantity).toBe(8);
                  done();
                })));
        });

        it('should skip if not included', done => {
          Order.create({ name: 'o1' }).then(o =>
            Item.create({ orderId: o.id, quantity: 7 }).then(i =>
              embed.update(Order, { id: o.id, items: [{ id: 123, quantity: 8 }] }, [], opts)
                .then(result => {
                  expect(result.items.length).toBe(1);
                  expect(result.items[0].id).toBe(i.id);
                  expect(result.items[0].quantity).toBe(7);
                  done();
                })));
        });
      });

      describe('to existing record', () => {

        it('should delete and update', done => {
          Order.create({ name: 'o1' }).then(o =>
            Item.create({ orderId: o.id, quantity: 7 }).then(i1 =>
              Item.create({ quantity: 8 }).then(i2 =>
                embed.update(Order, { id: o.id, items: [{ id: i2.id, quantity: 9 }] }, include, opts)
                  .then(result => {
                    expect(result.items.length).toBe(1);
                    expect(result.items[0].id).toBe(i2.id);
                    expect(result.items[0].quantity).toBe(9);
                    done();
                  }))));
        });

        it('should skip update if not included', done => {
          Order.create({ name: 'o1' }).then(o =>
            Item.create({ orderId: o.id, quantity: 7 }).then(i1 =>
              Item.create({ quantity: 8 }).then(i2 =>
                embed.update(Order, { id: o.id, items: [{ id: i2.id, quantity: 9 }] }, [], opts)
                  .then(result => {
                    expect(result.items.length).toBe(1);
                    expect(result.items[0].id).toBe(i1.id);
                    expect(result.items[0].quantity).toBe(7);
                    done();
                  }))));
        });

      });
    });
  });
});
