const lo = require('lodash');

function FinaleExport(embed, sequelize, finale) {

  const { insert, update } = embed;
  const { prune } = embed.util;

  // ------------------ Middleware factory -------------------
  
  const factory = (include, options) => ({
    extraConfiguration: resource => {
      options = lo.defaults(options, { reload: { plain: false, prune: true }, prefetchUpdate: true });

      /* Override standard includes */
      options.reload.include = options.reload.include || lo.clone(resource.include);
      resource.include.splice(0, resource.include.length);

      const handleError = err => {
        if (err.constructor === sequelize.OptimisticLockError)
          throw new finale.Errors.FinaleError(409, 'conflict', err.message, err);
        else throw new finale.Errors.FinaleError(500, 'internal error', err.message, err);
      }

      /* ----------------- READ ----------------- */

      /* Read all associations we want as part of the presentation */
      resource.read.fetch.before((req, res, ctx) => {
        ctx.include = options.reload.include;
        ctx.continue();
      });

      /* Prune foreign keys before sending result */
      if (options.reload.prune) {
        resource.read.send.before((req, res, ctx) => {
          prune(resource.model, ctx.instance, options.reload.include);
          ctx.continue();
        });
      }

      /* ----------------- LIST ----------------- */

      /* List all associations we want as part of the presentation */
      resource.list.fetch.before((req, res, ctx) => {
        ctx.include = options.reload.include;
        ctx.continue();
      });

      /* Prune foreign keys before sending result */
      if (options.reload.prune) {
        resource.list.send.before((req, res, ctx) => {
          ctx.instance.map(inst => prune(resource.model, inst, options.reload.include));
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
      resource.update.fetch.before((req, res, ctx) => {
        if (options.prefetchUpdate) {
          ctx.include = options.reload.include;
          ctx.continue();
        } else ctx.skip();
      });

      /* Perform updates and skip the default write milestone */
      resource.update.write.before((req, res, ctx) => {
        if (options.prefetchUpdate) {
          ctx.instance.set(req.body);
        
          /* Ensure version attribute is set */
          var ver = resource.model.options.version;
          if (ver) {
            ver = lo.isString(ver) ? ver : 'version';
            ctx.instance.set(ver, req.body[ver], { raw: true });
            ctx.instance.changed(ver, true); // force update
          }
        } else ctx.instance = req.body;

        return update(resource.model, ctx.instance, include, options)
          .then(inst => ctx.instance = inst)
          .catch(handleError)
          .then(ctx.skip);
      });
    }
  });

  return factory;
}


module.exports = FinaleExport;
