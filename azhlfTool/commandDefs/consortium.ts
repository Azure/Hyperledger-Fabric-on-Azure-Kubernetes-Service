import { Argv } from "yargs";

export const command = "consortium <command>";
export const desc = "Consortium management commands";
export const builder = (yargs: Argv): Argv => yargs.commandDir("consortium").demandCommand();