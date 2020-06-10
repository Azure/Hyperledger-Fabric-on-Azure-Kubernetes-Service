import { Argv } from "yargs";
import { MspCommandHandler } from "../../../commandHandlers/msp";

interface Arguments {
    organization: string;
    fileshare: string;
}

export const command = "fromAzureStorage";
export const desc = "Import MSP from Azure storage.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("organization", {
            demandOption: true,
            requiresArg: true,
            type: "string",
            description: "The organization name.",
            alias: "o"
        })
        .option("fileshare", {
            demandOption: true,
            requiresArg: true,
            type: "string",
            alias: "f",
            description:
                "The azure file share url to download MSP. Should be in format: https://$STORAGE_ACCOUNT.file.core.windows.net/$STORAGE_FILE_SHARE?$SAS_TOKEN. On Windows please wrap argument in triple quotes!"
        }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new MspCommandHandler().importFromAzureStorage(argv.organization, argv.fileshare);
    } catch (error) {
        console.error(error);
    }
};
