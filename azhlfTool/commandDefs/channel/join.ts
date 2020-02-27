import { Argv } from "yargs";
import { NetworkOperations } from "../../commandHandlers/network-ops";

interface Arguments {
    channelName: string;
    userName: string;
    organization: string;
    peerOrg: string;
}

export const command = "join";
export const desc = "Adds peer organization to the application channel. Should be called with orderer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("channelName", { demandOption: true, requiresArg: true, type: "string", description: "Channel name.", alias: "c" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Organization name which issues request.", alias: "o" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "User name who issues request.", alias: "u" })
        .option("peerOrg", { demandOption: true, requiresArg: true, type: "string", description: "Peer organization to be added to channel.", alias: "p" })
        .argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new NetworkOperations().AddPeerToChannel(argv.channelName, argv.userName, argv.organization, argv.peerOrg);
    } catch (error) {
        console.error(error);
    }
};
