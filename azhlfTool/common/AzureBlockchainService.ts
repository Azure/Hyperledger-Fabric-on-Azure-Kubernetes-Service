import Axios, { AxiosResponse, AxiosRequestConfig } from "axios";
import * as chalk from "chalk";
import { Agent } from "https";
import { ResourceManagementClient } from "@azure/arm-resources";
import { ServicePrincipalAuthConfig, UserProfile, UserClaims, ConnectionProfile, AdminProfile, MSP } from "./Interfaces";
import { RequestPrepareOptions } from "@azure/ms-rest-js";
import { AzureIdentity } from "./AzureIdentity";
import { TokenClientCredentials } from "@azure/ms-rest-nodeauth/dist/lib/credentials/tokenClientCredentials";

enum ProfileType {
    Admin,
    Connection,
    MSP
}
const HyperledgerFabricKind = "HyperledgerFabric";

export class AzureBlockchainService {
    public async GetUserProfile(subscriptionId: string, 
                                resourceGroup: string, 
                                organizationName: string,
                                tenantId: string, 
                                enrolmentRequest: UserClaims,
                                userName: string,
                                spnConfig?: ServicePrincipalAuthConfig,
                                managementUri?: string): Promise<UserProfile> {

        // TODO: Improvise interactive login
        // All the login attempts need tenantId for now in case of using ms-rest-nodeauth. 
        // It is known bug in the library: https://github.com/Azure/ms-rest-nodeauth/issues/81
        
        const azureIdentity = new AzureIdentity(subscriptionId, tenantId, spnConfig);
        const credentials = await azureIdentity.getCredentials();

        let memberProperties = await this.getMemberDetails(subscriptionId, resourceGroup, organizationName, credentials, managementUri);

        if (!memberProperties) {
            console.error(chalk.red(`Failed to fetch the member details of provided ABS resource!`));
            throw new Error("Invalid ABS HLF member information");
        }
        
        let abscaADAppId = memberProperties.properties!.certificateAuthority!.applicationId; 
        
        if (!abscaADAppId) {
            console.error(chalk.red(`The application Id of the member AD App cannot be undefined!`));
            throw new Error("Invalid ABS HLF member profile");
        }

        console.log(`\nFetching access token with ABSCA AD App Id: ${abscaADAppId} as the target audience...`);

        const adAppCredentials = await azureIdentity.refreshCredentials(abscaADAppId);
        if (adAppCredentials) {
            const adAppTokenResponse = await adAppCredentials.getToken();

            const caEndpoint = memberProperties.properties!.certificateAuthority!.endpoint;
            const userProfile = await this.getUserProfileFromABSCA(organizationName, caEndpoint, userName, 
                                                                    enrolmentRequest, adAppTokenResponse.accessToken);
            
            return userProfile;
        } else {
            console.error(chalk.red(`Failed to fetch access token with ABSCA AD App Id: ${abscaADAppId} as the target audience!`));
            throw new Error("User could not be enrolled with ABS CA!");
        }
    }

    public async GetAdminProfile(
        subscriptionId: string, 
        resourceGroup: string, 
        organizationName: string, 
        managementUri?: string, 
        tenantId?: string, 
        spnConfig?: ServicePrincipalAuthConfig
    ): Promise<AdminProfile> {

        const azureIdentity = new AzureIdentity(subscriptionId, tenantId, spnConfig);
        const credentials = await azureIdentity.getCredentials();

        let adminProfile: AdminProfile = (await this.GetProfileFromAzureBlockchainService(
            ProfileType.Admin,
            organizationName,
            resourceGroup,
            subscriptionId,
            credentials,
            managementUri
        )) as AdminProfile;

        if (!adminProfile || !adminProfile.msp_id) {
            console.log("Fallback to marketplace based application...");
            adminProfile = (await this.GetProfileFromMarketplaceBasedApp(
                ProfileType.Admin,
                organizationName,
                resourceGroup,
                subscriptionId,
                credentials,
                managementUri
            )) as AdminProfile;
        }

        if (!adminProfile.msp_id || adminProfile.msp_id != organizationName) {
            console.error(chalk.red(`Expected Msp_id in admin profile: ${organizationName} but got: ${adminProfile.msp_id}`));
            throw new Error("Wrong admin profile");
        }

        return adminProfile;
    }

    public async GetConnectionProfile(
        subscriptionId: string,
        resourceGroup: string,
        organizationName: string,
        managementUri?: string,
        tenantId?: string,
        spnConfig?: ServicePrincipalAuthConfig
    ): Promise<ConnectionProfile> {

        const azureIdentity = new AzureIdentity(subscriptionId, tenantId, spnConfig);
        const credentials = await azureIdentity.getCredentials();

        let connectionProfile: ConnectionProfile = (await this.GetProfileFromAzureBlockchainService(
            ProfileType.Connection,
            organizationName,
            resourceGroup,
            subscriptionId,
            credentials,
            managementUri
        )) as ConnectionProfile;

        if (!connectionProfile) {
            console.log("Fallback to marketplace based application...");
            connectionProfile = (await this.GetProfileFromMarketplaceBasedApp(
                ProfileType.Connection,
                organizationName,
                resourceGroup,
                subscriptionId,
                credentials,
                managementUri
            )) as ConnectionProfile;
        }

        if (!connectionProfile) {
            throw new Error("Empty connection profile");
        }

        return connectionProfile;
    }

