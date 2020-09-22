import { ConnectionProfileManager } from "../common/ConnectionProfileManager";
import { GatewayHelper } from "../common/GatewayHelper";
import { sep as pathSeparator, isAbsolute as isAbsolutePath } from "path";
import {pathExists, readJSON} from "fs-extra";
import * as Client from "fabric-client";
import * as chalk from "chalk";
import { ObjectToString } from "../common/LogHelper";
import { TransientMap } from "fabric-network";

export class ChaincodeOperations {
    public async InstallChaincode(
        chaincodeName: string,
        chaincodeVersion: string,
        chaincodePath: string,
        chaincodeType: Client.ChaincodeType,
        peerOrganization: string,
        peerAdminName: string
    ): Promise<void> {
        if (!isAbsolutePath(chaincodePath)) {
            throw new Error("Please provide absolute path to the chaincode code.");
        }

        const systemGoPath = process.env.GOPATH;
        if (chaincodeType == "golang") {
            const pathSegments = chaincodePath.split(pathSeparator);
            // for golang it is required to have path with 'src'
            const indexOfSrc = pathSegments.lastIndexOf("src");
            if (indexOfSrc < 1 || indexOfSrc >= pathSegments.length - 1) {
                throw new Error(
                    "For golang chaincode path to the chaincode should contain 'src' segment in the middle. E.g. /opt/gopath/src/github.com/chaincode"
                );
            }

            // and the we need to split path to two segments before src and after src (excluding src).
            process.env.GOPATH = pathSegments.slice(0, indexOfSrc).join(pathSeparator);
            chaincodePath = pathSegments.slice(indexOfSrc + 1).join(pathSeparator);
        }

        const profile = await new ConnectionProfileManager().getConnectionProfile(peerOrganization);

        const gateway = await GatewayHelper.CreateGateway(peerAdminName, peerOrganization, profile);

        try {
            const peerAdminClient = gateway.getClient();
            const peers = peerAdminClient.getPeersForOrg(peerOrganization);

            if (!peers.length) {
                throw new Error("No one peer found in connection profile");
            }

            console.log("Checking that chaincode is not installed yet...");
            if (await this.CheckIfChaincodeInstalled(chaincodeName, chaincodeVersion, peerAdminClient, peers[0])) {
                console.log("Chaincode with this name and version already installed.");
                return;
            }

            const txId = peerAdminClient.newTransactionID(true);

            const request: Client.ChaincodeInstallRequest = {
                chaincodeId: chaincodeName,
                chaincodePath,
                chaincodeVersion,
                chaincodeType,
                targets: peers, // all peers
                txId
            };

            console.log("Sending request for chaincode installation...");
            const installResponse = await peerAdminClient.installChaincode(request);
            // assert responses
            let success = true;
            installResponse[0].forEach(response => {
                if (response instanceof Error || response.response.status != 200) {
                    success = false;
                    console.log(ObjectToString(response));
                    console.log(chalk.red("Install failed."));
                    process.exit(1);
                }
            });

            if (success) {
                console.log(chalk.green("Chaincode install successful."));    
            }
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();

            // just in case return value back.
            if (chaincodeType == "golang") {
                process.env.GOPATH = systemGoPath;
            }
        }
    }

