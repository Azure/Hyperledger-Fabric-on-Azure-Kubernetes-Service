module.exports = {
    callDeployFabricTools: async function (context, req) {
        context.log('Orchestrator: Initializing storage...');
        const blobClient = await getBlobClient(req);

        // save in blob marker that operation started.
        const operationStartedState = {
            status: 200,
            provisioningState: "Created",
            createdAt: new Date().toISOString()
        };

        const blobContent = JSON.stringify(operationStartedState);
        try {
            // ifNoneMatch: '*', means that upload will be success only if there is no such blob atomically.
            await blobClient.upload(blobContent, blobContent.length, { conditions: { ifNoneMatch: '*' } });
        } catch (error) {
            if (error.statusCode === 409) {
                context.log.warn(`Looks like subsequent call, blob with name ${blobClient.name} exists. Just return its content.`);
                return await getProvisioningStateFromBlob(req);
            }

            context.log.error(`Orchestrator: error creating storage - ${error}`);
            throw error;
        }

        // call deploy fabric tools function and wait either deployFabricTools call fail or we see that provisioningState is changed
        context.log('Orchestrator: Call deploy fabric tools');
        const result = await Promise.race([deployFabricTools(context, req), waitStateChanged(context, req)]);

        context.log('Orchestrator: Initializing completed.');
        return result;
    },

    getDeployFabricToolsStatus: async function (context, req) {
        context.log('GetDeployFabricToolsStatus call');
        let provisioningState = await getProvisioningStateFromBlob(req);
        if (!provisioningState) {
            return provisioningState;
        }

        if (!provisioningState.createdAt) {
            context.log.error('Provisioning state must contain createdAt field.');
            return await setDeployFabricToolsStatus(context, req, {
                status: 409,
                provisioningState: 'Failed',
                error: {
                    message: 'Provisioning state must contain createdAt field.'
                }
            });
        }

        // Give up in 10 minutes (timeout for azure function), if not 'Validation' provisioning state, see below.
        let timeoutInMinutes = 10;
        let additionalInfo = null;

        if (provisioningState.provisioningState === 'Validation') {
            // if we reached 'Validation' state, provisioning is not limited with function's timeout.
            // increase give up timeout, and give more time for fabric-tools container to bring up HLF network.
            const { fabricToolsProvisionHlfTimeoutInMinutes } = require('./settings.json');
            timeoutInMinutes = fabricToolsProvisionHlfTimeoutInMinutes;

            // check status from kubernetes cluster.
            const containerStatus = await getStatusFromFabricToolsContainer(context);
            additionalInfo = containerStatus.additionalInfo;
            provisioningState = await setDeployFabricToolsStatus(context, req, containerStatus.state);
        }

        // in case of any Terminal states, just return it.
        if (['Succeeded', 'Failed', 'Canceled'].includes(provisioningState.provisioningState)) {
            return provisioningState;
        }

        const startDate = new Date(provisioningState.createdAt);
        const elapsedMinutes = (new Date() - startDate) / 1000 / 60;
        const tailLogLines = 30
        const toolsNamespace = 'tools';
        const fabricToolsPod = 'fabric-tools';
        const { createClient, tryGetResource } = require('./k8s-utils');
        const kuberConfig = process.env.KubernetesClusterAdminCredential;
        const client = createClient(kuberConfig);

        if (elapsedMinutes > timeoutInMinutes) {
            context.log.error(`${elapsedMinutes} minutes left from initializing deployment. Giving up...`);
            const hlfFabricToolsPod = await tryGetResource(client.api.v1.namespaces(toolsNamespace).pod, fabricToolsPod, context.log);
            if (hlfFabricToolsPod) {
                const hlfFabricToolsLog = await client.api.v1.namespaces(toolsNamespace).pods(fabricToolsPod).log.get({
                   qs: {
                     tailLines: tailLogLines
                   }
                });
                provisioningState = await setDeployFabricToolsStatus(context, req, {
                    status: 409,
                    provisioningState: 'Failed',
                    error: {
                        message: `Timeout for waiting of initialization of deployment exceeded. Stage: ${provisioningState.provisioningState}. Fabric Tools Pod status: ${hlfFabricToolsPod.body.status.phase}.`
                    },
                    additionalInfo: `${additionalInfo}. Stage: ${provisioningState.provisioningState}. Fabric Tools Pod status: ${hlfFabricToolsPod.body.status.phase}. Last ${tailLogLines} lines of log: ${JSON.stringify(hlfFabricToolsLog.body)}`
                });
            }
            else {
                provisioningState = await setDeployFabricToolsStatus(context, req, {
                    status: 409,
                    provisioningState: 'Failed',
                    error: {
                        message: `Timeout for waiting of initialization of deployment exceeded. Stage: ${provisioningState.provisioningState}`
                    },
                    additionalInfo: `${additionalInfo}. Fabric tools pod not found.`
                });
            } 
        }
        return provisioningState;
    },

    setDeployFabricToolsStatus: setDeployFabricToolsStatus
}

