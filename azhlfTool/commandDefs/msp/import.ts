import { Argv } from "yargs";

export const command = "import <source>";
export const desc = "Import MSP commands.";
export const builder = (yargs: Argv): Argv => yargs.commandDir("import").demandCommand();
