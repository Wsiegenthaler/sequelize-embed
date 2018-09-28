
const lo = require('lodash');
const Promise = require('bluebird');

const { allReflect, diff, plainify, prune, isModelInstance, pkMatch, pkWhere, isHasOne, isHasMany, isBelongsTo, isBelongsToMany } = require('./util');
const helpers = require('./include-helpers');


function EmbedExport(sequelize) {

  /* Core api */
  const insert = (model, values, include, options) => apiWrap((inc, t) => insertDeep(model, values, inc, t), model, include, options);
  const update = (model, values, include, options) => apiWrap((inc, t) => updateDeep(model, values, inc, t), model, include, options);

  /* Default options for core api */
  const defaults = { reload: true };

  const apiWrap = (action, model, include, options) => {
    options = lo.merge(defaults, options);
    include = lo.cloneDeep(include);
    const externalTx = lo.isObject(options.transaction);
    return (externalTx ? Promise.resolve(options.transaction) : sequelize.transaction())
      .then(t => action(include, t)
        .tap(commit(t, externalTx))
        .catch(rollback(t, externalTx))
        .then(inst => reload(model, inst, include, options.reload)));
  };

  const traverseDeep = (model, values, include, t, action) => 
    updateUpstream(model, values, include, t)
      .then(action)
      .then(inst => updateDownstream(inst, values, include, t));

  const insertDeep = (model, values, include, t) => traverseDeep(model, values, include, t, () => insertSelf(model, values, t));
  const updateDeep = (model, values, include, t) => traverseDeep(model, values, include, t, () => updateSelf(model, values, t));

  const commit = (t, skip) => () => {
    if (!skip) return t.commit();
  }

  const rollback = (t, skip) => err => Promise.try(() => {
    if (!skip && !t.finished) return t.rollback().catch(lo.noop);
  }).throw(err);

  const insertSelf = (model, values, t) => 
    model.create(isModelInstance(model, values) ? values.dataValues : values, { transaction: t, isNewRecord: true });

  const updateSelf = (model, values, t) => {
    const inst = isModelInstance(model, values) ? values : model.build(values, { isNewRecord: false });

    /* preserve version attribute for optimistic locking */
    var ver = model.options.version;
    if (ver) {
      ver = lo.isString(ver) ? ver : 'version';
      inst.set(ver, values[ver], { raw: true });
      inst.changed(ver, true); // force update if versioned
    }

    return inst.save({ transaction: t });
  }

  const updateUpstream = (model, values, include, t) => 
    updateBelongsTos(model, values, (include || []).filter(isBelongsTo), t);

  const updateDownstream = (instance, values, include, t) => {
    const hasManyInclude = (include || []).filter(isHasMany), hasOneInclude = (include || []).filter(isHasOne);
    return allReflect([ updateHasManys(instance, values, hasManyInclude, t), updateHasOnes(instance, values, hasOneInclude, t) ])
      .then(() => instance);
  }

  /* Builds a new instance from the original and applies values */
  const mergeInstance = (model, inst, vals, include) => {
    inst.set(isModelInstance(model, vals) ? vals.dataValues : vals);
    (include || []).map(inc => {
      const a = inc.association, as = a.associationAccessor;
      inst[as] = vals[as];
    });
    return inst;
  }

  const updateOrInsert = (model, val, include, t) => {
    const hasPk = lo.every(model.primaryKeyAttributes, attr => val[attr]);
    if (hasPk) {
      const where = pkWhere(model, val);
      return model.findOne({ where }).then(curVal =>
        lo.isObject(curVal) ?
          updateDeep(model, mergeInstance(model, curVal, val, include), include, t) :
          insertDeep(model, val, include, t));
    } else return insertDeep(model, val, include, t);
  }

  const updateBelongsTos = (model, values, include, t) => {
    const link = a => instance => {
      values[a.associationAccessor] = instance;
      values[a.identifier] = instance[a.target.primaryKeyAttribute];
    };
    const unlink = a => {
      delete values[a.associationAccessor];
      values[a.identifier] = null;
    }

    const associations = lo.values(model.associations).filter(isBelongsTo);
    const includeMap = lo.reduce(include, (m, i) => m.set(i.association.associationAccessor, i), new Map());
    return allReflect(associations.map(a => {
      const as = a.associationAccessor, val = values[as];
      if (!lo.isUndefined(val)) {
        if (val !== null) {
          const inc = includeMap.get(as);
          return Promise.resolve(inc ? updateOrInsert(a.target, val, inc.include, t) : val).tap(link(a));
        } else unlink(a);
      }
    }));
  }

  const updateHasOnes = (instance, values, include, t) => 
    allReflect((include || []).map(inc => {
      const a = inc.association, as = a.associationAccessor, val = values[as];
      if (!lo.isUndefined(val)) return updateHasValues(instance, val, a, inc.include, t);
    }));

  const updateHasManys = (instance, data, include, t) => 
    allReflect((include || []).map(inc => {
      const a = inc.association, as = a.associationAccessor, vals = data[as];
      if (lo.isArray(vals) || vals === null) return updateHasValues(instance, vals || [], a, inc.include, t);
    }));

  const updateHasValues = (instance, vals, a, include, t) => 
    a.get(instance).then(lastVals => {
      const array = vals => lo.filter(lo.isArray(vals) ? vals : [ vals ], v => !!v);
      lastVals = array(lastVals);
      vals = array(vals).map(v => lo.set(v, a.foreignKey, instance[a.sourceKey || a.source.primaryKeyAttribute]));
      const delta = diff(vals, lastVals, pkMatch(a.target));
      return allReflect(
        lo.flatten([
          delta.added.map(add => updateOrInsert(a.target, add, include, t)),
          delta.removed.map(removed => removed.destroy({ transaction: t })),
          delta.existing.map(existing => updateDeep(a.target, mergeInstance(a.target, existing.original, existing.current, include), include, t)) ]
        ));
      });

  const reload = (model, instance, include, options) => {
    const defaults = { include, prune: true, plain: false };
    if (lo.isObject(options)) lo.defaults(options, defaults);
    else if (options) options = defaults;
    else return Promise.resolve(instance);
    return instance.reload({ include: options.include }).then(inst => {
      if (options.prune) prune(model, inst, options.include);
      return options.plain ? plainify(model, inst, options.include) : inst;
    })
  };


  // ------------------ Exports -------------------
  
  return {
    insert,
    update,
    util: {
      diff,
      plainify,
      prune,
      helpers,
      isHasOne, isHasMany, isBelongsTo, isBelongsToMany
    }
  };
}


module.exports = EmbedExport;
