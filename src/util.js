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
 * either changed or unchanged). Elements are matched by the provided 'id' accessor.
 */
var diff = (current, original, id) => {
  var prep = val => lo.filter(lo.isArray(val) ? val : [val], v => !!v);
  current = prep(current), original = prep(original);
  return {
    added: lo.differenceBy(current, original, id),
    removed: lo.differenceBy(original, current, id),
    existing: original.map(v => ({ current: current.find(v2 => id(v)===id(v2)), original: v }))
      .filter(result => !!result.current)
  };
};

/* Detects whether value object is an instance of the given model. Supports sequelize v3 & v4. */
var isModelInstance = (model, value) => value instanceof (model.Instance || model);

/* Combines primary key fields of given model and value into single comparable field */
var pkId = model => v => model.primaryKeyAttributes.map(a => v[a]).join(',');

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
  pkId,
  isHasOne, isHasMany, isBelongsTo, isBelongsToMany
};
