import { Argv } from "yargs";
import { ImportUserCommandHandler } from "../../../commandHandlers/user";

interface Arguments {
    subscription: string;
    resourceGroup: string;
    organization: string;
    tenantId: string
    userName: string;
    type?: string;
    affiliation?: string;
    attrs?: string[];
    spnClientId?: string;
    spnClientSecret?: string;
    managementUri?: string;
    importToJSON?: boolean;
}

export const command = "usingABSCA";
export const desc = "Enroll user using ABS CA.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .group(["subscription", "resourceGroup", "organization", "tenantId", "userName"], "Required:")
        .group(["type", "affiliation", "attrs", "spnClientId", "spnClientSecret", "importToJSON"], "Optional:")
        .option("subscription", { demandOption: true, requiresArg: true, type: "string", description: "The subscription id of the HLF member.", alias: "s" })
        .option("resourceGroup", { demandOption: true, requiresArg: true, type: "string", description: "The resource group of the HLF member.", alias: "r" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "The HLF member name.", alias: "o" })
        .option("tenantId", { demandOption: true, requiresArg: true, type: "string", description: "The Azure AD app tenantId.", alias: "t" })
        .option("userName", { demandOption: true, requiresArg: true, type: "string", description: "The username of the user for creating the wallet.", alias: "u" })
        .option("type", { requiresArg: true, type: "string", description: "The identity type claim for fetching certificate." })
        .option("attrs", { requiresArg: true, type: "array", array: true, string: true, description: "The identity attribute claims for fetching certificate." })
        .option("affiliation", { requiresArg: true, type: "string", description: "The identity affiliation claim for fetching certificate." })
        .option("spnClientId", { requiresArg: true, type: "string", description: "The service principal client id for SPN-based authentication." })
        .option("spnClientSecret", { requiresArg: true, type: "string", description: "The service principal client secret for SPN-based authentication." })
        .option("managementUri", { hidden: true, requiresArg: true, type: "string", description: "The azure management uri.", alias: "m" })
        .option("importToJSON", { type: "boolean", description: "The flag for importing user credentials to JSON file along with wallet creation." })
        .example("usingABSCA -s \"<hlfMemberSubscriptionId>\" -r azhlfToolTest -o Org1 -t \"<adAppTenantId>\" -u \"admin1.Org1\"", "Allow ABS CA to parse default claims from token.")
        .example("usingABSCA -s \"<hlfMemberSubscriptionId>\" -r azhlfToolTest -o Org1 -t \"<adAppTenantId>\" -u \"admin2.Org1\" --type \"admin\" --affiliation \"org1.team1\"", "Enroll an admin user identity with org1.team1 affiliation claim.")
        .example("usingABSCA -s \"<hlfMemberSubscriptionId>\" -r azhlfToolTest -o Org1 -t \"<adAppTenantId>\" -u \"admin2.Org1\" --type \"admin\" --affiliation \"org1.team1\" --attrs \"allow_invoke\"", "Enroll an admin user identity with attribute claims.")
        .example("usingABSCA -s \"<hlfMemberSubscriptionId>\" -r azhlfToolTest -o Org1 -t \"<adAppTenantId>\" -u \"client1.Org1\" --type \"client\" --affiliation \"org1.team1\" --importToJSON", "Enroll a client user identity and store credentials as JSON.")
        .example("usingABSCA -s \"<hlfMemberSubscriptionId>\" -r azhlfToolTest -o Org1 -t \"<adAppTenantId>\" -u \"admin4.Org1\" --type \"admin\" --affiliation \"org1.team1\" --spnClientId \"<spnClientId>\" --spnClientSecret \"<spnClientSecret>\"", "Enroll an admin SPN identity.")
        .argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ImportUserCommandHandler().EnrollUserUsingABSCA(argv.subscription, argv.resourceGroup, argv.organization, 
                                                                    argv.tenantId, argv.userName, argv.type, argv.affiliation, 
                                                                    argv.attrs, argv.spnClientId, argv.spnClientSecret, 
                                                                    argv.managementUri, argv.importToJSON);
    } catch (error) {
        console.error(error);
    }
};
