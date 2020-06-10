import { join as joinPath, parse } from "path";
import { readFile, writeFile, pathExists, mkdir, readdir, stat } from "fs-extra";
import { ConnectionProfile } from "./Interfaces";
import { Constants } from "./Constants";
import { ObjectToString } from "./LogHelper";

export class ConnectionProfileManager {
    private readonly profilesDirectory: string;

    public constructor(){
        this.profilesDirectory = joinPath(Constants.StoresPath, "connectionprofiles");
    }

    public async getConnectionProfile(organizationName: string): Promise<ConnectionProfile> {
        const connectionProfilePath = joinPath(this.profilesDirectory, `${organizationName}.json`);
        if (!await pathExists(connectionProfilePath)) {
            throw new Error(`Connection profile file ${connectionProfilePath} does not exist. You need to import connection profile first.`);
        }

        const connectionProfileJSON = await readFile(connectionProfilePath, "utf8");
        const connectionProfile = JSON.parse(connectionProfileJSON);

        return connectionProfile;
    }

    public async WriteConnectionProfile(organization: string, connectionProfile: ConnectionProfile): Promise<string> {
        await this.ensureDirectoryExists();
        const connectionProfilePath = joinPath(this.profilesDirectory, `${organization}.json`);
        await writeFile(connectionProfilePath, ObjectToString(connectionProfile));
        return connectionProfilePath;
    }

    public async enumerateProfiles(): Promise<string[]>{
        const entries: string[] = [];
        if(!await pathExists(this.profilesDirectory)){
            return entries;
        }

        const directoriesAndFiles = await readdir(this.profilesDirectory);
        await Promise.all(
            directoriesAndFiles.map(async name => {
                const mspPath = joinPath(this.profilesDirectory, name);
                const stats = await stat(mspPath);
                if (stats.isFile()) {
                    entries.push(parse(name).name);
                }
            })
        );

        return entries;
    }

    private async ensureDirectoryExists(): Promise<void>{
        if(!await pathExists(this.profilesDirectory)){
            await mkdir(this.profilesDirectory);
        }
    }
}
