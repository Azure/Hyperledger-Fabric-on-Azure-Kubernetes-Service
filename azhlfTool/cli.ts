#!/usr/bin/env node
import * as yargs from "yargs";

yargs
    .commandDir("commandDefs")
    .demandCommand()
    .strict()
    .scriptName(process.platform == "win32" ? "azhlf" : "./azhlf")
    .help(false)
    .version(false)
    .wrap(yargs.terminalWidth())
    .parse();
