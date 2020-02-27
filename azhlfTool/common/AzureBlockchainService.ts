import Axios, { AxiosRequestConfig } from "axios";
import * as chalk from "chalk";
import { ResourceManagementClient } from "@azure/arm-resources";
import { interactiveLogin, AzureCliCredentials } from "@azure/ms-rest-nodeauth";
import { ConnectionProfile, AdminProfile, MSP } from "./Interfaces";
import { RequestPrepareOptions } from "@azure/ms-rest-js";
import { TokenClientCredentials } from "@azure/ms-rest-nodeauth/dist/lib/credentials/tokenClientCredentials";

enum ProfileType {
    Admin,
    Connection,
    MSP
}
const HyperledgerFabricKind = "HyperledgerFabric";

export class AzureBlockchainService {
    private credentials?: TokenClientCredentials;

    public async GetAdminProfile(subscriptionId: string, resourceGroup: string, organizationName: string, managementUri?: string): Promise<AdminProfile> {
        let adminProfile: AdminProfile = (await this.GetProfileFromABS(
            ProfileType.Admin,
            organizationName,
            resourceGroup,
            subscriptionId,
            managementUri
        )) as AdminProfile;

        if (!adminProfile || !adminProfile.msp_id) {
            console.log("Fallback to marketplace based application...");
            adminProfile = (await this.GetProfileFromMarketplaceBasedApp(
                ProfileType.Admin,
                organizationName,
                resourceGroup,
                subscriptionId,
                managementUri
            )) as AdminProfile;
        }

        if (!adminProfile.msp_id || adminProfile.msp_id != organizationName) {
            console.error(chalk.red(`Expected Msp_id in admin profile: ${organizationName} but got: ${adminProfile.msp_id}`));
            throw new Error("Wrong admin profile");
        }

        return adminProfile;
    }

    public async GetGatewayProfile(
        subscriptionId: string,
        resourceGroup: string,
        organizationName: string,
        managementUri?: string
    ): Promise<ConnectionProfile> {
        let connectionProfile: ConnectionProfile = (await this.GetProfileFromABS(
            ProfileType.Connection,
            organizationName,
            resourceGroup,
            subscriptionId,
            managementUri
        )) as ConnectionProfile;

        if (!connectionProfile) {
            console.log("Fallback to marketplace based application...");
            connectionProfile = (await this.GetProfileFromMarketplaceBasedApp(
                ProfileType.Connection,
                organizationName,
                resourceGroup,
                subscriptionId,
                managementUri
            )) as ConnectionProfile;
        }

        if (!connectionProfile) {
            throw new Error("Empty connection profile");
        }

        return connectionProfile;
    }

    public async GetMSP(subscriptionId: string, resourceGroup: string, organizationName: string, managementUri?: string): Promise<MSP> {
        let msp: MSP = (await this.GetProfileFromABS(ProfileType.MSP, organizationName, resourceGroup, subscriptionId, managementUri)) as MSP;

        if (!msp || !msp.msp_id) {
            console.log("Fallback to marketplace based application...");
            msp = (await this.GetProfileFromMarketplaceBasedApp(ProfileType.MSP, organizationName, resourceGroup, subscriptionId, managementUri)) as MSP;
        }

        if (!msp.msp_id || msp.msp_id != organizationName) {
            console.error(chalk.red(`Expected MSP_ID: ${organizationName} but got: ${msp.msp_id}`));
            throw new Error("Wrong msp");
        }

        return msp;
    }

