import { MspCommandHandler } from "../../commandHandlers/msp";

export const command = "list";
export const desc = "List imported MSPs.";

export const handler = async (): Promise<void> => {
    try {
        await new MspCommandHandler().listMSPs();
    } catch (error) {
        console.error(error);
    }
};
