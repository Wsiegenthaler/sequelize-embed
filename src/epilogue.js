var lo = require('lodash');
var epilogue = require('epilogue');

var embed = require('./index')(sequelize);

var { insert, update } = embed;
var { pruneFks, isBelongsTo, isBelongsToMany } = embed.util;


function EpilogueExport(sequelize) {

  // ------------------ Middleware factory -------------------
  
  var factory = (options) => ({
    extraConfiguration: (resource) => {
      options = lo.defaults(options, { pruneFks: true });

      /* Override standard includes */
      var readInclude = options.readInclude || lo.clone(resource.include);
      resource.include.splice(0, resource.include.length);

      /* Determine includes to embed. If not passed as an option, defaults to HasOne and HasMany of the read includes */
      var embedInclude = options.embedInclude;
      if (lo.isUndefined(embedInclude)) 
        embedInclude = lo.cloneDeep(readInclude.filter(inc => !isBelongsTo(inc.association) && !isBelongsToMany(inc.association)));

      var handleError = err => {
        if (err.constructor === sequelize.OptimisticLockError)
          throw new epilogue.Errors.EpilogueError(409, 'conflict', err.message, err);
        else throw new epilogue.Errors.EpilogueError(500, 'internal error', err.message, err);
      }

      /* ----------------- READ ----------------- */

      /* Read all association we want as part of the presentation */
      resource.read.fetch.before((req, res, ctx) => {
        ctx.include = readInclude;
        ctx.continue();
      });

      /* Prune foreign keys before sending result */
      if (options.pruneFks) {
        resource.read.send.before((req, res, ctx) => {
          pruneFks(ctx.instance, readInclude);
          ctx.continue();
        });
      }

      /* ----------------- CREATE ----------------- */

      /* Restore this models fks and include all embedded associations for insertion */
      resource.create.write.before((req, res, ctx) => 
        insert(resource.model, req.body, embedInclude, { readInclude, pruneFks: options.pruneFks })
          .then(inst => ctx.instance = inst)
          .catch(handleError)
          .then(ctx.skip));

      /* ----------------- UPDATE ----------------- */

      /* Prepare for read */
      resource.update.fetch.before((req, res, ctx) => ctx.skip);

      /* Perform updates and skip the default write milestone */
      resource.update.write.before((req, res, ctx) => 
        update(resource.model, req.body, embedInclude, { readInclude, pruneFks: options.pruneFks })
          .then(inst => ctx.instance = inst)
          .catch(handleError)
          .then(ctx.skip));
    }
  });

  return factory;
}


module.exports = EpilogueExport;
