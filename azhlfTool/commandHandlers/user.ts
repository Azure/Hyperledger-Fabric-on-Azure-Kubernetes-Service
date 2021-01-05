import { readFile } from "fs-extra";
import { X509WalletMixin } from "fabric-network";
import { WalletHelper } from "../common/WalletHelper";
import { AzureBlockchainService } from "../common/AzureBlockchainService";
import { ConnectionProfileManager } from "../common/ConnectionProfileManager";
import { GatewayHelper } from "../common/GatewayHelper";
import * as FabricCAServices from "fabric-ca-client";
import * as chalk from "chalk";
import { AdminProfileManager } from "../common/AdminProfileManager";

export interface ImportUserData {
    wallet: string;
    mspId: string;
    user: string;
    cert: string;
    key: string;
    tlsCert?: string;
    tlsKey?: string;
}

export class ImportUserCommandHandler {
    public async importUserFromFiles(
        organization: string,
        user: string,
        certPath: string,
        keyPath: string,
        tlsCertPath?: string,
        tlsKeyPath?: string
    ): Promise<void> {
        const cert = await readFile(certPath, "utf8");
        const key = await readFile(keyPath, "utf8");
        let tlsCert: string | undefined;
        let tlsKey: string | undefined;

        if (tlsCertPath && tlsKeyPath) {
            tlsCert = await readFile(certPath, "utf8");
            tlsKey = await readFile(keyPath, "utf8");
        }

        const userData: ImportUserData = {
            wallet: organization,
            user: user,
            mspId: organization,
            cert,
            key,
            tlsCert,
            tlsKey
        };

        await this.importUserToWallet(userData);
    }

    public async ImportAdminFromAzure(
        organization: string, 
        resourceGroup: string, 
        subscriptionId: string, 
        importToJSON?: boolean, 
        managementUri?: string
    ): Promise<void> {
        const azureBlockchainService = new AzureBlockchainService();
        const adminProfile = await azureBlockchainService.GetAdminProfile(subscriptionId, resourceGroup, organization, managementUri);

        const certBase64 = Buffer.from(adminProfile.cert, "base64");
        const keyBase64 = Buffer.from(adminProfile.private_key, "base64");
        const tlsCertBase64 = Buffer.from(adminProfile.tls_cert, "base64");
        const tlsKeyBase64 = Buffer.from(adminProfile.tls_private_key, "base64");

        const userData: ImportUserData = {
            mspId: adminProfile.msp_id,
            wallet: organization,
            user: adminProfile.name,
            cert: certBase64.toString("ascii"),
            key: keyBase64.toString("ascii"),
            tlsCert: tlsCertBase64.toString("ascii"),
            tlsKey: tlsKeyBase64.toString("ascii")
        };

        if (importToJSON) {
            const manager = new AdminProfileManager();
            const path = await manager.writeAdminProfile(adminProfile);
            console.log(chalk.green(`\nAdmin profile JSON imported to path: ${path}\n`));
        }

        await this.importUserToWallet(userData);
    }

    public async RegisterUser(organization: string, userName: string, adminName: string, secret?: string): Promise<string> {
        const profile = await new ConnectionProfileManager().getConnectionProfile(organization);

        // check, create and connect gateway.
        const gateway = await GatewayHelper.CreateGateway(adminName, organization, profile);

        // do operations
        try {
	        const admin = gateway.getCurrentIdentity();
            const ca = gateway.getClient().getCertificateAuthority();
            const registerRequest: FabricCAServices.IRegisterRequest = {
                enrollmentID: userName,
                enrollmentSecret: secret,
                role: "client",
                maxEnrollments: 2, // one for common enrollment and the second for tls
                affiliation: ""
            };

            const resultSecret = await ca.register(registerRequest, admin);
            return resultSecret;
        } finally {
            gateway.disconnect();
        }
    }

    public async EnrollUser(organization: string, userName: string, secret: string): Promise<void> {
        const profile = await new ConnectionProfileManager().getConnectionProfile(organization);

        // search for the CA for org.
        const cas = profile.organizations[organization].certificateAuthorities;
        if (!cas || !cas.length) {
            throw new Error(`No one CA for the org ${organization}`);
        }

        const ca = cas[0];
        const caDetails = profile.certificateAuthorities[ca];

        if (!caDetails.url || !caDetails.tlsCACerts) {
            throw new Error(`Invalid CA in connection profile: ${JSON.stringify(caDetails)}`);
        }

        const root = Buffer.from(caDetails.tlsCACerts.pem);
        const caClient = new FabricCAServices(caDetails.url, { trustedRoots: root, verify: true });
        const enrollmentRequest: FabricCAServices.IEnrollmentRequest = {
            enrollmentID: userName,
            enrollmentSecret: secret
        };

        const result = await caClient.enroll(enrollmentRequest);

        const tlsEnrollmentRequest: FabricCAServices.IEnrollmentRequest = {
            enrollmentID: userName,
            enrollmentSecret: secret,
            profile: "tls"
        };

        console.log("Sending request for enroll...");
        const tlsResult = await caClient.enroll(tlsEnrollmentRequest);

        const userData: ImportUserData = {
            mspId: organization,
            wallet: organization,
            user: userName,
            cert: result.certificate,
            key: result.key.toBytes().toString(),
            tlsCert: tlsResult.certificate,
            tlsKey: tlsResult.key.toBytes().toString()
        };

        console.log("Importing enrolled identity to wallet...");
        await this.importUserToWallet(userData);
    }

    public async ListUsers(): Promise<void> {
        const walletNames = await WalletHelper.enumerateWallets();
        if (!walletNames.length) {
            console.log(chalk.yellow("List of organizations is empty. No one user was imported."));
            return;
        }

        console.log("List of users per organization:");
        for (const walletName of walletNames) {
            console.log("  " + chalk.yellow(walletName));
            const wallet = WalletHelper.getWallet(walletName);
            const identities = await wallet.list();
            const users = identities.filter(identity => !identity.label.endsWith(WalletHelper.tlsIdentitySuffix));
            for (const user of users) {
                console.log("    " + chalk.green(user.label));
            }
        }
    }

    private async importUserToWallet(userData: ImportUserData): Promise<void> {
        if (!userData.cert || !userData.key) {
            throw new Error("Certificate and Key should be provided");
        }

        const identity = X509WalletMixin.createIdentity(userData.mspId, userData.cert, userData.key);
        const userName = userData.user;

        const wallet = WalletHelper.getWallet(userData.wallet);
        await wallet.import(userName, identity);

        if (userData.tlsCert && userData.tlsKey) {
            const tlsidentity = X509WalletMixin.createIdentity(userData.mspId, userData.tlsCert, userData.tlsKey);
            await wallet.import(userName + WalletHelper.tlsIdentitySuffix, tlsidentity);
        }

        console.log(chalk.green(`${userName} imported to wallet`));
    }
}
