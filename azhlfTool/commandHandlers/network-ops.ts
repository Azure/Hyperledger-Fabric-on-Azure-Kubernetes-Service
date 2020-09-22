import * as Client from "fabric-client";
import * as chalk from "chalk";
import { URL } from "url";
import { ConnectionProfileManager } from "../common/ConnectionProfileManager";
import { MSPManager } from "../common/MSPManager";
import { GatewayHelper } from "../common/GatewayHelper";
import { Constants } from "../common/Constants";
import { Configtxlator, ConfigEnvelope, ProtobuffType } from "../FabricUtils/Configtxlator";
import { ConfigHelper } from "../common/ConfigHelper";
import { ObjectToString } from "../common/LogHelper";
import { AnchorPeersSection, AnchorPeer } from "../common/ChannelConfigInterfaces";

export class NetworkOperations {
    public async addPeerOrgToConsortium(peerOrg: string, ordererAdminName: string, ordererOrg: string): Promise<void> {
        // search for the orderer endpoint.
        const ordererProfile = await new ConnectionProfileManager().getConnectionProfile(ordererOrg);

        if (!ordererProfile.orderers || Object.keys(ordererProfile.orderers).length == 0) {
            throw new Error("No orderers in connection profile.");
        }

        const ordererName = Object.keys(ordererProfile.orderers)[0];

        // check if we have peer org msp and get it.
        const peerMsp = await new MSPManager().GetMsp(peerOrg);

        // check, create and connect gateway.
        const gateway = await GatewayHelper.CreateGateway(ordererAdminName, ordererOrg, ordererProfile);

        // do operations.
        try {
            console.log("Retrieving system channel configuration...");
            const ordererAdminClient = gateway.getClient();

            const channel = ordererAdminClient.newChannel(Constants.SystemChannelName);
            const orderer = ordererAdminClient.getOrderer(ordererName);
            channel.addOrderer(orderer);

            const configEnvelope = await channel.getChannelConfigFromOrderer();

            const configtxlator = new Configtxlator();
            const currentConfigEnvelope = await configtxlator.decode<ConfigEnvelope>(configEnvelope.toBuffer(), ProtobuffType.CommonConfigenvelope);
            const currentConfig = currentConfigEnvelope.config;

            console.log("Calculating configuration update...");
            // clone current config
            const modifiedConfig = JSON.parse(JSON.stringify(currentConfig));
            if (modifiedConfig.channel_group.groups.Consortiums.groups[Constants.Consortium].groups[peerOrg]) {
                console.log(`Organization ${peerOrg} already in consortium.`);
                return;
            }

            // generate config for the org
            const peerOrgConfig = await ConfigHelper.getOrganizationConfig(
                peerOrg,
                [this.FromBase64(peerMsp.admincerts)],
                [this.FromBase64(peerMsp.cacerts)],
                [this.FromBase64(peerMsp.tlscacerts)]
            );

            modifiedConfig.channel_group.groups.Consortiums.groups[Constants.Consortium].groups[peerOrg] = peerOrgConfig;

            const configUpdate = await configtxlator.computeUpdate(Constants.SystemChannelName, ProtobuffType.CommonConfig, currentConfig, modifiedConfig);

            console.log("Sending configuration update transaction to orderer...");

            const signature = ordererAdminClient.signChannelConfig(configUpdate);
            const signatures: Client.ConfigSignature[] = [signature];

            const txId = ordererAdminClient.newTransactionID(true);
            const request: Client.ChannelRequest = {
                config: configUpdate,
                name: Constants.SystemChannelName,
                orderer,
                signatures,
                txId
            };

            // send request for update channel
            const response = await ordererAdminClient.updateChannel(request);

            if (response.status != "SUCCESS") {
                console.error(chalk.red(`Update system channel failed with status ${response.status}.`));
                console.error(`Response: ${response.info}`);
                process.exit(1);
            }

            console.log(`Successfully added organization ${chalk.green(peerOrg)} to the consortium!`);
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();
        }
    }