    private async GetProfileFromMarketplaceBasedApp(
        profileType: ProfileType,
        organization: string,
        resourceGroup: string,
        subscriptionId: string,
        managementUri?: string
    ): Promise<AdminProfile | ConnectionProfile | MSP | undefined> {
        const credentials = await this.getCredentials(subscriptionId);

        console.log("Retrieving information about marketplace based application...");

        // get function application name firstly, there should be only one function app in the resource group.
        const functionAppsFilter = "resourceType eq 'Microsoft.Web/sites'";
        const client = new ResourceManagementClient(credentials, subscriptionId, { baseUri: managementUri });
        const funcApps = await client.resources.listByResourceGroup(resourceGroup, { filter: functionAppsFilter, top: 1 });
        if (!funcApps.length || !funcApps[0].name) {
            throw new Error(
                `Could not find function app for marketplace based application in resource group ${resourceGroup} for organization ${organization}`
            );
        }

        // get function key to build needed uri.
        const funcAppName = funcApps[0].name;
        const webAppResourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Web/sites/${funcAppName}`;
        const configManagerFuncName = "ConfigManager";
        const listFunctionKeysUrl = `https://management.azure.com${webAppResourceId}/functions/${configManagerFuncName}/listKeys?api-version=2018-02-01`;

        const token = await credentials.getToken();
        const config: AxiosRequestConfig = {
            headers: { Authorization: `Bearer ${token.accessToken}` }
        };

        const keysResponse = await Axios.post(listFunctionKeysUrl, {}, config);
        if (keysResponse.status != 200) {
            throw new Error(`Can't get keys for ConfigManager function. Response: ${keysResponse.statusText}`);
        }

        // now we have url to the connection manager of marketplace based app
        const defaultKey: string = keysResponse.data.default;
        const configManagerUri = `https://${funcAppName}.azurewebsites.net/api/{action}?code=${defaultKey}`;
        let profileUri: string;
        switch (profileType) {
            case ProfileType.Admin:
                profileUri = configManagerUri.replace("/{action}?", "/admin?");
                break;
            case ProfileType.Connection:
                profileUri = configManagerUri.replace("/{action}?", "/gateway?");
                break;
            case ProfileType.MSP:
                profileUri = configManagerUri.replace("/{action}?", "/msp?");
                break;

            default:
                throw new Error(`Unknown Profile type ${profileType}`);
        }

        console.log(`Retrieving ${ProfileType[profileType]} profile from application...`);
        const response = await Axios.get(profileUri);
        if (response.status != 200) {
            throw new Error(`Can't get ${ProfileType[profileType]} profile. Response: ${response.statusText}`);
        }

        return response.data;
    }

    private async GetProfileFromABS(
        profileType: ProfileType,
        organization: string,
        resourceGroup: string,
        subscriptionId: string,
        managementUri?: string
    ): Promise<AdminProfile | ConnectionProfile | MSP | undefined> {
        const credentials = await this.getCredentials(subscriptionId);

        console.log("Trying to find requested resource in Azure Blockchain Service...");
        const blockchainMembersFilter = `resourceType eq 'Microsoft.Blockchain/blockchainMembers' and name eq '${organization}'`;
        const client = new ResourceManagementClient(credentials, subscriptionId, { baseUri: managementUri });
        const blockchainMembers = await client.resources.listByResourceGroup(resourceGroup, { filter: blockchainMembersFilter, top: 1 });
        if (!blockchainMembers.length || blockchainMembers[0].kind != HyperledgerFabricKind) {
            console.log(`Could not find Azure blockchain Hyperledger Fabric member ${organization} in resource group ${resourceGroup}`);
            return undefined;
        }

        const blockchainMember = blockchainMembers[0];

        let operation: string;
        switch (profileType) {
            case ProfileType.Admin:
                operation = "listAdminCredentials";
                break;
            case ProfileType.Connection:
                operation = "listConnectionProfiles";
                break;
            case ProfileType.MSP:
                operation = "listMemberMSP";
                break;

            default:
                throw new Error(`Unknown Profile type ${profileType}`);
        }

        // request to the ABS for the profile
        const request: RequestPrepareOptions = {
            method: "POST",
            baseUrl: managementUri,
            pathTemplate: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Blockchain/blockchainMembers/${blockchainMember.name}/fabricIdentity/${operation}?api-version=2018-06-01-preview`
        };

        const response = await client.sendRequest(request);
        const body = response.parsedBody;

        return body;
    }

    private async getCredentials(subscriptionId: string): Promise<TokenClientCredentials> {
        if (this.credentials) {
            return this.credentials;
        }

        try {
            // try CLI credentials - will work on Azure Cloud Shell
            this.credentials = await AzureCliCredentials.create({ subscriptionIdOrName: subscriptionId });
        } catch (error) {
            // fallback to interactive login - a bit annoying because is not cached.
            this.credentials = await interactiveLogin();
        }

        return this.credentials;
    }
}
