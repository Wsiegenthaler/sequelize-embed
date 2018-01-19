"use strict";

const lo = require('lodash');

const mkIncludes = (...args) => lo.flatten(args).filter(e => e !== null);
const mkInclude = (association, ...includes) => ({ model: association.target, include: mkIncludes(...includes), association });
const when = (condition, ...includes) => !condition ? [] : includes;

module.exports = { mkIncludes, mkInclude, when };
