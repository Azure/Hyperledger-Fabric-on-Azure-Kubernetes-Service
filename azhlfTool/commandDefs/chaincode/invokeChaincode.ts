import { Argv } from "yargs";
import { ChaincodeOperations } from "../../commandHandlers/chaincode-ops";

interface Arguments {
    channel: string;
    name: string;
    func: string;
    args?: string[];
    transient?: string;
    userName: string;
    organization: string;
}

export const command = "invoke";
export const desc = "Invoke chaincode on the application channel. Should be called with peer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .group(["channel", "name", "func", "userName", "organization"], "Required:")
        .group(["args", "transient"], "Optional:")
        .option("channel", { demandOption: true, requiresArg: true, type: "string", description: "Channel name.", alias: "c" })
        .option("name", { demandOption: true, requiresArg: true, type: "string", description: "Chaincode identifier.", alias: "n" })
        .option("func", { demandOption: true, requiresArg: true, type: "string", description: "Function to be invoked.", alias: "f" })
        .option("args", { type: "array", array: true, string: true, description: "Function arguments.", alias: "a" })
        .option("transient", { requiresArg: true, type: "string", description: "Transient(private) data to be sent. Should be valid json.", alias: "t" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "User name who issues request.", alias: "u" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Organization name which issues request.", alias: "o" })
        .example("invoke -c mychannel -n sampleChaincode -f invoke --args accountA accountB 100 -o peerOrgOne -u admin.peerOrgOne","Invoke chaincode with array of arguments.")
        .example("invoke -c mychannel -n marblesPrivate -f initMarble -t '{\\\"marble\\\":{\\\"name\\\":\\\"marble1\\\",\\\"color\\\":\\\"blue\\\",\\\"size\\\":35,\\\"owner\\\":\\\"tom\\\",\\\"price\\\":99}}' -o peerOrgOne -u admin.peerOrgOne","Invoke chaincode with transient(private) data.")
        .argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ChaincodeOperations().InvokeChaincode(argv.channel, argv.name, argv.func, argv.args ?? [], argv.transient , argv.userName, argv.organization);
    } catch (error) {
        console.error(error);
    }
};
