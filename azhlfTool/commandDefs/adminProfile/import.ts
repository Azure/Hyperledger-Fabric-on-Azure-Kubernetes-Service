import { Argv } from "yargs";
import { ImportUserCommandHandler } from "../../commandHandlers/user";

interface ImportUserFromProfileArguments {
    resourceGroup: string;
    subscriptionId: string;
    organization: string;
    managementUri?: string;
    spnClientId?: string;
    spnClientSecret?: string;
    spnTenantId?: string;
}

export const command = "import <source>";
export const desc = "Import admin profile commands.";
export const builder = (yargs: Argv): Argv => fromAzureCommand(yargs).demandCommand();

const fromAzureCommand = (yargs: Argv): Argv =>
    yargs.command(
        "fromAzure",
        "Import admin identity from Azure marketplace based HLF app or ABS by provided resource group name and organization.",
        (yargs: Argv): ImportUserFromProfileArguments => {
            return yargs
                .option("resourceGroup", {
                    demandOption: true,
                    requiresArg: true,
                    type: "string",
                    description: "The resource group to which app is provisioned.",
                    alias: "g",
                })
                .option("subscriptionId", {
                    demandOption: true,
                    requiresArg: true,
                    type: "string",
                    description: "The azure subscription identifier.",
                    alias: "s",
                })
                .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "The organization name.", alias: "o" })
                .option("managementUri", { hidden: true, requiresArg: true, type: "string", description: "The azure management uri.", alias: "m" })
                .option("spnClientId", { requiresArg: true, type: "string", description: "The service principal client id." })
                .option("spnClientSecret", { requiresArg: true, type: "string", description: "The service principal client secret." })
                .option("spnTenantId", { requiresArg: true, type: "string", description: "The service principal tenant id." })
                .argv;
        },
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (argv: ImportUserFromProfileArguments): Promise<void> => {
            try {
                await new ImportUserCommandHandler().ImportAdminFromAzure(argv.organization, argv.resourceGroup, argv.subscriptionId, argv.managementUri,
                                                                            argv.spnClientId, argv.spnClientSecret, argv.spnTenantId);
            } catch (error) {
                console.error(error);
            }
        }
    );