    public async InstantiateChaincode(
        channelName: string,
        chaincodeName: string,
        chaincodeVersion: string,
        func: string | undefined,
        args: string[] | undefined,
        collectionsConfigPath: string | undefined,
        transientDataJson: string | undefined,
        policyConfigPath: string | undefined,
        peerOrganization: string,
        peerAdminName: string
    ): Promise<void> {

        let policy = undefined;
        if(policyConfigPath){
            policy = await this.GetPolicy(policyConfigPath) as Client.EndorsementPolicy;
        }

        const peerProfile = await new ConnectionProfileManager().getConnectionProfile(peerOrganization);
        const gateway = await GatewayHelper.CreateGateway(peerAdminName, peerOrganization, peerProfile);

        try {
            const peerAdminClient = gateway.getClient();
            const peers = peerAdminClient.getPeersForOrg(peerOrganization);

            if (!peers.length) {
                throw new Error("No one peer found in connection profile");
            }

            const peerNode = peers[0];
            console.log("Checking that chaincode is installed...");
            if (!await this.CheckIfChaincodeInstalled(chaincodeName, chaincodeVersion, peerAdminClient, peerNode)) {
                console.error(chalk.red("Chaincode should be installed."));
                return;
            }

            const network = await gateway.getNetwork(channelName);
            const channel = network.getChannel();

            console.log("Checking that chaincode is not instantiated...");
            if (await this.CheckIfChaincodeInstantiated(chaincodeName, chaincodeVersion, channel, peerNode)) {
                console.log(`Chaincode ${chaincodeName} is already instantiated.`);
                return;
            }

            const txId = peerAdminClient.newTransactionID(true);

            const instantiateRequest: Client.ChaincodeInstantiateUpgradeRequest = {
                chaincodeId: chaincodeName,
                chaincodeVersion,
                fcn: func,
                args,
                targets: [peerNode],
                "collections-config":collectionsConfigPath,
                "endorsement-policy": policy,
                txId
            };

            if(transientDataJson){
                instantiateRequest.transientMap = this.JsonToTransientMap(transientDataJson);
            }

            console.log("Sending instantiate proposal request...");
            const instantiateProposalResponse = await channel.sendInstantiateProposal(instantiateRequest);

            let success = true;
            // assert
            instantiateProposalResponse[0].forEach(response => {
                if (response instanceof Error || response.response.status != 200) {
                    success = false;
                    console.log(ObjectToString(response));
                }
            });

            if (!success) {
                console.error(chalk.red("Sending instantiate proposal failed."));
                process.exit(1);
            }

            const proposal = instantiateProposalResponse[1];
            const proposalResponses = instantiateProposalResponse[0];

            const orderRequest: Client.TransactionRequest = {
                proposal,
                proposalResponses: proposalResponses as Client.ProposalResponse[],
                txId
            };

            console.log("Sending instantiation transaction to be ordered...");
            const orderTransactionResponse = await channel.sendTransaction(orderRequest);

            if (orderTransactionResponse.status != "SUCCESS") {
                console.error(JSON.stringify(orderTransactionResponse));
                console.log(chalk.red("Instantiation failed."));
                process.exit(1);
            }

            console.log(chalk.green("Instantiation successful."));
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();
        }
    }

    public async InvokeChaincode(
        channelName: string,
        chaincodeName: string,
        func: string,
        args: string[],
        transientDataJson: string | undefined,
        clientUserName: string,
        peerOrganization: string
    ): Promise<void> {
        const profile = await new ConnectionProfileManager().getConnectionProfile(peerOrganization);
        const gateway = await GatewayHelper.CreateGateway(clientUserName, peerOrganization, profile);

        try {
            const network = await gateway.getNetwork(channelName);
            const contract = network.getContract(chaincodeName);
            let transaction = contract.createTransaction(func);

            if(transientDataJson){
                const transientDataMap = this.JsonToTransientMap(transientDataJson);
                transaction = transaction.setTransient(transientDataMap);
            }

            const contractResponse = await transaction.submit(...args);

            console.log(`Chaincode ${chaincodeName} successfully invoked on channel ${channelName}.`);
            if (contractResponse.toString()) {
                console.log(`response from chaincode: ${contractResponse.toString()}`);
            } else {
                console.log(`Got empty response.`);
            }
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();
        }
    }

