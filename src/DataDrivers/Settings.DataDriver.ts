import settings from "./data/_settings.json"

export interface SettingsDto {
    tick: string;
    exchange?: string;
    isin: string;
    shares: number;
    targetPercentage: number;
}

export class Settings_DataDriver {

    public async getPortfolio(): Promise<SettingsDto[]> {
        return settings
    }
}
