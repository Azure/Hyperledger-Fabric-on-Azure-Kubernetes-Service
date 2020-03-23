import { Argv } from "yargs";

export const command = "import <source>";
export const desc = "Import user commands.";
export const builder = (yargs: Argv): Argv => yargs.commandDir("import").demandCommand();
