"use strict";

const lo = require('lodash');

const includez = (...args) => lo.flatten(args).filter(e => e !== null);
const include = (association, ...includes) => ({ model: association.target, include: includez(...includes), association });
const when = (condition, ...includes) => !condition ? [] : includes;

module.exports = { includes: includez, include, when };
