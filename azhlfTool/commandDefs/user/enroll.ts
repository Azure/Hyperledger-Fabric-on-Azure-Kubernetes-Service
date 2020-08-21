import { Argv } from "yargs";

export const command = "enroll <source>";
export const desc = "Enroll user commands.";
export const builder = (yargs: Argv): Argv => yargs.commandDir("enroll").demandCommand();