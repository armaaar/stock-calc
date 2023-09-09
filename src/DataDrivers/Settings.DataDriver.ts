export interface SettingsDto {
    tick: string;
    exchange?: string;
    isin: string;
    percentage: number;
}

export class Settings_DataDriver {

    public async getPortfolio(): Promise<SettingsDto[]> {
        return [
            {
                tick: 'QDVE',
                exchange: 'IBIS2',
                isin: "IE00B3WJKG14",
                percentage: 0.4,
            },
            {
                tick: 'SPYD',
                exchange: 'IBIS2',
                isin: "IE00B6YX5D40",
                percentage: 0.2,
            },
            {
                tick: 'HDLV',
                exchange: 'SBF',
                isin: "IE00BWTN6Y99",
                percentage: 0.2,
            },
            {
                tick: 'GOLD', // GLDA @ SWB
                exchange: 'SBF',
                isin: "FR0013416716",
                percentage: 0.2,
            }
        ]
    }
}
