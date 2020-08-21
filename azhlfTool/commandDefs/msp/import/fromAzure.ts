import { Argv } from "yargs";
import { MspCommandHandler } from "../../../commandHandlers/msp";

interface Arguments {
    organization: string;
    resourceGroup: string;
    subscriptionId: string;
    managementUri?: string;
    tenantId?: string;
    spnClientId?: string;
    spnClientSecret?: string;
}

export const command = "fromAzure";
export const desc = "Import MSP from Azure marketplace based HLF app or ABS by provided resource group name and organization.";
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
        .option("tenantId", { hidden: true, requiresArg: true, type: "string", description: "The service principal tenant id.", alias: "t" })
        .option("spnClientId", { hidden: true, requiresArg: true, type: "string", description: "The service principal client id." })
        .option("spnClientSecret", { hidden: true, requiresArg: true, type: "string", description: "The service principal client secret." })
        .argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new MspCommandHandler().importFromAzure(argv.organization, argv.resourceGroup, argv.subscriptionId, argv.managementUri,
                                                        argv.tenantId, argv.spnClientId, argv.spnClientSecret);
    } catch (error) {
        console.error(error);
    }
};
