const lo = require('lodash');
const Promise = require('bluebird');


/* 
 * Wrapper for Promise.all which will reject only after all promises have either
 * resolved or rejected (see bluebird .reflect). If any promises reject, will
 * throw the first one encountered, but only after all promises have concluded.
 */
const allReflect = promises => 
  Promise.all(lo.flatten(promises.map(p => Promise.resolve(p).reflect())))
    .then(inspections => {
      const firstReject = inspections.find(pi => pi.isRejected());
      if (firstReject) throw firstReject.reason();
    });

/* 
 * Compares two arrays and categorizes elements as added, removed, or existing (exists in both, 
 * either changed or unchanged). Elements are matched by primary key(s).
 */
const diff = (current, original, comparator) => {
  current = current || [];
  original = original || [];
  return {
    added: lo.differenceWith(current, original, comparator),
    removed: lo.differenceWith(original, current, comparator),
    existing: original.map(v => ({ current: current.find(v2 => comparator(v, v2)), original: v }))
      .filter(result => !!result.current)
  };
};

/* Converts sequelize instances to plain objects (does not mutate instance) */
const plainify = (model, instance, include) => {
  if (!lo.isObject(instance)) return instance;
  const clone = lo.pick(instance, lo.keys(model.rawAttributes));
  (include || []).map(inc => {
    const a = inc.association, as = a.associationAccessor, vals = instance[as];
    if (isBelongsTo(a) || isHasOne(a))
      lo.set(clone, as, plainify(a.target, vals, inc.include));
    else if (isHasMany(a))
      lo.set(clone, as, vals.map(val => plainify(a.target, val, inc.include)));
  });
  return clone;
};

/* Removes redundant foreign keys from structure (mutates instance) */
const prune = (model, instance, include) => {
  const clearFk = (model, inst, key) => {
    if (inst) delete inst[key];
    if (inst && inst.dataValues) delete inst.dataValues[key];
  }
  (include || []).map(inc => {
    const a = inc.association, as = a.associationAccessor, value = instance[as];
    if (isBelongsTo(a)) {
      clearFk(model, instance, a.foreignKey);
      prune(inc.model, value, inc.include);
    } else if (isHasOne(a)) {
      clearFk(inc.model, value, a.foreignKey);
      prune(inc.model, value, inc.include);
    } else if (isHasMany(a)) {
      value.map(child => {
        clearFk(inc.model, child, a.foreignKey);
        prune(inc.model, child, inc.include);
      });
    }
  });
  return instance;
};

/* Detects whether value object is an instance of the given model. Supports sequelize v3 & v4. */
const isModelInstance = (model, value) => value instanceof (model.Instance || model);

/* Compares primary key fields of two objects given their model and indicates whether they match */
const pkMatch = model => (a, b) => lo.every(model.primaryKeyAttributes.map(attr => a[attr] == b[attr]));

/* Constructs a sequelize compatible 'where' object with primary keys as defined by 'model' and 'val' */
const pkWhere = (model, val) => lo.fromPairs(model.primaryKeyAttributes.map(attr => [attr, val[attr]]));

/* Association type detection */
const isAssociationType = type => a => a.associationType === type || (!!a.association && a.association.associationType === type);
const isHasOne = isAssociationType('HasOne'),
      isHasMany = isAssociationType('HasMany'),
      isBelongsTo = isAssociationType('BelongsTo'),
      isBelongsToMany = isAssociationType('BelongsToMany');

// ------------------ Exports -------------------

module.exports = {
  allReflect,
  diff,
  plainify,
  prune,
  isModelInstance,
  pkMatch,
  pkWhere,
  isHasOne, isHasMany, isBelongsTo, isBelongsToMany
};