    public async CreateApplicationChannel(channelName: string, ordererAdminName: string, ordererOrg: string): Promise<void> {
        if (channelName == Constants.SystemChannelName) {
            console.error(chalk.red("Invalid channel name"));
        }

        const profile = await new ConnectionProfileManager().getConnectionProfile(ordererOrg);

        // search for the orderer endpoint.
        if (!profile.orderers || Object.keys(profile.orderers).length == 0) {
            throw new Error("No orderers in connection profile.");
        }

        const ordererName = Object.keys(profile.orderers)[0];

        // check if we have order org msp and get it.
        const msp = await new MSPManager().GetMsp(ordererOrg);

        // we are creating application channel with orderer organization in it.
        const ordererOrgConfig = await ConfigHelper.getOrganizationConfig(
            ordererOrg,
            [this.FromBase64(msp.admincerts)],
            [this.FromBase64(msp.cacerts)],
            [this.FromBase64(msp.tlscacerts)]
        );

        const configUpdate = await ConfigHelper.getNewAppChannelConfigUpdate(channelName, ordererOrg, ordererOrgConfig);
        const configtxlator = new Configtxlator();
        // this config update we will send to orderer:
        const channelConfigUpdate = await configtxlator.encode(configUpdate, ProtobuffType.CommonConfigupdate);

        // check, create and connect gateway.
        const gateway = await GatewayHelper.CreateGateway(ordererAdminName, ordererOrg, profile);

        // do operations
        try {
            const ordererAdminClient = gateway.getClient();

            const orderer = ordererAdminClient.getOrderer(ordererName);

            const signature = ordererAdminClient.signChannelConfig(channelConfigUpdate);
            const signatures: Client.ConfigSignature[] = [signature];

            // create transaction for channel creation.
            const txId = ordererAdminClient.newTransactionID(true);
            const request: Client.ChannelRequest = {
                config: channelConfigUpdate,
                name: channelName,
                orderer,
                signatures,
                txId
            };

            console.log("Sending request for channel creation...");
            const response = await ordererAdminClient.createChannel(request);

            if (response.status != "SUCCESS") {
                console.error("Update system channel failed with status " + chalk.red(response.status));
                console.error(`Response: ${response.info}`);
                process.exit(1);
            }

            console.log(chalk.green(`Channel ${channelName} successfully created.`));
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();
        }
    }

    public async AddPeerToChannel(channelName: string, ordererAdminName: string, ordererOrg: string, peerOrg: string): Promise<void> {
        if (channelName == Constants.SystemChannelName) {
            console.error(chalk.red("Invalid channel name"));
        }

        // search for the orderer endpoint.
        const profile = await new ConnectionProfileManager().getConnectionProfile(ordererOrg);

        if (!profile.orderers || Object.keys(profile.orderers).length == 0) {
            throw new Error("No orderers in connection profile.");
        }

        const ordererName = Object.keys(profile.orderers)[0];

        // check if we have peer org msp and get it.
        const peerOrgMsp = await new MSPManager().GetMsp(peerOrg);

        // check, create and connect gateway.
        const gateway = await GatewayHelper.CreateGateway(ordererAdminName, ordererOrg, profile);

        // do operations
        try {
            console.log("Retrieving application channel configuration...");
            const ordererAdminClient = gateway.getClient();

            const channel = ordererAdminClient.newChannel(channelName);
            const orderer = ordererAdminClient.getOrderer(ordererName);
            channel.addOrderer(orderer);

            const configEnvelope = await channel.getChannelConfigFromOrderer();

            const configtxlator = new Configtxlator();
            const currentConfigEnvelope = await configtxlator.decode<ConfigEnvelope>(configEnvelope.toBuffer(), ProtobuffType.CommonConfigenvelope);
            const currentConfig = currentConfigEnvelope.config;

            console.log("Calculating configuration update...");
            // clone current config
            const modifiedConfig = JSON.parse(JSON.stringify(currentConfig));

            if (modifiedConfig.channel_group.groups.Application.groups[peerOrg]) {
                console.log(`Organization ${peerOrg} already in the channel.`);
                return;
            }

            const peerOrgConfig = await ConfigHelper.getOrganizationConfig(
                peerOrg,
                [this.FromBase64(peerOrgMsp.admincerts)],
                [this.FromBase64(peerOrgMsp.cacerts)],
                [this.FromBase64(peerOrgMsp.tlscacerts)]
            );

            modifiedConfig.channel_group.groups.Application.groups[peerOrg] = peerOrgConfig;

            const configUpdate = await configtxlator.computeUpdate(channelName, ProtobuffType.CommonConfig, currentConfig, modifiedConfig);

            console.log("Sending configuration update transaction to orderer...");
            const signatureTest = ordererAdminClient.signChannelConfig(configUpdate);
            const signatures: Client.ConfigSignature[] = [signatureTest];

            const txId = ordererAdminClient.newTransactionID(true);
            const request: Client.ChannelRequest = {
                config: configUpdate,
                name: channelName,
                orderer,
                signatures,
                txId
            };

            // send request for update channel
            const response = await ordererAdminClient.updateChannel(request);

            if (response.status != "SUCCESS") {
                console.error(`Update ${channelName} channel failed with status ${chalk.red(response.status)}`);
                console.error(`Response: ${response.info}`);
                process.exit(1);
            }

            console.log(chalk.green(`Successfully added organization ${peerOrg} to the channel ${channelName}!`));
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();
        }
    }

