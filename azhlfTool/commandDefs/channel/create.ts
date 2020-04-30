import { Argv } from "yargs";
import { NetworkOperations } from "../../commandHandlers/network-ops";

interface Arguments {
    channelName: string;
    userName: string;
    organization: string;
}

export const command = "create";
export const desc = "Creates application channel. Should be called with orderer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("channelName", { demandOption: true, requiresArg: true, type: "string", description: "Channel name.", alias: "c" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "User name who issues request.", alias: "u" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Organization name which issues request.", alias: "o" }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new NetworkOperations().CreateApplicationChannel(argv.channelName, argv.userName, argv.organization);
    } catch (error) {
        console.error(error);
    }
};
