import { Argv } from "yargs";
import { ChaincodeOperations } from "../../commandHandlers/chaincode-ops";
import * as Client from "fabric-client";

const chaincodeTypes: Client.ChaincodeType[] = ["golang", "java", "node"];

interface Arguments {
    name: string;
    version: string;
    path: string;
    language: string;
    organization: string;
    userName: string;
}

export const command = "install";
export const desc = "Installs chaincode to the peers. Should be called with peer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("name", { demandOption: true, requiresArg: true, type: "string", description: "Chaincode identifier.", alias: "n" })
        .option("version", { demandOption: true, requiresArg: true, type: "string", description: "Chaincode version.", alias: "v" })
        .option("path", { demandOption: true, requiresArg: true, type: "string", description: "Path to the source code.", alias: "p" })
        .option("language", { default: "golang", requiresArg: true, type: "string", choices: chaincodeTypes, description: "Chaincode language.", alias: "l" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Organization name which issues request.", alias: "o" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "User name who issues request.", alias: "u" }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ChaincodeOperations().InstallChaincode(
            argv.name,
            argv.version,
            argv.path,
            argv.language as Client.ChaincodeType,
            argv.organization,
            argv.userName
        );
    } catch (error) {
        console.error(error);
    }
};
