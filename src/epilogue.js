var lo = require('lodash');

function EpilogueExport(embed, sequelize, epilogue) {

  var { insert, update } = embed;
  var { pruneFks } = embed.util;

  // ------------------ Middleware factory -------------------
  
  var factory = (model, include, options) => ({
    extraConfiguration: (resource) => {
      options = lo.defaults(options, { reload: { plain: false, pruneFks: true } });

      /* Override standard includes */
      options.reload.include = options.reload.include || lo.clone(resource.include);
      resource.include.splice(0, resource.include.length);

      var handleError = err => {
        if (err.constructor === sequelize.OptimisticLockError)
          throw new epilogue.Errors.EpilogueError(409, 'conflict', err.message, err);
        else throw new epilogue.Errors.EpilogueError(500, 'internal error', err.message, err);
      }

      /* ----------------- READ ----------------- */

      /* Read all association we want as part of the presentation */
      resource.read.fetch.before((req, res, ctx) => {
        ctx.include = options.reload.include;
        ctx.continue();
      });

      /* Prune foreign keys before sending result */
      if (options.reload.pruneFks) {
        resource.read.send.before((req, res, ctx) => {
          pruneFks(model, ctx.instance, options.reload.include);
          ctx.continue();
        });
      }

      /* ----------------- CREATE ----------------- */

      /* Restore this models fks and include all embedded associations for insertion */
      resource.create.write.before((req, res, ctx) => 
        insert(resource.model, req.body, include, options)
          .then(inst => ctx.instance = inst)
          .catch(handleError)
          .then(ctx.skip));

      /* ----------------- UPDATE ----------------- */

      /* Prepare for read */
      resource.update.fetch.before((req, res, ctx) => ctx.skip);

      /* Perform updates and skip the default write milestone */
      resource.update.write.before((req, res, ctx) => 
        update(resource.model, req.body, include, options)
          .then(inst => ctx.instance = inst)
          .catch(handleError)
          .then(ctx.skip));
    }
  });

  return factory;
}


module.exports = EpilogueExport;