    public async QueryChaincode(
        channelName: string,
        endorsingPeers: string[],
        chaincodeName: string,
        func: string,
        args: string[],
        clientUserName: string,
        peerOrganization: string
    ): Promise<void> {
        // If endorsingPeers is empty then exit with error
        if (!(Array.isArray(endorsingPeers) && endorsingPeers.length)) {
            throw new Error("Invalid argument. Endorsing peer list should not be empty.");
        }

        const profile = await new ConnectionProfileManager().getConnectionProfile(peerOrganization);
        const gateway = await GatewayHelper.CreateGateway(clientUserName, peerOrganization, profile);

        try {
            const network = await gateway.getNetwork(channelName);
            
            // Get all the peers that are part of this peer organization
            let peerList = gateway.getClient().getPeersForOrg();

            // Create Peer array corresponding to required endorsing peers
            let endorsingPeerObjects = [];
            for (let i=0; i<endorsingPeers.length; i++) {
                for (let j=0; j<peerList.length; j++) {
                    let currentPeer = endorsingPeers[i] + "." + peerOrganization;
                    if (currentPeer === peerList[j].getName()) {
                        endorsingPeerObjects.push(peerList[j]);
                    }
                }
            }

            // Throw error if no matching endorsing peers were found
            if (!(Array.isArray(endorsingPeerObjects) && endorsingPeerObjects.length)) {
                throw new Error("No peers found with given endorsing peer name(s).");
            }

            // Use channel object to send query request to target peers
            const channel = network.getChannel();

            // Create query request object
            let request: Client.ChaincodeQueryRequest = <Client.ChaincodeQueryRequest>{
                targets: endorsingPeerObjects,
                chaincodeId: chaincodeName,
                fcn: func,
                args: args,
                request_timeout: 300000
            };

            // Send query request to provided endorsing peers
            let responsePayloads = await channel.queryByChaincode(request);

            // Process the response payloads received from different peers
            for (let i = 0; i < responsePayloads.length; i++) {
                if (responsePayloads[i].toString()) {
                    console.log(`${endorsingPeers[i]} gave response from chaincode: ${responsePayloads[i].toString()}`);
                } else {
                    console.log(`Got empty query result from peer: ${endorsingPeers[i]}`);
                }
            }
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();
        }
    }

    private async CheckIfChaincodeInstalled(chaincodeName: string, chaincodeVersion: string, client: Client, peer: Client.Peer): Promise<boolean> {
        const installedChaincodes = (await client.queryInstalledChaincodes(peer)).chaincodes;

        let installed = false;
        installedChaincodes.forEach(chaincode => {
            installed = installed || chaincode.name == chaincodeName && chaincode.version == chaincodeVersion;
        });

        return installed;
    }

    private async CheckIfChaincodeInstantiated(chaincodeName: string, chaincodeVersion: string, channel: Client.Channel, peer: Client.Peer): Promise<boolean> {
        const instantiatedChaincodes = (await channel.queryInstantiatedChaincodes(peer)).chaincodes;

        let instantiated = false;
        instantiatedChaincodes.forEach(chaincode => {
            instantiated = instantiated || chaincode.name == chaincodeName && chaincode.version == chaincodeVersion;
        });

        return instantiated;
    }

    private JsonToTransientMap(transientDataJson: string): TransientMap {
        const transientDataMap: TransientMap = {};

        const transientData = JSON.parse(transientDataJson);
        for (let k of Object.keys(transientData)) {
            if(typeof transientDataMap[k] === "string") // to avoid double serialization of string
            {
                transientDataMap[k] = Buffer.from(transientData[k]);
            }
            else
            {
                transientDataMap[k] = Buffer.from(JSON.stringify(transientData[k]));
            }
        }

        return transientDataMap;
    }

    private async GetPolicy(policyConfigPath: string): Promise<object> {
        if (!isAbsolutePath(policyConfigPath)) {
            throw new Error("Please provide absolute path to the policy file.");
        }

        if(! await pathExists(policyConfigPath))
        {
            throw new Error(`Could not find file with provided path: ${policyConfigPath}`);
        }

        const policy = await readJSON(policyConfigPath);

        return policy;
    }
}