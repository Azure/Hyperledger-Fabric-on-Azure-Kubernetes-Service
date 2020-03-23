module.exports = async function (options, logger) {
  try {
    await provisionFabricToolsContainer(options, logger);
    return {
      status: 200,
      provisioningState: 'Validation', // this status means that now we need to validate deployment in k8s
    };
  } catch (error) {
    logger.error(`Provisioning of fabric tools container failed with ${error}`);
    return {
      status: 409,
      provisioningState: 'Failed', // now we can't retry anyway, so fail.
      error: {
        message: `Provisioning of fabric tools container failed with ${error}`
      }
    };
  }
}

async function provisionFabricToolsContainer(options, logger) {
  // define HLF variables
  const {
    hlfOrgName, hlfMemberType, hlfNodesNumber,
    hlfBackendDbType,
    userName, userPswd, postgresConnectionString,
    dnsZoneDomain, publicIpAddress: publicIP
  } = options;

  // create k8s client and define helper for resource creation - createIfNotExist.
  const { createClient, createIfNotExist } = require('./k8s-utils');

  // k8s
  const kuberConfig = process.env.KubernetesClusterAdminCredential
  logger.info(`Successfully loaded KubernetesClusterAdminCredential from env variables`);
  const client = createClient(kuberConfig);

  // FABRIC TOOLS NAMESPACE
  const toolsNamespace = 'tools';
  const manifestFtNamespaceTools = require('../aksManifests/fabricTools/namespace.json');
  manifestFtNamespaceTools.metadata.name = toolsNamespace;
  await createIfNotExist(client.api.v1.namespaces, manifestFtNamespaceTools, logger);

  // CA-SERVER CREDENTIALS SECRET
  const manifestFtSecretCaCredentials = require('../aksManifests/fabricTools/secretCaCredentials.json');
  manifestFtSecretCaCredentials.stringData['ca-admin-user'] = userName;
  manifestFtSecretCaCredentials.stringData['ca-admin-password'] = userPswd;
  await createIfNotExist(client.api.v1.namespaces(toolsNamespace).secrets, manifestFtSecretCaCredentials, logger);

  // CA-SERVER ROOT PRIVATE CERTIFICATE SECRET
  if (process.env.hlfCaRootCertPrivateKey) {
    logger.info('Adding user provided hlfCaRootCertPrivateKey');
    const manifestFtSecretCaPrivateCertificate = require('../aksManifests/fabricTools/secretCaPrivateCertificate.json');
    manifestFtSecretCaPrivateCertificate.stringData['rca.key'] = decode(process.env.hlfCaRootCertPrivateKey);
    await createIfNotExist(client.api.v1.namespaces(toolsNamespace).secrets, manifestFtSecretCaPrivateCertificate, logger);
  }

  // CA-SERVER ROOT PUBLIC CERTIFICATE SECRET
  if (process.env.hlfCaRootCertPublicKey) {
    logger.info('Adding user provided hlfCaRootCertPublicKey');
    const manifestFtSecretCaPublicCertificate = require('../aksManifests/fabricTools/secretCaPublicCertificate.json');
    manifestFtSecretCaPublicCertificate.stringData['rca.pem'] = decode(process.env.hlfCaRootCertPublicKey);
    await createIfNotExist(client.api.v1.namespaces(toolsNamespace).secrets, manifestFtSecretCaPublicCertificate, logger);
  }

  // SECRET FOR AZURE CONTAINER REGISTRY
  const manifestFtSecretFabricTools = require('../aksManifests/fabricTools/secretFabricTools.json');
  await createIfNotExist(client.api.v1.namespaces(toolsNamespace).secrets, manifestFtSecretFabricTools, logger);

  // SECRET FOR CA-SERVER POSTGRESQL
  const manifestFtSecretCaServerDB = require('../aksManifests/fabricTools/secretCaServerDB.json');
  manifestFtSecretCaServerDB.stringData.datasource = postgresConnectionString;
  await createIfNotExist(client.api.v1.namespaces(toolsNamespace).secrets, manifestFtSecretCaServerDB, logger);

  // DEPLOY CONFIG MAP WITH OMS AGENT CONFIGURATION TO ENABLE SCRAPPING PROMETHEUS METRICS
  const yaml = require('js-yaml');
  const fs = require('fs');
  const cfg = yaml.safeLoad(fs.readFileSync('./aksManifests/fabricTools/container-azm-ms-agentconfig.yaml', 'utf8'));
  await createIfNotExist(client.api.v1.namespaces('kube-system').configmap, cfg, logger);

  // FIXTURES FOR FABRIC-TOOLS CONTAINER
  // sleep needed to apply secrets
  // TODO: implement retries request instead sleep
  await sleep(5000);
  const manifestFtServiceAccount = require('../aksManifests/fabricTools/serviceAccount.json');
  await createIfNotExist(client.api.v1.namespaces(toolsNamespace).serviceaccounts, manifestFtServiceAccount, logger);

  // sleep needed to apply service account
  // TODO: implement retries request instead sleep
  await sleep(5000);
  const manifestFtClusterRoleBinding = require('../aksManifests/fabricTools/clusterRoleBinding.json');
  await createIfNotExist(client.apis['rbac.authorization.k8s.io'].v1.clusterrolebindings, manifestFtClusterRoleBinding, logger);

  // FABRIC-TOOLS POD
  const manifestFtPod = require('../aksManifests/fabricTools/pod.json');
  manifestFtPod.spec.containers[0].env[0].value = publicIP;
  manifestFtPod.spec.containers[0].env[1].value = hlfMemberType;
  manifestFtPod.spec.containers[0].env[2].value = String(hlfNodesNumber);
  manifestFtPod.spec.containers[0].env[3].value = hlfOrgName;
  manifestFtPod.spec.containers[0].env[4].value = hlfBackendDbType;
  manifestFtPod.spec.containers[0].env[5].value = dnsZoneDomain;
  await createIfNotExist(client.api.v1.namespaces(toolsNamespace).pods, manifestFtPod, logger);
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  });
}

// Helper function to decode base64 data to utf-8 text
function decode(base64Data) {
  return Buffer.from(base64Data, 'base64').toString('utf-8');
}
