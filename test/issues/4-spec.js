
const Bluebird = require('bluebird');

const { Sequelize, sequelize, sync } = require('../common');

const embed = require('../../src/index')(sequelize);
const { mkIncludes, mkInclude } = embed.util.helpers;


/* --- setup --- */

const ModelA = sequelize.define('ModelA', {});

const ModelB = sequelize.define('ModelB', {
  valA: Sequelize.STRING,
  valB: Sequelize.STRING
});

ModelA.ModelB = ModelA.hasOne(ModelB, { as: 'b', foreignKey: 'aId' });

const include = mkIncludes(mkInclude(ModelA.ModelB));
const opts = { reload: { include } };


/* --- tests --- */

describe('issue-4', () => {

  beforeEach(sync);

  it('should match pk despite different type', done => {
    ModelA.create({}).then(a =>
      ModelB.create({ id: 3, aId: a.id, valA: 'ayy', valB: 'bae' }).then(b =>
        embed.update(ModelA, { id: a.id, b: { id: '3', valA: 'ayyy' } }, include, opts)
          .then(result => {
            expect(result.b.id).toBe(b.id);
            expect(result.b.valA).toBe('ayyy');
            expect(result.b.valB).toBe('bae');
            done();
          })));
  });
});
