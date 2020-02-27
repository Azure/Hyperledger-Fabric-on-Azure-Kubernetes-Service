import { join as joinPath } from "path";
import { Wallet, FileSystemWallet } from "fabric-network";
import { Constants } from "./Constants";
import { stat, readdir } from "fs-extra";

export const WalletHelper = {
    tlsIdentitySuffix: "-tls",
    getWallet(walletName: string): Wallet {
        const walletPath = joinPath(Constants.StoresPath, "wallets", walletName);
        return new FileSystemWallet(walletPath);
    },

    async enumerateWallets(): Promise<string[]> {
        const walletsDirectory = joinPath(Constants.StoresPath, "wallets");
        const directoriesAndFiles = await readdir(walletsDirectory);
        const wallets: string[] = [];
        await Promise.all(
            directoriesAndFiles.map(async name => {
                const walletPath = joinPath(walletsDirectory, name);
                const stats = await stat(walletPath);
                if (stats.isDirectory()) {
                    wallets.push(name);
                }
            })
        );

        return wallets;
    }
};
