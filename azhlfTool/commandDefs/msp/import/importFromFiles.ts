import { Argv } from "yargs";
import { MspCommandHandler } from "../../../commandHandlers/msp";

interface Arguments {
    organization: string;
    root: string;
    tlsroot: string;
}

export const command = "fromFiles";
export const desc = "Imports organization certificates from files.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "The organization name.", alias: "o" })
        .option("root", { demandOption: true, requiresArg: true, type: "string", description: "The path to the CA root certificate file.", alias: "r" })
        .option("tlsroot", { demandOption: true, requiresArg: true, type: "string", description: "The path to the TLS CA root certificate file.", alias: "t" })
        .argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new MspCommandHandler().importFromFiles(argv.organization, argv.root, argv.tlsroot);
    } catch (error) {
        console.error(error);
    }
};
