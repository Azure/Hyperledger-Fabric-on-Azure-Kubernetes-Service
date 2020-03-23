import { Argv } from "yargs";
import { ConnectionProfileCommandHandler } from "../../../commandHandlers/connectionProfile";

interface Arguments {
    organization: string;
    profile: string;
}

export const command = "fromFile";
export const desc = "Import connection profile from file.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "The organization.", alias: "o" })
        .option("profile", { type: "string", demandOption: true, requiresArg: true, description: "The path to the profile.", alias: "f" }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ConnectionProfileCommandHandler().importFromGatewayFile(argv.organization, argv.profile);
    } catch (error) {
        console.error(error);
    }
};
