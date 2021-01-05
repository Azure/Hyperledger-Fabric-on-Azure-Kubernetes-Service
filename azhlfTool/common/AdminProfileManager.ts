import { join as joinPath } from "path";
import { readFile, writeFile, pathExists, mkdirp } from "fs-extra";
import { AdminProfile } from "./Interfaces";
import { Constants } from "./Constants";
import { ObjectToString } from "./LogHelper";

export class AdminProfileManager {
    private readonly profilesDirectory: string;

    public constructor(){
        this.profilesDirectory = joinPath(Constants.StoresPath, "adminprofiles");
    }

    public async getAdminProfile(organization: string): Promise<AdminProfile> {
        const adminProfilePath = joinPath(this.profilesDirectory, `${organization}_AdminCredential.json`);
        if (!await pathExists(adminProfilePath)) {
            throw new Error(`Admin profile file ${adminProfilePath} does not exist. You need to import admin profile first.`);
        }

        const adminProfileJSON = await readFile(adminProfilePath, "utf8");
        const adminProfile = JSON.parse(adminProfileJSON);

        return adminProfile;
    }

    public async writeAdminProfile(adminProfile: AdminProfile): Promise<string> {
        await this.ensureDirectoryExists();
        const adminProfilePath = joinPath(this.profilesDirectory, `${adminProfile.msp_id}_AdminCredential.json`);
        await writeFile(adminProfilePath, ObjectToString(adminProfile));
        return adminProfilePath;
    }

    private async ensureDirectoryExists(): Promise<void>{
        if (!await pathExists(this.profilesDirectory)) {
            await mkdirp(this.profilesDirectory);
        }
    }
}