import { ConnectionProfileCommandHandler } from "../../commandHandlers/connectionProfile";

export const command = "list";
export const desc = "List imported connection profiles.";

export const handler = async (): Promise<void> => {
    try {
        await new ConnectionProfileCommandHandler().listConnectionProfiles();
    } catch (error) {
        console.error(error);
    }
};
