import { Argv } from "yargs";

export const command = "msp <command>";
export const desc = "Operations with membership service provider";
export const builder = (yargs: Argv): Argv => yargs.commandDir("msp").demandCommand();
