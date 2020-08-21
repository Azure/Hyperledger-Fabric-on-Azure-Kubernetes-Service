import { Argv } from "yargs";
import { ImportUserCommandHandler } from "../../../commandHandlers/user";

interface Arguments {
    subscription: string;
    resourceGroup: string;
    organization: string;
    tenantId: string
    userName: string;
    role?: string;
    affiliation?: string;
    attrs?: string[];
    spnClientId?: string;
    spnClientSecret?: string;
    managementUri?: string;
    refreshUser?: boolean;
}

export const command = "usingABSCA";
export const desc = "Enroll user using ABS CA.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("subscription", { demandOption: true, requiresArg: true, type: "string", description: "The subscription id of the HLF member.", alias: "s" })
        .option("resourceGroup", { demandOption: true, requiresArg: true, type: "string", description: "The resource group of the HLF member.", alias: "r" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "The HLF member name.", alias: "o" })
        .option("tenantId", { demandOption: true, requiresArg: true, type: "string", description: "The AD App tenant Id for SPN-based authentication.", alias: "t" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "The username of the user for creating the wallet.", alias: "u" })
        .option("role", { requiresArg: true, type: "string", description: "The role claim for fetching certificate." })
        .option("attrs", { requiresArg: true, type: "array", array: true, string: true, description: "The attribute claims for fetching certificate." })
        .option("affiliation", { requiresArg: true, type: "string", description: "The affiliation claim for fetching certificate." })
        .option("spnClientId", { requiresArg: true, type: "string", description: "The service principal client id for SPN-based authentication." })
        .option("spnClientSecret", { requiresArg: true, type: "string", description: "The service principal client secret for SPN-based authentication." })
        .option("managementUri", { hidden: true, requiresArg: true, type: "string", description: "The azure management uri.", alias: "m" })
        .option("refreshUser", { type: "boolean", description: "The bool value for refreshing access token for AD App associated with HLF member." }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ImportUserCommandHandler().EnrollUserUsingABSCA(argv.subscription, argv.resourceGroup, argv.organization, 
                                                                    argv.tenantId, argv.userName, argv.role, argv.affiliation, 
                                                                    argv.attrs, argv.spnClientId, argv.spnClientSecret, 
                                                                    argv.managementUri, argv.refreshUser);
    } catch (error) {
        console.error(error);
    }
};
