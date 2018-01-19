
const Bluebird = require('bluebird');

const { sequelize, models, sync, clear } = require('./common');
const { Customer, Item, ItemType, Order, Audit } = models;

const embed = require('../src/index')(sequelize);
const { mkIncludes, mkInclude } = embed.util.helpers;


/* --- setup --- */

const include = mkIncludes(mkInclude(Order.Audit));
const opts = { reload: { include } };


/* --- tests --- */

describe('insert record with hasOne', () => {

  beforeEach(sync);

  it('should insert if value doesn\'t exist', done => {
    embed.insert(Order, { name: 'o1', audit: { manager: 'm1' } }, include, opts)
      .then(result => {
        expect(result.audit.id).not.toBeNull();
        expect(result.audit.manager).toBe('m1');
        done();
      });
  });

  it('should insert if value doesn\'t exist even if pk is specified', done => {
    embed.insert(Order, { name: 'o1', audit: { id: 123, manager: 'm1' } }, include, opts)
      .then(result => {
        expect(result.audit.id).toBe(123);
        expect(result.audit.manager).toBe('m1');
        done();
      });
  });


  it('should update if value exists', done => {
    Audit.create({ manager: 'm1' }).then(a =>
      embed.insert(Order, { name: 'o1', audit: { id: a.id, manager: 'm1.1' } }, include, opts)
        .then(result => {
          expect(result.audit.id).toBe(a.id);
          expect(result.audit.manager).toBe('m1.1');
          done();
        }));
  });

  it('should skip if not included', done => {
    embed.insert(Order, { name: 'o1', audit: { manager: 'm1' } }, [], opts)
      .then(result => {
        expect(result.audit).toBeNull();
        done();
      });
  });
});

