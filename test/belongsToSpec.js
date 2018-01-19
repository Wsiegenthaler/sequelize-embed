
const Bluebird = require('bluebird');

const { sequelize, models, sync, clear } = require('./common');
const { Customer, Item, ItemType, Order, Audit } = models;

const embed = require('../src/index')(sequelize);
const { mkIncludes, mkInclude } = embed.util.helpers;


/* --- setup --- */

const include = mkIncludes(mkInclude(Order.Customer));
const opts = { reload: { include } };


/* --- tests --- */

describe('insert record with belongsTo', () => {

  beforeEach(sync);

  it('should insert if value doesn\'t exist', done => {
    embed.insert(Order, { name: 'o1', customer: { name: 'c1' } }, include, opts)
      .then(result => {
        expect(result.customer.name).toBe('c1');
        done();
      });
  });

  it('should insert if value doesn\'t exist even if pk is specified', done => {
    embed.insert(Order, { name: 'o1', customer: { id: 123, name: 'c1' } }, include, opts)
      .then(result => {
        expect(result.customer.id).toBe(123);
        expect(result.customer.name).toBe('c1');
        done();
      });
  });

  it('should update if value exists', done => {
    Customer.create({ name: 'c1' }).then(c =>
      embed.insert(Order, { name: 'o1', customer: { id: c.id, name: 'c1.1' } }, include, opts)
        .then(result => {
          expect(result.customer.id).toBe(c.id);
          expect(result.customer.name).toBe('c1.1');
          done();
        }));
  });

  it('should skip if not included', done => {
    embed.insert(Order, { name: 'o1', customer: { name: 'c1' } }, [], opts)
      .then(result => {
        expect(result.customer).toBeNull();
        done();
      });
  });
});

describe('update record with belongsTo', () => {

  beforeEach(sync);


  describe('previously unset', () => {

    it('should insert if value doesn\'t exist', done => {
      Order.create({ name: 'o1' }).then(o =>
        embed.update(Order, { id: o.id, customer: { name: 'c1' } }, include, opts)
          .then(result => {
            expect(result.customer.name).toBe('c1');
            done();
          })
        );
    });

    it('should insert if value doesn\'t exist even if pk is specified', done => {
      Order.create({ name: 'o1' }).then(o =>
        embed.update(Order, { id: o.id, customer: { id: 123, name: 'c1' } }, include, opts)
          .then(result => {
            expect(result.customer.id).toBe(123);
            expect(result.customer.name).toBe('c1');
            done();
          })
        );
    });

    it('should update if value exists', done => {
      Customer.create({ name: 'c1' }).then(c =>
        Order.create({ name: 'o1' }).then(o =>
          embed.update(Order, { id: o.id, customer: { id: c.id, name: 'c1.1' } }, include, opts)
            .then(result => {
              expect(result.customer.id).toBe(c.id);
              expect(result.customer.name).toBe('c1.1');
              done();
            })));
    });

    it('should skip if not included', done => {
      Order.create({ name: 'o1' }).then(o =>
        embed.update(Order, { id: o.id, customer: { name: 'c1' } }, [], opts)
          .then(result => {
            expect(result.customer).toBeNull();
            done();
          }));
    });
  });

  describe('previously set', () => {

    it('should update existing value', done => {
      Customer.create({ name: 'c1' }).then(c =>
        Order.create({ name: 'o1', customerId: c.id }).then(o =>
          embed.update(Order, { id: o.id, customer: { id: c.id, name: 'c1.1' } }, include, opts)
            .then(result => {
              expect(result.customer.id).toBe(c.id);
              expect(result.customer.name).toBe('c1.1');
              done();
            })));
    });

    it('should unlink when assigned null', done => {
      Customer.create({ name: 'c1' }).then(c =>
        Order.create({ name: 'o1', customerId: c.id }).then(o =>
          embed.update(Order, { id: o.id, customer: null }, include, opts)
            .then(result => {
              expect(result.customer).toBeNull();
              done();
            })));
    });

    it('should skip if assignment is undefined', done => {
      Customer.create({ name: 'c1' }).then(c =>
        Order.create({ name: 'o1', customerId: c.id }).then(o =>
          embed.update(Order, { id: o.id, name: 'o1.1' }, include, opts)
            .then(result => {
              expect(result.customer.id).toBe(c.id);
              expect(result.name).toBe('o1.1');
              done();
            })));
    });

    it('should skip if not included', done => {
      Customer.create({ name: 'c1' }).then(c =>
        Order.create({ name: 'o1', customerId: c.id }).then(o =>
          embed.update(Order, { id: o.id, customer: { id: c.id, name: 'c1.1' } }, [], opts)
            .then(result => {
              expect(result.customer.id).toBe(c.id);
              expect(result.customer.name).toBe('c1');
              done();
            })));
    });

    describe('and now reassigned', () => {

      describe('to non-existent record', () => {

        it('should insert', done => {
          Customer.create({ name: 'c1' }).then(c1 =>
            Order.create({ name: 'o1', customerId: c1.id }).then(o =>
              embed.update(Order, { id: o.id, customer: { name: 'c2' } }, include, opts)
                .then(result => {
                  expect(result.customer.id).not.toBe(c1.id);
                  expect(result.customer.name).toBe('c2');
                  done();
                })));
        });

        it('should insert even if pk is specified', done => {
          Customer.create({ name: 'c' }).then(c =>
            Order.create({ name: 'o1', customerId: c.id }).then(o =>
              embed.update(Order, { id: o.id, customer: { id: 123, name: 'c2' } }, include, opts)
                .then(result => {
                  expect(result.customer.id).toBe(123);
                  expect(result.customer.name).toBe('c2');
                  done();
                })));
        });

        it('should skip if not included', done => {
          Customer.create({ name: 'c1' }).then(c1 =>
            Order.create({ name: 'o1', customerId: c1.id }).then(o =>
              embed.update(Order, { id: o.id, customer: { name: 'c2' } }, [], opts)
                .then(result => {
                  expect(result.customer.id).toBe(c1.id);
                  expect(result.customer.name).toBe('c1');
                  done();
                })));
        });
      });

      describe('to existing record', () => {

        it('should update', done => {
          Customer.create({ name: 'c1' }).then(c1 =>
            Customer.create({ name: 'c2' }).then(c2 =>
              Order.create({ name: 'o1', customerId: c1.id }).then(o =>
                embed.update(Order, { id: o.id, customer: { id: c2.id, name: 'c2.2' } }, include, opts)
                  .then(result => {
                    expect(result.customer.id).not.toBe(c1.id);
                    expect(result.customer.name).toBe('c2.2');
                    done();
                  }))));
        });

        it('should skip update if not included but still reassign', done => {
          Customer.create({ name: 'c1' }).then(c1 =>
            Customer.create({ name: 'c2' }).then(c2 =>
              Order.create({ name: 'o1', customerId: c1.id }).then(o =>
                embed.update(Order, { id: o.id, customer: { id: c2.id, name: 'c2.2' } }, [], opts)
                  .then(result => {
                    expect(result.customer.id).toBe(c2.id);
                    expect(result.customer.name).toBe('c2');
                    done();
                  }))));
        });

      });
    });
  });
});