    public async PrintChannel(channelName: string, ordererAdminName: string, ordererOrg: string): Promise<void> {
        // search for the orderer endpoint.
        const profile = await new ConnectionProfileManager().getConnectionProfile(ordererOrg);

        if (!profile.orderers || Object.keys(profile.orderers).length == 0) {
            throw new Error("No orderers in connection profile.");
        }

        const ordererName = Object.keys(profile.orderers)[0];

        // check, create and connect gateway.
        const gateway = await GatewayHelper.CreateGateway(ordererAdminName, ordererOrg, profile);

        try {
            console.log("Retrieving channel configuration...");
            const ordererAdminClient = gateway.getClient();

            const channel = ordererAdminClient.newChannel(channelName);
            const orderer = ordererAdminClient.getOrderer(ordererName);
            channel.addOrderer(orderer);

            const configEnvelope = await channel.getChannelConfigFromOrderer();

            const configtxlator = new Configtxlator();
            const currentConfigEnvelope = await configtxlator.decode<ConfigEnvelope>(configEnvelope.toBuffer(), ProtobuffType.CommonConfigenvelope);
            const currentConfig = currentConfigEnvelope.config;

            console.log(ObjectToString(currentConfig));
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();
        }
    }

    public async JoinNodeToChannel(channelName: string, peerAdminName: string, peerOrg: string, ordererOrg: string): Promise<void> {
        if (channelName == Constants.SystemChannelName) {
            console.error(chalk.red("Invalid channel name"));
        }

        const orderer = await this.GetOrdererFromConnectionProfile(ordererOrg, peerAdminName, peerOrg);

        // check, create and connect gateway.
        const peerProfile = await new ConnectionProfileManager().getConnectionProfile(peerOrg);
        const gateway = await GatewayHelper.CreateGateway(peerAdminName, peerOrg, peerProfile);

        try {
            console.log("Retrieving channel genesis block...");
            const peerAdminClient = gateway.getClient();

            const channel = peerAdminClient.newChannel(channelName);
            channel.addOrderer(orderer);

            const genesisTxId = peerAdminClient.newTransactionID(true);
            const genesisRequest: Client.OrdererRequest = {
                txId: genesisTxId,
                orderer: orderer
            };

            const genesisBlock = await channel.getGenesisBlock(genesisRequest);

            const peers = peerAdminClient.getPeersForOrg(peerOrg);

            const txId = peerAdminClient.newTransactionID(true);
            const request: Client.JoinChannelRequest = {
                targets: peers, // all peers
                block: genesisBlock,
                txId
            };

            console.log(`Joining channel ${channelName}...`);
            const joinResponse = await channel.joinChannel(request);

            // assert response from all peers.
            joinResponse.forEach(response => {
                if (!response.response || response.response.status != 200) {
                    console.error(`${chalk.red("Unsuccess")} response status from peer ${response.peer?.name}. Response: ${response}`);
                    process.exit(1);
                }
            });

            console.log(chalk.green(`Successfully joined all peers of ${peerOrg} to channel ${channelName}.`));
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();
        }
    }

