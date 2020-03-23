#!/usr/bin/env node
import * as yargs from "yargs";

yargs
    .commandDir("commandDefs")
    .demandCommand()
    .scriptName(process.platform == "win32" ? "azhlf" : "./azhlf")
    .help(false)
    .version(false)
    .wrap(Math.min(120, yargs.terminalWidth()))
    .parse();
