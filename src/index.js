
var lo = require('lodash');
var Promise = require('bluebird');

var { allReflect, diff, isModelInstance, pkId, isHasOne, isHasMany, isBelongsTo, isBelongsToMany } = require('./util');


function IndexExport(sequelize) {

  /* Default options for insert/update */
  var defaults = { pruneFks: true, reload: true };

  /* Removes redundant foreign keys from structure */
  var pruneFks = (instance, include) => {
    var clearFk = (inst, key) => inst ? inst.set(key) : null;
    if (lo.isArray(include)) {
      include.map(inc => {
        var a = inc.association;
        if (isBelongsTo(a)) {
          clearFk(instance, a.foreignKey);
          pruneFks(instance[a.associationAccessor], inc.include);
        } else if (isHasOne(a)) {
          clearFk(instance[a.associationAccessor], a.foreignKey);
          pruneFks(instance[a.associationAccessor], inc.include);
        } else if (isHasMany(a)) {
          instance[a.associationAccessor].map(child => {
            clearFk(child, a.foreignKey);
            pruneFks(child, inc.include);
          });
        }
      });
    }
  };

  var insert = (model, values, include, options) => {
    options = lo.defaults(options, defaults);
    var externalTx = lo.isObject(options.transaction);
    return (externalTx ? Promise.resolve(options.transaction) : sequelize.transaction())
      .then(t => insertDeep(model, values, include, t)
        .tap(commit(t, externalTx))
        .catch(rollback(t, externalTx))
        .then(inst => !options.reload ? Promise.resolve(inst) : reload(inst, options.readInclude, options.pruneFks)))
  };

  var update = (model, values, include, options) => {
    options = lo.defaults(options, defaults);
    var externalTx = lo.isObject(options.transaction);
    return (externalTx ? Promise.resolve(options.transaction) : sequelize.transaction())
      .then(t => updateDeep(model, values, include, t)
        .tap(commit(t, externalTx))
        .catch(rollback(t, externalTx))
        .then(inst => !options.reload ? Promise.resolve(inst) : reload(inst, options.readInclude, options.pruneFks)))
  };

  var insertDeep = (model, values, include, t) => 
    updateUpstream(model, values, include, t)
      .then(() => insertSelf(model, values, t))
      .then(inst => updateDownstream(inst, values, include, t))

  var updateDeep = (model, values, include, t) => 
    updateUpstream(model, values, include, t)
      .then(() => updateSelf(model, values, t))
      .then(inst => updateDownstream(inst, values, include, t))

  var commit = (t, skip) => () => {
    if (!skip) return t.commit()
  }

  var rollback = (t, skip) => err => Promise.try(() => {
    if (!skip && !t.finished) return t.rollback().catch(lo.noop);
  }).throw(err);

  var insertSelf = (model, values, t) => model.create(values, { transaction: t });

  var updateSelf = (model, values, t) => {
    var inst = isModelInstance(model, values) ? values : model.build(values, { isNewRecord: false });

    /* preserve version attribute for optimistic locking */
    var ver = model.options.version;
    if (ver) {
      ver = lo.isString(ver) ? ver : 'version';
      inst.set(ver, values[ver], { raw: true });
    }

    return inst.save({ transaction: t });
  }

  var updateUpstream = (model, values, include, t) => 
    updateBelongsTos(model, values, include.filter(isBelongsTo), t)

  var updateDownstream = (instance, values, include, t) => {
    var hasManyInclude = include.filter(isHasMany), hasOneInclude = include.filter(isHasOne);
    return allReflect([updateHasManys(instance, values, hasManyInclude, t), updateHasOnes(instance, values, hasOneInclude, t) ])
      .then(() => instance);
  }

  var updateOrInsert = (model, val, include, t) => {
    var insert = (val) => insertDeep(model, val, include, t)
    var update = (inst, val) => updateDeep(model, val, include, t)

    var pk = model.primaryKeyAttribute, pkVal = val[pk];
    if (pkVal) {
      /* Association may exist, update if found else insert */
      return model.findById(pkVal).then(curVal => {
        if (curVal) return update(curVal, val);
        else return insert(val);
      });
    } else return insert(val);
  }

  var updateBelongsTos = (model, values, include, t) => {
    var link = a => instance => {
      values[a.associationAccessor] = instance;
      values[a.identifier] = instance[a.target.primaryKeyAttribute];
    };
    var unlink = a => {
      delete values[a.associationAccessor];
      values[a.identifier] = null;
    }

    var associations = lo.values(model.associations).filter(isBelongsTo);
    var includeMap = lo.reduce(include, (m, i) => m.set(i.association, i), new Map());
    return allReflect(associations.map(a => {
      var as = a.associationAccessor, val = values[as];
      if (!lo.isUndefined(val)) {
        if (val !== null) {
          var inc = includeMap.get(a);
          return Promise.resolve(inc ? updateOrInsert(a.target, val, inc.include, t) : val).tap(link(a));
        } else unlink(a);
      }
    }));
  }

  var updateHasOnes = (instance, values, include, t) => 
    allReflect(include.map(inc => {
      var a = inc.association, as = a.associationAccessor, val = values[as];
      if (!lo.isUndefined(val)) {
        return a.get(instance).then(lastVal => {
          var delta = diff(val, lastVal, pkId(a.target));
          return allReflect(
            lo.flatten([
              delta.added.map(add => {
                add[a.foreignKey] = instance[a.source.primaryKeyAttribute];
                return updateOrInsert(inc.model, add, inc.include, t);
              }),
              delta.removed.map(removed => removed.destroy({ transaction: t })),
              delta.existing.map(existing => updateDeep(inc.model, existing.current, inc.include, t)) ]
            ));
        });
      }
    }));

  var updateHasManys = (instance, data, include, t) => 
    allReflect(include.map(inc => {
      var a = inc.association, as = a.associationAccessor, vals = data[as];
      if (lo.isUndefined(vals)) {
        // no value of given for update, skip
      } else if (lo.isArray(vals) || vals === null) {
        vals = vals || [];
        return a.get(instance).then(lastVals => {
          var delta = diff(vals, lastVals, pkId(a.target));
          return allReflect(
            lo.flatten([
              delta.added.map(add => {
                add[a.foreignKey] = instance[a.source.primaryKeyAttribute];
                return updateOrInsert(inc.model, add, inc.include, t);
              }),
              delta.removed.map(removed => removed.destroy({ transaction: t })),
              delta.existing.map(existing => updateDeep(inc.model, existing.current, inc.include, t)) ]
            ));
        });
      }
    }));

  var reload = (instance, include, prune) => 
    instance.reload({ include: include }).tap(inst => {
      if (!lo.isBoolean(prune) || !!prune) pruneFks(inst, include);
    });


  // ------------------ Exports -------------------
  
  return {
    insert,
    update,
    util: { pruneFks, isHasOne, isHasMany, isBelongsTo, isBelongsToMany }
  };
}


module.exports = IndexExport;
