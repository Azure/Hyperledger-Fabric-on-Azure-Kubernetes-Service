import { Argv } from "yargs";
import { MspCommandHandler } from "../../commandHandlers/msp";

interface Arguments {
    organization: string;
    fileshare: string;
}

const toAzureStorage = (yargs: Argv): Argv =>
    yargs.command(
        "toAzureStorage",
        "Export MSP to Azure File Share.",
        (yargs: Argv): Arguments => {
            return yargs
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
                        "The azure file share url to upload MSP. Should be in format: https://$STORAGE_ACCOUNT.file.core.windows.net/$STORAGE_FILE_SHARE?$SAS_TOKEN. On Windows please wrap argument in triple quotes!"
                }).argv;
        },
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (argv: Arguments): Promise<void> => {
            try {
                await new MspCommandHandler().exportToAzureStorage(argv.organization, argv.fileshare);
            } catch (error) {
                console.error(error);
            }
        }
    );

export const command = "export <destination>";
export const desc = "Export MSP.";
export const builder = (yargs: Argv): Argv => toAzureStorage(yargs).demandCommand();
