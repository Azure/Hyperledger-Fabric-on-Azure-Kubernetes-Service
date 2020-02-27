import { Argv } from "yargs";
import { ConnectionProfileCommandHandler } from "../../../commandHandlers/connectionProfile";

interface Arguments {
    organization: string;
    resourceGroup: string;
    subscriptionId: string;
    managementUri?: string;
}

export const command = "fromAzure";
export const desc = "Import gateway profile from Azure marketplace based HLF app or ABS by provided resource group name and organization.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "The organization name.", alias: "o" })
        .option("resourceGroup", {
            demandOption: true,
            requiresArg: true,
            type: "string",
            description: "The resource group to which app is provisioned.",
            alias: "g"
        })
        .option("subscriptionId", { demandOption: true, requiresArg: true, type: "string", description: "The azure subscription identifier.", alias: "s" })
        .option("managementUri", { hidden: true, requiresArg: true, type: "string", description: "The azure management uri.", alias: "m" })
        .argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ConnectionProfileCommandHandler().importFromAzure(argv.organization, argv.resourceGroup, argv.subscriptionId, argv.managementUri);
    } catch (error) {
        console.error(error);
    }
};
