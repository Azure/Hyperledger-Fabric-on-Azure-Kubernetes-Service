import Axios, { AxiosResponse, AxiosRequestConfig } from "axios";
import * as chalk from "chalk";
import { Agent } from "https";
import { ResourceManagementClient } from "@azure/arm-resources";
import { InteractiveLoginOptions, loginWithServicePrincipalSecret, interactiveLogin, AzureCliCredentials } from "@azure/ms-rest-nodeauth";
import { ServicePrincipalAuthConfig, UserProfile, UserClaims, ConnectionProfile, AdminProfile, MSP } from "./Interfaces";
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

    private printUserLoginHelp(): void {
        console.log(chalk.yellow(`\nWhile enrolling with user credentials, we need user consent for the AD App to call CA on its behalf.`));
        console.log(chalk.yellow(`For this purpose, please follow the below steps:`));
        console.log(chalk.yellow(`\t1. Add a scope definition in your AD App and enable it.`));
        console.log(chalk.yellow(`\t2. Authorize a client application to access the previously created scope.`));
        console.log(chalk.yellow(`\t\ta. Here we will whitelist the well known Azure CLI client id: 04b07795-8ddb-461a-bbee-02f9e1bf7b46`));
        console.log(chalk.yellow(`\t\tb. Whitelisting the Azure CLI client id will allow the azhlfTool to get a token for performing operations with ABS CA!`));
    }

    public async GetUserProfile(subscriptionId: string, 
                                resourceGroup: string, 
                                organizationName: string,
                                tenantId: string, 
                                enrolmentRequest: UserClaims,
                                spnConfig?: ServicePrincipalAuthConfig,
                                managementUri?: string,
                                refreshUser?: boolean): Promise<UserProfile> {

        // TODO: Improvise interactive login
        // All the login attempts need tenantId for now in case of using ms-rest-nodeauth. 
        // It is known bug in the library: https://github.com/Azure/ms-rest-nodeauth/issues/81
        
        await this.getCredentials(subscriptionId, tenantId, spnConfig);

        let memberProperties = await this.getMemberDetails(subscriptionId, resourceGroup, organizationName, managementUri);

        if (!memberProperties) {
            console.error(chalk.red(`Failed to fetch the member details of provided ABS resource!`));
            throw new Error("Invalid ABS HLF member information");
        }
        
        let abscaADAppId = memberProperties.properties!.certificateAuthority!.applicationId; 
        
        if (!abscaADAppId) {
            console.error(chalk.red(`The application Id of the member AD App cannot be undefined!`));
            throw new Error("Invalid ABS HLF member profile");
        }

        this.printUserLoginHelp();
        console.log(`\nFetching token with ABS CA AD App Id: ${abscaADAppId} as the target audience...`);

        let adAppCredentials: TokenClientCredentials;
        if (spnConfig) {
            // Use SPN based auth if SPN info is provided
            let options: InteractiveLoginOptions = {
                tokenAudience: abscaADAppId
            };
            adAppCredentials = await loginWithServicePrincipalSecret(spnConfig.spnClientId, spnConfig.spnClientSecret, tenantId, options);
        } else if (refreshUser) {
            // User scenario when user wishes to refresh his credentials due to change in AD app claims
            adAppCredentials = await interactiveLogin({ domain: tenantId, tokenAudience: abscaADAppId } as InteractiveLoginOptions);
        } else {
            try {
                // User scenario where user has already logged in through `az login`
                adAppCredentials = await AzureCliCredentials.create({ resource: abscaADAppId });  
            } catch (error) {
                // User scneario where user has not logged in using `az login` or 
                // caching is not configurable on this system.
                console.log(chalk.yellow(`Failed to fetch user credentials from Azure CLI.`));
                console.log(chalk.yellow(`Caching is not configurable on this system or try "az login" command before running "azhlfTool".`));

                console.log(chalk.green(`\nFalling back to interactive login.`));
                
                // fallback to interactive login
                adAppCredentials = await interactiveLogin({ domain: tenantId, tokenAudience: abscaADAppId } as InteractiveLoginOptions);
            }
        }

        const adAppTokenResponse = await adAppCredentials.getToken();

        const caEndpoint = memberProperties.properties!.certificateAuthority!.endpoint;
        const userProfile = await this.getUserProfileFromABSCA(caEndpoint, enrolmentRequest, adAppTokenResponse.accessToken);
        
        return userProfile;
    }

    public async GetAdminProfile(
        subscriptionId: string, 
        resourceGroup: string, 
        organizationName: string, 
        managementUri?: string, 
        tenantId?: string, 
        spnConfig?: ServicePrincipalAuthConfig
    ): Promise<AdminProfile> {

        await this.getCredentials(subscriptionId, tenantId, spnConfig);

        let adminProfile: AdminProfile = (await this.GetProfileFromAzureBlockchainService(
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

    public async GetConnectionProfile(
        subscriptionId: string,
        resourceGroup: string,
        organizationName: string,
        managementUri?: string,
        tenantId?: string,
        spnConfig?: ServicePrincipalAuthConfig
    ): Promise<ConnectionProfile> {

        await this.getCredentials(subscriptionId, tenantId, spnConfig);

        let connectionProfile: ConnectionProfile = (await this.GetProfileFromAzureBlockchainService(
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

    public async GetMSP(
        subscriptionId: string, 
        resourceGroup: string, 
        organizationName: string,
        managementUri?: string,
        tenantId?: string,
        spnConfig?: ServicePrincipalAuthConfig
    ): Promise<MSP> {
        await this.getCredentials(subscriptionId, tenantId, spnConfig);

        let msp: MSP = (await this.GetProfileFromAzureBlockchainService(ProfileType.MSP, organizationName, resourceGroup, subscriptionId, managementUri)) as MSP;

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

        if (!this.credentials) {
            console.error(chalk.red(`Could not fetch ${profileType} profile for member: ${organization}`));
            throw new Error(`Failed to initialize credentials for the user or service principal.`);
        }

        console.log("Retrieving information about marketplace based application...");

        // get function application name firstly, there should be only one function app in the resource group.
        const functionAppsFilter = "resourceType eq 'Microsoft.Web/sites'";
        const client = new ResourceManagementClient(this.credentials, subscriptionId, { baseUri: managementUri });
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

        const token = await this.credentials.getToken();
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
        managementUri?: string
    ): Promise<AdminProfile | ConnectionProfile | MSP | undefined> {

        if (!this.credentials) {
            console.error(chalk.red(`Could not fetch ${profileType} profile for member: ${organization}`));
            throw new Error(`Failed to initialize credentials for the user or service principal.`);
        }

        console.log("Trying to find requested resource in Azure Blockchain Service...");
        const blockchainMembersFilter = `resourceType eq 'Microsoft.Blockchain/blockchainMembers' and name eq '${organization}'`;
        const client = new ResourceManagementClient(this.credentials, subscriptionId, { baseUri: managementUri });
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

    private async getMemberDetails(subscriptionId: string, resourceGroup: string, organization: string, managementUri?: string): Promise<any> {
        if (!this.credentials) {
            console.error(chalk.red(`Could not fetch details for the member: ${organization}`));
            throw new Error(`Failed to initialize credentials for the user or service principal.`);
        }

        const baseUri = (managementUri)? managementUri : "https://management.azure.com";

        const agent = new Agent({  
            rejectUnauthorized: false
        });

        const tokenResponse = await this.credentials.getToken();
        
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

    public async getUserProfileFromABSCA(caEndpoint: string, enrolmentRequest: UserClaims, accessToken: string): Promise<UserProfile> {  
        
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

        const body = {
            type: enrolmentRequest.role,
            affiliation: enrolmentRequest.affiliation,
            attrReqs: enrolmentRequest.attrs
        }

        return await Axios.post(url, JSON.stringify(body), config).then((enrollmentResponse: AxiosResponse) => {
            if (enrollmentResponse.status !== 200) {
                throw new Error(`Can't get enrolment certificate for user. Response: ${enrollmentResponse.statusText}`);
            }

            const userProfile: UserProfile = {
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

    private async getCredentials(subscriptionId: string, tenantId?: string, spnConfig?: ServicePrincipalAuthConfig): Promise<void> {
        if (this.credentials) {
            return;
        }

        try {
            if (spnConfig && tenantId) {
                // If SPN based auth is chosen, then always login using SPN
                this.credentials = await loginWithServicePrincipalSecret(spnConfig.spnClientId, spnConfig.spnClientSecret, tenantId);
            } else {
                // try CLI credentials
                this.credentials = await AzureCliCredentials.create({ subscriptionIdOrName: subscriptionId });
            }
        } catch (error) {
            // fallback to interactive login - not cached.
            this.credentials = await interactiveLogin();
        }
    }
}
