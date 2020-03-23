import { Argv } from "yargs";
import { ChaincodeOperations } from "../../commandHandlers/chaincode-ops";

interface Arguments {
    channel: string;
    name: string;
    version: string;
    func?: string;
    args?: string[];
    organization: string;
    userName: string;
}

export const command = "instantiate";
export const desc = "Instantiate chaincode to the application channel. Should be called with peer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .group(["channel", "name", "version", "organization", "userName"], "Required:")
        .group(["func", "args"], "Optional:")
        .option("channel", { demandOption: true, requiresArg: true, type: "string", description: "Channel name.", alias: "c" })
        .option("name", { demandOption: true, requiresArg: true, type: "string", description: "Chaincode identifier.", alias: "n" })
        .option("version", { demandOption: true, requiresArg: true, type: "string", description: "Chaincode version.", alias: "v" })
        .option("func", { type: "string", requiresArg: true, description: "Function to be invoked.", alias: "f" })
        .option("args", { type: "array", array: true, string: true, description: "Arguments.", alias: "a" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Organization name which issues request.", alias: "o" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "User name who issues request.", alias: "u" }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ChaincodeOperations().InstantiateChaincode(
            argv.channel,
            argv.name,
            argv.version,
            argv.func,
            argv.args,
            argv.organization,
            argv.userName
        );
    } catch (error) {
        console.error(error);
    }
};
