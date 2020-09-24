import { join as joinPath } from "path";
import { readFile, writeFile, pathExists, mkdirp } from "fs-extra";
import { UserProfile } from "./Interfaces";
import { Constants } from "./Constants";
import { ObjectToString } from "./LogHelper";

export class UserProfileManager {
    private readonly profilesDirectory: string;

    public constructor(){
        this.profilesDirectory = joinPath(Constants.StoresPath, "userprofiles");
    }

    public async getUserProfile(organization: string, userName: string): Promise<UserProfile> {
        const userProfilePath = joinPath(this.profilesDirectory, `${organization}`, `${userName}.json`);
        if (!await pathExists(userProfilePath)) {
            throw new Error(`User profile file ${userProfilePath} does not exist. You need to import user profile first.`);
        }

        const userProfileJSON = await readFile(userProfilePath, "utf8");
        const userProfile = JSON.parse(userProfileJSON);

        return userProfile;
    }

    public async writeUserProfile(userProfile: UserProfile): Promise<string> {
        await this.ensureDirectoryExists(userProfile.msp_id);
        const userProfilePath = joinPath(this.profilesDirectory, `${userProfile.msp_id}`, `${userProfile.name}.json`);
        await writeFile(userProfilePath, ObjectToString(userProfile));
        return userProfilePath;
    }

    private async ensureDirectoryExists(organization: string): Promise<void>{
        if (!await pathExists(joinPath(this.profilesDirectory, `${organization}`))) {
            await mkdirp(joinPath(this.profilesDirectory, `${organization}`));
        }
    }
}
