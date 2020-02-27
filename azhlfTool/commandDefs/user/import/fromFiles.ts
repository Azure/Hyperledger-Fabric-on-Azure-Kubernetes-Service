import { Argv } from "yargs";
import { ImportUserCommandHandler } from "../../../commandHandlers/user";

interface Arguments {
    organization: string;
    user: string;
    certPath: string;
    keyPath: string;
    tlsCertPath?: string;
    tlsKeyPath?: string;
}

export const command = "fromFiles";
export const desc = "Import user identity from provided files with certificates and keys.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .group(["organization", "user", "certPath", "keyPath"], "Required:")
        .option("organization", { type: "string", demandOption: true, requiresArg: true, description: "The organization name", alias: "o" })
        .option("user", { type: "string", demandOption: true, requiresArg: true, description: "The user name", alias: "u" })
        .option("certPath", { type: "string", demandOption: true, requiresArg: true, description: "Path to the identity certificate file." })
        .option("keyPath", { type: "string", demandOption: true, requiresArg: true, description: "Path to the identity private key file." })
        .option("tlsCertPath", { type: "string", requiresArg: true, description: "Path to the tls certificate file." })
        .option("tlsKeyPath", { type: "string", requiresArg: true, description: "Path to the tls private key file." }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ImportUserCommandHandler().importUserFromFiles(argv.organization, argv.user, argv.certPath, argv.keyPath, argv.tlsCertPath, argv.tlsKeyPath);
    } catch (error) {
        console.error(error);
    }
};
