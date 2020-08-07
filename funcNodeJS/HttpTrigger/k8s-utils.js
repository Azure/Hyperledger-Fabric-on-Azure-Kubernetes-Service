module.exports = {
    createClient: function(base64EncodedKubernetesConfig){
        // connection
        const Request = require('kubernetes-client/backends/request')

        const { Client, KubeConfig } = require('kubernetes-client')

        const kubeconfig = new KubeConfig()

        const config = Buffer.from(base64EncodedKubernetesConfig, 'base64').toString()
        kubeconfig.loadFromString(config)
        const backend = new Request({
            kubeconfig
        });

        const aksClientVersion = '1.13'
        const client = new Client({
            backend,
            version: aksClientVersion
        });

        return client;
    },
    createIfNotExist: async function createIfNotExist(apiPath, manifest, logger){
        try {
          await apiPath(manifest.metadata.name).get();
        } catch (error) {
          if(error.statusCode !== 404){
            logger.error(`Creation ${manifest.kind} with name ${manifest.metadata.name} failed. Error: ${error}`);
            throw error;
          }

          logger.info(`Create resource ${manifest.kind} with name ${manifest.metadata.name}`);
          await apiPath.post({body: manifest});
          return;
        }

        logger.info(`Resource ${manifest.kind} with name ${manifest.metadata.name} already exists. Skip creation.`);
    },
    tryGetResource: async function (apiPath, resourceName, logger){
      // take last element in api path - resource kind
      let resourceKind = '';
      if(apiPath.splits && apiPath.splits.length){
        resourceKind = apiPath.splits[apiPath.splits.length - 1];
      }

      try {
        const result = await apiPath(resourceName).get();
        logger.info(`Resource ${resourceKind} with name ${resourceName} exists.`);
        return result;
      } catch (error) {
        if(error.statusCode !== 404){
          logger.error(`Get resource ${resourceKind} with name ${resourceName} failed. Error: ${error}`);
          throw error;
        }

        logger.info(`Resource ${resourceKind} with name ${resourceName} is not found`);
        return;
      }
  }
};