    public async GetMSP(
        subscriptionId: string, 
        resourceGroup: string, 
        organizationName: string,
        managementUri?: string,
        tenantId?: string,
        spnConfig?: ServicePrincipalAuthConfig
    ): Promise<MSP> {
        
        const azureIdentity = new AzureIdentity(subscriptionId, tenantId, spnConfig);
        const credentials = await azureIdentity.getCredentials();

        let msp: MSP = (await this.GetProfileFromAzureBlockchainService(
            ProfileType.MSP, 
            organizationName, 
            resourceGroup, 
            subscriptionId,
            credentials,
            managementUri
        )) as MSP;

        if (!msp || !msp.msp_id) {
            console.log("Fallback to marketplace based application...");
            msp = (await this.GetProfileFromMarketplaceBasedApp(
                ProfileType.MSP, 
                organizationName, 
                resourceGroup, 
                subscriptionId,
                credentials,
                managementUri
            )) as MSP;
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
        credentials: TokenClientCredentials,
        managementUri?: string
    ): Promise<AdminProfile | ConnectionProfile | MSP | undefined> {

        if (!credentials) {
            console.error(chalk.red(`Could not fetch ${profileType} profile for member: ${organization}`));
            throw new Error(`Failed to initialize credentials for the user or service principal.`);
        }

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

    private async GetProfileFromAzureBlockchainService(
        profileType: ProfileType,
        organization: string,
        resourceGroup: string,
        subscriptionId: string, 
        credentials: TokenClientCredentials,
        managementUri?: string
    ): Promise<AdminProfile | ConnectionProfile | MSP | undefined> {

        if (!credentials) {
            console.error(chalk.red(`Could not fetch ${profileType} profile for member: ${organization}`));
            throw new Error(`Failed to initialize credentials for the user or service principal.`);
        }

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

    private async getMemberDetails(
        subscriptionId: string, 
        resourceGroup: string, 
        organization: string,
        credentials: TokenClientCredentials,
        managementUri?: string
    ): Promise<any> {
        if (!credentials) {
            console.error(chalk.red(`Could not fetch details for the member: ${organization}`));
            throw new Error(`Failed to initialize credentials for the user or service principal.`);
        }

        const baseUri = (managementUri)? managementUri : "https://management.azure.com";

        const agent = new Agent({  
            rejectUnauthorized: false
        });

        const tokenResponse = await credentials.getToken();
        
        const config: AxiosRequestConfig = {
            headers: { 
                Authorization: `Bearer ${tokenResponse.accessToken}`
            },
            responseType: 'json',
            httpsAgent: agent
        };

        const path = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Blockchain/blockchainMembers/${organization}?api-version=2018-06-01-preview`;
        const url = baseUri + path;

        return await Axios.get(url, config).then((memberDetails: AxiosResponse) => {
            if (memberDetails.status !== 200) {
                throw new Error(`Cannot fetch member details. Response: ${memberDetails.statusText}`);
            }
    
            return memberDetails.data;
        }).catch((err: any) => {
            if (err.response) {
                console.log(chalk.red(`Response code from server: ${err.response.status}`));
                throw new Error(`Cannot fetch member details. Response message: ${err.response.statusText}`);
            } else if (err.request) {
                console.log(chalk.red(`Failed to receive response from server. Error encountered: ${err}`));
                throw new Error(`Can't reach server or unauthorized to access server.`);
            } else {
                console.log(chalk.red(`Client side app error encountered.`));
                throw new Error(`The error object: ${err}`);
            }
        });
    }

    public async getUserProfileFromABSCA(
        organizationName: string, 
        caEndpoint: string, 
        userName: string, 
        enrolmentRequest: UserClaims, 
        accessToken: string)
    : Promise<UserProfile> {  
        
        if (!accessToken) { 
            throw new Error(`Access token cannot empty or null!`);
        }

        const url = caEndpoint + "/certificates/enrollment";

        const agent = new Agent({  
            rejectUnauthorized: false
        });

        const config: AxiosRequestConfig = {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            responseType: 'json',
            httpsAgent: agent
        };

        return await Axios.post(url, JSON.stringify(enrolmentRequest), config).then((enrollmentResponse: AxiosResponse) => {
            if (enrollmentResponse.status !== 200) {
                throw new Error(`Can't get enrolment certificate for user. Response: ${enrollmentResponse.statusText}`);
            }

            const userProfile: UserProfile = {
                name: userName,
                msp_id: organizationName,
                cert: enrollmentResponse.data.certificate,
                private_key: enrollmentResponse.data.key
            }
    
            return userProfile;
        }).catch((err: any) => {
            if (err.response) {
                console.log(chalk.red(`Response code from server: ${err.response.status}`));
                throw new Error(`Can't get enrolment certificate for user. Response message: ${err.response.statusText}`);
            } else if (err.request) {
                console.log(chalk.red(`Failed to receive response from server. Error encountered: ${err}`));
                throw new Error(`Can't reach server or unauthorized to access server.`);
            } else {
                console.log(chalk.red(`Client side app error encountered.`));
                throw new Error(`The error object: ${err}`);
            }
        });
    }
}
