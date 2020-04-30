import { Gateway, GatewayOptions } from "fabric-network";
import { WalletHelper } from "./WalletHelper";
import { ConnectionProfile } from "./Interfaces";

export const GatewayHelper = {
    async CreateGateway(identityName: string, walletName: string, connectionProfile: ConnectionProfile): Promise<Gateway> {

        const wallet = WalletHelper.getWallet(walletName);
        if(!await wallet.exists(identityName)){
            throw new Error(`User ${identityName} does not exist in ${walletName} wallet`);
        }

        let clientTlsIdentity: string | undefined = identityName + WalletHelper.tlsIdentitySuffix;
        if(!await wallet.exists(clientTlsIdentity)){
            clientTlsIdentity = undefined;
        }

        const gatewayOptions: GatewayOptions = {
            identity: identityName,
            clientTlsIdentity,
            wallet,
            discovery: {
                asLocalhost: false,
                enabled: true
            }
        };

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, gatewayOptions);

        return gateway;
    }
};
