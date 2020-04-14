import { Argv, Arguments } from "yargs";
import { ImportUserCommandHandler } from "../../commandHandlers/user";

interface ImportUserFromProfileArguments {
    resourceGroup: string;
    subscriptionId: string;
    organization: string;
    managementUri?: string;
}

export const command = "import fromAzure";
export const desc = "Import admin identity from Azure marketplace based HLF app or ABS by provided resource group name and organization.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("resourceGroup", {
            demandOption: true,
            requiresArg: true,
            type: "string",
            description: "The resource group to which marketplace app is provisioned.",
            alias: "g"
        })
        .option("subscriptionId", { demandOption: true, requiresArg: true, type: "string", description: "The azure subscription identifier.", alias: "s" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "The organization name.", alias: "o" })
        .option("managementUri", { hidden: true, requiresArg: true, type: "string", description: "The azure management uri.", alias: "m" }).argv;

export const handler = async (argv: ImportUserFromProfileArguments): Promise<void> => {
    try {
        await new ImportUserCommandHandler().ImportAdminFromAzure(argv.organization, argv.resourceGroup, argv.subscriptionId, argv.managementUri);
    } catch (error) {
        console.error(error);
    }
};
