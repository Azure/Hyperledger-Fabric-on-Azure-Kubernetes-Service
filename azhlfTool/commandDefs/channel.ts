import { Argv } from "yargs";

export const command = "channel <command>";
export const desc = "Channel management commands";
export const builder = (yargs: Argv): Argv => yargs.commandDir("channel").demandCommand();