async function setDeployFabricToolsStatus(context, req, state) {
    context.log(`SetDeployFabricToolsStatus call with state: ${JSON.stringify(state)}`);

    // merge state (it is mostly to keep createdAt property)
    existingState = await getProvisioningStateFromBlob(req);
    mergedState = { ...existingState, ...state };

    const blobContent = JSON.stringify(mergedState);
    const blobClient = await getBlobClient(req);
    await blobClient.upload(blobContent, blobContent.length);
    context.log(`uploaded to blob: ${blobContent}`);

    return mergedState;
}

async function deployFabricTools(context, req) {
    const deployFabricToolsUrl = req.url.replace('/deploy/', '/deployfabrictools/');
    axios = require('axios');

    try {
        result = await axios.put(deployFabricToolsUrl, req.body);
        return result.data;
    } catch (error) {
        // swallow any exception and wrap it to response.
        context.log.error(`Exception during call deploy fabric tools Azure function: ${error}`);
        return {
            status: error.response.status, // here we can use non-200 code, because it is response on PUT request.
            provisioningState: 'Failed',
            error: {
                message: `Exception during call deploy fabric tools: ${error}`
            }
        }
    }
}

async function getProvisioningStateFromBlob(req) {
    const blockBlobClient = await getBlobClient(req);
    if (!blockBlobClient.exists()) {
        return;
    }

    blob = await blockBlobClient.download();
    blobContent = await streamToString(blob.readableStreamBody);
    provisioningState = JSON.parse(blobContent);

    return provisioningState;
}

async function waitStateChanged(context, req) {
    const retries = 10;
    const pollingIntervalInSeconds = 3;

    for (let attempt = 1; attempt <= retries; attempt++) {
        await sleep(pollingIntervalInSeconds * 1000);
        var result = await getProvisioningStateFromBlob(req);
        if (result.provisioningState !== 'Created') {
            return result;
        }
    }

    context.log.warn(`WaitStateChanged: change of state was not detected in ${attempt * pollingIntervalInSeconds} seconds.`);
    // Don't give up.
    return {
        status: 200,
        provisioningState: 'Created'
    }
}

async function checkPodStatus(context, namespace, pod, tailLogLines) {
    const { createClient, tryGetResource } = require('./k8s-utils');
    const kuberConfig = process.env.KubernetesClusterAdminCredential;
    const client = createClient(kuberConfig);
    const hlfPod = await tryGetResource(client.api.v1.namespaces(namespace).pod, pod, context.log);
    if (hlfPod && hlfPod.body.status.phase === 'Failed') {
        const hlfPodLog = await client.api.v1.namespaces(namespace).pods(pod).log.get({
            qs: {
                tailLines: tailLogLines
            }
        });
        return {
            state: {
                status: 409,
                provisioningState: 'Failed',
                error: {
                    message: `${pod} pod failed.`
                }
            },
            additionalInfo: `${pod} pod failed. Last ${tailLogLines} lines of log: ${JSON.stringify(hlfPodLog.body)}`
        };
    }
    return {
        state: {
	    status: 200 
        }
    }
}

async function getStatusFromFabricToolsContainer(context) {
    const { createClient, tryGetResource } = require('./k8s-utils');
    const kuberConfig = process.env.KubernetesClusterAdminCredential
    const client = createClient(kuberConfig);
    const toolsNamespace = 'tools';
    const fabricToolspod = 'fabric-tools';

    const fabricToolsPodStatus = await checkPodStatus(context, toolsNamespace, fabricToolspod, 30);
    if (fabricToolsPodStatus.state.status === 409) {
      context.log(fabricToolsPodStatus.additionalInfo);	    
      return fabricToolsPodStatus;
    }
        // retrieve config map content and check status.
    const hlfStatusConfigMap = await tryGetResource(client.api.v1.namespaces('metadata').configmap, 'hlf-status', context.log);

    if (!hlfStatusConfigMap) {
        context.log(`hlf-status config map is not created yet.`);
        return {
            state: {
                status: 200,
                // we won't change provisioning state.
            },
            additionalInfo: `hlf-status config map is not created yet.`
        };
    }

    context.log(`Status of provisioning HLF network: ${JSON.stringify(hlfStatusConfigMap.body.data)}`);

    // Done - terminal status, indicates work is done.
    if (hlfStatusConfigMap.body.data.hlfStatus === 'Done') {
        return {
            state: {
                status: 200,
                provisioningState: 'Succeeded'
            },
            additionalInfo: `${JSON.stringify(hlfStatusConfigMap.body.data)}`
        };
    }

    // still in progress.
    return {
        state: {
            status: 200,
            // we won't change provisioning state.
        },
        additionalInfo: `${JSON.stringify(hlfStatusConfigMap.body.data)}`
    };
}

async function getBlobClient(req) {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const storageEndpoint = process.env.StorageBlobEndpoint;
    const endpointSuffix = storageEndpoint.substring(storageEndpoint.lastIndexOf('core')).replace('/', '')
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage + ';EndpointSuffix=' + endpointSuffix);
    const containerName = req.params.name;
    const blobContainer = await blobServiceClient.getContainerClient(containerName);

    if (!await blobContainer.exists()) {
        await blobServiceClient.createContainer(containerName);
    }

    const blobName = 'deploy-fabric-tools-status';
    return blobContainer.getBlockBlobClient(blobName);
}

function streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}
