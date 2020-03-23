import { Argv } from "yargs";

export const command = "user <command>";
export const desc = "Commands for registering, enrolling and importing user to the wallet";
export const builder = (yargs: Argv): Argv => yargs.commandDir("user").demandCommand();
