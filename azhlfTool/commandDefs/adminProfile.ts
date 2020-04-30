import { Argv } from "yargs";

export const command = "adminProfile <command>";
export const desc = "Commands for importing adminProfile.";
export const builder = (yargs: Argv): Argv => yargs.commandDir("adminProfile").demandCommand();