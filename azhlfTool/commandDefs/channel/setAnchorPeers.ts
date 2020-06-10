import { Argv } from "yargs";
import { NetworkOperations } from "../../commandHandlers/network-ops";

interface Arguments {
    channelName: string;
    peer: string[];
    userName: string;
    organization: string;
    ordererOrg?: string;
}

export const command = "setAnchorPeers";
export const desc = "Sets peer organization node(s) as anchor peer(s) for the application channel. Should be called with peer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .group(["channelName", "peer", "organization", "userName"], "Required:")
        .group(["ordererOrg"], "Optional:")
        .option("channelName", { demandOption: true, requiresArg: true, type: "string", description: "Channel name.", alias: "c" })
        .option("peer", { demandOption: true, type: "array", array: true, string: true, description: "Peer node(s).", alias: "p" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Organization name which issues request.", alias: "o" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "User name who issues request.", alias: "u" })
        .option("ordererOrg", { requiresArg: true, type: "string", description: "The orderer organization." })
        .example("setAnchorPeers -c mychannel -p peer1 -o peerOrg1 -u admin.peerOrg1", "Setting single peer as anchor for channel.")
        .example("setAnchorPeers -c mychannel -p peer1 peer2 peer3 -o peerOrg1 -u admin.peerOrg1", "Setting multiple peers as anchor for channel.")
        .example("setAnchorPeers -c mychannel -p -o peerOrg1 -u admin.peerOrg1", "Remove anchor peers for the peer org on channel.").argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new NetworkOperations().SetPeerAsAnchorInChannel(argv.channelName, argv.peer, argv.userName, argv.organization, argv.ordererOrg);
    } catch (error) {
        console.error(error);
    }
};
