import { Argv } from "yargs";
import { ChaincodeOperations } from "../../commandHandlers/chaincode-ops";

interface Arguments {
    channel: string;
    name: string;
    func: string;
    args?: string[];
    userName: string;
    organization: string;
}

export const command = "query";
export const desc = "Query chaincode on the application channel. Should be called with peer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .group(["channel", "name", "func", "userName", "organization"], "Required:")
        .group(["args"], "Optional:")
        .option("channel", { demandOption: true, requiresArg: true, type: "string", description: "Channel name.", alias: "c" })
        .option("name", { demandOption: true, requiresArg: true, type: "string", description: "Chaincode identifier.", alias: "n" })
        .option("func", { demandOption: true, requiresArg: true, type: "string", description: "Function to be invoked.", alias: "f" })
        .option("args", { type: "array", array: true, string: true, description: "Function arguments.", alias: "a" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "User name who issues request.", alias: "u" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Organization name which issues request.", alias: "o" }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ChaincodeOperations().QueryChaincode(argv.channel, argv.name, argv.func, argv.args ?? [], argv.userName, argv.organization);
    } catch (error) {
        console.error(error);
    }
};
