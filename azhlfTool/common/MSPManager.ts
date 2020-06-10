import { join as joinPath, parse } from "path";
import * as chalk from "chalk";
import { readFile, writeFile, pathExists, mkdir, stat, readdir } from "fs-extra";
import { MSP } from "./Interfaces";
import { Constants } from "./Constants";
import { ObjectToString } from "./LogHelper";

export class MSPManager {
    private readonly mspDirectory: string;

    public constructor(){
        this.mspDirectory = joinPath(Constants.StoresPath, "msp");
    }

    public async ImportMsp(organization: string, adminCert: string, rootCert: string, tlsRootCert: string): Promise<string> {
        await this.ensureMspDirectoryExists();
        const mspFilePath = joinPath(this.mspDirectory, `${organization}.json`);
        const orgMsp: MSP = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            msp_id: organization,
            admincerts: adminCert,
            cacerts: rootCert,
            tlscacerts: tlsRootCert
        };
        await writeFile(mspFilePath, ObjectToString(orgMsp));
        return mspFilePath;
    }

    public async GetMsp(organization: string): Promise<MSP> {
        const mspFilePath = joinPath(this.mspDirectory, `${organization}.json`);
        if(!await pathExists(mspFilePath)){
            console.log(chalk.red("MSP for ") + chalk.blue(organization) + chalk.red(" was not found."));
            throw new Error(`MSP file does not exist in ${mspFilePath}`);
        }

        const mspJson = await readFile(mspFilePath, "utf8");
        return JSON.parse(mspJson);
    }

    public async enumerateMSPs(): Promise<string[]>{
        const entries: string[] = [];
        if(!await pathExists(this.mspDirectory)){
            return entries;
        }

        const directoriesAndFiles = await readdir(this.mspDirectory);
        await Promise.all(
            directoriesAndFiles.map(async name => {
                const mspPath = joinPath(this.mspDirectory, name);
                const stats = await stat(mspPath);
                if (stats.isFile()) {
                    entries.push(parse(name).name);
                }
            })
        );

        return entries;
    }

    private async ensureMspDirectoryExists(): Promise<void>{
        if(!await pathExists(this.mspDirectory)){
            await mkdir(this.mspDirectory);
        }
    }
}
