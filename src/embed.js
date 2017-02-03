
var lo = require('lodash');
var Promise = require('bluebird');

var { allReflect, diff, isModelInstance, pkId, isHasOne, isHasMany, isBelongsTo, isBelongsToMany } = require('./util');
var helpers = require('./include-helpers');


function EmbedExport(sequelize) {

  /* Core api */
  var insert = (model, values, include, options) => apiWrap(t => insertDeep(model, values, include, t), model, include, options)  
  var update = (model, values, include, options) => apiWrap(t => updateDeep(model, values, include, t), model, include, options) 

  /* Default options for core api */
  var defaults = { reload: true };

  var apiWrap = (action, model, include, options) => {
    options = lo.merge(defaults, options);
    var externalTx = lo.isObject(options.transaction);
    return (externalTx ? Promise.resolve(options.transaction) : sequelize.transaction())
      .then(t => action(t)
        .tap(commit(t, externalTx))
        .catch(rollback(t, externalTx))
        .then(inst => reload(model, inst, include, options.reload)))
  };

  var traverseDeep = (model, values, include, t, action) => 
    updateUpstream(model, values, include, t)
      .then(action)
      .then(inst => updateDownstream(inst, values, include, t))

  var insertDeep = (model, values, include, t) => traverseDeep(model, values, include || [], t, () => insertSelf(model, values, t))
  var updateDeep = (model, values, include, t) => traverseDeep(model, values, include || [], t, () => updateSelf(model, values, t))

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
    var pkVal = val[model.primaryKeyAttribute];
    if (pkVal) {
      return model.findById(pkVal).then(curVal =>
        lo.isObject(curVal) ?
          updateDeep(model, val, include, t) :
          insertDeep(model, val, include, t));
    } else return insertDeep(model, val, include, t);
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
      if (!lo.isUndefined(val)) return updateHasValues(instance, val, a, inc.include, t);
    }));

  var updateHasManys = (instance, data, include, t) => 
    allReflect(include.map(inc => {
      var a = inc.association, as = a.associationAccessor, vals = data[as];
      if (lo.isArray(vals) || vals === null) return updateHasValues(instance, vals || [], a, inc.include, t);
    }));

  var updateHasValues = (instance, vals, a, include, t) => 
    a.get(instance).then(lastVals => {
      var delta = diff(vals, lastVals, pkId(a.target));
      return allReflect(
        lo.flatten([
          delta.added.map(add => {
            add[a.foreignKey] = instance[a.source.primaryKeyAttribute];
            return updateOrInsert(a.target, add, include, t);
          }),
          delta.removed.map(removed => removed.destroy({ transaction: t })),
          delta.existing.map(existing => updateDeep(a.target, existing.current, include, t)) ]
        ));
      });

  /* Removes redundant foreign keys from structure */
  var pruneFks = (model, instance, include) => {
    var clearFk = (model, inst, key) => {
      if (inst && inst.dataValues) {
        if (!lo.some(model.primaryKeyAttributes, pk => pk===key)) {
          delete inst.dataValues[key];
        } 
      }
    }
    if (lo.isArray(include)) {
      include.map(inc => {
        var a = inc.association;
        if (isBelongsTo(a)) {
          clearFk(model, instance, a.foreignKey);
          pruneFks(inc.model, instance[a.associationAccessor], inc.include);
        } else if (isHasOne(a)) {
          clearFk(inc.model, instance[a.associationAccessor], a.foreignKey);
          pruneFks(inc.model, instance[a.associationAccessor], inc.include);
        } else if (isHasMany(a)) {
          instance[a.associationAccessor].map(child => {
            clearFk(inc.model, child, a.foreignKey);
            pruneFks(inc.model, child, inc.include);
          });
        }
      });
    }
  };

  /* Converts sequelize instances to plain objects (dataValues) */
  var plainify = (instance, include) => {
    if (!lo.isObject(instance)) return instance;
    var clone = lo.clone(instance.dataValues);
    include.map(inc => {
      var a = inc.association, as = a.associationAccessor, vals = instance[as];
      if (isBelongsTo(a) || isHasOne(a))
        lo.set(clone, as, plainify(vals, inc.include));
      else if (isHasMany(a))
        lo.set(clone, as, vals.map(val => plainify(val, inc.include)));
    });
    return clone;
  };

  var reload = (model, instance, include, options) => {
    var defaults = { include, pruneFks: true, plain: false };
    if (lo.isObject(options)) lo.merge(defaults, options);
    else if (options) options = defaults;
    else return Promise.resolve(instance);
    return instance.reload({ include: options.include }).then(inst => {
      if (!lo.isBoolean(options.pruneFks) || !!options.pruneFks) pruneFks(model, inst, options.include);
      if (!lo.isBoolean(options.plain) || !!options.plain) {
        return plainify(inst, options.include);
      } else return inst;
    })
  };


  // ------------------ Exports -------------------
  
  return {
    insert,
    update,
    util: {
      helpers,
      pruneFks,
      isHasOne, isHasMany, isBelongsTo, isBelongsToMany
    }
  };
}


module.exports = EmbedExport;
