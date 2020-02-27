import { readFile } from "fs-extra";
import { MSPManager } from "../common/MSPManager";
import { AzureBlockchainService } from "../common/AzureBlockchainService";
import Axios from "axios";
import { MSP } from "../common/Interfaces";
import { AnonymousCredential, ShareClient } from "@azure/storage-file-share";
import * as chalk from "chalk";
import { parse as urlParse } from "url";

export class MspCommandHandler {
    public async importFromFiles(organization: string, adminCertFilePath: string, rootCertFilePath: string, tlsRootCertFilePath: string): Promise<void> {
        const adminCert = Buffer.from(await readFile(adminCertFilePath, "utf8")).toString("base64");
        const rootCert = Buffer.from(await readFile(rootCertFilePath, "utf8")).toString("base64");
        const tlsRootCert = Buffer.from(await readFile(tlsRootCertFilePath, "utf8")).toString("base64");

        const path = await new MSPManager().ImportMsp(organization, adminCert, rootCert, tlsRootCert);
        console.log(chalk.green(`${organization} MSP is imported to ${path}.`));
    }

    public async importFromAzure(organization: string, resourceGroup: string, subscriptionId: string, managementUri?: string): Promise<void> {
        const azureBlockchainService = new AzureBlockchainService();
        const msp = await azureBlockchainService.GetMSP(subscriptionId, resourceGroup, organization, managementUri);

        const path = await new MSPManager().ImportMsp(msp.msp_id, msp.admincerts, msp.cacerts, msp.tlscacerts);
        console.log(chalk.green(`${organization} MSP is imported to ${path}.`));
    }

    public async importFromUrl(url: string): Promise<void> {
        const response = await Axios.get(url);
        if (response.status != 200) {
            throw new Error(`Can't get msp. Response: ${response.statusText}`);
        }

        const msp: MSP = response.data;
        if (!(msp.msp_id && msp.admincerts && msp.cacerts && msp.tlscacerts)) {
            throw new Error(`Response should contain fields: msp_id, admincerts, cacerts, tlscacerts. But was: ${JSON.stringify(response.data)}`);
        }

        const path = await new MSPManager().ImportMsp(msp.msp_id, msp.admincerts, msp.cacerts, msp.tlscacerts);
        console.log(chalk.green(`${msp.msp_id} MSP is imported to ${path}.`));
    }

    public async importFromAzureStorage(organization: string, fileshare: string): Promise<void> {
        console.log("Retrieving msp from azure storage...");
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

        const fileClient = directoryClient.getFileClient("msp.json");

        await this.importFromUrl(fileClient.url);
    }

    public async exportToAzureStorage(organization: string, fileshare: string): Promise<void> {
        const msp = await new MSPManager().GetMsp(organization);
        const mspData = Buffer.from(JSON.stringify(msp));

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

        const fileClient = directoryClient.getFileClient("msp.json");
        await fileClient.uploadData(mspData);

        console.log(`Uploaded ${organization} msp to:`);
        const sasToken = urlParse(fileClient.url).search ?? "";
        const urlWithoutToken = fileClient.url.replace(sasToken, "");
        console.log(chalk.green(urlWithoutToken));
    }

    public async listMSPs(): Promise<void>{
        const entries = await new MSPManager().enumerateMSPs();
        if(!entries.length){
            console.log(chalk.yellow("List of MSPs is empty."));
            return;
        }

        console.log("List of MSPs:");
        for(const msp of entries){
            console.log("  " + chalk.green(msp));
        }
    }
}
