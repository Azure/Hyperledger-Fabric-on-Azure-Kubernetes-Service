import { Argv } from "yargs";

export const command = "chaincode <command>";
export const desc = "Chaincode commands";
export const builder = (yargs: Argv): Argv => yargs.commandDir("chaincode").demandCommand();
