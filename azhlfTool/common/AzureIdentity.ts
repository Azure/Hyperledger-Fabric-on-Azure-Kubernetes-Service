import * as chalk from "chalk";
import { TokenClientCredentials } from "@azure/ms-rest-nodeauth/dist/lib/credentials/tokenClientCredentials";
import { AzureTokenCredentialsOptions, InteractiveLoginOptions, loginWithServicePrincipalSecret, interactiveLogin, AzureCliCredentials } from "@azure/ms-rest-nodeauth";
import { ServicePrincipalAuthConfig } from "./Interfaces";

export class AzureIdentity {
    public subscriptionId: string;
    public tenantId?: string;
    public spnConfig?: ServicePrincipalAuthConfig;

    constructor(subscriptionId: string, tenantId?: string, spnConfig?: ServicePrincipalAuthConfig) {
        this.subscriptionId = subscriptionId;
        this.tenantId = tenantId;
        this.spnConfig = spnConfig;
    }

    private printUserLoginHelp(): void {
        console.log(chalk.yellow(`\nWhile enrolling with user credentials, we need user consent for the AD App to call CA on its behalf.`));
        console.log(chalk.yellow(`For this purpose, please follow the below steps:`));
        console.log(chalk.yellow(`\t1. Add a scope definition in your AD App and enable it.`));
        console.log(chalk.yellow(`\t2. Authorize a client application to access the previously created scope.`));
        console.log(chalk.yellow(`\t\ta. Here we will whitelist the well known Azure CLI client id: 04b07795-8ddb-461a-bbee-02f9e1bf7b46`));
        console.log(chalk.yellow(`\t\tb. Whitelisting the Azure CLI client id will allow the azhlfTool to get a token for performing operations with ABS CA!`));
    }

    public async getCredentials(): Promise<TokenClientCredentials> {
        console.log(`Fetching access token for the identity to get the HLF member details...`);

        try {
            if (this.spnConfig && this.tenantId) {
                try {
                    // Use Azure CLI credentials to check if the SPN has already logged in
                    const subscriptionInfo = await AzureCliCredentials.getSubscription(this.subscriptionId);
                    const userType = subscriptionInfo.user.type;
                    const userName = subscriptionInfo.user.name;
                    if (userType === "servicePrincipal" && userName === this.spnConfig.spnClientId) {
                        return await AzureCliCredentials.create({ subscriptionIdOrName: this.subscriptionId });
                    } else {
                        throw new Error();
                    }
                } catch (error) {
                    console.log(chalk.yellow("The given SPN has not logged in using `az login`!"));
                    console.log(chalk.yellow(`Falling back to SPN client id and secret based login.\n`));

                    // If SPN based auth is chosen, then always login using SPN
                    return await loginWithServicePrincipalSecret(this.spnConfig.spnClientId, this.spnConfig.spnClientSecret, this.tenantId);
                }
            } else {
                // try CLI credentials
                return await AzureCliCredentials.create({ subscriptionIdOrName: this.subscriptionId });
            }
        } catch (error) {
            // fallback to interactive login - not cached.
            return await interactiveLogin();
        }
    }

    public async refreshCredentials(tokenAudience: string): Promise<TokenClientCredentials> {
        if (this.spnConfig && this.tenantId) {
            try {
                // Use Azure CLI credentials to check if the SPN has already logged in
                const subscriptionInfo = await AzureCliCredentials.getSubscription(this.subscriptionId);
                const userType = subscriptionInfo.user.type;
                const userName = subscriptionInfo.user.name;
                if (userType === "servicePrincipal" && userName === this.spnConfig.spnClientId) {
                    return await AzureCliCredentials.create({ resource: tokenAudience });
                } else {
                    throw new Error();
                }
            } catch (error) {
                console.log(chalk.yellow("The given SPN has not logged in using `az login`!"));
                console.log(chalk.yellow(`Falling back to SPN client id and secret based login.\n`));

                // Use SPN based auth if SPN has not logged in
                let options: AzureTokenCredentialsOptions = {
                    tokenAudience: tokenAudience
                };
                return await loginWithServicePrincipalSecret(this.spnConfig.spnClientId, this.spnConfig.spnClientSecret, this.tenantId, options);
            }
        } else {
            this.printUserLoginHelp();
            try {
                // User scenario where user has already logged in through `az login`
                return await AzureCliCredentials.create({ resource: tokenAudience }); 
            } catch (error) {
                // User scneario where user has not logged in using `az login` or 
                // caching is not configurable on this system.
                console.log(chalk.yellow(`Failed to fetch user credentials from Azure CLI.`));
                console.log(chalk.yellow(`Caching is not configurable on this system or try "az login" command before running "azhlfTool".`));

                console.log(chalk.yellow(`\nFalling back to interactive login.`));
                
                // fallback to interactive login
                return await interactiveLogin({ domain: this.tenantId, tokenAudience: tokenAudience } as InteractiveLoginOptions);
            }
        }
    }
}