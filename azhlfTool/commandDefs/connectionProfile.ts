import { Argv } from "yargs";

export const command = "connectionProfile <command>";
export const desc = "Operations with connection profile";
export const builder = (yargs: Argv): Argv => yargs.commandDir("connectionProfile").demandCommand();
