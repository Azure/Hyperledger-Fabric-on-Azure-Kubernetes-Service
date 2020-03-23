import * as Client from "fabric-client";
import * as chalk from "chalk";
import { ConnectionProfileManager } from "../common/ConnectionProfileManager";
import { MSPManager } from "../common/MSPManager";
import { GatewayHelper } from "../common/GatewayHelper";
import { Constants } from "../common/Constants";
import { Configtxlator, ConfigEnvelope, ProtobuffType } from "../FabricUtils/Configtxlator";
import { ConfigHelper } from "../common/ConfigHelper";
import { ObjectToString } from "../common/LogHelper";

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
            // TODO: check if we can pass no signature
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
                return;
            }

            console.log(`Successfully added organization ${chalk.green(peerOrg)} to the consortium!`);
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
                return;
            }

            console.log(chalk.green(chalk.green(`Channel ${channelName} successfully created.`)));
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
                return;
            }

            console.log(chalk.green(`Successfully added organization ${peerOrg} to the channel ${channelName}!`));
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
        } finally {
            gateway.disconnect();
        }
    }

    public async JoinNodeToChannel(channelName: string, peerAdminName: string, peerOrg: string, ordererOrg: string): Promise<void> {
        if (channelName == Constants.SystemChannelName) {
            console.error(chalk.red("Invalid channel name"));
        }
        // search for the orderer endpoint.
        const ordererProfile = await new ConnectionProfileManager().getConnectionProfile(ordererOrg);

        if (!ordererProfile.orderers || Object.keys(ordererProfile.orderers).length == 0) {
            throw new Error("No orderers in connection profile.");
        }

        const ordererName = Object.keys(ordererProfile.orderers)[0];
        const ordererClient = new Client();
        ordererClient.loadFromConfig(ordererProfile);
        const orderer = ordererClient.getOrderer(ordererName);

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

            let success = true;
            // assert response from all peers.
            joinResponse.forEach(response => {
                if (!response.response || response.response.status != 200) {
                    success = false;
                    console.error(`${chalk.red("Unsuccess")} response status from peer ${response.peer?.name}. Response: ${response}`);
                }
            });

            console.log(success ? chalk.green(`Successfully joined all peers of ${peerOrg} to channel ${channelName}.`) : chalk.red(`Join peers of ${peerOrg} to channel ${channelName} failed.`));
        } finally {
            gateway.disconnect();
        }
    }

    private FromBase64(base64encoded: string): string {
        return Buffer.from(base64encoded, "base64").toString("ascii");
    }
}