    public async SetPeerAsAnchorInChannel(channelName: string, anchorPeerNames: string[], peerAdminName: string, peerOrg: string, ordererOrg?: string): Promise<void> {
        if (channelName == Constants.SystemChannelName) {
            console.error(chalk.red("Invalid channel name"));
        }

        // check, create and connect gateway.
        const peerProfile = await new ConnectionProfileManager().getConnectionProfile(peerOrg);
        const gateway = await GatewayHelper.CreateGateway(peerAdminName, peerOrg, peerProfile);

        try {
            const peerAdminClient = gateway.getClient();

            console.log("Preparing anchor peers list...");
            const peerNodes = peerAdminClient.getPeersForOrg(peerOrg);
            const anchorPeersToBeSet: AnchorPeer[] = [];
            anchorPeerNames.forEach(anchorPeerNodeName => {
                // get peer info from connection profile.
                // check full name first and then try to find in ABS connection profile format: peer1.peerOrg
                const peer = peerNodes.find(peerNode => peerNode.getName() === anchorPeerNodeName)
                            || peerNodes.find(peerNode => peerNode.getName() === `${anchorPeerNodeName}.${peerOrg}`)
                if(!peer){
                    throw new Error(`Peer with name "${anchorPeerNodeName}" not found.`);
                }

                const peerUrl = new URL(peer.getUrl());
                if (!peerUrl.hostname || !peerUrl.port) {
                    throw new Error(`Url for peer ${anchorPeerNodeName} should have host and port. Got ${peer.getUrl()}`);
                }

                const anchorPeer: AnchorPeer = {
                    host: peerUrl.hostname,
                    port: parseInt(peerUrl.port),
                };

                anchorPeersToBeSet.push(anchorPeer);
            });

            console.log("Retrieving channel's latest configuration block...");
            // create channel and get orderer from connection profile (if ordererOrg provided) or from discovery results.
            let channel: Client.Channel;
            let orderer: Client.Orderer;
            if (ordererOrg) {
                channel = peerAdminClient.newChannel(channelName);
                orderer = await this.GetOrdererFromConnectionProfile(ordererOrg, peerAdminName, peerOrg);
                channel.addOrderer(orderer);
            } else {
                try {
                    const network = await gateway.getNetwork(channelName);
                    channel = network.getChannel();
                    orderer = channel.getOrderers()[0]; // there will be orderer always.
                } catch (error) {
                    console.error(error);
                    console.error("If no one peer joined the requested channel - provide --ordererOrg parameter to command.");
                    return;
                }
            }

            const configEnvelope = await channel.getChannelConfigFromOrderer();

            const configtxlator = new Configtxlator();
            const currentConfigEnvelope = await configtxlator.decode<ConfigEnvelope>(configEnvelope.toBuffer(), ProtobuffType.CommonConfigenvelope);
            const currentConfig = currentConfigEnvelope.config;

            // clone current config
            const modifiedConfig = JSON.parse(JSON.stringify(currentConfig));

            if (!modifiedConfig.channel_group.groups.Application.groups[peerOrg]) {
                console.log(`Organization ${peerOrg} is not in the channel.`);
                return;
            }

            console.log("Verifying list of existing anchor peers...");
            const anchorPeersSection: AnchorPeersSection = modifiedConfig.channel_group.groups.Application.groups[peerOrg].values.AnchorPeers || {
                mod_policy: "Admins",
                version: 0,
                value: { anchor_peers: [] },
            }; // in case no anchor peers

            // in case anchor peers section exist, but don't have anchor peers, value in returned config is null.
            anchorPeersSection.value = anchorPeersSection.value || { anchor_peers: [] };

            let configModified = anchorPeersToBeSet.length !== anchorPeersSection.value.anchor_peers.length;
            anchorPeersToBeSet.forEach(newAnchorPeer => {
                if(!anchorPeersSection.value.anchor_peers.find(existingAnchorPeer =>
                           newAnchorPeer.host === existingAnchorPeer.host &&
                           newAnchorPeer.port === existingAnchorPeer.port
                )) {
                    configModified = true;
                }
            });

            if (!configModified) {
                console.log(chalk.yellow(`No changes in Anchor peers list. Exit.`));
                return;
            }

            anchorPeersSection.value.anchor_peers = anchorPeersToBeSet;
            modifiedConfig.channel_group.groups.Application.groups[peerOrg].values.AnchorPeers = anchorPeersSection;

            console.log("Calculating configuration update...");
            const configUpdate = await configtxlator.computeUpdate(channelName, ProtobuffType.CommonConfig, currentConfig, modifiedConfig);
            const signature = peerAdminClient.signChannelConfig(configUpdate);
            const signatures: Client.ConfigSignature[] = [signature];

            console.log("Sending configuration update transaction...");
            const txId = peerAdminClient.newTransactionID(true);
            const request: Client.ChannelRequest = {
                config: configUpdate,
                name: channelName,
                orderer,
                signatures,
                txId
            };

            // send request for update channel
            const response = await peerAdminClient.updateChannel(request);
            if (response.status != "SUCCESS") {
                console.error(chalk.red(`Updating ${channelName} failed with status ${response.status}.`));
                console.error(`Response: ${response.info}`);
                process.exit(1);
            }

            if (anchorPeerNames.length) {
                console.log(`Successfully set anchor peers: [${chalk.green(anchorPeerNames.join(","))}] for the ${chalk.green(peerOrg)} on channel ${chalk.green(channelName)}!`);
            } else {
                console.log(`Successfully removed anchor peers for the ${chalk.green(peerOrg)} on channel ${chalk.green(channelName)}!`);
            }
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            gateway.disconnect();
        }
    }

    private FromBase64(base64encoded: string): string {
        return Buffer.from(base64encoded, "base64").toString("ascii");
    }

    private async GetOrdererFromConnectionProfile(ordererOrg: string, userName: string, userOrg: string): Promise<Client.Orderer> {
        // search for the orderer endpoint.
        const ordererProfile = await new ConnectionProfileManager().getConnectionProfile(ordererOrg);

        if (!ordererProfile.orderers || Object.keys(ordererProfile.orderers).length == 0) {
            throw new Error("No orderers in connection profile.");
        }

        const ordererName = Object.keys(ordererProfile.orderers)[0];

        // Gateway is needed to get client with user certificates which will be used to access to the orderer.
        // We don't connect to network, so gateway.disconnect() is not needed.
        const ordererGateway = await GatewayHelper.CreateGateway(userName, userOrg, ordererProfile);
        const ordererClient = ordererGateway.getClient();
        const orderer = ordererClient.getOrderer(ordererName);
        return orderer;
    }
}