describe('update record with hasOne', () => {

  beforeEach(sync);

  describe('previously unset', () => {

    it('should insert if value doesn\'t exist', done => {
      Order.create({ name: 'o1' }).then(o =>
        embed.update(Order, { id: o.id, audit: { manager: 'm1' } }, include, opts)
          .then(result => {
            expect(result.audit.manager).toBe('m1');
            done();
          })
        );
    });

    it('should insert if value doesn\'t exist even if pk is specified', done => {
      Order.create({ name: 'o1' }).then(o =>
        embed.update(Order, { id: o.id, audit: { id: 123, manager: 'm1' } }, include, opts)
          .then(result => {
            expect(result.audit.id).toBe(123);
            expect(result.audit.manager).toBe('m1');
            done();
          })
        );
    });


    it('should update if value exists', done => {
      Audit.create({ manager: 'm1' }).then(a =>
        Order.create({ name: 'o1' }).then(o =>
          embed.update(Order, { id: o.id, audit: { id: a.id, manager: 'm1.1' } }, include, opts)
            .then(result => {
              expect(result.audit.id).toBe(a.id);
              expect(result.audit.manager).toBe('m1.1');
              done();
            })));
    });

    it('should skip if not included', done => {
      Order.create({ name: 'o1' }).then(o =>
        embed.update(Order, { id: o.id, audit: { manager: 'm1' } }, [], opts)
          .then(result => {
            expect(result.audit).toBeNull();
            done();
          }));
    });
  });

  describe('previously set', () => {

    it('should update existing value on matching pk', done => {
      Order.create({ name: 'o1' }).then(o =>
        Audit.create({ orderId: o.id, manager: 'm1' }).then(a =>
          embed.update(Order, { id: o.id, audit: { id: a.id, manager: 'm1.1' } }, include, opts)
            .then(result => {
              expect(result.audit.id).toBe(a.id);
              expect(result.audit.manager).toBe('m1.1');
              done();
            })));
    });

    it('should insert new value on pk mismatch', done => {
      Order.create({ name: 'o1' }).then(o =>
        Audit.create({ orderId: o.id, manager: 'm1' }).then(a =>
          embed.update(Order, { id: o.id, audit: { manager: 'm2' } }, include, opts)
            .then(result => {
              expect(result.audit.id).not.toBe(a.id);
              expect(result.audit.manager).toBe('m2');
              done();
            })));
    });

    it('should insert new value on pk mismatch even if pk specified', done => {
      Order.create({ name: 'o1' }).then(o =>
        Audit.create({ orderId: o.id, manager: 'm1' }).then(a =>
          embed.update(Order, { id: o.id, audit: { id: 123, manager: 'm2' } }, include, opts)
            .then(result => {
              expect(result.audit.id).toBe(123);
              expect(result.audit.manager).toBe('m2');
              done();
            })));
    });


    it('should unlink when assigned null', done => {
      Order.create({ name: 'o1' }).then(o =>
        Audit.create({ orderId: o.id, manager: 'm1' }).then(c =>
          embed.update(Order, { id: o.id, audit: null }, include, opts)
            .then(result => {
              expect(result.audit).toBeNull();
              done();
            })));
    });

    it('should skip if assignment is undefined', done => {
      Order.create({ name: 'o1' }).then(o =>
        Audit.create({ orderId: o.id, manager: 'a1' }).then(a =>
          embed.update(Order, { id: o.id, name: 'o1.1' }, include, opts)
            .then(result => {
              expect(result.audit.id).toBe(a.id);
              expect(result.name).toBe('o1.1');
              done();
            })));
    });

    it('should skip if not included', done => {
      Order.create({ name: 'o1' }).then(o =>
        Audit.create({ orderId: o.id, manager: 'a1' }).then(a =>
          embed.update(Order, { id: o.id, audit: { id: a.id, manager: 'a1.1' } }, [], opts)
            .then(result => {
              expect(result.audit.id).toBe(a.id);
              expect(result.audit.manager).toBe('a1');
              done();
            })));
    });

    describe('and now reassigned', () => {

      describe('to non-existent record', () => {

        it('should insert', done => {
          Order.create({ name: 'o1' }).then(o =>
            Audit.create({ orderId: o.id, manager: 'a1' }).then(a1 =>
              embed.update(Order, { id: o.id, audit: { manager: 'a2' } }, include, opts)
                .then(result => {
                  expect(result.audit.id).not.toBe(a1.id);
                  expect(result.audit.manager).toBe('a2');
                  done();
                })));
        });

        it('should insert even if pk is specified', done => {
          Order.create({ name: 'o1' }).then(o =>
            Audit.create({ orderId: o.id, manager: 'a1' }).then(a1 =>
              embed.update(Order, { id: o.id, audit: { id: 123, manager: 'a2' } }, include, opts)
                .then(result => {
                  expect(result.audit.id).toBe(123);
                  expect(result.audit.manager).toBe('a2');
                  done();
                })));
        });

        it('should skip if not included', done => {
          Order.create({ name: 'o1' }).then(o =>
            Audit.create({ orderId: o.id, manager: 'a1' }).then(a =>
              embed.update(Order, { id: o.id, audit: { id: 123, manager: 'a2' } }, [], opts)
                .then(result => {
                  expect(result.audit.id).toBe(a.id);
                  expect(result.audit.manager).toBe('a1');
                  done();
                })));
        });
      });

      describe('to existing record', () => {

        it('should delete and update', done => {
          Order.create({ name: 'o1' }).then(o =>
            Audit.create({ orderId: o.id, manager: 'a1' }).then(a1 =>
              Audit.create({ manager: 'a2' }).then(a2 =>
                embed.update(Order, { id: o.id, audit: { id: a2.id, manager: 'a2.2' } }, include, opts)
                  .then(result => {
                    expect(result.audit.id).toBe(a2.id);
                    expect(result.audit.manager).toBe('a2.2');
                    done();
                  }))));
        });

        it('should skip update if not included', done => {
          Order.create({ name: 'o1' }).then(o =>
            Audit.create({ orderId: o.id, manager: 'a1' }).then(a1 =>
              Audit.create({ manager: 'a2' }).then(a2 =>
                embed.update(Order, { id: o.id, audit: { id: a2.id, manager: 'a2.2' } }, [], opts)
                  .then(result => {
                    expect(result.audit.id).toBe(a1.id);
                    expect(result.audit.manager).toBe('a1');
                    done();
                  }))));
        });

      });
    });
  });
});
