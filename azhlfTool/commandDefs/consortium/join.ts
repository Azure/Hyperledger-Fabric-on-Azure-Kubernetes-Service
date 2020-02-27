import { Argv } from "yargs";
import { NetworkOperations } from "../../commandHandlers/network-ops";

interface Arguments {
    peerOrg: string;
    userName: string;
    organization: string;
}

export const command = "join";
export const desc = "Add peer organization to the consortium. Should be called with orderer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "The name of user who issue the request.", alias: "u" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Orderer organization", alias: "o" })
        .option("peerOrg", { demandOption: true, requiresArg: true, type: "string", description: "Peer organization to be added to consortium.", alias: "p" })
        .argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new NetworkOperations().addPeerOrgToConsortium(argv.peerOrg, argv.userName, argv.organization);
    } catch (error) {
        console.error(error);
    }
};
