import { readFile } from "fs-extra";
import { ConnectionProfileManager } from "../common/ConnectionProfileManager";
import { AzureBlockchainService } from "../common/AzureBlockchainService";
import { ShareClient, AnonymousCredential } from "@azure/storage-file-share";
import * as chalk from "chalk";
import Axios from "axios";
import { ConnectionProfile } from "../common/Interfaces";
import { parse as urlParse } from "url";

export class ConnectionProfileCommandHandler {
    public async importFromGatewayFile(organization: string, gatewayFilePath: string): Promise<void> {
        const gatewayProfileJSON = await readFile(gatewayFilePath, "utf8");
        const gatewayProfile = JSON.parse(gatewayProfileJSON);

        const manager = new ConnectionProfileManager();
        const path = await manager.WriteConnectionProfile(organization, gatewayProfile);

        console.log(chalk.green(`Connection profile for ${organization} imported to ${path}.`));
    }

    public async importFromAzure(organization: string, resourceGroup: string, subscriptionId: string, managementUri?: string): Promise<void> {
        const azureBlockchainService = new AzureBlockchainService();
        const gatewayProfile = await azureBlockchainService.GetGatewayProfile(subscriptionId, resourceGroup, organization, managementUri);

        const manager = new ConnectionProfileManager();
        const path = await manager.WriteConnectionProfile(organization, gatewayProfile);

        console.log(chalk.green(`Connection profile for ${organization} imported to ${path}.`));
    }

    public async importFromUrl(organization: string, url: string): Promise<void> {
        const response = await Axios.get(url);
        if (response.status != 200) {
            throw new Error(`Can't get connection profile. Response: ${response.statusText}`);
        }

        const profile: ConnectionProfile = response.data;
        if (!(profile.organizations && (profile.orderers || profile.peers))) {
            throw new Error(`Response should contain fields: organizations and either orderers or peers. But was: ${JSON.stringify(response.data)}`);
        }

        const manager = new ConnectionProfileManager();
        const path = await manager.WriteConnectionProfile(organization, profile);

        console.log(chalk.green(`Connection profile for ${organization} imported to ${path}.`));
    }

    public async importFromAzureStorage(organization: string, fileshare: string): Promise<void> {
        console.log("Retrieving connection profile from azure storage...");
        const shareClient = new ShareClient(fileshare, new AnonymousCredential());
        const directoryClient = shareClient.getDirectoryClient(organization);
        // check if directory exists
        try {
            await directoryClient.getProperties();
        } catch (error) {
            if (error.statusCode == 404) {
                throw new Error(`Directory ${organization} does not exist on fileshare.`);
            }

            throw error;
        }

        const fileClient = directoryClient.getFileClient("connectionprofile.json");

        await this.importFromUrl(organization, fileClient.url);
    }

    public async exportToAzureStorage(organization: string, fileshare: string): Promise<void> {
        const profile = await new ConnectionProfileManager().getConnectionProfile(organization);
        const profileData = Buffer.from(JSON.stringify(profile));

        const shareClient = new ShareClient(fileshare, new AnonymousCredential());
        const directoryClient = shareClient.getDirectoryClient(organization);
        // create directory if not exist
        try {
            await directoryClient.getProperties();
        } catch (error) {
            if (error.statusCode != 404) {
                throw error;
            }

            await directoryClient.create();
        }

        const fileClient = directoryClient.getFileClient(`connectionprofile.json`);
        await fileClient.uploadData(profileData);

        console.log(`Uploaded ${organization} connection profile to:`);
        const sasToken = urlParse(fileClient.url).search ?? "";
        const urlWithoutToken = fileClient.url.replace(sasToken, "");
        console.log(chalk.green(urlWithoutToken));
    }

    public async listConnectionProfiles(): Promise<void>{
        const entries = await new ConnectionProfileManager().enumerateProfiles();
        if(!entries.length){
            console.log(chalk.yellow("List of connection profiles is empty."));
            return;
        }

        console.log("List of connection profiles:");
        for(const profile of entries){
            console.log("  " + chalk.green(profile));
        }
    }
}
