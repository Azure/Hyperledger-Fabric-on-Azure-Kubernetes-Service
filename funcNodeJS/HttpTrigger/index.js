module.exports = async function (context, req) {
    const action = req.params.action;
    const method = req.method;

    const orchestrator = require('./orchestrator');

    if (action === 'deploy' && method === 'PUT') {
        // here come call from resource provider to create resource.
        // via orchestrator we will delegate work to another call of Azure function and quickly return response to resource provider.
        const result = await orchestrator.callDeployFabricTools(context, req);
        // body should be in 'properties' field for response to ARM
        setResponse(result.status, { properties: result });

        return;
    } else if (action === 'deploy' && method === 'GET') {
        // here come call from resource provider to poll resource creation status.
        const result = await orchestrator.getDeployFabricToolsStatus(context, req);
        // body should be in 'properties' field for response to ARM
        setResponse(result.status, { properties: result });

        return;
    } else if (action === 'deployfabrictools' && method === 'PUT') {
        // here come chaining call from orchestrator, this call will do main work.
        context.log('Deploy fabric tools requested.');
        const deployFabricTools = require('./fabric-tools-provisioner');

        // mark that remote orchestrator's call reached this function.
        await orchestrator.setDeployFabricToolsStatus(context, req, {
            status: 200,
            provisioningState: 'Accepted'
        });

        const result = await deployFabricTools(req.body.properties, context.log);
        context.log(`Deploy fabric tools finished.`);

        await orchestrator.setDeployFabricToolsStatus(context, req, result);
        setResponse(result.status, result);

        return;
    } else {
        setResponse(409, {
            error: {
                message: `Unknown action ${action} and method ${method}`
            },
            provisioningState: 'Failed',
            properties: {
                provisioningState: 'Failed'
            }
        });
    }

    function setResponse(status, body) {
        context.res = {
            status: status,
            headers: {
                'Content-Type': 'application/json'
            },
            body: body
        };

        context.log(`Set response: ${JSON.stringify(context.res)}`);
    }
};
