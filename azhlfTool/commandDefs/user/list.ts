import { ImportUserCommandHandler } from "../../commandHandlers/user";

export const command = "list";
export const desc = "List imported users.";

export const handler = async (): Promise<void> => {
    try {
        await new ImportUserCommandHandler().ListUsers();
    } catch (error) {
        console.error(error);
    }
};
