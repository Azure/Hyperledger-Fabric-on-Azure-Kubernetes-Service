import { Argv } from "yargs";
import * as chalk from "chalk";
import { ImportUserCommandHandler } from "../../commandHandlers/user";

interface Arguments {
    username: string;
    adminName: string;
    organization: string;
    secret?: string;
}

export const command = "register";
export const desc = "Register user.";
export const builder = (yargs: Argv): Arguments =>
    yargs
        .option("username", { demandOption: true, requiresArg: true, type: "string", description: "The username to be registered.", alias: "u" })
        .option("secret", { requiresArg: true, type: "string", description: "Optional secret to be registered. Auto generated if not provided.", alias: "s" })
        .option("adminName", {
            demandOption: true,
            requiresArg: true,
            type: "string",
            description: "The name of administrator which will register user.",
            alias: "a"
        })
        .option("organization", { demandOption: true, requiresArg: true, type: "string", description: "The organization name.", alias: "o" }).argv;

export const handler = async (argv: Arguments): Promise<void> => {
    try {
        const secret = await new ImportUserCommandHandler().RegisterUser(argv.organization, argv.username, argv.adminName, argv.secret);
        console.log(`Registered user: ${chalk.green(argv.username)}`);
        console.log(`Temporary secret for enrolling: ${chalk.green(secret)}`);
    } catch (error) {
        console.error(error);
    }
};
