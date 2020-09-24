import { Argv } from "yargs";

export const command = "register <source>";
export const desc = "Register user commands.";
export const builder = (yargs: Argv): Argv => yargs.commandDir("register").demandCommand();