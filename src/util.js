var lo = require('lodash');
var Promise = require('bluebird');


/* 
 * Wrapper for Promise.all which will reject only after all promises have either
 * resolved or rejected (see bluebird .reflect). If any promises reject, will
 * throw the first one encountered, but only after all promises have concluded.
 */
var allReflect = promises => 
  Promise.all(lo.flatten(promises.map(p => Promise.resolve(p).reflect())))
    .then(inspections => {
      var firstReject = inspections.find(pi => pi.isRejected());
      if (firstReject) throw firstReject.reason();
    });

/* 
 * Compares two arrays and categorizes elements as added, removed, or existing (exists in both, 
 * either changed or unchanged). Elements are matched by primary key(s).
 */
var diff = (current, original, comparator) => {
  current = current || [];
  original = original || [];
  return {
    added: lo.differenceWith(current, original, comparator),
    removed: lo.differenceWith(original, current, comparator),
    existing: original.map(v => ({ current: current.find(v2 => comparator(v, v2)), original: v }))
      .filter(result => !!result.current)
  };
};

/* Detects whether value object is an instance of the given model. Supports sequelize v3 & v4. */
var isModelInstance = (model, value) => value instanceof (model.Instance || model);

/* Compares primary key fields of two objects given their model and indicates whether they match */
var pkMatch = model => (a, b) => lo.every(model.primaryKeyAttributes.map(attr => a[attr] === b[attr]));

/* Constructs a sequelize compatible 'where' object with primary keys as defined by 'model' and 'val' */
var pkWhere = (model, val) => lo.fromPairs(model.primaryKeyAttributes.map(attr => [attr, val[attr]]));

/* Association type detection */
var isAssociationType = (type) => (a) => a.associationType === type || (!!a.association && a.association.associationType === type);
var isHasOne = isAssociationType('HasOne'),
    isHasMany = isAssociationType('HasMany'),
    isBelongsTo = isAssociationType('BelongsTo'),
    isBelongsToMany = isAssociationType('BelongsToMany');

// ------------------ Exports -------------------

module.exports = {
  allReflect,
  diff,
  isModelInstance,
  pkMatch,
  pkWhere,
  isHasOne, isHasMany, isBelongsTo, isBelongsToMany
};
