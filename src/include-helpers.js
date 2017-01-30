"use strict";

var lo = require('lodash');

var includez = (...args) => lo.flatten(args).filter(e => e !== null);
var include = (association, ...includes) => ({ model: association.target, include: includez(...includes), association });
var when = (condition, ...includes) => !condition ? [] : includes;

module.exports = { includes: includez, include, when };
