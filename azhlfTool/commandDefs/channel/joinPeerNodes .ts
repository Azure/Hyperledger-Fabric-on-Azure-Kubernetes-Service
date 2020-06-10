import { Argv } from "yargs";
import { NetworkOperations } from "../../commandHandlers/network-ops";

interface Arguments {
    channelName: string;
    userName: string;
    organization: string;
    ordererOrg: string;
}

export const command = "joinPeerNodes";
export const desc = "Join peer organization nodes to the application channel. Should be called with peer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("channelName", { demandOption: true, requiresArg: true, type: "string", description: "Channel name.", alias: "c" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Organization name which issues request.", alias: "o" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "User name who issues request.", alias: "u" })
        .option("ordererOrg", { demandOption: true, requiresArg: true, type: "string", description: "The orderer organization." }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new NetworkOperations().JoinNodeToChannel(argv.channelName, argv.userName, argv.organization, argv.ordererOrg);
    } catch (error) {
        console.error(error);
    }
};
