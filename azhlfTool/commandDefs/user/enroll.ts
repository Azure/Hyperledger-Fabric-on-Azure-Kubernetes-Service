import { Argv } from "yargs";
import { ImportUserCommandHandler } from "../../commandHandlers/user";

interface Arguments {
    username: string;
    secret: string;
    organization: string;
}

export const command = "enroll";
export const desc = "Enroll user.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("username", { demandOption: true, requiresArg: true, type: "string", description: "The username to be registered.", alias: "u" })
        .option("secret", { demandOption: true, requiresArg: true, type: "string", description: "The temporary secret from user registration.", alias: "s" })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "The organization name.", alias: "o" }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        await new ImportUserCommandHandler().EnrollUser(argv.organization, argv.username, argv.secret);
    } catch (error) {
        console.error(error);
    }
};
