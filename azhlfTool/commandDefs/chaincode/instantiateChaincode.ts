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
    collectionsConfig?: string;
    transient?: string;
    policyConfig?: string;
}

export const command = "instantiate";
export const desc = "Instantiate chaincode to the application channel. Should be called with peer.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .group(["channel", "name", "version", "organization", "userName"], "Required:")
        .group(["func", "args", "collections-config", "transient", "policy-config"], "Optional:")
        .option("channel", { demandOption: true, requiresArg: true, type: "string", description: "Channel name.", alias: "c" })
        .option("name", { demandOption: true, requiresArg: true, type: "string", description: "Chaincode identifier.", alias: "n" })
        .option("version", { demandOption: true, requiresArg: true, type: "string", description: "Chaincode version.", alias: "v" })
        .option("func", { type: "string", requiresArg: true, description: "Function to be invoked.", alias: "f" })
        .option("args", { type: "array", array: true, string: true, description: "Arguments.", alias: "a" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "Organization name which issues request.", alias: "o" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "User name who issues request.", alias: "u" })
        .option("collections-config", { type: "string", requiresArg: true, description: "Path to the collections config file." })
        .option("transient", { requiresArg: true, type: "string", description: "Transient(private) data to be sent. Should be valid json.", alias: "t" })
        .option("policy-config", { type: "string", requiresArg: true, description: "Path to the file with endorsement policy for the chaincode. See examples in: https://hyperledger.github.io/fabric-sdk-node/release-1.4/global.html#ChaincodeInstantiateUpgradeRequest." })
        .example("instantiate -c mychannel -n sampleCC -v v1 -o peerOne -u admin.peerOne -f init -a accountA 100 accountB 200", "Instantiate chaincode and call init function with args.")
        .example("instantiate -c mychannel -n privateMarbles -v v1 -o peerOne -u admin.peerOne --collections-config /samples/chaincode/src/private_marbles/collections_config.json", "Instantiate private marbles sample chaincode.")
        .example("instantiate -c mychannel -n privateCC -v v1 -o peerOne -u admin.peerOne --collections-config /samples/chaincode/src/private_marbles/collections_config.json -t '{\\\"asset\":{\\\"name\\\":\\\"asset1\\\",\\\"price\\\":99}}'", "Instantiate chaincode with private data.")
        .argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ChaincodeOperations().InstantiateChaincode(
            argv.channel,
            argv.name,
            argv.version,
            argv.func,
            argv.args,
            argv.collectionsConfig,
            argv.transient,
            argv.policyConfig,
            argv.organization,
            argv.userName
        );
    } catch (error) {
        console.error(error);
    }
};
